import { readFile, readdir } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { ACCOUNT_IDS, type AccountId, type ManifestPass, type TaskManifest, type TaskReadiness } from "../../shared/contracts.js";

interface CompletionPassReceipt {
  state: "complete";
  completedBy: AccountId | "coordinator";
  completedAt: string;
}

export interface WorkerCompletionReceipt {
  schemaVersion: 1;
  taskId: string;
  passes: Partial<Record<ManifestPass, CompletionPassReceipt>>;
}

export interface CompletionManifestSnapshot {
  authoritative: boolean;
  receipts: ReadonlyMap<string, WorkerCompletionReceipt>;
  completedTaskIds: ReadonlySet<string>;
}

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
    if (!allowedPasses.includes(pass) || !isRecord(candidate) || candidate.state !== "complete" || typeof candidate.completedBy !== "string" || (candidate.completedBy !== "coordinator" && !ACCOUNT_IDS.includes(candidate.completedBy as AccountId)) || typeof candidate.completedAt !== "string" || !Number.isFinite(Date.parse(candidate.completedAt))) throw new Error(`Invalid ${pass} completion receipt for ${expectedTaskId}`);
    passes[pass] = { state: "complete", completedBy: candidate.completedBy as AccountId | "coordinator", completedAt: candidate.completedAt };
  }
  return { schemaVersion: 1, taskId: expectedTaskId, passes };
}

export function completionReceiptPath(manifest: Pick<TaskManifest, "coordinationRoot">, taskId: string): string {
  return `${manifest.coordinationRoot}/completion-manifest/${taskId.toLowerCase()}.json`;
}

/** Loads collision-safe, worker-owned completion receipts from the pulled repository. */
export async function loadCompletionManifest(manifest: TaskManifest, repositoryRoot: string): Promise<CompletionManifestSnapshot> {
  const root = resolve(repositoryRoot);
  const directory = resolve(root, manifest.coordinationRoot, "completion-manifest");
  if (!inside(root, directory)) throw new Error("Completion manifest is outside repository");
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { authoritative: false, receipts: new Map(), completedTaskIds: new Set() };
    throw error;
  }
  const taskByFilename = new Map(manifest.tasks.map((task) => [`${task.id.toLowerCase()}.json`, task]));
  const receipts = new Map<string, WorkerCompletionReceipt>();
  for (const entry of entries.filter((candidate) => candidate.isFile() && candidate.name.endsWith(".json")).sort((left, right) => left.name.localeCompare(right.name))) {
    const task = taskByFilename.get(entry.name);
    if (!task) throw new Error(`Unknown completion manifest receipt filename: ${entry.name}`);
    const path = resolve(directory, entry.name);
    if (!inside(directory, path)) throw new Error("Completion manifest receipt is outside repository");
    receipts.set(task.id, parseReceipt(JSON.parse(await readFile(path, "utf8")), task.id, task.passes ?? ["planning"]));
  }
  const activePass = manifest.lifecycle?.activePass ?? "planning";
  return { authoritative: true, receipts, completedTaskIds: new Set([...receipts].filter(([, receipt]) => receipt.passes[activePass]?.state === "complete").map(([taskId]) => taskId)) };
}

/** Explicit repository receipts replace status-prose heuristics whenever present. */
export function applyCompletionManifest(manifest: TaskManifest, fallback: readonly TaskReadiness[], completion: CompletionManifestSnapshot): TaskReadiness[] {
  if (!completion.authoritative) return [...fallback];
  const activePass = manifest.lifecycle?.activePass ?? "planning";
  const fallbackById = new Map(fallback.map((task) => [task.taskId, task]));
  return manifest.tasks.map((task) => {
    const completed = completion.completedTaskIds.has(task.id);
    const dependencies = activePass === "execution" ? task.executionDependsOn ?? [] : task.dependsOn;
    const prerequisitesComplete = dependencies.every((taskId) => completion.completedTaskIds.has(taskId));
    const prior = fallbackById.get(task.id);
    const phase = activePass === "execution" ? "execution" : task.kind === "ui" ? "ui" : task.kind;
    return {
      taskId: task.id,
      phase,
      state: completed ? "complete" : prerequisitesComplete ? "ready" : "blocked",
      evidence: [
        { code: "COMPLETION_MANIFEST", satisfied: completed, path: completionReceiptPath(manifest, task.id) },
        { code: "REMOTE_PREREQUISITES", satisfied: prerequisitesComplete, details: dependencies.join(", ") || "none" },
      ],
      blockingCodes: completed || prerequisitesComplete ? [] : ["TASK_NOT_READY"],
      ...(prior?.suggestedAccount ? { suggestedAccount: prior.suggestedAccount } : {}),
    };
  });
}
