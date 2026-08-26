import type { DispatchRecord } from "../../shared/contracts.js";

export interface ThreadReconciler {
  readThread(record: DispatchRecord, options: { includeTurns: true }): Promise<{ turns: Array<{ clientUserMessageId?: string }> }>;
}

export class DispatchOutbox {
  private readonly records = new Map<string, DispatchRecord>();

  constructor(initial: DispatchRecord[] = [], private readonly persist: (records: DispatchRecord[]) => Promise<void> = async () => undefined) {
    for (const record of initial) {
      if (this.records.has(record.id)) throw new Error(`Duplicate durable dispatch ${record.id}`);
      if ([...this.records.values()].some((existing) => existing.clientUserMessageId === record.clientUserMessageId)) throw new Error(`Duplicate durable client message ${record.clientUserMessageId}`);
      this.records.set(record.id, { ...record });
    }
  }

  get(id: string): DispatchRecord | undefined { const record = this.records.get(id); return record && { ...record }; }
  list(): DispatchRecord[] { return [...this.records.values()].map((record) => ({ ...record })); }

  async enqueue(record: DispatchRecord): Promise<void> {
    if (record.state !== "queued") throw new Error("New dispatches must be queued before send");
    if (this.records.has(record.id)) throw new Error(`Dispatch ${record.id} already exists`);
    if ([...this.records.values()].some((existing) => existing.clientUserMessageId === record.clientUserMessageId)) throw new Error(`Dispatch client message ${record.clientUserMessageId} already exists`);
    this.records.set(record.id, { ...record });
    try { await this.flush(); } catch (error) { this.records.delete(record.id); throw error; }
  }

  async dispatch(record: DispatchRecord, adapter: { startTurn(record: DispatchRecord): Promise<void> }, now = Date.now()): Promise<void> {
    await this.enqueue(record);
    await this.markSubmitting(record.id, now);
    await adapter.startTurn(this.require(record.id));
    await this.markAccepted(record.id, now);
  }

  async markSubmitting(id: string, now = Date.now()): Promise<void> { await this.transition(id, ["queued", "waiting_for_limit"], "submitting", now); }
  async markAccepted(id: string, now = Date.now()): Promise<void> { await this.transition(id, ["submitting"], "accepted", now); }

  async waitForLimit(id: string, retryAt: number, now = Date.now()): Promise<void> {
    const record = this.require(id);
    if (!Number.isFinite(retryAt) || retryAt <= now) throw new Error("Rate-limit retry must be in the future");
    await this.transition(id, ["queued", "submitting"], "waiting_for_limit", now, retryAt);
  }

  async recover(adapter: ThreadReconciler, now = Date.now()): Promise<void> {
    for (const record of this.records.values()) {
      if (record.state !== "submitting") continue;
      try {
        const thread = await adapter.readThread({ ...record }, { includeTurns: true });
        const matches = thread.turns.filter((turn) => turn.clientUserMessageId === record.clientUserMessageId).length;
        record.state = matches === 1 ? "accepted" : "attention_required";
      } catch {
        record.state = "attention_required";
      }
      record.updatedAt = now;
    }
    await this.flush();
  }

  recoverWaitingTimers(): Array<{ id: string; retryAt: number }> {
    return this.list()
      .filter((record) => record.state === "waiting_for_limit" && record.retryAt !== null)
      .map((record) => ({ id: record.id, retryAt: record.retryAt! }))
      .sort((left, right) => left.retryAt - right.retryAt || left.id.localeCompare(right.id));
  }

  private require(id: string): DispatchRecord {
    const record = this.records.get(id);
    if (!record) throw new Error(`Unknown dispatch ${id}`);
    return record;
  }

  private async transition(id: string, allowed: DispatchRecord["state"][], state: DispatchRecord["state"], now: number, retryAt?: number): Promise<void> {
    const record = this.require(id);
    if (!allowed.includes(record.state)) throw new Error(`Cannot transition dispatch ${id} from ${record.state} to ${state}`);
    const prior = { ...record };
    record.state = state;
    record.updatedAt = now;
    record.retryAt = retryAt ?? null;
    try { await this.flush(); } catch (error) { Object.assign(record, prior); throw error; }
  }

  private async flush(): Promise<void> { await this.persist(this.list()); }
}
