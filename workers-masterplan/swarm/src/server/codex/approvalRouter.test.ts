import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApprovalRouter } from "./approvalRouter.js";
import { createTestApprovalContext } from "../safety/approvalPolicy.js";

let directory: string | undefined;

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function workspace() {
  directory = await mkdtemp(join(tmpdir(), "swarm-approval-router-"));
  const root = join(directory, "EdenMind");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "fixture.md"), "fixture");
  return realpath(root);
}

describe("ApprovalRouter", () => {
  it("is the single method-compatible policy boundary for safe automatic approvals", async () => {
    const root = await workspace();
    const append = vi.fn(async () => undefined);
    const router = new ApprovalRouter({
      context: createTestApprovalContext("bot1", root),
      journal: { append, waitForDecision: async () => ({ kind: "decline" }) },
      now: () => 1_000,
    });

    await expect(router.handle({
      jsonrpc: "2.0",
      id: "approval-1",
      method: "applyPatchApproval",
      params: { conversationId: "thread-1", callId: "call-1", fileChanges: { [join(root, "fixture.md")]: { type: "update" } }, reason: null, grantRoot: null },
    })).resolves.toEqual({ decision: "approved" });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      pending: expect.objectContaining({ id: "approval-1", accountId: "bot1", threadId: "thread-1", method: "applyPatchApproval", createdAt: 1_000 }),
      actor: "auto",
      sendOutcome: "response_ready",
    }));
  });

  it("journals real-v2 human-required requests and returns the method-safe timeout response", async () => {
    const root = await workspace();
    const append = vi.fn(async () => undefined);
    const router = new ApprovalRouter({
      context: createTestApprovalContext("bot1", root),
      journal: { append, waitForDecision: async () => new Promise<never>(() => undefined) },
      requestTimeoutMs: 10,
      now: () => 2_000,
    });

    await expect(router.handle({
      jsonrpc: "2.0",
      id: "approval-2",
      method: "item/fileChange/requestApproval",
      params: { threadId: "thread-2", turnId: "turn-2", itemId: "item-2", startedAtMs: 2_000, reason: "outside writable roots", grantRoot: "/Users/bot2/Dev/EdenMind" },
    })).resolves.toEqual({ decision: "cancel" });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      pending: expect.objectContaining({ id: "approval-2", accountId: "bot1", threadId: "thread-2", turnId: "turn-2", itemId: "item-2", method: "item/fileChange/requestApproval" }),
      classification: expect.objectContaining({ outcome: "human_required" }),
      offeredChoices: ["decline", "cancel"],
      actor: "timeout",
    }));
  });
});
