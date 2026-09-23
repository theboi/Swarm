import { randomUUID } from "node:crypto";

import type { AccountId } from "../../shared/contracts.js";

export interface InterruptRequestAuditContext {
  requestId: string;
  actorEmail: string;
  sourceAddress: string;
  origin?: string;
  userAgent?: string;
}

export type InterruptAuditRecord = {
  id: string;
  kind: "interrupt_request" | "interrupted_event";
  accountId: AccountId;
  threadId: string;
  turnId?: string;
  recordedAt: number;
  requestId?: string;
  actorEmail?: string;
  sourceAddress?: string;
  origin?: string;
  userAgent?: string;
  outcome?: "requested" | "accepted" | "rejected";
  settledAt?: number;
  error?: string;
  observedAt?: number;
  attribution?: "swarm_request" | "external_or_unknown";
  matchedRequestId?: string;
};

type RequestInput = InterruptRequestAuditContext & { accountId: AccountId; threadId: string; turnId: string };

const DEFAULT_MATCH_WINDOW_MS = 5 * 60_000;
const DEFAULT_MAX_RECORDS = 500;

export class InterruptAuditJournal {
  private records: InterruptAuditRecord[];
  private mutation = Promise.resolve();

  constructor(
    initial: InterruptAuditRecord[],
    private readonly persist: (records: InterruptAuditRecord[]) => Promise<void>,
    private readonly options: { now?: () => number; id?: () => string; matchWindowMs?: number; maxRecords?: number } = {},
  ) {
    this.records = initial.map((record) => ({ ...record }));
  }

  list(): InterruptAuditRecord[] { return this.records.map((record) => ({ ...record })); }

  request(input: RequestInput): Promise<InterruptAuditRecord> {
    return this.mutate((records) => {
      const record: InterruptAuditRecord = {
        id: this.id(), kind: "interrupt_request", accountId: input.accountId, threadId: input.threadId, turnId: input.turnId,
        recordedAt: this.now(), requestId: input.requestId, actorEmail: input.actorEmail, sourceAddress: input.sourceAddress,
        ...(input.origin ? { origin: input.origin } : {}), ...(input.userAgent ? { userAgent: input.userAgent } : {}), outcome: "requested",
      };
      records.push(record);
      return record;
    });
  }

  accept(id: string): Promise<void> { return this.settle(id, "accepted"); }
  reject(id: string, error: string): Promise<void> { return this.settle(id, "rejected", error); }

  observeInterrupted(accountId: AccountId, threadId: string, turnId?: string): Promise<InterruptAuditRecord> {
    return this.mutate((records) => {
      const recordedAt = this.now();
      const threshold = recordedAt - (this.options.matchWindowMs ?? DEFAULT_MATCH_WINDOW_MS);
      const matched = [...records].reverse().find((record) => record.kind === "interrupt_request"
        && record.accountId === accountId && record.threadId === threadId && record.turnId === turnId
        && record.recordedAt >= threshold && record.outcome !== "rejected");
      if (matched) matched.observedAt = recordedAt;
      const observed: InterruptAuditRecord = {
        id: this.id(), kind: "interrupted_event", accountId, threadId, ...(turnId ? { turnId } : {}), recordedAt,
        attribution: matched ? "swarm_request" : "external_or_unknown",
        ...(matched?.requestId ? { matchedRequestId: matched.requestId } : {}),
      };
      records.push(observed);
      return observed;
    });
  }

  private settle(id: string, outcome: "accepted" | "rejected", error?: string): Promise<void> {
    return this.mutate((records) => {
      const record = records.find((candidate) => candidate.id === id && candidate.kind === "interrupt_request");
      if (record) {
        record.outcome = outcome;
        record.settledAt = this.now();
        if (error) record.error = error.slice(0, 500);
      }
    });
  }

  private now(): number { return (this.options.now ?? Date.now)(); }
  private id(): string { return (this.options.id ?? randomUUID)(); }

  private async mutate<T>(change: (records: InterruptAuditRecord[]) => T): Promise<T> {
    let result!: T;
    const next = this.mutation.then(async () => {
      const updated = this.records.map((record) => ({ ...record }));
      result = change(updated);
      const maximum = this.options.maxRecords ?? DEFAULT_MAX_RECORDS;
      if (updated.length > maximum) updated.splice(0, updated.length - maximum);
      await this.persist(updated);
      this.records = updated;
    });
    this.mutation = next.catch(() => undefined);
    await next;
    return result;
  }
}
