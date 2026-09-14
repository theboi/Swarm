import type { AccountId, ChatExecutionSettings, ThreadSummary } from "../../shared/contracts.js";
import type { LocalHandoffFile } from "./localHandoffTransport.js";
import { handoffThreadName } from "./handoff.js";

export interface JsonlContinuationTarget {
  startThread(): Promise<Record<string, unknown>>;
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
  jsonl: Buffer;
  copyJsonl(input: { sourceAccountId: AccountId; sourceThreadId: string; targetAccountId: AccountId; targetWorkspace: string; jsonl: Buffer }): Promise<LocalHandoffFile>;
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
  readJsonl(accountId: AccountId, threadId: string): Promise<Buffer>;
  copyJsonl(input: { sourceAccountId: AccountId; sourceThreadId: string; targetAccountId: AccountId; targetWorkspace: string; jsonl: Buffer }): Promise<LocalHandoffFile>;
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

export async function createJsonlContinuation(input: JsonlContinuationInput): Promise<ThreadSummary> {
  const handoff = await input.copyJsonl({
    sourceAccountId: input.sourceAccountId,
    sourceThreadId: input.sourceThreadId,
    targetAccountId: input.targetAccountId,
    targetWorkspace: input.targetWorkspace,
    jsonl: input.jsonl,
  });
  const rawThread = await input.target.startThread();
  const thread = input.normalizeThread(rawThread);

  const threadName = handoffThreadName(input.sourceName);
  await input.target.setThreadName(thread.id, threadName);
  const queuedMessages = input.queuedMessages ?? "";
  const prompt = [
    `Continue the previous chat from source account ${input.sourceAccountId} and source thread ${input.sourceThreadId}.`,
    `The attached ${handoff.filename} contains the exact source rollout JSONL. Continue from where the source session left off on target account ${input.targetAccountId}.`,
    ...(queuedMessages ? ["", queuedMessages] : []),
  ].join("\n");
  await input.target.startTurn({
    threadId: thread.id,
    clientUserMessageId: input.clientUserMessageId,
    text: prompt,
    attachments: [{ name: handoff.filename, path: handoff.path }],
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
      copyJsonl: input.copyJsonl,
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
