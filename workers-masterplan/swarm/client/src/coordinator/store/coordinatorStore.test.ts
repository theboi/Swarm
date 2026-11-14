import { describe, expect, it } from "vitest";

import { acknowledgeApprovalsForThread, classifyRealtimeMessage, clearUnreadTurn, completionNotificationUpdate, unreadApprovalTurnKeys } from "./coordinatorStore.js";
import * as coordinatorStore from "./coordinatorStore.js";

describe("coordinator realtime messages", () => {
  it("does not let a late terminal event stop a newer active turn", () => {
    const shouldClear = (coordinatorStore as unknown as { shouldClearActiveTurn?: (activeTurnId: string | undefined, eventTurnId: string | undefined, historical: boolean) => boolean }).shouldClearActiveTurn;

    expect(shouldClear).toBeTypeOf("function");
    expect(shouldClear?.("turn-new", "turn-old", true)).toBe(false);
    expect(shouldClear?.("turn-new", "turn-new", true)).toBe(true);
    expect(shouldClear?.("turn-new", undefined, true)).toBe(false);
    expect(shouldClear?.("turn-new", "turn-old", false)).toBe(false);
    expect(shouldClear?.("turn-new", undefined, false)).toBe(false);
    expect(shouldClear?.("turn-new", "turn-new", false)).toBe(true);
  });

  it("accepts snapshots and detects sequence gaps before applying an incremental event", () => {
    expect(classifyRealtimeMessage({ type: "snapshot", sequence: 4, payload: {} }, 0)).toEqual({ kind: "snapshot", sequence: 4 });
    expect(classifyRealtimeMessage({ type: "rate_limit", sequence: 6, payload: {} }, 4)).toEqual({ kind: "gap", sequence: 6 });
    expect(classifyRealtimeMessage({ type: "rate_limit", sequence: 5, payload: {} }, 4)).toEqual({ kind: "event", sequence: 5 });
  });

  it("marks only completed replies unread and clears the exact chat when it is opened", () => {
    const first = completionNotificationUpdate(new Set(), new Map(), "bot3\u0000thread-1", "turn-1", "completed");
    const ignored = completionNotificationUpdate(first.unread, first.notifiedCompletionIds, "bot3\u0000thread-2", "turn-2", "limit_exhausted");
    const historical = completionNotificationUpdate(ignored.unread, ignored.notifiedCompletionIds, "bot3\u0000thread-old", "turn-old", "completed", true);

    expect([...historical.unread]).toEqual(["bot3\u0000thread-1"]);
    expect([...clearUnreadTurn(historical.unread, "bot3\u0000thread-1")]).toEqual([]);
  });

  it("does not notify twice when the same completed turn is replayed after its chat was opened", () => {
    const first = completionNotificationUpdate(new Set(), new Map(), "bot3\u0000thread-1", "turn-1", "completed");
    const read = clearUnreadTurn(first.unread, "bot3\u0000thread-1");
    const replayed = completionNotificationUpdate(read, first.notifiedCompletionIds, "bot3\u0000thread-1", "turn-1", "completed");
    const nextTurn = completionNotificationUpdate(replayed.unread, replayed.notifiedCompletionIds, "bot3\u0000thread-1", "turn-2", "completed");

    expect([...replayed.unread]).toEqual([]);
    expect([...nextTurn.unread]).toEqual(["bot3\u0000thread-1"]);
  });

  it("acknowledges only the pending approvals belonging to the chat that was opened", () => {
    const approvals = [
      { id: "approval-1", accountId: "bot3" as const, threadId: "thread-1", turnId: "turn-1", itemId: "item-1", method: "command", summary: "One", availableDecisions: ["decline"], createdAt: 1 },
      { id: "approval-2", accountId: "bot3" as const, threadId: "thread-2", turnId: "turn-2", itemId: "item-2", method: "command", summary: "Two", availableDecisions: ["decline"], createdAt: 2 },
    ];

    const acknowledged = acknowledgeApprovalsForThread(new Set<string>(), approvals, "bot3", "thread-1");

    expect([...acknowledged]).toEqual(["approval-1"]);
    expect([...unreadApprovalTurnKeys(approvals, acknowledged)]).toEqual(["bot3\u0000thread-2"]);
  });
});
