import { describe, expect, it, vi } from "vitest";

import type {
  AccountSnapshot,
  AccountAuthenticationState,
  AccountConnectionState,
  DispatchRecord,
  TaskNode,
  ThreadSummary,
} from "../../shared/contracts.js";
import { AutoPilotController, reconcileAutoPilotLaunches, retryAutoPilotArchives, selectAutoPilotLaunches, shouldAutoArchive } from "./autoPilot.js";

const task = (id: string, state: TaskNode["readiness"]["state"]): TaskNode => ({
  id,
  title: id,
  kind: "execution",
  dependsOn: [],
  promptTemplate: "execution",
  readiness: {
    taskId: id,
    state,
    phase: "execution",
    evidence: [],
    blockingCodes: [],
  },
});

const account = (
  id: AccountSnapshot["id"],
  connection: AccountConnectionState = "connected",
  authentication: AccountAuthenticationState = "authenticated",
): AccountSnapshot => ({
  id,
  connection,
  authentication,
  rateLimits: [],
  activeTurns: 0,
  lastAssignedAt: null,
});

const thread = (accountId: AccountSnapshot["id"], id: string, archived: boolean): ThreadSummary => ({
  id,
  accountId,
  name: id,
  archived,
  updatedAt: 1,
  capabilities: {
    canArchive: true,
    canInterrupt: false,
    canStartTurn: true,
    canSteer: false,
  },
});

describe("selectAutoPilotLaunches", () => {
  it("pairs ready tasks with connected authenticated idle bots", () => {
    expect(selectAutoPilotLaunches({
      tasks: [task("T0", "ready"), task("T1", "blocked"), task("T2", "ready")],
      accounts: [
        account("claudiothe"),
        account("bot1"),
        account("bot2"),
        account("bot3", "action_required", "unauthenticated"),
      ],
      threads: [thread("bot2", "existing", false)],
    })).toEqual([{ taskId: "T0", accountId: "bot1" }]);
  });

  it("does not let an archived chat occupy a bot", () => {
    expect(selectAutoPilotLaunches({
      tasks: [task("T0", "ready")],
      accounts: [account("bot1")],
      threads: [thread("bot1", "archived-chat", true)],
    })).toEqual([{ taskId: "T0", accountId: "bot1" }]);
  });

  it("counts unrelated unarchived chats as bot occupancy", () => {
    expect(selectAutoPilotLaunches({
      tasks: [task("T0", "ready"), task("T1", "ready")],
      accounts: [account("bot1"), account("bot2")],
      threads: [thread("bot1", "unrelated-chat", false)],
    })).toEqual([{ taskId: "T0", accountId: "bot2" }]);
  });

  it("preserves ready-task manifest order while pairing bots in stable order", () => {
    expect(selectAutoPilotLaunches({
      tasks: [task("T2", "ready"), task("T0", "blocked"), task("T1", "ready")],
      accounts: [account("bot2"), account("bot1")],
      threads: [],
    })).toEqual([
      { taskId: "T2", accountId: "bot1" },
      { taskId: "T1", accountId: "bot2" },
    ]);
  });
});

describe("AutoPilotController", () => {
  it("runs on startup and its safety interval, then clears the timer on shutdown", async () => {
    vi.useFakeTimers();
    let runs = 0;
    const controller = new AutoPilotController({ isEnabled: () => true, reconcile: async () => { runs += 1; }, log: () => undefined, intervalMs: 15_000 });
    try {
      controller.start();
      await controller.whenIdle();
      expect(runs).toBe(1);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(runs).toBe(2);
      controller.stop();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(runs).toBe(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally { controller.stop(); vi.useRealTimers(); }
  });
  it("serializes reconciliation and coalesces requests that arrive while running", async () => {
    let resolveFirst: (() => void) | undefined;
    const firstRun = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    let runs = 0;
    const reconcile = vi.fn(async () => {
      runs += 1;
      if (runs === 1) await firstRun;
    });
    const controller = new AutoPilotController({
      isEnabled: () => true,
      reconcile,
      log: vi.fn(),
      intervalMs: 60_000,
    });

    controller.request();
    controller.request();
    controller.request();
    await Promise.resolve();
    expect(reconcile).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await controller.whenIdle();
    expect(reconcile).toHaveBeenCalledTimes(2);

    controller.stop();
  });

  it("does not reconcile while disabled", async () => {
    let enabled = false;
    const reconcile = vi.fn(async () => undefined);
    const controller = new AutoPilotController({
      isEnabled: () => enabled,
      reconcile,
      log: vi.fn(),
      intervalMs: 60_000,
    });

    controller.request();
    await controller.whenIdle();
    expect(reconcile).not.toHaveBeenCalled();

    enabled = true;
    controller.request();
    await controller.whenIdle();
    expect(reconcile).toHaveBeenCalledTimes(1);

    controller.stop();
  });

  it("does not do new work after being stopped", async () => {
    const reconcile = vi.fn(async () => undefined);
    const controller = new AutoPilotController({
      isEnabled: () => true,
      reconcile,
      log: vi.fn(),
      intervalMs: 60_000,
    });

    controller.stop();
    controller.request();
    await controller.whenIdle();

    expect(reconcile).not.toHaveBeenCalled();
  });
});

describe("autonomous completion and reconciliation", () => {
  it.each([
    ["auto_pilot", true, true], ["auto_pilot", false, false],
    ["operator", true, false], [undefined, true, false],
  ] as const)("archives origin %s with receipt %s only when autonomous and proven", (origin, proven, expected) => {
    expect(shouldAutoArchive({ origin, state: "accepted" }, proven)).toBe(expected);
    expect(shouldAutoArchive(undefined, proven)).toBe(false);
  });

  it("refreshes first and continues other pairings after a launch rejects", async () => {
    let refreshed = false;
    const starts: string[] = [];
    const errors: Error[] = [];
    await reconcileAutoPilotLaunches({
      refresh: async () => { refreshed = true; },
      snapshot: () => ({ tasks: refreshed ? [task("T0", "ready"), task("T1", "ready")] : [], accounts: [account("bot1"), account("bot2")], threads: [] }),
      launch: async (pair) => { starts.push(`${pair.taskId}:${pair.accountId}`); if (pair.accountId === "bot1") throw new Error("offline"); },
      log: (error) => { errors.push(error); },
    });
    expect(starts).toEqual(["T0:bot1", "T1:bot2"]);
    expect(errors.map((error) => error.message)).toEqual(["offline"]);
  });

  it("rechecks readiness and occupancy before each launch", async () => {
    let currentTasks = [task("T0", "ready"), task("T1", "ready"), task("T2", "ready")];
    const currentThreads: ThreadSummary[] = [];
    const starts: string[] = [];
    await reconcileAutoPilotLaunches({
      refresh: async () => undefined,
      snapshot: () => ({ tasks: currentTasks, accounts: [account("bot1"), account("bot2"), account("bot3")], threads: currentThreads }),
      launch: async (pair) => {
        starts.push(pair.taskId);
        currentTasks = currentTasks.filter((node) => node.id !== "T1");
        currentThreads.push(thread("bot3", "operator-chat", false));
      },
      log: () => undefined,
    });
    expect(starts).toEqual(["T0"]);
  });

  it("retries a failed receipt-proven archive before freeing the bot", async () => {
    const currentThread = thread("bot1", "finished", false);
    const record = { id: "d1", taskId: "T0", accountId: "bot1" as const, threadId: "finished", origin: "auto_pilot" as const, state: "completed" as const, clientUserMessageId: "m1", createdAt: 0, updatedAt: 0, retryAt: null };
    let attempts = 0;
    const errors: Error[] = [];
    const dependencies = {
      records: () => [record, { ...record, id: "manual", origin: "operator" as const, threadId: "manual" }, { ...record, id: "unproven", taskId: "T1", threadId: "unproven" }, { ...record, id: "running", state: "accepted" as const, threadId: "running" }],
      threads: () => [currentThread, thread("bot1", "manual", false), thread("bot1", "unproven", false), thread("bot1", "running", false)],
      provenComplete: (candidate: DispatchRecord) => candidate.taskId === "T0",
      archive: async () => { attempts += 1; if (attempts === 1) throw new Error("archive offline"); currentThread.archived = true; },
      log: (error: Error) => { errors.push(error); },
    };
    await retryAutoPilotArchives(dependencies);
    expect(currentThread.archived).toBe(false);
    expect(selectAutoPilotLaunches({ tasks: [task("next", "ready")], accounts: [account("bot1")], threads: [currentThread] })).toEqual([]);
    await retryAutoPilotArchives(dependencies);
    expect(currentThread.archived).toBe(true);
    expect(attempts).toBe(2);
    expect(errors.map((error) => error.message)).toEqual(["archive offline"]);
    await retryAutoPilotArchives(dependencies);
    expect(attempts).toBe(2);
  });
});
