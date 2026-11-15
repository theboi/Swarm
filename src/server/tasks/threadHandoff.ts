import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import type { AccountId, ChatExecutionSettings, ThreadSummary } from "../../shared/contracts.js";
import { handoffThreadName } from "./handoff.js";

export const MAX_ROLLOUT_BYTES = 128 * 1024 * 1024;

export function decodePrivateRollout(value: unknown): string {
  const encoded = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>).jsonlGzipBase64 : undefined;
  if (typeof encoded !== "string" || !encoded || encoded.length > 64 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("Source rollout payload is invalid");
  try { return gunzipSync(Buffer.from(encoded, "base64"), { maxOutputLength: MAX_ROLLOUT_BYTES }).toString("utf8"); }
  catch { throw new Error("Source rollout payload is invalid"); }
}

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
  const compressed = Buffer.byteLength(input.jsonl, "utf8") > 1024 * 1024;
  const filename = `${handoffFilename(input.sourceAccountId, input.sourceThreadId)}${compressed ? ".gz.b64" : ""}`;
  const contents = compressed ? gzipSync(Buffer.from(input.jsonl, "utf8")).toString("base64") : input.jsonl;
  const partSize = 1024 * 1024;
  const multipart = compressed && contents.length > partSize;
  const attachments: Array<{ name: string; path: string }> = [];
  for (let offset = 0; offset < contents.length || offset === 0; offset += multipart ? partSize : contents.length || 1) {
    const name = multipart ? `${filename}.part-${String(offset / partSize + 1).padStart(3, "0")}` : filename;
    const path = resolve(input.targetWorkspace, name);
    await input.target.writeFile(path, multipart ? contents.slice(offset, offset + partSize) : contents);
    attachments.push({ name, path });
  }

  const threadName = handoffThreadName(input.sourceName);
  await input.target.setThreadName(thread.id, threadName);
  const queuedMessages = input.queuedMessages ?? "";
  const prompt = [
    `Continue the previous chat from source account ${input.sourceAccountId} and source thread ${input.sourceThreadId}.`,
    ...(multipart ? [`Concatenate the ${attachments.length} attached parts in numbered order to reconstruct ${filename} before decoding it.`] : []),
    compressed
      ? `The attached ${filename} is the exact source rollout JSONL, gzip-compressed and base64-encoded. Decode it with base64 -D followed by gunzip, then continue from where the source session left off on target account ${input.targetAccountId}.`
      : `The attached ${filename} contains the exact source rollout JSONL. Continue from where the source session left off on target account ${input.targetAccountId}.`,
    ...(queuedMessages ? ["", queuedMessages] : []),
  ].join("\n");
  await input.target.startTurn({
    threadId: thread.id,
    clientUserMessageId: input.clientUserMessageId,
    text: prompt,
    attachments,
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
