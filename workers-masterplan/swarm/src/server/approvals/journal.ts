import { randomUUID } from "node:crypto";

import type { ApprovalChoice } from "../safety/approvalPolicy.js";
import type { ApprovalJournal, ApprovalJournalEntry } from "../codex/approvalRouter.js";

function key(entry: ApprovalJournalEntry): string { return `${entry.pending.accountId}\u0000${entry.requestId}`; }
function copy(entry: ApprovalJournalEntry): ApprovalJournalEntry {
  return { ...entry, pending: { ...entry.pending, availableDecisions: [...entry.pending.availableDecisions] }, classification: { ...entry.classification, targets: [...entry.classification.targets] }, normalizedTargets: [...entry.normalizedTargets], offeredChoices: [...entry.offeredChoices], ...(entry.chosenResponse ? { chosenResponse: { ...entry.chosenResponse } } : {}) };
}

/** Durable metadata journal; only resolver-held entries represent a live app-server request. */
export class DurableApprovalJournal implements ApprovalJournal {
  private readonly entries = new Map<string, ApprovalJournalEntry>();
  private readonly live = new Map<string, { resolve(choice: ApprovalChoice): void; reject(error: Error): void }>();
  private mutation = Promise.resolve();

  constructor(initial: ApprovalJournalEntry[] = [], private readonly persist: (entries: ApprovalJournalEntry[]) => Promise<void> = async () => undefined) {
    for (const entry of initial) this.entries.set(key(entry), copy(entry));
  }

  pending() { return [...this.entries.values()].filter((entry) => entry.sendOutcome === "pending").map(copy); }
  list() { return [...this.entries.values()].map(copy); }

  async append(entry: ApprovalJournalEntry): Promise<void> {
    const entryKey = key(entry);
    const existing = this.entries.get(entryKey);
    const id = existing?.pending.id && existing.pending.id !== entry.requestId ? existing.pending.id : randomUUID();
    entry.pending.id = id;
    const next = copy(entry);
    next.pending.id = id;
    const operation = this.mutation.then(async () => {
      const prior = this.entries.get(entryKey);
      this.entries.set(entryKey, next);
      try { await this.persist(this.list()); } catch (error) { if (prior) this.entries.set(entryKey, prior); else this.entries.delete(entryKey); throw error; }
    });
    this.mutation = operation.catch(() => undefined);
    await operation;
  }

  async waitForDecision(entry: ApprovalJournalEntry): Promise<ApprovalChoice> {
    const entryKey = key(entry);
    if (entry.sendOutcome !== "pending" || !this.entries.has(entryKey)) throw new Error("Approval is not a live pending request");
    if (this.live.has(entry.pending.id)) throw new Error("Approval already has a live decision waiter");
    return new Promise<ApprovalChoice>((resolve, reject) => this.live.set(entry.pending.id, { resolve, reject }));
  }

  async decide(id: string, choice: ApprovalChoice): Promise<void> {
    const waiter = this.live.get(id);
    const entry = [...this.entries.values()].find((candidate) => candidate.pending.id === id);
    if (!waiter || !entry || entry.sendOutcome !== "pending") throw new Error("Approval is not a live pending request");
    if (!entry.offeredChoices.includes(choice.kind)) throw new Error("Approval choice is not offered by this protocol method");
    this.live.delete(id);
    waiter.resolve(choice);
  }

  rejectLive(error = new Error("Coordinator shutdown")): void {
    for (const waiter of this.live.values()) waiter.reject(error);
    this.live.clear();
  }
}
