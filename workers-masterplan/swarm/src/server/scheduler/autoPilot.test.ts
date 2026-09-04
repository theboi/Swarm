import { describe, expect, it, vi } from "vitest";

import type {
  AccountSnapshot,
  AccountAuthenticationState,
  AccountConnectionState,
  TaskNode,
  ThreadSummary,
} from "../../shared/contracts.js";
import { AutoPilotController, selectAutoPilotLaunches } from "./autoPilot.js";

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
