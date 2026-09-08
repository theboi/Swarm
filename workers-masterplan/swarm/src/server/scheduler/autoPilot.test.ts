import { describe, expect, it, vi } from "vitest";

import type {
  AccountSnapshot,
  AccountAuthenticationState,
  AccountConnectionState,
  BotAccountId,
  DispatchRecord,
  TaskNode,
  ThreadSummary,
} from "../../shared/contracts.js";
import { DispatchOutbox } from "../dispatch/outbox.js";
import { WorkerAssignmentManifest } from "../tasks/workerAssignments.js";
import { AutoPilotController, AutoPilotRecoveryGuard, latestThreadTurnCompleted, reconcileAutoPilotLaunches, recoverAcceptedAutoPilotDispatches, retryAutoPilotArchives, selectAutoPilotLaunches, settleLaunchCompletion, shouldAutoArchive, shouldHandleCompletedLaunchEvent } from "./autoPilot.js";

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
      refresh: async () => { refreshed = true; return new Set(["bot1", "bot2"] as const); },
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
      refresh: async () => new Set(["bot1", "bot2", "bot3"] as const),
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

  it("does not launch a bot that connects after this run captured its refresh candidates", async () => {
    const accounts = [account("bot1", "action_required", "unauthenticated")];
    const starts: string[] = [];
    const dependencies = {
      refresh: async () => {
        const candidates = new Set<BotAccountId>(accounts.filter((candidate) => candidate.connection === "connected" && candidate.authentication === "authenticated").map((candidate) => candidate.id as BotAccountId));
        accounts[0] = account("bot1");
        return candidates;
      },
      snapshot: () => ({ tasks: [task("T0", "ready")], accounts, threads: [] }),
      launch: async (pair: { taskId: string; accountId: string }) => { starts.push(`${pair.taskId}:${pair.accountId}`); },
      log: () => undefined,
    };

    await reconcileAutoPilotLaunches(dependencies);
    expect(starts).toEqual([]);
    await reconcileAutoPilotLaunches(dependencies);
    expect(starts).toEqual(["T0:bot1"]);
  });

  it("recovers a missed autonomous completion only after thread completion and receipt proof", async () => {
    const finished = thread("bot1", "finished", false);
    const auto = { id: "auto", taskId: "T0", accountId: "bot1" as const, threadId: "finished", origin: "auto_pilot" as const, state: "accepted" as const, clientUserMessageId: "m1", createdAt: 0, updatedAt: 0, retryAt: null };
    const unproven = { ...auto, id: "unproven", clientUserMessageId: "m2", taskId: "T1", accountId: "bot2" as const, threadId: "unproven" };
    const limited = { ...auto, id: "limited", clientUserMessageId: "m3", taskId: "T2", accountId: "bot3" as const, threadId: "limited" };
    const manual = { ...auto, id: "manual", clientUserMessageId: "m4", taskId: "T3", accountId: "bot4" as const, threadId: "manual", origin: "operator" as const };
    const records: DispatchRecord[] = [auto, unproven, limited, manual];
    const outbox = new DispatchOutbox(records);
    const reads: string[] = [];
    const settled: string[] = [];

    await recoverAcceptedAutoPilotDispatches({
      records: () => outbox.list(),
      readCompleted: async (record) => { reads.push(record.id); return record.id !== "limited"; },
      provenComplete: (record) => record.id === "auto" || record.id === "limited",
      settle: async (record) => { await outbox.complete(record.id); settled.push(record.id); if (record.id === "auto") finished.archived = true; },
      log: () => undefined,
    });

    expect(reads).toEqual(["auto", "unproven", "limited"]);
    expect(settled).toEqual(["auto"]);
    expect(outbox.list().map((record) => record.state)).toEqual(["completed", "accepted", "accepted", "accepted"]);
    expect(finished.archived).toBe(true);
    expect(selectAutoPilotLaunches({ tasks: [task("next", "ready")], accounts: [account("bot1")], threads: [finished] })).toEqual([{ taskId: "next", accountId: "bot1" }]);
  });

  it.each(["throws", "loses receipt proof"] as const)("keeps a recovered autonomous launch accepted when settlement's second refresh %s", async (refreshOutcome) => {
    const auto: DispatchRecord = { id: "auto", taskId: "T0", accountId: "bot1", threadId: "finished", origin: "auto_pilot", state: "accepted", clientUserMessageId: "m1", createdAt: 0, updatedAt: 0, retryAt: null };
    const outbox = new DispatchOutbox([auto]);
    const assignments = new WorkerAssignmentManifest();
    await assignments.assign("T0", "bot1", "finished", 1);
    const recoveryGuard = new AutoPilotRecoveryGuard();
    let receiptProven = true;
    let refreshes = 0;
    let overlappingLiveSettlements = 0;
    const errors: Error[] = [];
    const settle = (mode: "live" | "recovery") => settleLaunchCompletion({
      refresh: async () => {
        refreshes += 1;
        if (refreshOutcome === "throws") throw new Error("manifest refresh failed");
        receiptProven = false;
      },
      provenComplete: () => receiptProven,
      complete: async () => { await assignments.complete("bot1", "finished"); await outbox.complete("auto"); },
      markAttentionRequired: async () => { await assignments.markAttentionRequired("bot1", "finished"); await outbox.abandon("auto"); },
    }, mode);

    await recoverAcceptedAutoPilotDispatches({
      records: () => outbox.list(),
      withRecovery: (record, operation) => recoveryGuard.run(record.accountId, record.threadId, operation),
      readCompleted: async (record) => {
        // AppServerClient synchronously emits the historical completion while hydrating readThread.
        if (shouldHandleCompletedLaunchEvent({ accountId: record.accountId, threadId: record.threadId, historical: true }, recoveryGuard)) {
          overlappingLiveSettlements += 1;
          await settle("live");
        }
        return true;
      },
      provenComplete: () => receiptProven,
      settle: async () => { await settle("recovery"); },
      log: (error) => { errors.push(error); },
    });

    expect(refreshes).toBe(1);
    expect(overlappingLiveSettlements).toBe(0);
    expect(outbox.get("auto")?.state).toBe("accepted");
    expect(assignments.forTask("T0")?.state).toBe("assigned");
    expect(errors.map((error) => error.message)).toEqual(refreshOutcome === "throws" ? ["manifest refresh failed"] : []);
  });

  it("handles a live completed event during recovery while still guarding the historical read event", async () => {
    const auto: DispatchRecord = { id: "auto", taskId: "T0", accountId: "bot1", threadId: "finished", origin: "auto_pilot", state: "accepted", clientUserMessageId: "m1", createdAt: 0, updatedAt: 0, retryAt: null };
    const outbox = new DispatchOutbox([auto]);
    const assignments = new WorkerAssignmentManifest();
    await assignments.assign("T0", "bot1", "finished", 1);
    const recoveryGuard = new AutoPilotRecoveryGuard();
    let receiptProven = true;
    let historicalSettlements = 0;
    let liveSettlements = 0;
    const settleLive = () => settleLaunchCompletion({
      refresh: async () => { receiptProven = false; },
      provenComplete: () => receiptProven,
      complete: async () => { await assignments.complete("bot1", "finished"); await outbox.complete("auto"); },
      markAttentionRequired: async () => { await assignments.markAttentionRequired("bot1", "finished"); await outbox.abandon("auto"); },
    }, "live");
    const handleCompletion = async (record: DispatchRecord, historical: boolean) => {
      if (!shouldHandleCompletedLaunchEvent({ accountId: record.accountId, threadId: record.threadId, historical }, recoveryGuard)) return;
      if (historical) historicalSettlements += 1;
      else liveSettlements += 1;
      await settleLive();
    };

    await recoverAcceptedAutoPilotDispatches({
      records: () => outbox.list(),
      withRecovery: (record, operation) => recoveryGuard.run(record.accountId, record.threadId, operation),
      readCompleted: async (record) => {
        await handleCompletion(record, true);
        await handleCompletion(record, false);
        return true;
      },
      provenComplete: () => receiptProven,
      settle: async () => { throw new Error("recovery settlement must not replace the live policy"); },
      log: () => undefined,
    });

    expect(historicalSettlements).toBe(0);
    expect(liveSettlements).toBe(1);
    expect(outbox.get("auto")?.state).toBe("attention_required");
    expect(assignments.forTask("T0")?.state).toBe("attention_required");
  });

  it("retains the attention-required fallback for an unproven live completion", async () => {
    const outbox = new DispatchOutbox([{ id: "live", taskId: "T0", accountId: "bot1", threadId: "finished", origin: "operator", state: "accepted", clientUserMessageId: "m1", createdAt: 0, updatedAt: 0, retryAt: null }]);
    const assignments = new WorkerAssignmentManifest();
    await assignments.assign("T0", "bot1", "finished", 1);

    await settleLaunchCompletion({
      refresh: async () => undefined,
      provenComplete: () => false,
      complete: async () => { await assignments.complete("bot1", "finished"); await outbox.complete("live"); },
      markAttentionRequired: async () => { await assignments.markAttentionRequired("bot1", "finished"); await outbox.abandon("live"); },
    }, "live");

    expect(outbox.get("live")?.state).toBe("attention_required");
    expect(assignments.forTask("T0")?.state).toBe("attention_required");
  });

  it("recognizes only a completed latest thread turn and excludes limit exhaustion", () => {
    expect(latestThreadTurnCompleted({ thread: { turns: [{ status: "completed", startedAt: 1 }, { status: { type: "active" }, startedAt: 2 }] } })).toBe(false);
    expect(latestThreadTurnCompleted({ thread: { turns: [{ status: "active", startedAt: 1 }, { status: { type: "completed" }, startedAt: 2 }] } })).toBe(true);
    expect(latestThreadTurnCompleted({ thread: { turns: [{ status: "completed", error: { codexErrorInfo: "usageLimitExceeded" }, startedAt: 2 }] } })).toBe(false);
    expect(latestThreadTurnCompleted({ thread: { turns: [{ status: "completed", error: { codexErrorInfo: "sessionBudgetExceeded" }, startedAt: 2 }] } })).toBe(false);
  });
});
