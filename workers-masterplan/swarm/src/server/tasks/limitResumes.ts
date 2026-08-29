import type { AccountId, LimitResumeRecord, LimitResumeState } from "../../shared/contracts.js";

function key(accountId: AccountId, threadId: string): string { return `${accountId}\u0000${threadId}`; }
function clone(record: LimitResumeRecord): LimitResumeRecord { return { ...record }; }

/** Owns durable usage-limit recovery state independently of worker/task assignment. */
export class LimitResumeManifest {
  private readonly records = new Map<string, LimitResumeRecord>();

  constructor(initial: LimitResumeRecord[] = [], private readonly persist: (records: LimitResumeRecord[]) => Promise<void> = async () => undefined) {
    for (const record of initial) this.records.set(key(record.accountId, record.threadId), clone(record));
  }

  list(): LimitResumeRecord[] { return [...this.records.values()].map(clone); }
  forThread(accountId: AccountId, threadId: string): LimitResumeRecord | undefined {
    const value = this.records.get(key(accountId, threadId));
    return value && clone(value);
  }
  waitingForAccount(accountId: AccountId): LimitResumeRecord[] {
    return [...this.records.values()].filter((record) => record.accountId === accountId && record.state === "waiting_for_limit").map(clone);
  }

  async markWaiting(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    const current = this.records.get(key(accountId, threadId));
    if (current && current.state !== "waiting_for_limit") return;
    await this.mutate(() => {
      this.records.set(key(accountId, threadId), { accountId, threadId, state: "waiting_for_limit", updatedAt: now });
    });
  }

  async clear(accountId: AccountId, threadId: string): Promise<void> {
    if (!this.records.has(key(accountId, threadId))) return;
    await this.mutate(() => { this.records.delete(key(accountId, threadId)); });
  }

  async claimResume(accountId: AccountId, threadId: string, clientUserMessageId: string, now = Date.now()): Promise<LimitResumeRecord | undefined> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "waiting_for_limit") return undefined;
    await this.mutate(() => {
      record.state = "resuming";
      record.resumeClientUserMessageId = clientUserMessageId;
      record.updatedAt = now;
    });
    return this.forThread(accountId, threadId);
  }

  async restoreWaitingFromResume(accountId: AccountId, threadId: string, clientUserMessageId: string, now = Date.now()): Promise<void> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "resuming" || record.resumeClientUserMessageId !== clientUserMessageId) return;
    await this.mutate(() => {
      record.state = "waiting_for_limit";
      delete record.resumeClientUserMessageId;
      record.updatedAt = now;
    });
  }

  async claimTransfer(accountId: AccountId, threadId: string, now = Date.now()): Promise<LimitResumeState | undefined> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "waiting_for_limit") return undefined;
    const prior = record.state;
    await this.mutate(() => {
      record.state = "transferring";
      delete record.resumeClientUserMessageId;
      record.updatedAt = now;
    });
    return prior;
  }

  async restoreTransfer(accountId: AccountId, threadId: string, state: LimitResumeState, now = Date.now()): Promise<void> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "transferring") return;
    await this.mutate(() => { record.state = state; record.updatedAt = now; });
  }

  async completeTransfer(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "transferring") return;
    await this.mutate(() => { record.state = "transferred"; record.updatedAt = now; });
  }

  private async mutate(operation: () => void): Promise<void> {
    const prior = this.list();
    operation();
    try { await this.persist(this.list()); }
    catch (error) {
      this.records.clear();
      for (const record of prior) this.records.set(key(record.accountId, record.threadId), record);
      throw error;
    }
  }
}
