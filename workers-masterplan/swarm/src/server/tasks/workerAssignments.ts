import type { AccountId, WorkerAssignmentRecord } from "../../shared/contracts.js";

function clone(record: WorkerAssignmentRecord): WorkerAssignmentRecord {
  return { ...record, transferHistory: record.transferHistory.map((transfer) => ({ ...transfer })) };
}

/** Owns the durable task-to-account/thread manifest and serializes every lifecycle mutation. */
export class WorkerAssignmentManifest {
  private readonly records = new Map<string, WorkerAssignmentRecord>();

  constructor(initial: WorkerAssignmentRecord[] = [], private readonly persist: (records: WorkerAssignmentRecord[]) => Promise<void> = async () => undefined) {
    for (const record of initial) this.records.set(record.taskId, clone(record));
  }

  list(): WorkerAssignmentRecord[] { return [...this.records.values()].map(clone); }
  forTask(taskId: string): WorkerAssignmentRecord | undefined { const value = this.records.get(taskId); return value && clone(value); }
  forThread(accountId: AccountId, threadId: string): WorkerAssignmentRecord | undefined {
    const value = [...this.records.values()].find((record) => record.accountId === accountId && record.threadId === threadId);
    return value && clone(value);
  }
  waitingForAccount(accountId: AccountId): WorkerAssignmentRecord[] {
    return [...this.records.values()]
      .filter((record) => record.accountId === accountId && record.state === "waiting_for_limit")
      .map(clone);
  }

  async assign(taskId: string, accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    const prior = this.records.get(taskId);
    this.records.set(taskId, { taskId, accountId, threadId, state: "assigned", assignedAt: prior?.assignedAt ?? now, updatedAt: now, transferHistory: prior?.transferHistory.map((item) => ({ ...item })) ?? [] });
    await this.flush();
  }

  async markAssigned(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    await this.updateCurrent(accountId, threadId, (record) => { record.state = "assigned"; record.updatedAt = now; });
  }

  async markWaitingForLimit(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    await this.updateCurrent(accountId, threadId, (record) => {
      if (record.state !== "assigned") return;
      record.state = "waiting_for_limit";
      record.updatedAt = now;
    });
  }

  async complete(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    await this.updateCurrent(accountId, threadId, (record) => { record.state = "completed"; record.updatedAt = now; });
  }

  async markAttentionRequired(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    await this.updateCurrent(accountId, threadId, (record) => { record.state = "attention_required"; record.updatedAt = now; });
  }

  async transfer(sourceAccountId: AccountId, sourceThreadId: string, targetAccountId: AccountId, targetThreadId: string, now = Date.now()): Promise<void> {
    await this.updateCurrent(sourceAccountId, sourceThreadId, (record) => {
      record.transferHistory.push({ fromAccountId: sourceAccountId, fromThreadId: sourceThreadId, toAccountId: targetAccountId, toThreadId: targetThreadId, transferredAt: now });
      record.accountId = targetAccountId;
      record.threadId = targetThreadId;
      record.state = "assigned";
      record.updatedAt = now;
    });
  }

  private async updateCurrent(accountId: AccountId, threadId: string, operation: (record: WorkerAssignmentRecord) => void): Promise<void> {
    const record = [...this.records.values()].find((candidate) => candidate.accountId === accountId && candidate.threadId === threadId);
    if (!record) return;
    const prior = clone(record);
    operation(record);
    if (JSON.stringify(record) === JSON.stringify(prior)) return;
    try { await this.flush(); } catch (error) { this.records.set(prior.taskId, prior); throw error; }
  }

  private async flush(): Promise<void> { await this.persist(this.list()); }
}
