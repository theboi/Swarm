import { createHash } from "node:crypto";
import { resolve } from "node:path";

import type { AccountId, ChatExecutionSettings, ThreadSummary } from "../../shared/contracts.js";
import { handoffThreadName } from "./handoff.js";

export interface JsonlContinuationTarget {
  startThread(): Promise<Record<string, unknown>>;
  writeFile(path: string, contents: string): Promise<void>;
  setThreadName(threadId: string, name: string): Promise<void>;
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

function handoffFilename(sourceAccountId: AccountId, sourceThreadId: string): string {
  const suffix = createHash("sha256").update(`${sourceAccountId}\u0000${sourceThreadId}`).digest("hex").slice(0, 12);
  return `swarm-handoff-${sourceAccountId}-${suffix}.jsonl`;
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
