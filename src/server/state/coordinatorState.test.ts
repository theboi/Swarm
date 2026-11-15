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

  it("normalizes legacy durable account IDs in memory and persists them only on the next save", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const state = new CoordinatorState<Record<string, unknown>>({
      dispatches: [{ accountId: "bot3" }],
      workerAssignments: [{ accountId: "bot3", transferHistory: [{ fromAccountId: "bot3", toAccountId: "bot4" }] }],
      limitResumes: [{ accountId: "bot3" }],
    }, async (value) => { writes.push(structuredClone(value)); });

    expect(state.snapshot()).toMatchObject({
      dispatches: [{ accountId: "bot3/acc1" }],
      workerAssignments: [{ accountId: "bot3/acc1", transferHistory: [{ fromAccountId: "bot3/acc1", toAccountId: "bot4/acc1" }] }],
      limitResumes: [{ accountId: "bot3/acc1" }],
    });
    expect(writes).toEqual([]);

    await state.persist();

    expect(writes).toEqual([expect.objectContaining({ dispatches: [{ accountId: "bot3/acc1" }] })]);
  });
});
