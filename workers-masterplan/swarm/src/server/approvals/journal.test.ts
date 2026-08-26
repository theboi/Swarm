import { describe, expect, it } from "vitest";

import type { ApprovalJournalEntry } from "../codex/approvalRouter.js";
import { DurableApprovalJournal } from "./journal.js";

function entry(): ApprovalJournalEntry {
  return {
    pending: { id: "server-request", accountId: "bot1", threadId: "thread", turnId: "turn", itemId: "item", method: "item/commandExecution/requestApproval", summary: "contained action", availableDecisions: ["accept", "decline"], createdAt: 1 },
    requestId: "server-request", classification: { outcome: "human_required", reason: "review", targets: [] }, normalizedTargets: [], summary: "contained action", offeredChoices: ["accept", "decline"], actor: "error", sendOutcome: "pending",
  };
}

describe("DurableApprovalJournal", () => {
  it("mints a globally unique UI id and only resolves a currently live method-specific decision", async () => {
    const persisted: ApprovalJournalEntry[] = [];
    const journal = new DurableApprovalJournal(persisted, async (entries) => { persisted.splice(0, persisted.length, ...entries); });
    const pending = entry();
    await journal.append(pending);
    const decision = journal.waitForDecision(pending);

    expect(pending.pending.id).not.toBe("server-request");
    await journal.decide(pending.pending.id, { kind: "accept" });
    await expect(decision).resolves.toEqual({ kind: "accept" });
    await expect(journal.decide(pending.pending.id, { kind: "accept" })).rejects.toThrow(/live/i);
  });

  it("restores old pending entries as attention metadata and never replies to a dead server request", async () => {
    const old = entry();
    const journal = new DurableApprovalJournal([old]);

    expect(journal.pending()).toHaveLength(1);
    await expect(journal.decide(old.pending.id, { kind: "decline" })).rejects.toThrow(/live/i);
  });
});
