import { describe, expect, it } from "vitest";

import type { ThreadSummary } from "../../shared/contracts.js";
import { applyThreadActivityEvent } from "./threadActivityCache.js";

const idleThread: ThreadSummary = {
  id: "thread-1",
  accountId: "bot3",
  name: "P4",
  archived: false,
  updatedAt: 1,
  activity: "idle",
  capabilities: { canArchive: true, canInterrupt: true, canStartTurn: true, canSteer: true },
};

describe("applyThreadActivityEvent", () => {
  it("records a started turn in the cached thread summary", () => {
    expect(applyThreadActivityEvent([idleThread], {
      type: "turn", accountId: "bot3", threadId: "thread-1", turnId: "turn-live", state: "started",
    })).toEqual([expect.objectContaining({ activity: "active", activeTurnId: "turn-live" })]);
  });

  it("clears cached activity only when the terminal event matches the active turn", () => {
    const active = { ...idleThread, activity: "active" as const, activeTurnId: "turn-live" };

    expect(applyThreadActivityEvent([active], {
      type: "turn", accountId: "bot3", threadId: "thread-1", turnId: "turn-old", state: "completed",
    })).toEqual([active]);
    const completed = applyThreadActivityEvent([active], {
      type: "turn", accountId: "bot3", threadId: "thread-1", turnId: "turn-live", state: "completed",
    });
    expect(completed).toEqual([expect.objectContaining({ activity: "idle" })]);
    expect(completed[0]).not.toHaveProperty("activeTurnId");
  });
});
