import { describe, expect, it } from "vitest";

import { classifyRealtimeMessage, clearUnreadTurn, unreadAfterTurnEvent } from "./coordinatorStore.js";

describe("coordinator realtime messages", () => {
  it("accepts snapshots and detects sequence gaps before applying an incremental event", () => {
    expect(classifyRealtimeMessage({ type: "snapshot", sequence: 4, payload: {} }, 0)).toEqual({ kind: "snapshot", sequence: 4 });
    expect(classifyRealtimeMessage({ type: "rate_limit", sequence: 6, payload: {} }, 4)).toEqual({ kind: "gap", sequence: 6 });
    expect(classifyRealtimeMessage({ type: "rate_limit", sequence: 5, payload: {} }, 4)).toEqual({ kind: "event", sequence: 5 });
  });

  it("marks only completed replies unread and clears the exact chat when it is opened", () => {
    const first = unreadAfterTurnEvent(new Set<string>(), "bot3\u0000thread-1", "completed");
    const ignored = unreadAfterTurnEvent(first, "bot3\u0000thread-2", "limit_exhausted");
    const historical = unreadAfterTurnEvent(ignored, "bot3\u0000thread-old", "completed", true);

    expect([...historical]).toEqual(["bot3\u0000thread-1"]);
    expect([...clearUnreadTurn(historical, "bot3\u0000thread-1")]).toEqual([]);
  });
});
