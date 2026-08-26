import { describe, expect, it } from "vitest";

import { classifyRealtimeMessage } from "./coordinatorStore.js";

describe("coordinator realtime messages", () => {
  it("accepts snapshots and detects sequence gaps before applying an incremental event", () => {
    expect(classifyRealtimeMessage({ type: "snapshot", sequence: 4, payload: {} }, 0)).toEqual({ kind: "snapshot", sequence: 4 });
    expect(classifyRealtimeMessage({ type: "rate_limit", sequence: 6, payload: {} }, 4)).toEqual({ kind: "gap", sequence: 6 });
    expect(classifyRealtimeMessage({ type: "rate_limit", sequence: 5, payload: {} }, 4)).toEqual({ kind: "event", sequence: 5 });
  });
});
