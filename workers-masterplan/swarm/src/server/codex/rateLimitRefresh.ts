import type { AccountId, AccountSnapshot, RateLimitWindow } from "../../shared/contracts.js";

/** Serializes account usage probes so stale failures cannot overwrite newer success. */
export class AccountRateLimitRefresher {
  private readonly tails = new Map<AccountId, Promise<AccountSnapshot>>();

  constructor(private readonly options: {
    prepare?(accountId: AccountId): Promise<void>;
    read(accountId: AccountId): Promise<RateLimitWindow[]>;
    current(accountId: AccountId): AccountSnapshot;
    merge(current: RateLimitWindow[], incoming: RateLimitWindow[]): RateLimitWindow[];
    success(accountId: AccountId, windows: RateLimitWindow[]): AccountSnapshot;
    failure(accountId: AccountId, error: unknown): AccountSnapshot;
    token(accountId: AccountId): unknown;
  }) {}

  refresh(accountId: AccountId): Promise<AccountSnapshot> {
    const prior = this.tails.get(accountId);
    const operation = (prior ? prior.catch(() => undefined) : Promise.resolve()).then(async () => {
      let expectedToken: unknown;
      try {
        if (this.options.prepare) await this.options.prepare(accountId);
        expectedToken = this.options.token(accountId);
        if (!expectedToken || this.options.token(accountId) !== expectedToken) throw new Error("RATE_LIMIT_REFRESH_CANCELLED");
        const incoming = await this.options.read(accountId);
        if (this.options.token(accountId) !== expectedToken) throw new Error("RATE_LIMIT_REFRESH_CANCELLED");
        return this.options.success(accountId, this.options.merge(this.options.current(accountId).rateLimits, incoming));
      } catch (error) {
        if (this.options.token(accountId) !== expectedToken || (error instanceof Error && error.message === "RATE_LIMIT_REFRESH_CANCELLED")) throw error;
        this.options.failure(accountId, error);
        throw error;
      }
    });
    this.tails.set(accountId, operation);
    void operation.finally(() => { if (this.tails.get(accountId) === operation) this.tails.delete(accountId); }).catch(() => undefined);
    return operation;
  }
}
