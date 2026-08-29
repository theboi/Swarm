import type { AccountSnapshot, RateLimitWindow } from "../../shared/contracts.js";

export function mergeRateLimits(current: RateLimitWindow[], update: RateLimitWindow[]): RateLimitWindow[] {
  const merged = new Map(current.map((window) => [window.id, window]));
  for (const window of update) merged.set(window.id, window);
  return [...merged.values()];
}

function remaining(window: RateLimitWindow, now?: number): number | undefined {
  if (!window.id.trim() || !window.label.trim() || !Number.isFinite(window.usedPercent) || window.usedPercent === null || window.usedPercent < 0 || window.usedPercent > 100) return undefined;
  if (window.resetsAt !== null && (!Number.isInteger(window.resetsAt) || window.resetsAt <= 0)) return undefined;
  if (!Number.isFinite(window.updatedAt) || window.updatedAt <= 0 || (now !== undefined && now - window.updatedAt > 5 * 60_000)) return undefined;
  return Math.max(0, Math.min(100, 100 - window.usedPercent));
}
function score(account: AccountSnapshot, now?: number): number | undefined {
  if (account.connection !== "connected" || account.authentication !== "authenticated" || account.rateLimits.length === 0) return undefined;
  const values = account.rateLimits.map((window) => remaining(window, now));
  if (values.some((value) => value === undefined)) return undefined;
  return Math.min(...values as number[]);
}

export function rankAccounts(accounts: AccountSnapshot[], now?: number): AccountSnapshot[] {
  return accounts.filter((account) => score(account, now) !== undefined && score(account, now)! > 0).sort((left, right) => score(right, now)! - score(left, now)! || left.activeTurns - right.activeTurns || (left.lastAssignedAt ?? 0) - (right.lastAssignedAt ?? 0));
}

function stableHash(value: string): number { return [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 0); }
export function nextRateLimitCheck(limits: RateLimitWindow[], seed: string, now = Date.now()): { at: number; reason: "reset" | "heartbeat" } {
  const known = limits.map((limit) => limit.resetsAt).filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const future = known.filter((value) => value * 1_000 > now);
  if (future.length) return { at: Math.min(...future) * 1_000 + 1_000, reason: "reset" };
  const jitter = 40 * 60_000 + (stableHash(seed) % (40 * 60_000 + 1));
  return { at: now + jitter, reason: "heartbeat" };
}

/** Chooses an immediate retry after restart when fresh limits already show capacity. */
export function nextLimitResumeCheck(account: AccountSnapshot, seed: string, now = Date.now()): { at: number; reason: "available" | "reset" | "heartbeat" } {
  if (rankAccounts([account], now).length) return { at: now, reason: "available" };
  return nextRateLimitCheck(account.rateLimits, seed, now);
}

export function canDispatch(activeTurns: number, limit: number, override: boolean): boolean { return activeTurns < limit || override; }
