import { describe, expect, it, vi } from "vitest";
import { gunzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";

import type { AccountId, ThreadSummary } from "../../shared/contracts.js";
import { createJsonlContinuation, moveWithJsonl, type JsonlContinuationTarget, type MoveWithJsonlInput } from "./threadHandoff.js";

function summary(accountId: AccountId, id: string): ThreadSummary {
  return {
    id,
    accountId,
    name: null,
    archived: false,
    updatedAt: 1,
    capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false },
  };
}

function target(startTurn: JsonlContinuationTarget["startTurn"] = vi.fn(async () => ({}))): JsonlContinuationTarget & { startTurn: typeof startTurn } {
  return {
    startThread: vi.fn(async () => ({ id: "target-thread" })),
    writeFile: vi.fn(async () => undefined),
    setThreadName: vi.fn(async () => undefined),
    startTurn,
  };
}

function moveFixture(overrides: Partial<MoveWithJsonlInput> = {}): MoveWithJsonlInput {
  const continuationTarget = target();
  return {
    sourceAccountId: "bot3",
    sourceThreadId: "source-thread",
    sourceName: "Build the release",
    targetAccountId: "bot1",
    targetWorkspace: "/Users/bot1/Dev/EdenMind",
    clientUserMessageId: "handoff-message",
    readJsonl: vi.fn(async () => "{\"type\":\"session_meta\"}\n"),
    target: vi.fn(async () => continuationTarget),
    normalizeThread: (source) => summary("bot1", String(source.id)),
    claimResume: vi.fn(async () => undefined),
    claimAssignment: vi.fn(async () => undefined),
    restoreResume: vi.fn(async () => undefined),
    restoreAssignment: vi.fn(async () => undefined),
    transfer: vi.fn(async () => undefined),
    cache: vi.fn(),
    ...overrides,
  };
}

describe("createJsonlContinuation", () => {
  it("transfers an incompressible history through bounded writes and ordered attachments", async () => {
    const jsonl = JSON.stringify({ text: randomBytes(2 * 1024 * 1024).toString("base64") });
    const written: Array<{ name: string; path: string }> = [];
    const contents: string[] = [];
    const continuationTarget = target(async (input) => {
      expect(input.attachments).toEqual(written);
      expect(input.text).toContain("Concatenate");
    });
    continuationTarget.writeFile = async (path, content) => {
      if (Buffer.byteLength(content) > 1024 * 1024) throw new Error("RPC frame too large");
      written.push({ name: path.split("/").at(-1)!, path });
      contents.push(content);
    };
    await createJsonlContinuation({
      sourceAccountId: "bot3/acc1", sourceThreadId: "source-thread", sourceName: null,
      targetAccountId: "bot8/acc1", targetWorkspace: "/Users/bot8/Dev/EdenMind",
      jsonl, clientUserMessageId: "large-transfer", target: continuationTarget,
      normalizeThread: (source) => summary("bot8/acc1", String(source.id)),
    });
    expect(contents.length).toBeGreaterThan(1);
    expect(gunzipSync(Buffer.from(contents.join(""), "base64")).toString("utf8")).toBe(jsonl);
  });
  it("attaches a large rollout as compressed base64 text without dropping content", async () => {
    const sourceJsonl = '{"type":"event_msg","payload":{"text":"large chat"}}\n'.repeat(40_000);
    const continuationTarget = target();
    await createJsonlContinuation({
      sourceAccountId: "bot1/acc1", sourceThreadId: "source-thread", sourceName: "Large chat",
      targetAccountId: "bot3/acc1", targetWorkspace: "/Users/bot3/Dev/EdenMind",
      jsonl: sourceJsonl, clientUserMessageId: "handoff-large", target: continuationTarget,
      normalizeThread: (source) => summary("bot3/acc1", String(source.id)),
    });
    const [path, compressed] = (continuationTarget.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(path).toMatch(/\.jsonl\.gz\.b64$/);
    expect(compressed.length).toBeLessThan(sourceJsonl.length / 10);
    expect(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8")).toBe(sourceJsonl);
    expect(continuationTarget.startTurn).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Decode"), attachments: [{ name: expect.stringMatching(/\.jsonl\.gz\.b64$/), path }] }));
  });
  it("creates a target-only continuation with the exact source JSONL attached", async () => {
    const continuationTarget = target();
    const sourceJsonl = "{\"type\":\"session_meta\"}\n";

    const result = await createJsonlContinuation({
      sourceAccountId: "bot3",
      sourceThreadId: "source-thread",
      sourceName: "Build the release",
      targetAccountId: "bot5",
      targetWorkspace: "/Users/bot5/Dev/EdenMind",
      jsonl: sourceJsonl,
      clientUserMessageId: "handoff-message",
      target: continuationTarget,
      normalizeThread: (source) => summary("bot5", String(source.id)),
    });

    expect(continuationTarget.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/swarm-handoff-bot3-[a-f0-9]{12}\.jsonl$/),
      sourceJsonl,
    );
    expect(continuationTarget.setThreadName).toHaveBeenCalledWith("target-thread", "(Handoff) Build the release");
    expect(continuationTarget.startTurn).toHaveBeenCalledWith(expect.objectContaining({
      threadId: "target-thread",
      clientUserMessageId: "handoff-message",
      attachments: [expect.objectContaining({ name: expect.stringMatching(/\.jsonl$/) })],
      text: expect.stringContaining("source account bot3"),
    }));
    expect(continuationTarget.startTurn).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("source thread source-thread"),
    }));
    expect(result).toMatchObject({ id: "target-thread", accountId: "bot5", name: "(Handoff) Build the release" });
  });

  it("appends queued messages to the target continuation prompt", async () => {
    const continuationTarget = target();

    await createJsonlContinuation({
      sourceAccountId: "bot3",
      sourceThreadId: "source-thread",
      sourceName: null,
      targetAccountId: "bot5",
      targetWorkspace: "/Users/bot5/Dev/EdenMind",
      jsonl: "{\"type\":\"session_meta\"}\n",
      clientUserMessageId: "handoff-message",
      target: continuationTarget,
      normalizeThread: (source) => summary("bot5", String(source.id)),
      queuedMessages: "Please run the release checks.",
    });

    expect(continuationTarget.startTurn).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining("Please run the release checks."),
    }));
  });

  it("keeps a profile ID in handoff attribution without placing its slash in the attachment filename", async () => {
    const continuationTarget = target();

    await createJsonlContinuation({
      sourceAccountId: "bot1/acc2",
      sourceThreadId: "source-thread",
      sourceName: null,
      targetAccountId: "bot1/acc1",
      targetWorkspace: "/Users/bot1/Dev/EdenMind",
      jsonl: "{\"type\":\"session_meta\"}\n",
      clientUserMessageId: "handoff-message",
      target: continuationTarget,
      normalizeThread: (source) => summary("bot1/acc1", String(source.id)),
    });

    expect(continuationTarget.writeFile).toHaveBeenCalledWith(expect.stringMatching(/swarm-handoff-bot1-acc2-[a-f0-9]{12}\.jsonl$/), expect.any(String));
    expect(continuationTarget.startTurn).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("source account bot1/acc2") }));
  });

  it("propagates a target start-turn error", async () => {
    const targetError = new Error("target turn rejected");
    const continuationTarget = target(vi.fn(async () => { throw targetError; }));

    await expect(createJsonlContinuation({
      sourceAccountId: "bot3",
      sourceThreadId: "source-thread",
      sourceName: "Build the release",
      targetAccountId: "bot5",
      targetWorkspace: "/Users/bot5/Dev/EdenMind",
      jsonl: "{\"type\":\"session_meta\"}\n",
      clientUserMessageId: "handoff-message",
      target: continuationTarget,
      normalizeThread: (source) => summary("bot5", String(source.id)),
    })).rejects.toBe(targetError);
  });
});

describe("moveWithJsonl", () => {
  it("moves from cached source metadata with the source rollout read directly from JSONL", async () => {
    const readJsonl = vi.fn(async () => "{\"type\":\"session_meta\"}\n");

    await expect(moveWithJsonl(moveFixture({
      sourceAccountId: "bot3",
      sourceThreadId: "01a03efb-f1b9-76c2-b04f-73c5e167bdcb",
      readJsonl,
    }))).resolves.toEqual(expect.objectContaining({ accountId: "bot1" }));

    expect(readJsonl).toHaveBeenCalledWith("bot3", "01a03efb-f1b9-76c2-b04f-73c5e167bdcb");
  });

  it("restores both transfer claims without durably transferring when the target rejects the continuation", async () => {
    const targetRejected = new Error("target turn rejected");
    const continuationTarget = target(vi.fn(async () => { throw targetRejected; }));
    const restoreResume = vi.fn(async () => undefined);
    const restoreAssignment = vi.fn(async () => undefined);
    const transfer = vi.fn(async () => undefined);
    const fixture = moveFixture({ target: vi.fn(async () => continuationTarget), restoreResume, restoreAssignment, transfer });

    await expect(moveWithJsonl(fixture)).rejects.toBe(targetRejected);

    expect(restoreResume).toHaveBeenCalledOnce();
    expect(restoreAssignment).toHaveBeenCalledOnce();
    expect(transfer).not.toHaveBeenCalled();
  });
});
