import { describe, expect, it, vi } from "vitest";
import { ApprovalRouter } from "./approvalRouter.js";
import { createApprovalContext, type ApprovalFilesystem } from "../safety/approvalPolicy.js";

const root = "/Users/bot1/Dev/EdenMind";
const fixture = `${root}/fixture.md`;

function mappedFilesystem(): ApprovalFilesystem {
  const present = new Set([root, fixture]);
  return { async realpath(path) { if (!present.has(path)) throw new Error(`ENOENT ${path}`); return path; } };
}

describe("ApprovalRouter", () => {
  it("is the single method-compatible policy boundary for safe automatic approvals", async () => {
    const append = vi.fn(async () => undefined);
    const router = new ApprovalRouter({
      context: createApprovalContext("bot1"),
      journal: { append, waitForDecision: async () => ({ kind: "decline" }) },
      filesystem: mappedFilesystem(),
      now: () => 1_000,
    });

    await expect(router.handle({
      id: "approval-1",
      method: "applyPatchApproval",
      params: { conversationId: "thread-1", callId: "call-1", fileChanges: { [fixture]: { type: "update" } }, reason: null, grantRoot: null },
    })).resolves.toEqual({ decision: "approved" });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      pending: expect.objectContaining({ id: "approval-1", accountId: "bot1", threadId: "thread-1", method: "applyPatchApproval", createdAt: 1_000 }),
      actor: "auto",
      sendOutcome: "response_ready",
    }));
  });

  it("journals fixed-v2 human-required requests and returns a method-safe timeout response", async () => {
    const append = vi.fn(async () => undefined);
    const router = new ApprovalRouter({
      context: createApprovalContext("bot1"),
      journal: { append, waitForDecision: async () => new Promise<never>(() => undefined) },
      filesystem: mappedFilesystem(),
      requestTimeoutMs: 10,
      now: () => 2_000,
    });

    await expect(router.handle({
      id: "approval-2",
      method: "item/fileChange/requestApproval",
      params: { threadId: "thread-2", turnId: "turn-2", itemId: "item-2", startedAtMs: 2_000, reason: "outside writable roots", grantRoot: "/Users/bot2/Dev/EdenMind" },
    })).resolves.toEqual({ decision: "cancel" });
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      pending: expect.objectContaining({ id: "approval-2", accountId: "bot1", threadId: "thread-2", turnId: "turn-2", itemId: "item-2", method: "item/fileChange/requestApproval" }),
      classification: expect.objectContaining({ outcome: "human_required" }),
      offeredChoices: ["accept", "decline", "cancel"],
      actor: "timeout",
    }));
  });
});
