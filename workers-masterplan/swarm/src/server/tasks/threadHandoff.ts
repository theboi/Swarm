import { createHash } from "node:crypto";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";

import type { AccountId, ChatExecutionSettings, ThreadSummary } from "../../shared/contracts.js";
import { handoffThreadName } from "./handoff.js";

export interface JsonlContinuationTarget {
  startThread(): Promise<Record<string, unknown>>;
  writeFile(path: string, contents: string): Promise<unknown>;
  setThreadName(threadId: string, name: string): Promise<unknown>;
  startTurn(input: {
    threadId: string;
    clientUserMessageId: string;
    text: string;
    attachments: Array<{ name: string; path: string }>;
    settings?: ChatExecutionSettings;
  }): Promise<unknown>;
}

export interface JsonlContinuationInput {
  sourceAccountId: AccountId;
  sourceThreadId: string;
  sourceName: string | null;
  targetAccountId: AccountId;
  targetWorkspace: string;
  jsonl: string;
  clientUserMessageId: string;
  target: JsonlContinuationTarget;
  normalizeThread(source: Record<string, unknown>): ThreadSummary;
  settings?: ChatExecutionSettings;
  queuedMessages?: string;
}

export interface PrivateRolloutSource {
  listAllThreads(): Promise<Array<Record<string, unknown>>>;
  readFile(path: string): Promise<{ dataBase64: string }>;
}

const THREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROLLOUT_BASE64_BYTES = 64 * 1024 * 1024;

/** Reads a bot-private rollout through the app-server already running as that bot. */
export async function readJsonlFromAppServer(source: PrivateRolloutSource, codexHome: string, threadId: string): Promise<string> {
  if (!THREAD_ID.test(threadId)) throw new Error("Invalid source thread identifier");
  const thread = (await source.listAllThreads()).find((candidate) => candidate.id === threadId);
  const path = thread?.path;
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error("Source rollout path is unavailable");
  const sessionsRoot = resolve(codexHome, "sessions");
  const resolvedPath = resolve(path);
  const withinSessions = relative(sessionsRoot, resolvedPath);
  if (!withinSessions || withinSessions === ".." || withinSessions.startsWith(`..${sep}`) || isAbsolute(withinSessions)
    || !basename(resolvedPath).endsWith(`-${threadId}.jsonl`)) {
    throw new Error("Source rollout is outside the selected profile");
  }
  const result = await source.readFile(resolvedPath);
  if (!result.dataBase64 || result.dataBase64.length > MAX_ROLLOUT_BASE64_BYTES || !/^[A-Za-z0-9+/]*={0,2}$/.test(result.dataBase64)) {
    throw new Error("Source rollout payload is invalid");
  }
  return Buffer.from(result.dataBase64, "base64").toString("utf8");
}

/**
 * Dependencies for a transfer that can continue even when the source app-server
 * is unavailable. The source is represented only by its cached metadata and
 * local rollout JSONL.
 */
export interface MoveWithJsonlInput {
  sourceAccountId: AccountId;
  sourceThreadId: string;
  sourceName: string | null;
  targetAccountId: AccountId;
  targetWorkspace: string;
  clientUserMessageId: string;
  readJsonl(accountId: AccountId, threadId: string): Promise<string>;
  target(): Promise<JsonlContinuationTarget>;
  normalizeThread(source: Record<string, unknown>): ThreadSummary;
  claimResume(): Promise<void>;
  claimAssignment(): Promise<void>;
  restoreResume(): Promise<void>;
  restoreAssignment(): Promise<void>;
  transfer(thread: ThreadSummary): Promise<void>;
  cache(thread: ThreadSummary): void | Promise<void>;
  onAcceptedTransferFailure?(): Promise<void>;
  settings?: ChatExecutionSettings;
  queuedMessages?: string;
}

function handoffFilename(sourceAccountId: AccountId, sourceThreadId: string): string {
  const suffix = createHash("sha256").update(`${sourceAccountId}\u0000${sourceThreadId}`).digest("hex").slice(0, 12);
  return `swarm-handoff-${sourceAccountId.replace(/[^A-Za-z0-9_-]/g, "-")}-${suffix}.jsonl`;
}

export async function createJsonlContinuation(input: JsonlContinuationInput): Promise<ThreadSummary> {
  const rawThread = await input.target.startThread();
  const thread = input.normalizeThread(rawThread);
  const filename = handoffFilename(input.sourceAccountId, input.sourceThreadId);
  const path = resolve(input.targetWorkspace, filename);
  await input.target.writeFile(path, input.jsonl);

  const threadName = handoffThreadName(input.sourceName);
  await input.target.setThreadName(thread.id, threadName);
  const queuedMessages = input.queuedMessages ?? "";
  const prompt = [
    `Continue the previous chat from source account ${input.sourceAccountId} and source thread ${input.sourceThreadId}.`,
    `The attached ${filename} contains the exact source rollout JSONL. Continue from where the source session left off on target account ${input.targetAccountId}.`,
    ...(queuedMessages ? ["", queuedMessages] : []),
  ].join("\n");
  await input.target.startTurn({
    threadId: thread.id,
    clientUserMessageId: input.clientUserMessageId,
    text: prompt,
    attachments: [{ name: filename, path }],
    ...(input.settings ? { settings: input.settings } : {}),
  });

  return { ...thread, name: threadName };
}

/** Creates a target-only JSONL continuation while protecting the source transfer state. */
export async function moveWithJsonl(input: MoveWithJsonlInput): Promise<ThreadSummary> {
  let targetAccepted = false;
  try {
    await input.claimResume();
    await input.claimAssignment();
    const jsonl = await input.readJsonl(input.sourceAccountId, input.sourceThreadId);
    const thread = await createJsonlContinuation({
      sourceAccountId: input.sourceAccountId,
      sourceThreadId: input.sourceThreadId,
      sourceName: input.sourceName,
      targetAccountId: input.targetAccountId,
      targetWorkspace: input.targetWorkspace,
      jsonl,
      clientUserMessageId: input.clientUserMessageId,
      target: await input.target(),
      normalizeThread: input.normalizeThread,
      ...(input.settings ? { settings: input.settings } : {}),
      ...(input.queuedMessages ? { queuedMessages: input.queuedMessages } : {}),
    });
    targetAccepted = true;
    await input.cache(thread);
    await input.transfer(thread);
    return thread;
  } catch (error) {
    if (targetAccepted) await input.onAcceptedTransferFailure?.();
    else {
      await input.restoreResume();
      await input.restoreAssignment();
    }
    throw error;
  }
}
