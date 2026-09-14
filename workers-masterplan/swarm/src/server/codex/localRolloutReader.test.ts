import { mkdtemp, mkdir, rm, writeFile, appendFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { LocalRolloutTranscriptReader } from "./localRolloutReader.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

describe("LocalRolloutTranscriptReader", () => {
  it("loads completed chat messages and incrementally includes appended items", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-rollout-"));
    roots.push(root);
    const sessions = join(root, "sessions", "2026", "08", "29");
    await mkdir(sessions, { recursive: true });
    const threadId = "01a03efb-f1b9-76c2-b04f-73c5e167bdcb";
    const path = join(sessions, `rollout-2026-08-29T00-00-00-${threadId}.jsonl`);
    await writeFile(path, `${JSON.stringify({ timestamp: "2023-11-14T22:13:19.000Z", type: "event_msg", payload: { type: "task_started", turn_id: "turn-1" } })}\n${JSON.stringify({ type: "event_msg", payload: { type: "item_completed", thread_id: threadId, turn_id: "turn-1", started_at_ms: 1_700_000_000_000, item: { id: "user-1", type: "UserMessage", client_id: "resume-message-1", content: [{ type: "text", text: "Hello" }] } } })}\n`);
    const reader = new LocalRolloutTranscriptReader(root);

    const first = await reader.readThread(threadId);
    expect(first.thread.turns).toEqual([expect.objectContaining({ id: "turn-1", clientUserMessageId: "resume-message-1", items: [expect.objectContaining({ id: "user-1", type: "userMessage" })] })]);
    expect(first.thread.turns[0]).toMatchObject({ status: "inProgress" });
    expect(first.thread.turns[0]?.items[0]).toMatchObject({ createdAtMs: 1_700_000_000_000 });

    await appendFile(path, `${JSON.stringify({ type: "event_msg", payload: { type: "item_completed", thread_id: threadId, turn_id: "turn-1", started_at_ms: 1_700_000_001_000, item: { id: "agent-1", type: "AgentMessage", content: [{ type: "Text", text: "Hi back" }] } } })}\n${JSON.stringify({ timestamp: "2023-11-14T22:13:22.000Z", type: "event_msg", payload: { type: "task_complete", turn_id: "turn-1" } })}\n`);
    const second = await reader.readThread(threadId);
    expect(second.thread.turns[0]?.items).toEqual([
      expect.objectContaining({ id: "user-1", type: "userMessage" }),
      expect.objectContaining({ id: "agent-1", type: "agentMessage", text: "Hi back" }),
    ]);
    expect(second.thread.turns[0]).toMatchObject({ status: "completed" });
    expect(second.thread.turns[0]?.items[1]).toMatchObject({ createdAtMs: 1_700_000_001_000 });
  });

  it("returns the exact source JSONL for account-independent chat handoff", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-rollout-"));
    roots.push(root);
    const sessions = join(root, "sessions", "2026", "08", "29");
    await mkdir(sessions, { recursive: true });
    const threadId = "01a03efb-f1b9-76c2-b04f-73c5e167bdcb";
    const path = join(sessions, `rollout-2026-08-29T00-00-00-${threadId}.jsonl`);
    const source = `${JSON.stringify({ type: "session_meta", payload: { id: threadId } })}\n${JSON.stringify({ type: "event_msg", payload: { type: "item_completed", turn_id: "turn-1" } })}\n`;
    await writeFile(path, source);

    await expect(new LocalRolloutTranscriptReader(root).readJsonl(threadId)).resolves.toEqual(Buffer.from(source));
  });

  it("preserves usage-limit failures from a completed desktop-owned rollout", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-rollout-"));
    roots.push(root);
    const sessions = join(root, "sessions", "2026", "08", "29");
    await mkdir(sessions, { recursive: true });
    const threadId = "01a03efb-f1b9-76c2-b04f-73c5e167bdcb";
    const path = join(sessions, `rollout-2026-08-29T00-00-00-${threadId}.jsonl`);
    await writeFile(path, `${JSON.stringify({ type: "event_msg", payload: { type: "task_started", turn_id: "turn-limited" } })}\n${JSON.stringify({ type: "event_msg", payload: { type: "task_complete", turn_id: "turn-limited", error: { message: "You've hit your usage limit", codex_error_info: "usage_limit_exceeded" } } })}\n`);

    const result = await new LocalRolloutTranscriptReader(root).readThread(threadId);

    expect(result.thread.turns[0]).toMatchObject({ status: "failed", error: { codex_error_info: "usage_limit_exceeded" } });
  });

  it("recovers recent unmatched rollout activity after the owning app-server is replaced", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-rollout-"));
    roots.push(root);
    const sessions = join(root, "sessions", "2026", "09", "09");
    await mkdir(sessions, { recursive: true });
    const threadId = "01a03efb-f1b9-76c2-b04f-73c5e167bdcb";
    const path = join(sessions, `rollout-2026-09-09T00-00-00-${threadId}.jsonl`);
    await writeFile(path, `${JSON.stringify({ timestamp: "2026-09-09T08:04:53.000Z", type: "event_msg", payload: { type: "task_started", turn_id: "turn-live" } })}\n`);
    const now = Date.parse("2026-09-09T08:05:00.000Z");
    await utimes(path, now / 1_000, now / 1_000);

    await expect(new LocalRolloutTranscriptReader(root).readRecentActivity(threadId, now)).resolves.toEqual({ activity: "active", turnId: "turn-live" });
  });

  it("does not recover aborted or stale rollout activity", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-rollout-"));
    roots.push(root);
    const sessions = join(root, "sessions", "2026", "09", "09");
    await mkdir(sessions, { recursive: true });
    const abortedId = "01a03efb-f1b9-76c2-b04f-73c5e167bdcb";
    const abortedPath = join(sessions, `rollout-2026-09-09T00-00-00-${abortedId}.jsonl`);
    await writeFile(abortedPath, `${JSON.stringify({ type: "event_msg", payload: { type: "task_started", turn_id: "turn-aborted" } })}\n${JSON.stringify({ type: "event_msg", payload: { type: "turn_aborted", turn_id: "turn-aborted", reason: "interrupted" } })}\n`);
    const staleId = "01a03efb-f1b9-76c2-b04f-73c5e167bdcc";
    const stalePath = join(sessions, `rollout-2026-09-09T00-00-00-${staleId}.jsonl`);
    await writeFile(stalePath, `${JSON.stringify({ type: "event_msg", payload: { type: "task_started", turn_id: "turn-stale" } })}\n`);
    const now = Date.parse("2026-09-09T08:10:00.000Z");
    await utimes(abortedPath, now / 1_000, now / 1_000);
    await utimes(stalePath, (now - 10 * 60_000) / 1_000, (now - 10 * 60_000) / 1_000);
    const reader = new LocalRolloutTranscriptReader(root);

    await expect(reader.readRecentActivity(abortedId, now)).resolves.toEqual({ activity: "idle" });
    await expect(reader.readRecentActivity(staleId, now)).resolves.toEqual({ activity: "idle" });
  });

  it("rejects an invalid thread identifier before inspecting the filesystem", async () => {
    const reader = new LocalRolloutTranscriptReader("/Users/claudiothe/.codex");
    await expect(reader.readThread("../../secrets")).rejects.toThrow("Invalid local thread identifier");
  });

  it("rejects an invalid identifier before reading handoff JSONL", async () => {
    const reader = new LocalRolloutTranscriptReader("/Users/claudiothe/.codex");
    await expect(reader.readJsonl("../../auth.json")).rejects.toThrow("Invalid local thread identifier");
  });
});
