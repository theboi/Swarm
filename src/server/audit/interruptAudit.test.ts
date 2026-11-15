import { describe, expect, it } from "vitest";

import { InterruptAuditJournal, type InterruptAuditRecord } from "./interruptAudit.js";

describe("InterruptAuditJournal", () => {
  it("attributes a live interrupted event to the matching Swarm request", async () => {
    const records: InterruptAuditRecord[] = [];
    let now = 1_000;
    const journal = new InterruptAuditJournal(records, async (next) => { records.splice(0, records.length, ...next); }, { now: () => now, id: () => "audit-1" });

    const requested = await journal.request({ accountId: "bot6/acc1", threadId: "thread-1", turnId: "turn-1", requestId: "http-1", actorEmail: "claudio@example.test", sourceAddress: "127.0.0.1", origin: "http://127.0.0.1:4310", userAgent: "test-browser" });
    await journal.accept(requested.id);
    now = 1_100;
    const observed = await journal.observeInterrupted("bot6/acc1", "thread-1", "turn-1");

    expect(observed).toMatchObject({ kind: "interrupted_event", attribution: "swarm_request", matchedRequestId: "http-1" });
    expect(journal.list()).toEqual([
      expect.objectContaining({ kind: "interrupt_request", outcome: "accepted", actorEmail: "claudio@example.test" }),
      expect.objectContaining({ kind: "interrupted_event", attribution: "swarm_request" }),
    ]);
  });

  it("labels an unmatched interruption external or unknown", async () => {
    const records: InterruptAuditRecord[] = [];
    const journal = new InterruptAuditJournal(records, async (next) => { records.splice(0, records.length, ...next); }, { now: () => 10_000, id: () => "audit-unknown" });

    const observed = await journal.observeInterrupted("bot6/acc1", "thread-2", "turn-2");

    expect(observed).toMatchObject({ kind: "interrupted_event", attribution: "external_or_unknown", accountId: "bot6/acc1", threadId: "thread-2", turnId: "turn-2" });
  });

  it("does not match an old or rejected Stop request", async () => {
    const records: InterruptAuditRecord[] = [];
    let now = 1_000;
    let sequence = 0;
    const journal = new InterruptAuditJournal(records, async (next) => { records.splice(0, records.length, ...next); }, { now: () => now, id: () => `audit-${++sequence}`, matchWindowMs: 100 });
    const rejected = await journal.request({ accountId: "bot6/acc1", threadId: "thread-1", turnId: "turn-1", requestId: "http-rejected", actorEmail: "claudio@example.test", sourceAddress: "127.0.0.1" });
    await journal.reject(rejected.id, "Codex refused");
    now = 1_200;

    await expect(journal.observeInterrupted("bot6/acc1", "thread-1", "turn-1")).resolves.toMatchObject({ attribution: "external_or_unknown" });
  });
});
