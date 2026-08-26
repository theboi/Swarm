import { describe, expect, it } from "vitest";
import type { AccountSnapshot, RateLimitWindow } from "../../shared/contracts.js";
import { canDispatch, mergeRateLimits, nextRateLimitCheck, rankAccounts } from "./accountScheduler.js";

const account = (id: "bot3" | "bot5", limits: RateLimitWindow[], activeTurns = 0): AccountSnapshot => ({ id, connection: "connected", authentication: "authenticated", rateLimits: limits, activeTurns, lastAssignedAt: null });
const limit = (id: string, usedPercent: number | null, resetsAt: number | null): RateLimitWindow => ({ id, label: id, usedPercent, resetsAt, updatedAt: 1 });

describe("account scheduler", () => {
  it("prefers the account with the strongest weakest reported window", () => {
    expect(rankAccounts([account("bot3", [limit("five-hour", 3, 1), limit("weekly", 80, 1)]), account("bot5", [limit("five-hour", 20, 1), limit("weekly", 30, 1)])])[0]?.id).toBe("bot5");
  });
  it("merges sparse buckets and makes malformed buckets ineligible", () => {
    expect(mergeRateLimits([limit("five", 10, 100), limit("week", 20, 200)], [limit("five", 30, 300)])).toEqual([limit("five", 30, 300), limit("week", 20, 200)]);
    expect(rankAccounts([account("bot3", [limit("five", null, null)])])).toEqual([]);
  });
  it("rejects malformed identifiers, invalid reset seconds, and stale reset snapshots", () => {
    expect(rankAccounts([account("bot3", [limit("", 20, 1)])])).toEqual([]);
    expect(rankAccounts([account("bot3", [limit("five", 20, -1)])])).toEqual([]);
    expect(rankAccounts([account("bot3", [{ ...limit("five", 20, 1), updatedAt: 0 }])], 10 * 60_000)).toEqual([]);
  });
  it("interprets resets as Unix seconds and deterministically jitters unknown resets", () => {
    expect(nextRateLimitCheck([limit("five", 100, 1_800)], "job", 0)).toEqual({ at: 1_801_000, reason: "reset" });
    const first = nextRateLimitCheck([limit("five", 100, null)], "job", 0);
    expect(first).toEqual(nextRateLimitCheck([limit("five", 100, null)], "job", 0));
    expect(first.at).toBeGreaterThanOrEqual(40 * 60_000);
    expect(first.at).toBeLessThanOrEqual(80 * 60_000);
  });
  it("requires an explicit override above global active-turn concurrency", () => {
    expect(canDispatch(3, 3, false)).toBe(false);
    expect(canDispatch(3, 3, true)).toBe(true);
  });
});
