import type { AccountId, TranscriptItem } from "../../shared/contracts.js";

export interface TranscriptState {
  items: TranscriptItem[];
  appliedDeltaIds: ReadonlySet<string>;
}

export interface TranscriptScope {
  accountId: AccountId;
  threadId: string;
}

export interface RawThreadTurn {
  id: string;
  startedAt: number | null;
  items: Array<Record<string, unknown>>;
}

const KNOWN_ITEM_TYPES = new Set([
  "userMessage", "hookPrompt", "agentMessage", "plan", "reasoning", "commandExecution", "fileChange", "mcpToolCall",
  "dynamicToolCall", "collabAgentToolCall", "subAgentActivity", "webSearch", "imageView", "sleep", "imageGeneration",
  "enteredReviewMode", "exitedReviewMode", "contextCompaction",
]);

export const initialTranscriptState: TranscriptState = { items: [], appliedDeltaIds: new Set<string>() };

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

function upsert(state: TranscriptState, item: TranscriptItem): TranscriptState {
  const key = itemKey(item);
  const index = state.items.findIndex((candidate) => itemKey(candidate) === key);
  const replacement = index < 0 ? item : { ...item, createdAt: state.items[index].createdAt ?? item.createdAt };
  const items = index < 0 ? [...state.items, replacement] : state.items.map((candidate, candidateIndex) => candidateIndex === index ? replacement : candidate);
  // Stable sort preserves the app-server's exact item order when timestamps are equal or absent.
  items.sort((left, right) => (left.createdAt ?? Number.MAX_SAFE_INTEGER) - (right.createdAt ?? Number.MAX_SAFE_INTEGER));
  return { ...state, items };
}

export function hydrateTranscript(state: TranscriptState, history: TranscriptScope & { turns: RawThreadTurn[] }): TranscriptState {
  let next = state;
  const turns = [...history.turns].sort((left, right) => (left.startedAt ?? Number.MAX_SAFE_INTEGER) - (right.startedAt ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id));
  for (const turn of turns) {
    const createdAt = turn.startedAt === null ? null : turn.startedAt * 1_000;
    for (const item of turn.items) next = upsert(next, normalizeItem(history, turn.id, item, createdAt));
  }
  return next;
}

export function reduceTranscriptEvent(state: TranscriptState, event: { method: string; params: unknown }): TranscriptState {
  const params = asRecord(event.params);
  const scope = { accountId: params.accountId, threadId: params.threadId };
  if (typeof scope.accountId !== "string" || typeof scope.threadId !== "string") return state;
  const typedScope: TranscriptScope = scope as TranscriptScope;
  const turnId = typeof params.turnId === "string" ? params.turnId : null;

  if (event.method === "item/started" || event.method === "item/completed") {
    const item = asRecord(params.item);
    const timestamp = toMillis(event.method === "item/started" ? params.startedAtMs : params.completedAtMs);
    return upsert(state, normalizeItem(typedScope, turnId, item, timestamp));
  }

  if (event.method === "item/commandExecution/outputDelta") {
    const itemId = typeof params.itemId === "string" ? params.itemId : undefined;
    const delta = typeof params.delta === "string" ? params.delta : undefined;
    if (!itemId || delta === undefined) return state;
    const deltaId = typeof params.deltaId === "string" ? `${typedScope.accountId}\u0000${typedScope.threadId}\u0000${turnId ?? ""}\u0000${itemId}\u0000${params.deltaId}` : undefined;
    if (deltaId && state.appliedDeltaIds.has(deltaId)) return state;
    const index = state.items.findIndex((item) => itemKey(item) === itemKey({ ...typedScope, turnId, id: itemId }));
    if (index < 0) return state;
    const target = state.items[index];
    const output = typeof target.payload.aggregatedOutput === "string" ? target.payload.aggregatedOutput : "";
    const updated: TranscriptItem = { ...target, payload: { ...target.payload, aggregatedOutput: `${output}${delta}` } };
    const items = state.items.map((item, itemIndex) => itemIndex === index ? updated : item);
    const appliedDeltaIds = new Set(state.appliedDeltaIds);
    if (deltaId) appliedDeltaIds.add(deltaId);
    return { items, appliedDeltaIds };
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
