import type { AccountId, TranscriptItem } from "../../shared/contracts.js";

export interface TranscriptState {
  items: TranscriptItem[];
  /**
   * Connection coverage per account/thread. Live output is never guessed to be
   * replay-safe: only a complete `thread/read(includeTurns: true)` history
   * marks a scope complete after a reconnect.
   */
  recoveryByScope: ReadonlyMap<string, TranscriptRecoveryState>;
}

export type TranscriptRecoveryState = "incomplete" | "disconnected" | "recovering" | "complete";

export interface TranscriptScope {
  accountId: AccountId;
  threadId: string;
}

export interface RawThreadTurn {
  id: string;
  startedAt: number | null;
  /** Installed app-server's explicit proof that this turn contains all items. */
  itemsView: "full";
  items: Array<Record<string, unknown>>;
}

const KNOWN_ITEM_TYPES = new Set([
  "userMessage", "hookPrompt", "agentMessage", "plan", "reasoning", "commandExecution", "fileChange", "mcpToolCall",
  "dynamicToolCall", "collabAgentToolCall", "subAgentActivity", "webSearch", "imageView", "sleep", "imageGeneration",
  "enteredReviewMode", "exitedReviewMode", "contextCompaction",
]);

export const initialTranscriptState: TranscriptState = { items: [], recoveryByScope: new Map<string, TranscriptRecoveryState>() };

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toMillis(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeItem(scope: TranscriptScope, turnId: string | null, raw: Record<string, unknown>, createdAt: number | null): TranscriptItem {
  const id = typeof raw.id === "string" && raw.id ? raw.id : `opaque:${turnId ?? "thread"}:${createdAt ?? "unknown"}`;
  const originalType = typeof raw.type === "string" ? raw.type : "unknown";
  const { id: _id, type: _type, status, ...payload } = raw;
  if (!KNOWN_ITEM_TYPES.has(originalType)) {
    return {
      id,
      accountId: scope.accountId,
      threadId: scope.threadId,
      turnId,
      type: "opaque",
      status: null,
      createdAt,
      payload: { originalType, raw: payload },
    };
  }
  return {
    id,
    accountId: scope.accountId,
    threadId: scope.threadId,
    turnId,
    type: originalType,
    status: typeof status === "string" ? status : null,
    createdAt,
    payload,
  };
}

function itemKey(item: Pick<TranscriptItem, "accountId" | "threadId" | "turnId" | "id">): string {
  return `${item.accountId}\u0000${item.threadId}\u0000${item.turnId ?? ""}\u0000${item.id}`;
}

function scopeKey(scope: TranscriptScope): string {
  return `${scope.accountId}\u0000${scope.threadId}`;
}

function withRecoveryState(state: TranscriptState, scope: TranscriptScope, recovery: TranscriptRecoveryState): TranscriptState {
  const recoveryByScope = new Map(state.recoveryByScope);
  recoveryByScope.set(scopeKey(scope), recovery);
  return { ...state, recoveryByScope };
}

export function transcriptRecoveryState(state: TranscriptState, scope: TranscriptScope): TranscriptRecoveryState {
  return state.recoveryByScope.get(scopeKey(scope)) ?? "incomplete";
}

function isFullThreadHistory(history: TranscriptScope & { turns: RawThreadTurn[] }): boolean {
  return Array.isArray(history.turns) && history.turns.every((turn) => {
    const raw = turn as unknown;
    return raw !== null
      && typeof raw === "object"
      && typeof (raw as Record<string, unknown>).id === "string"
      && ((raw as Record<string, unknown>).startedAt === null || typeof (raw as Record<string, unknown>).startedAt === "number")
      && (raw as Record<string, unknown>).itemsView === "full"
      && Array.isArray((raw as Record<string, unknown>).items);
  });
}

function upsert(state: TranscriptState, item: TranscriptItem): TranscriptState {
  const key = itemKey(item);
  const index = state.items.findIndex((candidate) => itemKey(candidate) === key);
  const replacement = index < 0 ? item : { ...item, createdAt: state.items[index].createdAt ?? item.createdAt };
  const items = index < 0 ? [...state.items, replacement] : state.items.map((candidate, candidateIndex) => candidateIndex === index ? replacement : candidate);
  // Stable sort preserves the app-server's exact item order when timestamps are equal or absent.
  items.sort((left, right) => (left.createdAt ?? Number.MAX_SAFE_INTEGER) - (right.createdAt ?? Number.MAX_SAFE_INTEGER));
  return { ...state, items };
}

function reasoningItemIndex(state: TranscriptState, scope: TranscriptScope, turnId: string | null, itemId: string): number {
  return state.items.findIndex((item) => itemKey(item) === itemKey({ ...scope, turnId, id: itemId }) && item.type === "reasoning");
}

function appendReasoningSummary(state: TranscriptState, scope: TranscriptScope, turnId: string | null, itemId: string, delta: string, summaryIndex?: number): TranscriptState {
  const index = reasoningItemIndex(state, scope, turnId, itemId);
  if (index < 0) return state;
  const item = state.items[index];
  const summary = Array.isArray(item.payload.summary) ? item.payload.summary.filter((part): part is string => typeof part === "string") : [];
  const targetIndex = typeof summaryIndex === "number" && summaryIndex >= 0 && Number.isInteger(summaryIndex) ? summaryIndex : Math.max(0, summary.length - 1);
  while (summary.length <= targetIndex) summary.push("");
  summary[targetIndex] = `${summary[targetIndex]}${delta}`;
  const updated: TranscriptItem = { ...item, payload: { ...item.payload, summary } };
  return { ...state, items: state.items.map((candidate, candidateIndex) => candidateIndex === index ? updated : candidate) };
}

/**
 * Replaces a single scope solely from a full `thread/read(includeTurns: true)`
 * payload. This deliberately does not attempt output-delta deduplication:
 * identical deltas can be distinct output, while history is authoritative.
 */
export function replaceTranscriptFromThreadRead(state: TranscriptState, history: TranscriptScope & { turns: RawThreadTurn[] }): TranscriptState {
  if (!isFullThreadHistory(history)) return state;
  const scopeItems = state.items.filter((item) => item.accountId !== history.accountId || item.threadId !== history.threadId);
  let next: TranscriptState = { ...state, items: scopeItems };
  const turns = [...history.turns].sort((left, right) => (left.startedAt ?? Number.MAX_SAFE_INTEGER) - (right.startedAt ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
  for (const turn of turns) {
    const createdAt = turn.startedAt === null ? null : turn.startedAt * 1_000;
    for (const item of turn.items) next = upsert(next, normalizeItem(history, turn.id, item, createdAt));
  }
  return withRecoveryState(next, history, "complete");
}

/** Backwards-compatible name for the only authoritative transcript hydration path. */
export const hydrateTranscript = replaceTranscriptFromThreadRead;

export function reduceTranscriptEvent(state: TranscriptState, event: { method: string; params: unknown }): TranscriptState {
  const params = asRecord(event.params);
  const scope = { accountId: params.accountId, threadId: params.threadId };
  if (typeof scope.accountId !== "string" || typeof scope.threadId !== "string") return state;
  const typedScope: TranscriptScope = scope as TranscriptScope;
  const turnId = typeof params.turnId === "string" ? params.turnId : null;

  if (event.method === "transcript/disconnected") return withRecoveryState(state, typedScope, "disconnected");
  if (event.method === "transcript/recoveryStarted") return withRecoveryState(state, typedScope, "recovering");

  const recovery = transcriptRecoveryState(state, typedScope);
  if (recovery === "disconnected" || recovery === "recovering") return state;

  if (event.method === "item/started" || event.method === "item/completed") {
    const item = asRecord(params.item);
    const timestamp = toMillis(event.method === "item/started" ? params.startedAtMs : params.completedAtMs);
    return upsert(state, normalizeItem(typedScope, turnId, item, timestamp));
  }

  if (event.method === "item/commandExecution/outputDelta") {
    const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
    const delta = typeof params.delta === "string" ? params.delta : undefined;
    if (!itemId || delta === undefined) return state;
    const index = state.items.findIndex((item) => itemKey(item) === itemKey({ ...typedScope, turnId, id: itemId }));
    if (index < 0) return state;
    const target = state.items[index];
    const output = typeof target.payload.aggregatedOutput === "string" ? target.payload.aggregatedOutput : "";
    const updated: TranscriptItem = { ...target, payload: { ...target.payload, aggregatedOutput: `${output}${delta}` } };
    const items = state.items.map((item, itemIndex) => itemIndex === index ? updated : item);
    return { ...state, items };
  }

  if (event.method === "item/reasoning/summaryPartAdded") {
    const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
    const part = asRecord(params.part);
    const text = typeof part.text === "string" ? part.text : typeof params.text === "string" ? params.text : "";
    const summaryIndex = typeof params.summaryIndex === "number" ? params.summaryIndex : undefined;
    if (!itemId) return state;
    return appendReasoningSummary(state, typedScope, turnId, itemId, text, summaryIndex);
  }

  if (event.method === "item/reasoning/summaryTextDelta") {
    const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
    const delta = typeof params.delta === "string" ? params.delta : undefined;
    const summaryIndex = typeof params.summaryIndex === "number" ? params.summaryIndex : undefined;
    if (!itemId || delta === undefined) return state;
    return appendReasoningSummary(state, typedScope, turnId, itemId, delta, summaryIndex);
  }

  return state;
}

/** Extract potential Markdown references; containment is enforced by the file reader before use. */
export function extractMarkdownPaths(text: string): string[] {
  const paths = new Set<string>();
  const pattern = /(?:^|[\s(])((?:\.{1,2}\/|\/)?[A-Za-z0-9_./-]+?\.(?:md|markdown))(?=$|[\s,)\]])/gi;
  for (const match of text.matchAll(pattern)) paths.add(match[1]);
  return [...paths];
}
