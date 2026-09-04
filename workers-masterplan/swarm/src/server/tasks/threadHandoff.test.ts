import { describe, expect, it, vi } from "vitest";

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
