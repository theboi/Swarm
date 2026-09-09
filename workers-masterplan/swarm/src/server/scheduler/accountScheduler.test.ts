import { describe, expect, it } from "vitest";
import type { AccountSnapshot, RateLimitWindow } from "../../shared/contracts.js";
import { canDispatch, mergeRateLimits, nextRateLimitCheck, rankAccounts } from "./accountScheduler.js";
import * as accountScheduler from "./accountScheduler.js";

const account = (id: "bot3" | "bot5", limits: RateLimitWindow[], activeTurns = 0): AccountSnapshot => ({ id, connection: "connected", authentication: "authenticated", rateLimits: limits, activeTurns, lastAssignedAt: null });
const limit = (id: string, usedPercent: number | null, resetsAt: number | null): RateLimitWindow => ({ id, label: id, usedPercent, resetsAt, updatedAt: 1 });

describe("account scheduler", () => {
  it("prefers the account with the strongest weakest reported window", () => {
    expect(rankAccounts([account("bot3", [limit("five-hour", 3, 1), limit("weekly", 80, 1)]), account("bot5", [limit("five-hour", 20, 1), limit("weekly", 30, 1)])])[0]?.id).toBe("bot5");
  });
  it("replaces the previous authoritative snapshot so stale reserve buckets cannot survive refresh", () => {
    expect(mergeRateLimits([limit("base_model_inference:primary", 0, 100), limit("codex:primary", 10, 100), limit("codex:secondary", 20, 200)], [limit("luna_reserve:primary", 0, 500), limit("codex:primary", 30, 300), limit("codex:secondary", 40, 400)])).toEqual([limit("codex:primary", 30, 300), limit("codex:secondary", 40, 400)]);
  });
  it("makes malformed buckets ineligible", () => {
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
  it("resumes immediately when a recovered account already has capacity", () => {
    const nextLimitResumeCheck = (accountScheduler as unknown as { nextLimitResumeCheck?: (account: AccountSnapshot, seed: string, now: number) => { at: number; reason: string } }).nextLimitResumeCheck;

    expect(nextLimitResumeCheck).toBeTypeOf("function");
    expect(nextLimitResumeCheck?.(account("bot3", [limit("five", 0, 1_800), limit("week", 20, 7_200)]), "CD", 1_000)).toEqual({ at: 1_000, reason: "available" });
  });
  it("requires an explicit override above global active-turn concurrency", () => {
    expect(canDispatch(3, 3, false)).toBe(false);
    expect(canDispatch(3, 3, true)).toBe(true);
  });
});
