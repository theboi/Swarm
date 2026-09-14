import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AccountId, ThreadSummary } from "../../shared/contracts.js";
import { LocalJsonlHandoffTransport } from "./localHandoffTransport.js";
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
    setThreadName: vi.fn(async () => undefined),
    startTurn,
  } as JsonlContinuationTarget & { startTurn: typeof startTurn };
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
    readJsonl: vi.fn(async () => Buffer.from("{\"type\":\"session_meta\"}\n")),
    copyJsonl: vi.fn(async () => ({ filename: "swarm-handoff-bot3-0123456789ab.jsonl", path: "/Users/bot1/Dev/EdenMind/swarm-handoff-bot3-0123456789ab.jsonl" })),
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
  it("creates a target-only continuation from a local handoff file without app-server file writes", async () => {
    const continuationTarget = target();
    const sourceJsonl = Buffer.from("{\"type\":\"session_meta\"}\n");
    const copyJsonl = vi.fn(async () => ({ filename: "swarm-handoff-bot3-0123456789ab.jsonl", path: "/Users/bot5/Dev/EdenMind/swarm-handoff-bot3-0123456789ab.jsonl" }));

    const result = await createJsonlContinuation({
      sourceAccountId: "bot3",
      sourceThreadId: "source-thread",
      sourceName: "Build the release",
      targetAccountId: "bot5",
      targetWorkspace: "/Users/bot5/Dev/EdenMind",
      jsonl: sourceJsonl,
      clientUserMessageId: "handoff-message",
      copyJsonl,
      target: continuationTarget,
      normalizeThread: (source) => summary("bot5", String(source.id)),
    });

    expect(copyJsonl).toHaveBeenCalledWith(expect.objectContaining({ jsonl: sourceJsonl }));
    expect(continuationTarget.setThreadName).toHaveBeenCalledWith("target-thread", "(Handoff) Build the release");
    expect(continuationTarget.startTurn).toHaveBeenCalledWith(expect.objectContaining({
      threadId: "target-thread",
      clientUserMessageId: "handoff-message",
      attachments: [{ name: "swarm-handoff-bot3-0123456789ab.jsonl", path: "/Users/bot5/Dev/EdenMind/swarm-handoff-bot3-0123456789ab.jsonl" }],
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
      jsonl: Buffer.from("{\"type\":\"session_meta\"}\n"),
      clientUserMessageId: "handoff-message",
      copyJsonl: vi.fn(async () => ({ filename: "handoff.jsonl", path: "/Users/bot5/Dev/EdenMind/handoff.jsonl" })),
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
      jsonl: Buffer.from("{\"type\":\"session_meta\"}\n"),
      clientUserMessageId: "handoff-message",
      copyJsonl: vi.fn(async () => ({ filename: "handoff.jsonl", path: "/Users/bot5/Dev/EdenMind/handoff.jsonl" })),
      target: continuationTarget,
      normalizeThread: (source) => summary("bot5", String(source.id)),
    })).rejects.toBe(targetError);
  });

  it("removes local staging but retains the target handoff when target startup fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-continuation-"));
    const stagingRoot = join(root, "coordinator", ".data", "handoffs");
    const targetWorkspace = join(root, "bot5", "Dev", "EdenMind");
    await mkdir(targetWorkspace, { recursive: true });
    const targetError = new Error("target turn rejected");
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: () => targetWorkspace,
      passwords: { bot5: "target-password" },
      copyAsTarget: async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath),
      grantTargetRead: async () => undefined,
    });

    try {
      await expect(createJsonlContinuation({
        sourceAccountId: "bot3",
        sourceThreadId: "source-thread",
        sourceName: "Build the release",
        targetAccountId: "bot5",
        targetWorkspace,
        jsonl: Buffer.from("{\"type\":\"session_meta\"}\n"),
        clientUserMessageId: "handoff-message",
        copyJsonl: (input) => transport.copyJsonl(input),
        target: target(vi.fn(async () => { throw targetError; })),
        normalizeThread: (source) => summary("bot5", String(source.id)),
      })).rejects.toBe(targetError);

      expect(await readdir(stagingRoot)).toEqual([]);
      expect(await readdir(targetWorkspace)).toEqual([expect.stringMatching(/^swarm-handoff-bot3-[a-f0-9]{12}\.jsonl$/)]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("moveWithJsonl", () => {
  it("moves from cached source metadata with the source rollout read directly from JSONL", async () => {
    const readJsonl = vi.fn(async () => Buffer.from("{\"type\":\"session_meta\"}\n"));

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
