import { describe, expect, it, vi } from "vitest";

import type { ThreadSummary } from "../../shared/contracts.js";
import { recoverThreadActivity } from "./threadActivityRecovery.js";

const idleThread: ThreadSummary = {
  id: "thread-1",
  accountId: "bot3",
  name: "C2",
  archived: false,
  isEdenMindProject: true,
  updatedAt: 1,
  activity: "idle",
  capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false },
};

describe("recoverThreadActivity", () => {
  it("promotes an idle replacement-server summary when the local rollout is still active", async () => {
    const recovered = await recoverThreadActivity(idleThread, { readRecentActivity: vi.fn(async () => ({ activity: "active" as const, turnId: "turn-live" })) });

    expect(recovered).toMatchObject({ id: "thread-1", activity: "active", activeTurnId: "turn-live" });
  });

  it("clears stale app-server activity when the rollout definitively completed", async () => {
    const recovered = await recoverThreadActivity(
      { ...idleThread, activity: "active", activeTurnId: "turn-finished" },
      { readRecentActivity: vi.fn(async () => ({ activity: "idle" as const, terminal: true })) },
    );

    expect(recovered).toMatchObject({ activity: "idle" });
    expect(recovered).not.toHaveProperty("activeTurnId");
  });

  it("preserves authoritative app-server activity when rollout evidence is only stale or unavailable", async () => {
    const readRecentActivity = vi.fn(async () => ({ activity: "idle" as const }));

    await expect(recoverThreadActivity({ ...idleThread, activity: "active" }, { readRecentActivity })).resolves.toMatchObject({ activity: "active" });
    await expect(recoverThreadActivity(idleThread, { readRecentActivity: vi.fn(async () => { throw new Error("missing"); }) })).resolves.toBe(idleThread);
    expect(readRecentActivity).toHaveBeenCalledWith("thread-1");
  });
});
