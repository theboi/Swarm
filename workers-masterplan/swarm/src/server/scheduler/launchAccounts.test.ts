import { describe, expect, it } from "vitest";

import type { AccountSnapshot, ThreadSummary } from "../../shared/contracts.js";
import { rankLaunchAccounts } from "./launchAccounts.js";

const connected = (id: AccountSnapshot["id"], activeTurns = 0): AccountSnapshot => ({
  id,
  connection: "connected",
  authentication: "authenticated",
  rateLimits: [],
  activeTurns,
  lastAssignedAt: null,
});

const worker = (id: string, accountId: AccountSnapshot["id"], isEdenMindProject: boolean, archived = false): ThreadSummary => ({
  id,
  accountId,
  name: id,
  archived,
  isEdenMindProject,
  updatedAt: 1,
  capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false },
});

describe("rankLaunchAccounts", () => {
  it("counts every unarchived chat shown by Chats and ranks accounts with fewer chats first", () => {
    const accounts = [connected("bot1"), connected("bot2"), { ...connected("bot3"), connection: "action_required" as const, authentication: "unauthenticated" as const }];
    const threads = [
      worker("bot1-eden-1", "bot1", true),
      worker("bot1-eden-2", "bot1", true),
      worker("bot1-other", "bot1", false),
      worker("bot2-archived", "bot2", true, true),
      worker("bot3-eden", "bot3", true),
    ];

    expect(rankLaunchAccounts(accounts, threads)).toEqual([
      { id: "bot2", activeWorkers: 0, available: true },
      { id: "bot1", activeWorkers: 3, available: true },
      { id: "bot3", activeWorkers: 1, available: false },
    ]);
  });

  it("keeps claudiothe first when equally available accounts have the same worker count", () => {
    expect(rankLaunchAccounts([connected("bot2"), connected("claudiothe")], [])).toEqual([
      { id: "claudiothe", activeWorkers: 0, available: true },
      { id: "bot2", activeWorkers: 0, available: true },
    ]);
  });
});
