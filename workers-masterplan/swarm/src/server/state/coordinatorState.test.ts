import { describe, expect, it } from "vitest";

import { CoordinatorState } from "./coordinatorState.js";

describe("CoordinatorState", () => {
  it("serializes mixed durable service mutations through one state snapshot", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const state = new CoordinatorState<Record<string, unknown>>({}, async (value) => { writes.push(structuredClone(value)); });

    await Promise.all([
      state.mutate((value) => { value.dispatches = ["d1"]; }),
      state.mutate((value) => { value.approvals = ["a1"]; }),
      state.mutate((value) => { value.notifications = { active: true }; }),
    ]);

    expect(state.snapshot()).toMatchObject({ dispatches: ["d1"], approvals: ["a1"], notifications: { active: true } });
    expect(writes.at(-1)).toMatchObject({ dispatches: ["d1"], approvals: ["a1"], notifications: { active: true } });
  });
});
