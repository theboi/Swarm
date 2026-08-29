import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import type { ReadinessEvidence, TaskManifest, TaskManifestTask, TaskReadiness } from "../../shared/contracts.js";

const execFile = promisify(execFileCallback);
const SHA = /\b[0-9a-f]{6,64}\b/i;

export interface BlueprintEvidence {
  code?: "MASTERPLAN_NOT_READY";
  remoteCommit?: string;
  /** Remote-head commits referenced by evidence and verified as integrated ancestors. */
  integratedCommits?: ReadonlySet<string>;
  records: Map<string, string>;
  missingPaths: Set<string>;
}

export interface EvidenceSource {
  fetch(): Promise<string | void>;
  revParse?(): Promise<string>;
  readRemote(path: string, commit: string): Promise<string | undefined>;
  isAncestor?(commit: string, remoteCommit: string): Promise<boolean>;
}

function remoteCommitFrom(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const labelled = text.match(/(?:remoteCommit|Latest integrated `origin\/main` commit[^\n|:]*|Latest `origin\/main` reconciled[^\n|:]*|Authorized `origin\/main` commit[^\n|:]*|Latest proven integration head before this status edit|Accepted app-state commit)\s*[:|]\s*`?([0-9a-f]{6,64})/i);
  return labelled?.[1]?.toLowerCase();
}

function hasBlueprintIdentity(text: string | undefined, blueprintId: string): boolean {
  if (!text) return false;
  const escaped = blueprintId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?:Blueprint:\\s*" + escaped + "\\b|\\|\\s*Blueprint ID\\s*\\|\\s*`" + escaped + "`)", "i").test(text)
    && /origin\/main/i.test(text);
}

function allReferencedPaths(manifest: TaskManifest): string[] {
  return [manifest.masterplanPath, ...manifest.tasks.flatMap((task) => [task.statusPath, task.specificationPath, task.implementationPlanPath, task.uiRequirementsPath, task.uiHandoffPath])]
    .filter((path): path is string => Boolean(path));
}

export async function loadBlueprintEvidence(manifest: TaskManifest, source?: EvidenceSource): Promise<BlueprintEvidence> {
  if (!manifest.masterplanPath.trim()) return { code: "MASTERPLAN_NOT_READY", records: new Map(), missingPaths: new Set() };
  const gitSource: EvidenceSource = source ?? {
    async fetch() { await execFile("git", ["fetch", "origin", "main"]); },
    async revParse() { const { stdout } = await execFile("git", ["rev-parse", "origin/main"]); return stdout.trim(); },
    async readRemote(path, commit) { try { const { stdout } = await execFile("git", ["show", `${commit}:${path}`]); return stdout; } catch { return undefined; } },
    async isAncestor(commit, remoteCommit) { try { await execFile("git", ["merge-base", "--is-ancestor", commit, remoteCommit]); return true; } catch { return false; } },
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
  const integratedCommits = new Set<string>([remoteCommit]);
  const citedCommits = new Set([...records.values()].map(remoteCommitFrom).filter((commit): commit is string => Boolean(commit)));
  await Promise.all([...citedCommits].map(async (commit) => {
    if (commit === remoteCommit || await gitSource.isAncestor?.(commit, remoteCommit)) integratedCommits.add(commit);
  }));
  if (!hasBlueprintIdentity(records.get(manifest.masterplanPath), manifest.blueprintId)) {
    return { code: "MASTERPLAN_NOT_READY", remoteCommit, integratedCommits, records, missingPaths };
  }
  return { remoteCommit, integratedCommits, records, missingPaths };
}

function evidence(code: string, satisfied: boolean, path?: string, commit?: string): ReadinessEvidence {
  return { code, satisfied, path, commit };
}

function statusIsRemoteTerminal(text: string | undefined, remoteCommit: string | undefined, integratedCommits?: ReadonlySet<string>): boolean {
  const committed = remoteCommitFrom(text);
  return Boolean(text && remoteCommit && committed && (integratedCommits?.has(committed) ?? committed === remoteCommit) && /(?:status|state|gate state)\s*[:|][^\n]*(?:complete|completed|passed|amended handoff integrated|worker-authored planning handoff integrated)\b/i.test(text));
}

function planningArtifactsAreRemote(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.specificationPath && task.implementationPlanPath
    && source.records.has(task.specificationPath)
    && source.records.has(task.implementationPlanPath));
}

function planningEvidenceIsComplete(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.statusPath
    && statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits)
    && planningArtifactsAreRemote(task, source));
}

function uiArtifactsAreRemote(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  const handoff = task.uiHandoffPath ? source.records.get(task.uiHandoffPath) : undefined;
  const acceptedCommit = remoteCommitFrom(handoff);
  return Boolean(
    task.uiRequirementsPath
      && task.uiHandoffPath
      && source.records.has(task.uiRequirementsPath)
      && handoff
      && acceptedCommit
      && source.integratedCommits?.has(acceptedCommit)
      && /(?:product[- ]owner|user) approval\s*[|:][^\n]*(?:accepted|approved)/i.test(handoff),
  );
}

function uiEvidenceIsComplete(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(task.statusPath
    && statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits)
    && uiArtifactsAreRemote(task, source));
}

function statusNeedsAttention(text: string | undefined): boolean {
  return Boolean(text && /(?:^|\n)\s*\|?\s*(?:status|state)\s*(?:\||:)\s*(?:review|attention(?:[_ -]required)?|awaiting(?:[_ -](?:approval|review))?|paused)\b/im.test(text));
}

function receiptNamesWorker(line: string, workerId: string): boolean {
  const escaped = workerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[|\\s])${escaped}(?=$|[|\\s])`).test(line);
}

function gateEvidenceIsComplete(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): boolean {
  if (!task.statusPath || !statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits)) return false;
  const receipt = source.records.get(task.statusPath) ?? "";
  if (!source.remoteCommit) return false;
  const integratedCommits = [...(source.integratedCommits ?? new Set([source.remoteCommit]))];
  const hasIntegratedCommit = (line: string) => integratedCommits.some((commit) => line.toLowerCase().includes(commit));
  const ordinaryRowsComplete = [...taskById.values()].filter((candidate) => candidate.kind === "planning").every((planning) =>
    planningEvidenceIsComplete(planning, source)
      && receipt.includes(planning.specificationPath ?? "")
      && receipt.includes(planning.implementationPlanPath ?? "")
      && receipt.split("\n").some((line) => receiptNamesWorker(line, planning.id)
        && /(authority[- ]sync|no[- ]impact)/i.test(line)
        && /reconciled/i.test(line)
        && hasIntegratedCommit(line)));
  const uiRowsComplete = [...taskById.values()].filter((candidate) => candidate.kind === "ui").every((ui) =>
    uiEvidenceIsComplete(ui, source)
      && receipt.split("\n").some((line) => receiptNamesWorker(line, ui.id)
        && line.includes(ui.uiRequirementsPath ?? "")
        && line.includes(ui.uiHandoffPath ?? "")
        && /accepted app/i.test(line)
        && /approval/i.test(line)
        && /live review/i.test(line)
        && /reconciled/i.test(line)
        && /transfer/i.test(line)
        && hasIntegratedCommit(line)));
  return ordinaryRowsComplete && uiRowsComplete;
}

function dependencyTerminal(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): { satisfied: boolean; mismatch: boolean } {
  let mismatch = false;
  const satisfied = task.dependsOn.every((id) => {
    const dependency = taskById.get(id);
    if (!dependency?.statusPath) return false;
    const status = source.records.get(dependency.statusPath);
    const committed = remoteCommitFrom(status);
    if (committed && !(source.integratedCommits?.has(committed) ?? committed === source.remoteCommit)) mismatch = true;
    return statusIsRemoteTerminal(status, source.remoteCommit, source.integratedCommits);
  });
  return { satisfied, mismatch };
}

function dependencyPlanningEvidence(task: TaskManifestTask, taskById: Map<string, TaskManifestTask>, source: BlueprintEvidence): { satisfied: boolean; mismatch: boolean } {
  let mismatch = false;
  const satisfied = task.dependsOn.every((id) => {
    const dependency = taskById.get(id);
    if (!dependency?.statusPath) return false;
    const status = source.records.get(dependency.statusPath);
    const committed = remoteCommitFrom(status);
    if (committed && !(source.integratedCommits?.has(committed) ?? committed === source.remoteCommit)) mismatch = true;
    if (dependency.kind === "planning") return planningEvidenceIsComplete(dependency, source);
    if (dependency.kind === "ui") return uiEvidenceIsComplete(dependency, source);
    if (dependency.kind === "gate") return gateEvidenceIsComplete(dependency, taskById, source);
    return statusIsRemoteTerminal(status, source.remoteCommit, source.integratedCommits);
  });
  return { satisfied, mismatch };
}

export function evaluateTaskReadiness(manifest: TaskManifest, source: BlueprintEvidence): TaskReadiness[] {
  if (source.code === "MASTERPLAN_NOT_READY") {
    return manifest.tasks.map((task) => ({ taskId: task.id, phase: task.kind, state: "blocked", evidence: [evidence("MASTERPLAN_NOT_READY", false)], blockingCodes: ["MASTERPLAN_NOT_READY"] }));
  }

  const taskById = new Map(manifest.tasks.map((task) => [task.id, task]));
  return manifest.tasks.map((task) => {
    const dependencies = task.kind === "execution"
      ? dependencyTerminal(task, taskById, source)
      : dependencyPlanningEvidence(task, taskById, source);
    const ownStatus = task.statusPath ? statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits) : false;
    const planningGate = task.kind === "execution"
      ? task.dependsOn.map((id) => taskById.get(id)).find((candidate): candidate is TaskManifestTask => candidate?.kind === "gate")
      : undefined;
    const gatePassed = task.kind !== "execution" || Boolean(planningGate && gateEvidenceIsComplete(planningGate, taskById, source));
    const uiArtifacts = task.kind === "ui" ? uiArtifactsAreRemote(task, source) : true;
    const requiredPlanning = task.kind === "gate"
      ? gateEvidenceIsComplete(task, taskById, source)
      : task.kind === "planning" ? (ownStatus ? planningArtifactsAreRemote(task, source) : true)
        : task.kind === "ui" ? (ownStatus ? uiArtifacts : true) : true;
    const terminal = task.kind === "gate"
      ? gateEvidenceIsComplete(task, taskById, source)
      : task.kind === "ui" ? uiEvidenceIsComplete(task, source) : ownStatus;
    const ready = dependencies.satisfied && gatePassed && requiredPlanning;
    const blockingCodes = ready ? [] : [dependencies.mismatch ? "REMOTE_EVIDENCE_MISMATCH" : "TASK_NOT_READY"];
    const needsAttention = !terminal && ready && statusNeedsAttention(task.statusPath ? source.records.get(task.statusPath) : undefined);
    const planningArtifacts = task.kind === "planning" ? planningArtifactsAreRemote(task, source) : requiredPlanning;
    return {
      taskId: task.id,
      phase: task.kind,
      state: terminal && ready ? "complete" : needsAttention ? "attention_required" : ready ? "ready" : "blocked",
      evidence: [
        evidence("REMOTE_PREREQUISITES", dependencies.satisfied, undefined, source.remoteCommit),
        evidence("PLANNING_GATE", gatePassed, planningGate?.statusPath ?? task.statusPath, source.remoteCommit),
        evidence("PLANNING_ARTIFACTS", planningArtifacts, task.specificationPath, source.remoteCommit),
        evidence("UI_ARTIFACTS", uiArtifacts, task.uiRequirementsPath, source.remoteCommit),
      ],
      blockingCodes,
    };
  });
}
