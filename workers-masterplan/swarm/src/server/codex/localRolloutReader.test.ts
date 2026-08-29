import { mkdtemp, mkdir, rm, writeFile, appendFile } from "node:fs/promises";
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
    await writeFile(path, `${JSON.stringify({ type: "event_msg", payload: { type: "item_completed", thread_id: threadId, turn_id: "turn-1", started_at_ms: 1_700_000_000_000, item: { id: "user-1", type: "UserMessage", content: [{ type: "text", text: "Hello" }] } } })}\n`);
    const reader = new LocalRolloutTranscriptReader(root);

    const first = await reader.readThread(threadId);
    expect(first.thread.turns).toEqual([expect.objectContaining({ id: "turn-1", items: [expect.objectContaining({ id: "user-1", type: "userMessage" })] })]);

    await appendFile(path, `${JSON.stringify({ type: "event_msg", payload: { type: "item_completed", thread_id: threadId, turn_id: "turn-1", started_at_ms: 1_700_000_001_000, item: { id: "agent-1", type: "AgentMessage", content: [{ type: "Text", text: "Hi back" }] } } })}\n`);
    const second = await reader.readThread(threadId);
    expect(second.thread.turns[0]?.items).toEqual([
      expect.objectContaining({ id: "user-1", type: "userMessage" }),
      expect.objectContaining({ id: "agent-1", type: "agentMessage", text: "Hi back" }),
    ]);
  });

  it("rejects an invalid thread identifier before inspecting the filesystem", async () => {
    const reader = new LocalRolloutTranscriptReader("/Users/claudiothe/.codex");
    await expect(reader.readThread("../../secrets")).rejects.toThrow("Invalid local thread identifier");
  });
});
