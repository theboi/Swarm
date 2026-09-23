import { describe, expect, it } from "vitest";

import { normalizeLegacyAccountId, normalizePersistedAccountIds } from "./legacyAccountMigration.js";

describe("legacy account migration", () => {
  it("normalizes every durable account-bearing field without mutating the input", () => {
    const persisted = {
      preferredAccount: "bot3",
      dispatches: [{ accountId: "bot3" }],
      workerAssignments: [{
        accountId: "bot3",
        transferHistory: [{ fromAccountId: "bot3", toAccountId: "bot4" }],
      }],
      limitResumes: [{ accountId: "bot3" }],
      notifications: { breakingChangeAccounts: ["bot3"] },
      accountRateLimits: { bot3: [{ label: "five-hour" }] },
    };

    expect(normalizePersistedAccountIds(persisted)).toEqual({
      preferredAccount: "bot3/acc1",
      dispatches: [{ accountId: "bot3/acc1" }],
      workerAssignments: [{
        accountId: "bot3/acc1",
        transferHistory: [{ fromAccountId: "bot3/acc1", toAccountId: "bot4/acc1" }],
      }],
      limitResumes: [{ accountId: "bot3/acc1" }],
      notifications: { breakingChangeAccounts: ["bot3/acc1"] },
      accountRateLimits: { "bot3/acc1": [{ label: "five-hour" }] },
    });
    expect(persisted.preferredAccount).toBe("bot3");
  });

  it("preserves the local account and qualified IDs while rejecting unknown account values", () => {
    expect(normalizeLegacyAccountId("claudiothe")).toBe("claudiothe");
    expect(normalizeLegacyAccountId("bot3/acc2")).toBe("bot3/acc2");
    expect(normalizeLegacyAccountId("bot9")).toBeUndefined();
    expect(() => normalizePersistedAccountIds({ dispatches: [{ accountId: "bot9" }] })).toThrow("Unknown account ID");
  });
});
