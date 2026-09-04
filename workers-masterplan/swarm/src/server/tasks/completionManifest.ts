import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute, relative, resolve } from "node:path";

import { ACCOUNT_IDS, type AccountId, type ManifestPass, type TaskManifest, type TaskReadiness } from "../../shared/contracts.js";

interface CompletionPassReceipt {
  state: "complete";
  completedBy: AccountId;
  completedAt: string;
}

export interface WorkerCompletionReceipt {
  schemaVersion: 1;
  taskId: string;
  passes: Partial<Record<ManifestPass, CompletionPassReceipt>>;
}

export interface CompletionManifestSnapshot {
  revision: string;
  receipts: ReadonlyMap<string, WorkerCompletionReceipt>;
  completedTaskIds: ReadonlySet<string>;
  planningGatePassed?: boolean;
}

export function completedTaskIdsForPass(completion: Pick<CompletionManifestSnapshot, "receipts">, pass: ManifestPass): Set<string> {
  return new Set([...completion.receipts].filter(([, receipt]) => receipt.passes[pass]?.state === "complete").map(([taskId]) => taskId));
}

export interface CompletionManifestSource {
  fetch(repositoryRoot: string): Promise<void>;
  resolveRevision(repositoryRoot: string): Promise<string>;
  readFile(repositoryRoot: string, revision: string, path: string): Promise<string | undefined>;
  isAncestor(repositoryRoot: string, ancestor: string, descendant: string): Promise<boolean>;
}

const execFileAsync = promisify(execFile);

const gitCompletionManifestSource: CompletionManifestSource = {
  fetch: async (repositoryRoot) => { await execFileAsync("git", ["-C", repositoryRoot, "fetch", "origin", "main"]); },
  resolveRevision: async (repositoryRoot) => (await execFileAsync("git", ["-C", repositoryRoot, "rev-parse", "origin/main"])).stdout.trim(),
  readFile: async (repositoryRoot, revision, path) => {
    try { return (await execFileAsync("git", ["-C", repositoryRoot, "show", `${revision}:${path}`], { maxBuffer: 4 * 1024 * 1024 })).stdout; }
    catch (error) {
      const stderr = typeof (error as { stderr?: unknown }).stderr === "string" ? (error as { stderr: string }).stderr : "";
      if (/does not exist in|exists on disk, but not in|path .* not in|Path .* does not exist/.test(stderr)) return undefined;
      throw error;
    }
  },
  isAncestor: async (repositoryRoot, ancestor, descendant) => {
    try { await execFileAsync("git", ["-C", repositoryRoot, "merge-base", "--is-ancestor", ancestor, descendant]); return true; }
    catch (error) {
      if (typeof (error as { code?: unknown }).code === "number" && (error as { code: number }).code === 1) return false;
      throw error;
    }
  },
};

function inside(root: string, candidate: string): boolean {
  const value = relative(root, candidate);
  return value === "" || (!value.startsWith("..") && !isAbsolute(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseReceipt(value: unknown, expectedTaskId: string, allowedPasses: readonly ManifestPass[]): WorkerCompletionReceipt {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.taskId !== expectedTaskId || !isRecord(value.passes)) throw new Error(`Invalid completion manifest receipt filename or schema for ${expectedTaskId}`);
  const passes: Partial<Record<ManifestPass, CompletionPassReceipt>> = {};
  for (const pass of ["planning", "execution"] as const) {
    const candidate = value.passes[pass];
    if (candidate === undefined) continue;
    if (!allowedPasses.includes(pass) || !isRecord(candidate) || candidate.state !== "complete" || typeof candidate.completedBy !== "string" || !ACCOUNT_IDS.includes(candidate.completedBy as AccountId) || typeof candidate.completedAt !== "string" || !Number.isFinite(Date.parse(candidate.completedAt))) throw new Error(`Invalid ${pass} completion receipt for ${expectedTaskId}`);
    passes[pass] = { state: "complete", completedBy: candidate.completedBy as AccountId, completedAt: candidate.completedAt };
  }
  return { schemaVersion: 1, taskId: expectedTaskId, passes };
}

function passedPlanningGateCommit(contents: string | undefined): string | undefined {
  if (contents === undefined || !/^\|\s*Gate state\s*\|\s*passed\s*\|\s*$/m.test(contents)
    || !/^\|\s*Unresolved material contradictions\s*\|\s*none\s*\|\s*$/mi.test(contents)) return undefined;
  return contents.match(/^\|\s*Authorized origin\/main commit\s*\|\s*`([0-9a-f]{40})`\s*\|\s*$/m)?.[1];
}

export function completionReceiptPath(manifest: Pick<TaskManifest, "coordinationRoot">, taskId: string): string {
  return `${manifest.coordinationRoot}/completion-manifest/${taskId.toLowerCase()}.json`;
}

/** Loads collision-safe, worker-owned completion receipts from one fetched origin/main revision. */
export async function loadCompletionManifest(manifest: TaskManifest, repositoryRoot: string, source: CompletionManifestSource = gitCompletionManifestSource): Promise<CompletionManifestSnapshot> {
  const root = resolve(repositoryRoot);
  const directory = resolve(root, manifest.coordinationRoot, "completion-manifest");
  if (!inside(root, directory)) throw new Error("Completion manifest is outside repository");
  await source.fetch(root);
  const revision = await source.resolveRevision(root);
  const markerPath = `${manifest.coordinationRoot}/completion-manifest/README.md`;
  if (await source.readFile(root, revision, markerPath) === undefined) throw new Error("Completion manifest is missing from origin/main");
  const receipts = new Map<string, WorkerCompletionReceipt>();
  for (const task of manifest.tasks) {
    const path = completionReceiptPath(manifest, task.id);
    const absolutePath = resolve(root, path);
    if (!inside(directory, absolutePath)) throw new Error("Completion manifest receipt is outside repository");
    const contents = await source.readFile(root, revision, path);
    if (contents === undefined) continue;
    receipts.set(task.id, parseReceipt(JSON.parse(contents), task.id, task.passes ?? ["planning"]));
  }
  const activePass = manifest.lifecycle?.activePass ?? "planning";
  const gatePath = manifest.lifecycle?.planningGatePath;
  let planningGatePassed = activePass !== "execution" || manifest.lifecycle?.parallelPasses !== false;
  if (!planningGatePassed && gatePath) {
    const authorizedCommit = passedPlanningGateCommit(await source.readFile(root, revision, gatePath));
    planningGatePassed = Boolean(authorizedCommit) && await source.isAncestor(root, authorizedCommit!, revision);
  }
  return { revision, receipts, completedTaskIds: new Set([...receipts].filter(([, receipt]) => receipt.passes[activePass]?.state === "complete").map(([taskId]) => taskId)), planningGatePassed };
}

/** Projects task readiness exclusively from worker-owned origin/main receipts. */
export function applyCompletionManifest(manifest: TaskManifest, completion: CompletionManifestSnapshot): TaskReadiness[] {
  const activePass = manifest.lifecycle?.activePass ?? "planning";
  const completedForPass = new Set([...completion.completedTaskIds, ...completedTaskIdsForPass(completion, activePass)]);
  const planningComplete = completedTaskIdsForPass(completion, "planning");
  const planningGatePassed = activePass !== "execution" || manifest.lifecycle?.parallelPasses !== false || completion.planningGatePassed === true;
  return manifest.tasks.filter((task) => (task.passes ?? ["planning"]).includes(activePass)).map((task) => {
    const completed = completedForPass.has(task.id);
    const dependencies = activePass === "execution" ? task.executionDependsOn ?? [] : task.dependsOn;
    const prerequisitesComplete = dependencies.every((taskId) => completedForPass.has(taskId));
    const ownPlanningComplete = activePass !== "execution" || planningComplete.has(task.id);
    const phase = activePass === "execution" ? "execution" : task.kind === "ui" ? "ui" : task.kind;
    return {
      taskId: task.id,
      phase,
      state: completed ? "complete" : planningGatePassed && prerequisitesComplete && ownPlanningComplete ? "ready" : "blocked",
      evidence: [
        { code: "COMPLETION_MANIFEST", satisfied: completed, path: completionReceiptPath(manifest, task.id) },
        ...(activePass === "execution" ? [{ code: "PLANNING_COMPLETE", satisfied: ownPlanningComplete, path: completionReceiptPath(manifest, task.id), commit: completion.revision }] : []),
        ...(activePass === "execution" && manifest.lifecycle?.parallelPasses === false ? [{ code: "GLOBAL_PLANNING_GATE", satisfied: planningGatePassed, path: manifest.lifecycle.planningGatePath, commit: completion.revision }] : []),
        { code: "REMOTE_PREREQUISITES", satisfied: prerequisitesComplete, details: dependencies.join(", ") || "none" },
      ],
      blockingCodes: completed || (planningGatePassed && prerequisitesComplete && ownPlanningComplete) ? [] : planningGatePassed ? ["TASK_NOT_READY"] : ["PLANNING_GATE_NOT_PASSED"],
    };
  });
}

/** Removes workers that do not own the active pass, such as UI presentation workers in execution. */
export function projectManifestToActivePass(manifest: TaskManifest): TaskManifest {
  const activePass = manifest.lifecycle?.activePass ?? "planning";
  return projectManifestToPass(manifest, activePass);
}

export function projectManifestToPass(manifest: TaskManifest, pass: ManifestPass): TaskManifest {
  return {
    ...manifest,
    lifecycle: manifest.lifecycle ? { ...manifest.lifecycle, activePass: pass } : undefined,
    tasks: manifest.tasks.filter((task) => (task.passes ?? ["planning"]).includes(pass)).map((task) => pass === "execution" ? {
      ...task,
      kind: "execution" as const,
      promptTemplate: "execution" as const,
      dependsOn: task.executionDependsOn ?? [],
    } : { ...task }),
  };
}
