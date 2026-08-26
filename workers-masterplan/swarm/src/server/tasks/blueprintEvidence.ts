import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { ReadinessEvidence, TaskManifest, TaskManifestTask, TaskReadiness } from "../../shared/contracts.js";

const execFile = promisify(execFileCallback);
const SHA = /\b[0-9a-f]{6,64}\b/i;

export interface BlueprintEvidence {
  code?: "MASTERPLAN_NOT_READY";
  remoteCommit?: string;
  records: Map<string, string>;
  missingPaths: Set<string>;
}

export interface EvidenceSource {
  fetch(): Promise<string | void>;
  revParse?(): Promise<string>;
  readRemote(path: string, commit: string): Promise<string | undefined>;
}

function remoteCommitFrom(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const labelled = text.match(/(?:remoteCommit|Latest integrated `origin\/main` commit|Authorized `origin\/main` commit)\s*[:|]\s*`?([0-9a-f]{6,64})/i);
  return labelled?.[1]?.toLowerCase();
}

function hasBlueprintIdentity(text: string | undefined, blueprintId: string): boolean {
  if (!text) return false;
  const escaped = blueprintId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?:Blueprint:\\s*" + escaped + "\\b|\\|\\s*Blueprint ID\\s*\\|\\s*`" + escaped + "`)", "i").test(text)
    && /origin\/main/i.test(text);
}

function allReferencedPaths(manifest: TaskManifest): string[] {
  return [manifest.masterplanPath, ...manifest.tasks.flatMap((task) => [task.statusPath, task.specificationPath, task.implementationPlanPath])]
    .filter((path): path is string => Boolean(path));
}

export async function loadBlueprintEvidence(manifest: TaskManifest, source?: EvidenceSource): Promise<BlueprintEvidence> {
  if (!manifest.masterplanPath.trim()) return { code: "MASTERPLAN_NOT_READY", records: new Map(), missingPaths: new Set() };
  const gitSource: EvidenceSource = source ?? {
    async fetch() { await execFile("git", ["fetch", "origin", "main"]); },
    async revParse() { const { stdout } = await execFile("git", ["rev-parse", "origin/main"]); return stdout.trim(); },
    async readRemote(path, commit) { try { const { stdout } = await execFile("git", ["show", `${commit}:${path}`]); return stdout; } catch { return undefined; } },
  };

  const fetchResult = await gitSource.fetch();
  const remoteCommit = (gitSource.revParse ? await gitSource.revParse() : fetchResult)?.trim().toLowerCase();
  if (!remoteCommit || !SHA.test(remoteCommit)) return { code: "MASTERPLAN_NOT_READY", records: new Map(), missingPaths: new Set() };

  const records = new Map<string, string>();
  const missingPaths = new Set<string>();
  await Promise.all(allReferencedPaths(manifest).map(async (path) => {
    const content = await gitSource.readRemote(path, remoteCommit);
    if (content === undefined) missingPaths.add(path);
    else records.set(path, content);
  }));
  if (!hasBlueprintIdentity(records.get(manifest.masterplanPath), manifest.blueprintId)) {
    return { code: "MASTERPLAN_NOT_READY", remoteCommit, records, missingPaths };
  }
  return { remoteCommit, records, missingPaths };
}

function evidence(code: string, satisfied: boolean, path?: string, commit?: string): ReadinessEvidence {
  return { code, satisfied, path, commit };
}

function statusIsRemoteTerminal(text: string | undefined, remoteCommit: string | undefined): boolean {
  const committed = remoteCommitFrom(text);
  return Boolean(text && remoteCommit && committed === remoteCommit && /(?:status|state|gate state)\s*[:|][^\n]*(?:complete|completed|passed)\b/i.test(text));
}

function planningArtifactsAreRemote(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.specificationPath && task.implementationPlanPath
    && source.records.has(task.specificationPath)
    && source.records.has(task.implementationPlanPath));
}

function planningEvidenceIsComplete(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.statusPath
    && statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit)
    && planningArtifactsAreRemote(task, source));
}

function receiptNamesWorker(line: string, workerId: string): boolean {
  const escaped = workerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[|\\s])${escaped}(?=$|[|\\s])`).test(line);
}

function gateEvidenceIsComplete(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): boolean {
  if (!task.statusPath || !statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit)) return false;
  const receipt = source.records.get(task.statusPath) ?? "";
  if (!source.remoteCommit) return false;
  return [...taskById.values()].filter((candidate) => candidate.kind === "planning").every((planning) =>
    planningEvidenceIsComplete(planning, source)
      && receipt.includes(planning.specificationPath ?? "")
      && receipt.includes(planning.implementationPlanPath ?? "")
      && receipt.split("\n").some((line) => receiptNamesWorker(line, planning.id)
        && /(authority[- ]sync|no[- ]impact)/i.test(line)
        && line.toLowerCase().includes(source.remoteCommit!)));
}

function dependencyTerminal(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): { satisfied: boolean; mismatch: boolean } {
  let mismatch = false;
  const satisfied = task.dependsOn.every((id) => {
    const dependency = taskById.get(id);
    if (!dependency?.statusPath) return false;
    const status = source.records.get(dependency.statusPath);
    if (status && remoteCommitFrom(status) !== source.remoteCommit) mismatch = true;
    return statusIsRemoteTerminal(status, source.remoteCommit);
  });
  return { satisfied, mismatch };
}

export function evaluateTaskReadiness(manifest: TaskManifest, source: BlueprintEvidence): TaskReadiness[] {
  if (source.code === "MASTERPLAN_NOT_READY") {
    return manifest.tasks.map((task) => ({ taskId: task.id, phase: task.kind, state: "blocked", evidence: [evidence("MASTERPLAN_NOT_READY", false)], blockingCodes: ["MASTERPLAN_NOT_READY"] }));
  }

  const taskById = new Map(manifest.tasks.map((task) => [task.id, task]));
  return manifest.tasks.map((task) => {
    const dependencies = dependencyTerminal(task, taskById, source);
    const ownStatus = task.statusPath ? statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit) : false;
    const planningGate = task.kind === "execution"
      ? task.dependsOn.map((id) => taskById.get(id)).find((candidate): candidate is TaskManifestTask => candidate?.kind === "gate")
      : undefined;
    const gatePassed = task.kind !== "execution" || Boolean(planningGate && gateEvidenceIsComplete(planningGate, taskById, source));
    const requiredPlanning = task.kind === "gate"
      ? gateEvidenceIsComplete(task, taskById, source)
      : task.kind === "planning" ? (ownStatus ? planningArtifactsAreRemote(task, source) : true) : true;
    const terminal = task.kind === "gate" ? gateEvidenceIsComplete(task, taskById, source) : ownStatus;
    const ready = dependencies.satisfied && gatePassed && requiredPlanning;
    const blockingCodes = ready ? [] : [dependencies.mismatch ? "REMOTE_EVIDENCE_MISMATCH" : "TASK_NOT_READY"];
    return {
      taskId: task.id,
      phase: task.kind,
      state: terminal && ready ? "complete" : ready ? "ready" : "blocked",
      evidence: [
        evidence("REMOTE_PREREQUISITES", dependencies.satisfied, undefined, source.remoteCommit),
        evidence("PLANNING_GATE", gatePassed, planningGate?.statusPath ?? task.statusPath, source.remoteCommit),
        evidence("PLANNING_ARTIFACTS", requiredPlanning, task.specificationPath, source.remoteCommit),
      ],
      blockingCodes,
    };
  });
}
