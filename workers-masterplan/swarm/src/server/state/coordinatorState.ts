import { normalizePersistedAccountIds } from "../accounts/legacyAccountMigration.js";

/** A single in-memory durable document with one mutation queue shared by every runtime service. */
export class CoordinatorState<T extends Record<string, unknown> = Record<string, unknown>> {
  private queue = Promise.resolve();
  private readonly data: T;

  constructor(data: T, private readonly write: (value: T) => Promise<void>) {
    this.data = normalizePersistedAccountIds(data);
  }

  root(): T { return this.data; }
  snapshot(): T { return structuredClone(this.data); }

  async mutate(operation: (value: T) => void): Promise<void> {
    const next = this.queue.then(async () => {
      const prior = structuredClone(this.data);
      operation(this.data);
      try { await this.write(this.data); } catch (error) { Object.assign(this.data, prior); throw error; }
    });
    this.queue = next.catch(() => undefined);
    await next;
  }

  /** Persist service-owned mutations made through a reference returned by root(). */
  async persist(): Promise<void> {
    const next = this.queue.then(() => this.write(this.data));
    this.queue = next.catch(() => undefined);
    await next;
  }
}
