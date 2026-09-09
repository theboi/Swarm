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
    const recovered = await recoverThreadActivity(idleThread, { readRecentActivity: vi.fn(async () => "active" as const) });

    expect(recovered).toMatchObject({ id: "thread-1", activity: "active" });
  });

  it("preserves authoritative app-server activity and ignores unavailable rollout evidence", async () => {
    const readRecentActivity = vi.fn(async () => "idle" as const);

    await expect(recoverThreadActivity({ ...idleThread, activity: "active" }, { readRecentActivity })).resolves.toMatchObject({ activity: "active" });
    await expect(recoverThreadActivity(idleThread, { readRecentActivity: vi.fn(async () => { throw new Error("missing"); }) })).resolves.toBe(idleThread);
    expect(readRecentActivity).not.toHaveBeenCalled();
  });
});
