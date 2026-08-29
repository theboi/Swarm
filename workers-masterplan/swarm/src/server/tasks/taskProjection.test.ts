import { describe, expect, it } from "vitest";
import type { DispatchRecord, TaskNode, ThreadSummary } from "../../shared/contracts.js";
import { projectDispatchState } from "./taskProjection.js";

const task = (id: string, state: TaskNode["readiness"]["state"]): TaskNode => ({
  id,
  title: id,
  kind: "planning",
  dependsOn: [],
  promptTemplate: "planning",
  readiness: { taskId: id, phase: "planning", state, evidence: [], blockingCodes: [] },
});

const dispatch = (taskId: string, state: DispatchRecord["state"]): DispatchRecord => ({
  id: `${taskId}-${state}`,
  clientUserMessageId: `${taskId}-message`,
  taskId,
  accountId: "bot3",
  threadId: `${taskId}-thread`,
  state,
  createdAt: 1,
  updatedAt: 1,
  retryAt: null,
});

const activeThread = (name: string): ThreadSummary => ({
  id: "thread-active",
  accountId: "bot6",
  name,
  archived: false,
  isEdenMindProject: true,
  updatedAt: 2,
  activity: "active",
  capabilities: { canArchive: true, canInterrupt: true, canStartTurn: true, canSteer: true },
});

describe("task dispatch projection", () => {
  it.each(["queued", "submitting", "accepted", "waiting_for_limit"] as const)("projects %s work as running so it is no longer next-ready", (state) => {
    expect(projectDispatchState([task("F0", "ready")], [dispatch("F0", state)])[0]?.readiness.state).toBe("running");
  });

  it("never regresses a task after a durable dispatch completed", () => {
    expect(projectDispatchState([task("F0", "complete")], [dispatch("F0", "accepted")])[0]?.readiness.state).toBe("complete");
    expect(projectDispatchState([task("P1", "attention_required")], [dispatch("P1", "completed")])[0]?.readiness.state).toBe("complete");
  });

  it("never regresses a task recorded in the durable completion ledger", () => {
    expect(projectDispatchState([task("A1", "blocked")], [], [], [], new Set(["A1"]))[0]?.readiness.state).toBe("complete");
  });

  it("projects an active named EdenMind task thread as running without a historical dispatch", () => {
    const projected = projectDispatchState([task("A1", "attention_required"), task("A10", "ready")], [], [activeThread("A1 · Uploads, requests, and batches")]);

    expect(projected.find((item) => item.id === "A1")?.readiness.state).toBe("running");
    expect(projected.find((item) => item.id === "A10")?.readiness.state).toBe("ready");
  });

  it("treats every unarchived EdenMind task chat as assigned even when its latest turn is idle", () => {
    const base = activeThread("A1 · Uploads, requests, and batches");
    const projected = projectDispatchState([task("A1", "ready")], [], [{ ...base, id: "idle", activity: "idle" }]);

    expect(projected[0]?.readiness.state).toBe("running");
  });

  it("does not bind archived or non-EdenMind chats to a task", () => {
    const base = activeThread("A1 · Uploads, requests, and batches");
    const projected = projectDispatchState([task("A1", "ready")], [], [
      { ...base, id: "archived", archived: true },
      { ...base, id: "elsewhere", isEdenMindProject: false },
    ]);

    expect(projected[0]?.readiness.state).toBe("ready");
  });
});
