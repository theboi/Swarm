import { describe, expect, it, vi } from "vitest";
import type { AccountSnapshot, RateLimitWindow } from "../../shared/contracts.js";
import { AccountRateLimitRefresher } from "./rateLimitRefresh.js";

describe("AccountRateLimitRefresher", () => {
  it("serializes overlapping probes so a newer success is applied after an older failure", async () => {
    let rejectFirst!: (error: Error) => void;
    const first = new Promise<RateLimitWindow[]>((_resolve, reject) => { rejectFirst = reject; });
    const fresh = [{ id: "primary", label: "Five-hour", usedPercent: 10, resetsAt: 2_000, updatedAt: 1_000 }];
    const read = vi.fn<() => Promise<RateLimitWindow[]>>().mockReturnValueOnce(first).mockResolvedValueOnce(fresh);
    const connection = {};
    let snapshot = { id: "bot2", connection: "connected", authentication: "authenticated", activeWorkers: 0, activeTurns: 0, lastAssignedAt: null, rateLimits: [] } as AccountSnapshot;
    const failure = vi.fn(() => snapshot = { ...snapshot, connection: "action_required", authentication: "unauthenticated" });
    const refresher = new AccountRateLimitRefresher({
      read: async () => read(),
      current: () => snapshot,
      merge: (_current, incoming) => incoming,
      success: (_accountId, windows) => snapshot = { ...snapshot, connection: "connected", authentication: "authenticated", rateLimits: windows },
      failure,
      token: () => connection,
    });

    const older = refresher.refresh("bot2");
    const newer = refresher.refresh("bot2");
    await Promise.resolve();
    expect(read).toHaveBeenCalledOnce();

    rejectFirst(new Error("401 Unauthorized"));
    await expect(older).rejects.toThrow("401");
    await expect(newer).resolves.toMatchObject({ connection: "connected", authentication: "authenticated", rateLimits: fresh });
    expect(read).toHaveBeenCalledTimes(2);
    expect(failure).toHaveBeenCalledOnce();
  });

  it("cancels active and queued probes when their account connection is replaced", async () => {
    let resolveFirst!: (windows: RateLimitWindow[]) => void;
    const first = new Promise<RateLimitWindow[]>((resolve) => { resolveFirst = resolve; });
    const read = vi.fn<() => Promise<RateLimitWindow[]>>().mockReturnValueOnce(first);
    const success = vi.fn();
    const failure = vi.fn();
    let connection: object | undefined = {};
    const snapshot = { id: "bot2", connection: "connected", authentication: "authenticated", activeWorkers: 0, activeTurns: 0, lastAssignedAt: null, rateLimits: [] } as AccountSnapshot;
    const refresher = new AccountRateLimitRefresher({
      read: async () => read(), current: () => snapshot, merge: (_current, incoming) => incoming,
      success: (_accountId, windows) => { success(windows); return snapshot; },
      failure: (_accountId, error) => { failure(error); return snapshot; },
      token: () => connection,
    });

    const active = refresher.refresh("bot2");
    const queued = refresher.refresh("bot2");
    await Promise.resolve();
    connection = undefined;
    resolveFirst([]);

    await expect(active).rejects.toThrow("RATE_LIMIT_REFRESH_CANCELLED");
    await expect(queued).rejects.toThrow("RATE_LIMIT_REFRESH_CANCELLED");
    expect(read).toHaveBeenCalledOnce();
    expect(success).not.toHaveBeenCalled();
    expect(failure).not.toHaveBeenCalled();
  });

  it("prepares an expired account before capturing the connection used by the probe", async () => {
    const priorConnection = {};
    const recoveredConnection = {};
    let connection = priorConnection;
    const prepare = vi.fn(async () => { connection = recoveredConnection; });
    const read = vi.fn(async () => [{ id: "primary", label: "Five-hour", usedPercent: 0, resetsAt: 2_000, updatedAt: 1_000 }]);
    const snapshot = { id: "bot2", connection: "connected", authentication: "authenticated", activeTurns: 0, lastAssignedAt: null, rateLimits: [] } as AccountSnapshot;
    const refresher = new AccountRateLimitRefresher({
      prepare,
      read,
      current: () => snapshot,
      merge: (_current, incoming) => incoming,
      success: (_accountId, windows) => ({ ...snapshot, rateLimits: windows }),
      failure: () => snapshot,
      token: () => connection,
    });

    await expect(refresher.refresh("bot2")).resolves.toMatchObject({ rateLimits: [{ usedPercent: 0 }] });
    expect(prepare).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledOnce();
  });
});
