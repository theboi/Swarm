import { describe, expect, it, vi } from "vitest";

import { GitSynchronizer } from "./sync.js";

describe("GitSynchronizer", () => {
  it("pulls local first, then pushes bots in account order", async () => {
    const actions: string[] = [];
    const synchronizer = new GitSynchronizer({
      pullLocal: async () => { actions.push("local:pull"); },
      pushBot: async (account) => { actions.push(`${account}:push`); },
    });

    await synchronizer.syncNow();

    expect(actions).toEqual(["local:pull", "bot1:push", "bot2:push", "bot3:push", "bot4:push", "bot5:push", "bot6:push", "bot7:push", "bot8:push"]);
    expect(synchronizer.snapshot("local")).toMatchObject({ state: "ok", action: "pull" });
    expect(synchronizer.snapshot("bot8")).toMatchObject({ state: "ok", action: "push" });
  });

  it("records a warning on only the failed pull or push target and waits for the next scheduled run", async () => {
    const pullLocal = vi.fn(async () => { throw new Error("not fast-forward"); });
    const pushBot = vi.fn(async (account: string) => { if (account === "bot4") throw new Error("rejected"); });
    const synchronizer = new GitSynchronizer({ pullLocal, pushBot });

    await synchronizer.syncNow();

    expect(synchronizer.snapshot("local")).toMatchObject({ state: "warning", action: "pull", message: "Git pull failed." });
    expect(synchronizer.snapshot("bot4")).toMatchObject({ state: "warning", action: "push", message: "Git push failed." });
    expect(synchronizer.snapshot("bot3")).toMatchObject({ state: "ok", action: "push" });
    expect(pullLocal).toHaveBeenCalledTimes(1);
    expect(pushBot).toHaveBeenCalledTimes(8);
  });
});
