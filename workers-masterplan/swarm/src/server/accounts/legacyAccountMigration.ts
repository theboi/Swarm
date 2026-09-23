import { isBotProfileAccountId, isMacosBotId, LOCAL_ACCOUNT_ID, type AccountId } from "../../shared/contracts.js";

const ACCOUNT_ID_FIELDS = new Set([
  "preferredAccount",
  "accountId",
  "fromAccountId",
  "toAccountId",
  "targetAccountId",
  "completedBy",
  "primaryAccountId",
]);
const ACCOUNT_ID_ARRAY_FIELDS = new Set(["breakingChangeAccounts"]);
const ACCOUNT_ID_RECORD_FIELDS = new Set(["accountRateLimits"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeLegacyAccountId(value: unknown): AccountId | undefined {
  if (value === LOCAL_ACCOUNT_ID || isBotProfileAccountId(value)) return value;
  return isMacosBotId(value) ? `${value}/acc1` : undefined;
}

function requiredAccountId(value: unknown): AccountId {
  const accountId = normalizeLegacyAccountId(value);
  if (!accountId) throw new Error("Unknown account ID in durable data");
  return accountId;
}

function latestUpdatedAt(value: unknown[]): number {
  return value.reduce<number>((latest, child) => {
    if (!isRecord(child)) return latest;
    const updatedAt = child.updatedAt;
    if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return latest;
    return Math.max(latest, updatedAt);
  }, Number.NEGATIVE_INFINITY);
}

function normalizeAccountRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Invalid account-keyed durable record");
  const result: Record<string, unknown> = {};
  for (const [accountId, child] of Object.entries(value)) {
    const normalized = requiredAccountId(accountId);
    const candidate = normalize(child);
    if (!Object.hasOwn(result, normalized)) {
      result[normalized] = candidate;
      continue;
    }
    const current = result[normalized];
    if (!Array.isArray(current) || !Array.isArray(candidate)) throw new Error("Duplicate account ID after legacy normalization");
    if (latestUpdatedAt(candidate) > latestUpdatedAt(current)) result[normalized] = candidate;
  }
  return result;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!isRecord(value)) return value;

  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (ACCOUNT_ID_FIELDS.has(key)) {
      result[key] = child === undefined || (key === "primaryAccountId" && child === null) ? child : requiredAccountId(child);
    } else if (ACCOUNT_ID_ARRAY_FIELDS.has(key)) {
      if (!Array.isArray(child)) throw new Error(`Invalid ${key} durable field`);
      result[key] = child.map(requiredAccountId);
    } else if (ACCOUNT_ID_RECORD_FIELDS.has(key)) {
      result[key] = normalizeAccountRecord(child);
    } else {
      result[key] = normalize(child);
    }
  }
  return result;
}

/** Converts legacy bot IDs at durable-state boundaries without writing any files. */
export function normalizePersistedAccountIds<T>(value: T): T {
  return normalize(value) as T;
}
