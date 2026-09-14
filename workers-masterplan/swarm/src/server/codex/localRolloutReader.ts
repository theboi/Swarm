import { createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";

import type { RawThreadTurn } from "./transcriptReducer.js";

type CachedTurn = Omit<RawThreadTurn, "items"> & { items: Map<string, Record<string, unknown>> };
type CachedRollout = { path: string; offset: number; pending: string; turns: Map<string, CachedTurn> };

const RECENT_ACTIVITY_WINDOW_MS = 5 * 60_000;

const threadIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const itemTypes: Record<string, string> = {
  UserMessage: "userMessage", AgentMessage: "agentMessage", Reasoning: "reasoning", CommandExecution: "commandExecution",
  FileChange: "fileChange", McpToolCall: "mcpToolCall", DynamicToolCall: "dynamicToolCall", CollabAgentToolCall: "collabAgentToolCall",
  SubAgentActivity: "subAgentActivity", ContextCompaction: "contextCompaction",
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function contentText(value: unknown): string {
  if (!Array.isArray(value)) return typeof value === "string" ? value : "";
  return value.flatMap((part) => typeof record(part)?.text === "string" ? [record(part)!.text as string] : []).join("");
}

function normalizeChanges(value: unknown): Array<{ path: string; kind: string }> {
  if (Array.isArray(value)) return value.flatMap((change) => {
    const item = record(change);
    return typeof item?.path === "string" ? [{ path: item.path, kind: typeof item.kind === "string" ? item.kind : "changed" }] : [];
  });
  const changes = record(value);
  if (!changes) return [];
  return Object.entries(changes).map(([path, change]) => ({ path, kind: typeof record(change)?.kind === "string" ? record(change)!.kind as string : "changed" }));
}

function normalizeRolloutItem(value: unknown): Record<string, unknown> | undefined {
  const item = record(value);
  if (!item || typeof item.id !== "string" || typeof item.type !== "string") return undefined;
  const type = itemTypes[item.type] ?? "opaque";
  if (type === "userMessage") return { id: item.id, type, content: Array.isArray(item.content) ? item.content : [] };
  if (type === "agentMessage") return { id: item.id, type, text: contentText(item.content), phase: item.phase };
  if (type === "reasoning") return { id: item.id, type, summary: Array.isArray(item.summary_text) ? item.summary_text : [] };
  if (type === "commandExecution") return { id: item.id, type, command: item.command, cwd: item.cwd, status: item.status, aggregatedOutput: item.aggregated_output };
  if (type === "fileChange") return { id: item.id, type, status: item.status, changes: normalizeChanges(item.changes) };
  if (type === "opaque") return { id: item.id, type: item.type, raw: item };
  return { ...item, type };
}

async function findRollout(directory: string, threadId: string): Promise<string | undefined> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return undefined; }
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(`-${threadId}.jsonl`)) return path;
    if (entry.isDirectory()) {
      const nested = await findRollout(path, threadId);
      if (nested) return nested;
    }
  }
  return undefined;
}

/** Read-only transcript fallback for a local rollout whose writer is owned by Codex desktop. */
export class LocalRolloutTranscriptReader {
  private readonly cache = new Map<string, CachedRollout>();
  constructor(private readonly codexHome: string) {}

  async readThread(threadId: string): Promise<{ thread: { id: string; turns: RawThreadTurn[] } }> {
    let cached = this.cache.get(threadId);
    if (!cached) {
      const path = await this.rolloutPath(threadId);
      cached = { path, offset: 0, pending: "", turns: new Map() };
      this.cache.set(threadId, cached);
    }
    const size = (await stat(cached.path)).size;
    if (size < cached.offset) { cached.offset = 0; cached.pending = ""; cached.turns.clear(); }
    if (size > cached.offset) await this.readAppended(cached);
    return { thread: { id: threadId, turns: [...cached.turns.values()].map((turn) => ({ id: turn.id, startedAt: turn.startedAt, ...(turn.status ? { status: turn.status } : {}), ...(turn.error ? { error: turn.error } : {}), ...(turn.clientUserMessageId ? { clientUserMessageId: turn.clientUserMessageId } : {}), itemsView: "full", items: [...turn.items.values()] })) } };
  }

  async readJsonl(threadId: string): Promise<Buffer> {
    return readFile(await this.rolloutPath(threadId));
  }

  async readRecentActivity(threadId: string, now = Date.now()): Promise<{ activity: "active" | "idle"; turnId?: string } | undefined> {
    const result = await this.readThread(threadId);
    const latest = result.thread.turns.at(-1);
    if (!latest) return undefined;
    if (latest.status !== "inProgress") return { activity: "idle" };
    const cached = this.cache.get(threadId);
    if (!cached) return undefined;
    const modifiedAt = (await stat(cached.path)).mtimeMs;
    return now - modifiedAt <= RECENT_ACTIVITY_WINDOW_MS
      ? { activity: "active", turnId: latest.id }
      : { activity: "idle" };
  }

  private async rolloutPath(threadId: string): Promise<string> {
    if (!threadIdPattern.test(threadId)) throw new Error("Invalid local thread identifier");
    const path = await findRollout(join(this.codexHome, "sessions"), threadId);
    if (!path) throw new Error("Local rollout transcript not found");
    return path;
  }

  private async readAppended(cached: CachedRollout): Promise<void> {
    const decoder = new StringDecoder("utf8");
    for await (const chunk of createReadStream(cached.path, { start: cached.offset })) {
      const bytes = chunk as Buffer;
      cached.offset += bytes.byteLength;
      const lines = `${cached.pending}${decoder.write(bytes)}`.split("\n");
      cached.pending = lines.pop() ?? "";
      for (const line of lines) this.consumeLine(cached, line);
    }
    cached.pending += decoder.end();
  }

  private consumeLine(cached: CachedRollout, line: string): void {
    if (!line) return;
    let envelope: Record<string, unknown> | undefined;
    try { envelope = record(JSON.parse(line)); } catch { return; }
    if (envelope?.type !== "event_msg") return;
    const payload = record(envelope.payload);
    if (!payload || typeof payload.turn_id !== "string") return;
    const timestampMs = typeof payload.started_at_ms === "number"
      ? payload.started_at_ms
      : typeof envelope.timestamp === "string" && Number.isFinite(Date.parse(envelope.timestamp))
        ? Date.parse(envelope.timestamp)
        : null;
    if (payload.type === "task_started" || payload.type === "task_complete" || payload.type === "turn_aborted") {
      let turn = cached.turns.get(payload.turn_id);
      if (!turn) {
        turn = { id: payload.turn_id, startedAt: timestampMs === null ? null : timestampMs / 1_000, itemsView: "full", items: new Map() };
        cached.turns.set(payload.turn_id, turn);
      }
      const completionError = payload.type === "task_complete" ? record(payload.error) : undefined;
      turn.status = payload.type === "task_started" ? "inProgress" : payload.type === "turn_aborted" || completionError ? "failed" : "completed";
      turn.error = completionError;
      return;
    }
    if (payload.type !== "item_completed") return;
    const rawItem = record(payload.item);
    const item = normalizeRolloutItem(rawItem);
    if (!item || typeof item.id !== "string") return;
    let turn = cached.turns.get(payload.turn_id);
    if (!turn) {
      turn = { id: payload.turn_id, startedAt: timestampMs === null ? null : timestampMs / 1_000, status: "inProgress", itemsView: "full", items: new Map() };
      cached.turns.set(payload.turn_id, turn);
    }
    if (!turn.clientUserMessageId && rawItem?.type === "UserMessage" && typeof rawItem.client_id === "string" && rawItem.client_id) turn.clientUserMessageId = rawItem.client_id;
    turn.items.set(item.id, { ...item, ...(timestampMs === null ? {} : { createdAtMs: timestampMs }) });
  }
}
