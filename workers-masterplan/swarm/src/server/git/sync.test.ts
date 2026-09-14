import { describe, expect, it, vi } from "vitest";
import type { BotAccountId, CodexAccountSlot } from "../../shared/contracts.js";

import { accountForGitSyncTarget, GitMergeConflictError, GitSynchronizer, MergeConflictSteerGate } from "./sync.js";

describe("GitSynchronizer", () => {
  it("pulls local first, then pulls bots in account order", async () => {
    const actions: string[] = [];
    const synchronizer = new GitSynchronizer({
      pullLocal: async () => { actions.push("local:pull"); },
      pullBot: async (account) => { actions.push(`${account}:pull`); },
    });

    await synchronizer.syncNow();

    expect(actions).toEqual(["local:pull", "bot1:pull", "bot2:pull", "bot3:pull", "bot4:pull", "bot5:pull", "bot6:pull", "bot7:pull", "bot8:pull"]);
    expect(synchronizer.snapshot("local")).toMatchObject({ state: "ok", action: "pull" });
    expect(synchronizer.snapshot("bot8")).toMatchObject({ state: "ok", action: "pull" });
  });

  it("pulls only the registry-backed profile checkouts and refreshes them after provisioning", async () => {
    const acc2 = {
      id: "bot1/acc2" as const,
      macosUser: "bot1" as const,
      accountNumber: 2,
      codexHome: "/Users/bot1/.swarm/codex-profiles/acc2",
      workspaceRoot: "/Users/bot1/Dev/EdenMind-acc2",
    };
    const acc3 = {
      ...acc2,
      id: "bot1/acc3" as const,
      accountNumber: 3,
      codexHome: "/Users/bot1/.swarm/codex-profiles/acc3",
      workspaceRoot: "/Users/bot1/Dev/EdenMind-acc3",
    };
    const profiles: CodexAccountSlot[] = [acc2];
    const pullBot = vi.fn(async (_account: BotAccountId | CodexAccountSlot) => undefined);
    const synchronizer = new GitSynchronizer({
      pullLocal: async () => undefined,
      pullBot,
      profileSlots: () => profiles,
    });

    await synchronizer.syncNow();
    profiles.push(acc3);
    synchronizer.refreshTargets();
    await synchronizer.syncNow();

    expect(pullBot).toHaveBeenNthCalledWith(1, acc2);
    expect(pullBot).toHaveBeenNthCalledWith(2, acc2);
    expect(pullBot).toHaveBeenNthCalledWith(3, acc3);
    expect(synchronizer.snapshot("bot1/acc2")).toMatchObject({ state: "ok", action: "pull" });
    expect(synchronizer.snapshot("bot1/acc3")).toMatchObject({ state: "ok", action: "pull" });
  });

  it("records a warning on only the failed pull or push target and waits for the next scheduled run", async () => {
    const pullLocal = vi.fn(async () => { throw new Error("not fast-forward"); });
    const pullBot = vi.fn(async (account: BotAccountId | CodexAccountSlot) => { if (account === "bot4") throw new Error("rejected"); });
    const synchronizer = new GitSynchronizer({ pullLocal, pullBot });

    await synchronizer.syncNow();

    expect(synchronizer.snapshot("local")).toMatchObject({ state: "warning", action: "pull", message: "Git pull failed." });
    expect(synchronizer.snapshot("bot4")).toMatchObject({ state: "warning", action: "pull", message: "Git pull failed." });
    expect(synchronizer.snapshot("bot3")).toMatchObject({ state: "ok", action: "pull" });
    expect(pullLocal).toHaveBeenCalledTimes(1);
    expect(pullBot).toHaveBeenCalledTimes(8);
  });

  it("classifies only an actual merge conflict for operator-assisted resolution", async () => {
    const synchronizer = new GitSynchronizer({
      pullLocal: async () => undefined,
      pullBot: async (account) => {
        if (account === "bot3") throw new GitMergeConflictError();
        if (account === "bot4") throw new Error("network unavailable");
      },
    });

    await synchronizer.syncNow();

    expect(synchronizer.snapshot("bot3")).toMatchObject({ state: "warning", errorCode: "MERGE_CONFLICT" });
    expect(synchronizer.snapshot("bot4")).toMatchObject({ state: "warning" });
    expect(synchronizer.snapshot("bot4").errorCode).toBeUndefined();
  });

  it("allows one steer per continuous merge conflict and rearms after recovery", () => {
    const gate = new MergeConflictSteerGate();
    const conflict = { state: "warning", action: "pull", lastAttemptAt: 1, errorCode: "MERGE_CONFLICT" } as const;
    const recovered = { state: "ok", action: "pull", lastAttemptAt: 2 } as const;

    expect(gate.shouldSteer("bot3", conflict)).toBe(true);
    expect(gate.shouldSteer("bot3", conflict)).toBe(false);
    expect(gate.shouldSteer("bot4", { ...conflict, lastAttemptAt: 3 })).toBe(true);
    expect(gate.shouldSteer("bot3", recovered)).toBe(false);
    expect(gate.shouldSteer("bot3", { ...conflict, lastAttemptAt: 4 })).toBe(true);
  });

  it("maps the local checkout conflict to the claudiothe account", () => {
    expect(accountForGitSyncTarget("local")).toBe("claudiothe");
    expect(accountForGitSyncTarget("bot8")).toBe("bot8");
  });
});
