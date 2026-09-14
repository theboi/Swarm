import { access, realpath, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import dotenv from "dotenv";
import { spawn as spawnPty } from "node-pty";

import { isBotProfileAccountId, isMacosBotId, LOCAL_ACCOUNT_ID, type AccountId, type AutoPilotState, type BotProfileAccountId, type ChatExecutionSettings, type CodexAccountSlot, type CoordinatorSnapshot, type DispatchRecord, type HealthSnapshot, type LimitResumeRecord, type LocalWorkspaceSnapshot, type MacosBotId, type ManifestPass, type RateLimitWindow, type TaskManifest, type TaskNode, type TaskReadiness, type ThreadSummary, type WorkerAssignmentRecord } from "../shared/contracts.js";
import { LoginCoordinator } from "./accounts/loginCoordinator.js";
import { PrimaryProfileManager } from "./accounts/primaryProfileManager.js";
import { restorePrimaryProfileState } from "./accounts/primaryProfileState.js";
import { ProfileProvisioner } from "./accounts/profileProvisioner.js";
import { ProfileRegistry } from "./accounts/profileRegistry.js";
import { createPasswordHash } from "./auth/password.js";
import { LoginThrottle, SessionStore } from "./auth/sessionStore.js";
import { createTotpVerifier } from "./auth/totp.js";
import { DurableApprovalJournal } from "./approvals/journal.js";
import type { ApprovalJournalEntry } from "./codex/approvalRouter.js";
import { ApprovalRouter } from "./codex/approvalRouter.js";
import { AccountManager } from "./codex/accountManager.js";
import { AppServerClient } from "./codex/appServerClient.js";
import { AccountRateLimitRefresher, refreshAllAccountRateLimits } from "./codex/rateLimitRefresh.js";
import { JsonRpcClient } from "./codex/jsonRpcClient.js";
import { LocalRolloutTranscriptReader } from "./codex/localRolloutReader.js";
import { readWorkspaceMarkdown } from "./codex/safeFileReader.js";
import { SuLauncher, type PortLease } from "./codex/suLauncher.js";
import { openMacOsTerminal } from "./codex/terminalConsole.js";
import { workspaceRoot } from "./codex/protocol.js";
import { normalizeThreadActivity, normalizeThreadCapabilities } from "./codex/threadCapabilities.js";
import { recoverThreadActivity } from "./codex/threadActivityRecovery.js";
import { createApprovalContext } from "./safety/approvalPolicy.js";
import { loadConfig, type SwarmConfig } from "./config/config.js";
import { DispatchOutbox } from "./dispatch/outbox.js";
import { createLogger } from "./logging/logger.js";
import { GitCommandRunner } from "./git/commandRunner.js";
import { accountForGitSyncTarget, GitSynchronizer, MergeConflictSteerGate } from "./git/sync.js";
import { createCoordinatorApp } from "./app.js";
import { dashboardOrigins } from "./http/dashboardOrigins.js";
import type { CoordinatorRouteServices } from "./http/routes.js";
import { mergeRateLimits, nextLimitResumeCheck, rankAccounts } from "./scheduler/accountScheduler.js";
import { rankLaunchAccounts } from "./scheduler/launchAccounts.js";
import { AutoPilotController, AutoPilotRecoveryGuard, latestThreadTurnCompleted, reconcileAutoPilotLaunches, recoverAcceptedAutoPilotDispatches, retryAutoPilotArchives, selectAutoPilotLaunches, settleLaunchCompletion, shouldAutoArchive, shouldHandleCompletedLaunchEvent } from "./scheduler/autoPilot.js";
import { nextRateLimitCheck } from "./scheduler/accountScheduler.js";
import { CoordinatorState } from "./state/coordinatorState.js";
import { createCoordinatorStateStore } from "./state/atomicStateStore.js";
import { projectDispatchState, reconcileTaskAssignments } from "./tasks/taskProjection.js";
import { refreshTaskGraphAtomically } from "./tasks/taskRefreshState.js";
import { applyCompletionManifest, completedTaskIdsForPass, loadCompletionManifest, projectManifestToPass } from "./tasks/completionManifest.js";
import { WorkerAssignmentManifest } from "./tasks/workerAssignments.js";
import { LimitResumeManifest, shouldRetireLimitResume, type DurableLimitResumeRecord } from "./tasks/limitResumes.js";
import { moveWithJsonl } from "./tasks/threadHandoff.js";
import { loadManifest } from "./tasks/manifestLoader.js";
import { executionLaunchMetadata, taskArtifactLaunchMetadata } from "./tasks/launchMetadata.js";
import { launchGitMetadata } from "./tasks/launchGitMetadata.js";
import { renderWorkerPrompt } from "./tasks/promptTemplates.js";

const execFileAsync = promisify(execFile);

type DurableState = {
  auth?: { challenges?: Record<string, unknown>; sessions?: Record<string, unknown>; loginThrottle?: Record<string, { failures: number; retryAt: number }>; usedTotp?: Record<string, true> };
  autoPilot?: AutoPilotState;
  dispatches?: DispatchRecord[];
  workerAssignments?: WorkerAssignmentRecord[];
  limitResumes?: DurableLimitResumeRecord[];
  completedTaskIds?: string[];
  completedTaskPass?: ManifestPass;
  approvals?: ApprovalJournalEntry[];
  notifications?: { breakingChangeAccounts?: AccountId[] };
  accountRateLimits?: Partial<Record<AccountId, RateLimitWindow[]>>;
};

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringAt(value: unknown, field: string): string | undefined { const result = object(value)[field]; return typeof result === "string" && result ? result : undefined; }
function isWorkspaceThread(cwd: unknown, workspace: string | undefined): boolean {
  if (typeof cwd !== "string" || !workspace) return false;
  try {
    const path = cwd.startsWith("file:") ? fileURLToPath(cwd) : cwd;
    return resolve(path) === resolve(workspace);
  } catch {
    return false;
  }
}
function asThread(account: AccountId, source: Record<string, unknown>, workspace?: string): ThreadSummary {
  const id = stringAt(source, "id");
  if (!id) throw new Error("App-server did not return a thread identifier");
  const updated = source.updatedAt;
  return { id, accountId: account, name: typeof source.name === "string" ? source.name : null, archived: source.archived === true, isEdenMindProject: isWorkspaceThread(source.cwd, workspace), updatedAt: typeof updated === "number" ? updated : Date.now(), activity: normalizeThreadActivity(source), capabilities: normalizeThreadCapabilities(source) };
}
function responseThread(value: unknown): Record<string, unknown> { const response = object(value); return response.thread && typeof response.thread === "object" && !Array.isArray(response.thread) ? object(response.thread) : response; }

/** Fails closed: an indeterminate Desktop process state must never permit a primary symlink swap. */
async function desktopRunningFor(bot: MacosBotId): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("/usr/bin/pgrep", ["-u", bot, "-fl", "/Applications/(ChatGPT|Codex)\\.app/"]);
    return stdout.trim().length > 0;
  } catch (error) {
    return Number((error as NodeJS.ErrnoException).code) === 1 ? false : true;
  }
}

async function leasePort(): Promise<PortLease> {
  const listener = createNetServer();
  await new Promise<void>((resolveListen, rejectListen) => { listener.once("error", rejectListen); listener.listen(0, "127.0.0.1", () => resolveListen()); });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a loopback port");
  return { port: address.port, release: async () => new Promise<void>((resolveClose) => listener.close(() => resolveClose())) };
}

function taskNode(manifest: TaskManifest, readiness: TaskReadiness[]): TaskNode[] {
  return manifest.tasks.map((task) => ({ ...task, readiness: readiness.find((candidate) => candidate.taskId === task.id) ?? { taskId: task.id, phase: task.kind, state: "blocked", evidence: [], blockingCodes: ["TASK_NOT_READY"] } }));
}

async function createRuntime(config: SwarmConfig) {
  const registry = await ProfileRegistry.load(resolve(process.cwd(), ".data", "account-profiles.json"));
  let profileSlots = registry.list();
  let accountIds: AccountId[] = [LOCAL_ACCOUNT_ID, ...profileSlots.map((slot) => slot.id)];
  const slotFor = (account: AccountId): CodexAccountSlot | undefined => profileSlots.find((slot) => slot.id === account);
  const primaryProfiles = new PrimaryProfileManager({ registry, desktopRunning: desktopRunningFor });
  const primaryByBot = await restorePrimaryProfileState(primaryProfiles, profileSlots);
  const logger = createLogger({ secrets: [config.loginPasswordHash, config.totpSecret, config.sessionSecret, ...Object.values(config.accountPasswords)].filter((value): value is string => Boolean(value)) });
  const store = createCoordinatorStateStore<DurableState>(resolve(process.cwd(), ".data", "state.json"), config);
  const state = new CoordinatorState(await store.read(), async (value) => store.write(value));
  const root = state.root();
  root.auth ??= {};
  root.autoPilot ??= { enabled: false };
  root.notifications ??= {};
  root.notifications.breakingChangeAccounts ??= [];
  const sessions = new SessionStore(config.sessionSecret, { persistence: root.auth as never, persist: () => state.persist() });
  const throttle = new LoginThrottle({ persistence: root.auth as never, persist: () => state.persist() });
  const verifyTotp = createTotpVerifier(config.totpSecret, { persistence: root.auth as never, persist: () => state.persist() });
  const journal = new DurableApprovalJournal(root.approvals ?? [], async (entries) => state.mutate((value) => { value.approvals = entries; }));
  const outbox = new DispatchOutbox(root.dispatches ?? [], async (records) => state.mutate((value) => { value.dispatches = records; }));
  const assignments = new WorkerAssignmentManifest(root.workerAssignments ?? [], async (records) => state.mutate((value) => { value.workerAssignments = records; }));
  root.limitResumes ??= (root.workerAssignments ?? [])
    .filter((record) => record.state === "waiting_for_limit" || record.state === "resuming" || record.state === "transferring")
    .map((record): LimitResumeRecord => ({ accountId: record.accountId, threadId: record.threadId, state: record.state as LimitResumeRecord["state"], updatedAt: record.updatedAt, ...(record.resumeClientUserMessageId ? { resumeClientUserMessageId: record.resumeClientUserMessageId } : {}) }));
  const limitResumes = new LimitResumeManifest(root.limitResumes, async (records) => state.mutate((value) => { value.limitResumes = records; }));
  const completedTaskIds = new Set(root.completedTaskIds ?? []);
  let completedTaskPass = root.completedTaskPass;
  const coordinationWorkspaceRoot = resolve(config.coordinationRoot ?? process.cwd());
  const workspaceFor = (account: AccountId): string | undefined => account === LOCAL_ACCOUNT_ID ? coordinationWorkspaceRoot : slotFor(account)?.workspaceRoot;
  const projectWorkspaceFor = (account: AccountId): string => workspaceRoot(slotFor(account) ?? account, workspaceFor(account));
  const legacyCodexHome = (macosUser: import("../shared/contracts.js").MacosBotId): string => `/Users/${macosUser}/.codex`;
  const codexHomeForAccount = (account: AccountId): string => {
    if (account === LOCAL_ACCOUNT_ID) return process.env.CODEX_HOME ?? `/Users/${config.localAccount}/.codex`;
    if (isMacosBotId(account)) return legacyCodexHome(account);
    const slot = slotFor(account);
    if (slot) return slot.codexHome;
    throw new Error("A logical profile requires an explicit Codex home slot");
  };
  const localWorkspace: LocalWorkspaceSnapshot = { label: `${config.localAccount} (local)`, gitSync: { state: "idle", action: "pull", lastAttemptAt: null } };
  let publishRuntimeEvent: (type: string, payload: Record<string, unknown>) => void = () => undefined;
  let publishAccountSnapshots: (accounts: import("../shared/contracts.js").AccountSnapshot[]) => void = () => undefined;
  let requestAutoPilot = () => undefined;
  let shuttingDown = false;
  const gitRunner = new GitCommandRunner(coordinationWorkspaceRoot, config.accountPasswords);
  const activeTurnIds = new Map<string, string>();
  const activeTurnKey = (account: AccountId, threadId: string) => `${account}\u0000${threadId}`;
  let scheduleLimitResume: (account: AccountId, threadId: string, retryNotBefore?: number) => Promise<void> = async () => undefined;
  const launcher = new SuLauncher({
    spawnPty: (file, args, options) => {
      const child = spawnPty(file, args, options);
      return {
        get pid() { return child.pid; },
        write: (value) => child.write(value),
        kill: (signal) => child.kill(signal),
        dispose: () => (child as unknown as { destroy(): void }).destroy(),
        onData: (listener) => child.onData(listener),
        onExit: (listener) => child.onExit(listener),
      };
    },
    allocatePort: leasePort,
    pathExists: async (path) => access(path).then(() => true).catch(() => false),
    verifyCodexBinary: async (path) => access(path).then(() => true).catch(() => false),
    waitForReady: async (endpoint, capabilityToken) => { const probe = new JsonRpcClient({ launch: { endpoint, capabilityToken } }); await probe.connect(); await probe.close(); },
    // A cold local Codex profile can exceed the normal 30-second app-server startup.
    startupTimeoutMs: 120_000,
    killProcessGroup: (pid, signal) => { try { process.kill(pid, signal); } catch { /* process already gone */ } },
    openTerminal: openMacOsTerminal,
    log: (entry) => logger.info("suLauncher", entry),
  });
  const rolloutReaders = new Map<AccountId, LocalRolloutTranscriptReader>(accountIds.map((account) => [account, new LocalRolloutTranscriptReader(codexHomeForAccount(account))]));
  const refreshProfileRuntime = (): void => {
    profileSlots = registry.list();
    accountIds = [LOCAL_ACCOUNT_ID, ...profileSlots.map((slot) => slot.id)];
    for (const slot of profileSlots) {
      if (!rolloutReaders.has(slot.id)) rolloutReaders.set(slot.id, new LocalRolloutTranscriptReader(slot.codexHome));
    }
  };
  const completedLaunchThreads = new Set<string>();
  const completedLaunchThreadKey = (account: AccountId, threadId: string) => `${account}\u0000${threadId}`;
  const autoPilotRecoveryGuard = new AutoPilotRecoveryGuard();
  let accounts: AccountManager;
  let loginCoordinator: LoginCoordinator | undefined;
  const breakingChangeAccounts = new Set<AccountId>(root.notifications.breakingChangeAccounts);
  const recordBreakingChange = (account: AccountId) => {
    accounts.updateSnapshot(account, { hasBreakingChange: true });
    void state.mutate((value) => {
      value.notifications ??= {};
      value.notifications.breakingChangeAccounts ??= [];
      if (!value.notifications.breakingChangeAccounts.includes(account)) value.notifications.breakingChangeAccounts.push(account);
    }).catch((error) => logger.warn("notifications", { event: "breaking_change_persist_failed", account, error: error instanceof Error ? error.message : "failed" }));
  };
  const settleCompletedLaunchThread = async (account: AccountId, threadId: string, mode: "live" | "recovery" = "live") => {
    const assignment = assignments.forThread(account, threadId);
    const accepted = outbox.list().find((record) => record.accountId === account && record.threadId === threadId && record.state === "accepted");
    // A completion event can beat startTurn's acknowledgement. The launch path
    // retries settlement after persisting accepted; never settle a submission early.
    if (!accepted) return;
    const taskId = assignment?.taskId ?? accepted?.taskId;
    if (!taskId) return;
    const pass = assignment?.pass ?? accepted?.pass ?? "planning";
    const result = await settleLaunchCompletion({
      refresh: () => refreshTasks(true),
      provenComplete: () => !manifestError && completedByPass[pass].has(taskId),
      complete: async () => {
        await assignments.completeTask(taskId, pass);
        await outbox.completeAcceptedForThread(account, threadId);
        completedByPass[pass].add(taskId);
        if (shouldAutoArchive(accepted, true)) {
          try { await services.archiveThread(account, threadId); }
          catch (error) { logger.warn("autoPilot", { event: "archive_failed", account, threadId, error: error instanceof Error ? error.message : "failed" }); }
        }
      },
      markAttentionRequired: async () => {
        await assignments.markAttentionRequired(account, threadId);
        await outbox.abandon(accepted.id);
      },
    }, mode);
    if (result === "unproven" && mode === "recovery") return;
    if (pass === (manifest?.lifecycle?.activePass ?? "planning")) {
      completedTaskIds.clear();
      for (const completedId of completedByPass[pass]) completedTaskIds.add(completedId);
      await state.mutate((value) => { value.completedTaskIds = [...completedTaskIds]; value.completedTaskPass = pass; });
    }
    completedLaunchThreads.delete(completedLaunchThreadKey(account, threadId));
    const snapshot = accounts.snapshot(account);
    accounts.updateSnapshot(account, { activeTurns: Math.max(0, snapshot.activeTurns - 1) });
    requestAutoPilot();
  };
  accounts = new AccountManager({
    launcher,
    codexBin: config.codexBin,
    onRateLimitReadError: (account, error) => logger.warn("accounts", { event: "rate_limits_read_failed", account, error: error instanceof Error ? error.message : "failed" }),
    credentialVersion: async (account) => {
      try {
        const value = await stat(resolve(codexHomeForAccount(account), "auth.json"));
        return `${value.dev}:${value.ino}:${value.size}:${value.mtimeMs}`;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
        throw error;
      }
    },
    accountIds: () => accountIds,
    resolveSlot: slotFor,
    onAuthenticated: (account, metadata) => {
      if (!isBotProfileAccountId(account)) return undefined;
      if (!loginCoordinator) throw new Error("ACCOUNT_AUTH_REQUIRED");
      return loginCoordinator.registerConnectedIdentity(account, metadata);
    },
    onDisconnected: (account) => {
      if (isBotProfileAccountId(account)) loginCoordinator?.disconnect(account);
    },
    createClient: (handle) => {
      const localWorkspaceRoot = handle.slot?.workspaceRoot ?? workspaceFor(handle.account);
      const client = new AppServerClient({ account: handle.account, workspaceRoot: localWorkspaceRoot, rpc: new JsonRpcClient({ launch: handle }), approvalRouter: new ApprovalRouter({ context: createApprovalContext(handle.account, localWorkspaceRoot), journal }), readLockedThread: (threadId: string) => rolloutReaders.get(handle.account)!.readThread(threadId) });
      client.onEvent((event) => {
        if (event.type === "breaking_change") recordBreakingChange(event.accountId);
        if (event.type === "turn" && event.threadId && event.turnId && event.state === "started") {
          activeTurnIds.set(activeTurnKey(event.accountId, event.threadId), event.turnId);
          void assignments.markAssigned(event.accountId, event.threadId).catch((error) => logger.warn("assignments", { event: "mark_assigned_failed", error: error instanceof Error ? error.message : "failed" }));
        }
        if (event.type === "turn" && event.threadId && event.state === "limit_exhausted") {
          const exhaustedThreadId = event.threadId;
          activeTurnIds.delete(activeTurnKey(event.accountId, exhaustedThreadId));
          void (async () => {
            await limitResumes.markWaiting(event.accountId, exhaustedThreadId, Date.now(), client.turnSettings(exhaustedThreadId));
            if (limitResumes.forThread(event.accountId, exhaustedThreadId)?.state !== "waiting_for_limit") return;
            await assignments.markWaitingForLimit(event.accountId, exhaustedThreadId);
            try { await gitRunner.checkpointAndPush(slotFor(event.accountId) ?? event.accountId); }
            catch {
              const status = { state: "warning" as const, action: "push" as const, lastAttemptAt: Date.now(), message: "Git push failed. Push manually before transferring this worker." };
              if (event.accountId === LOCAL_ACCOUNT_ID) localWorkspace.gitSync = status;
              else accounts.updateSnapshot(event.accountId, { gitSync: status });
              publishRuntimeEvent("git_sync", { target: event.accountId, state: status.state, action: status.action });
            }
            await scheduleLimitResume(event.accountId, exhaustedThreadId);
            publishRuntimeEvent("task", { taskId: assignments.forThread(event.accountId, exhaustedThreadId)?.taskId ?? "" });
          })().catch((error) => logger.warn("assignments", { event: "limit_wait_failed", error: error instanceof Error ? error.message : "failed" }));
        }
        if (event.type === "turn" && event.state === "completed" && event.threadId && shouldHandleCompletedLaunchEvent(event, autoPilotRecoveryGuard)) {
          activeTurnIds.delete(activeTurnKey(event.accountId, event.threadId));
          const key = completedLaunchThreadKey(event.accountId, event.threadId);
          if (outbox.list().some((record) => record.accountId === event.accountId && record.threadId === event.threadId && (record.state === "submitting" || record.state === "accepted"))) {
            completedLaunchThreads.add(key);
            void settleCompletedLaunchThread(event.accountId, event.threadId)
              .then(() => refreshTasks(true))
              .then(() => publishRuntimeEvent("task", { taskId: outbox.list().find((record) => record.accountId === event.accountId && record.threadId === event.threadId)?.taskId ?? "" }))
              .catch((error) => logger.warn("dispatch", { event: "complete_failed", account: event.accountId, threadId: event.threadId, error: error instanceof Error ? error.message : "failed" }));
          }
        }
        if (event.type === "turn" && event.threadId && (event.state === "failed" || event.state === "interrupted")) activeTurnIds.delete(activeTurnKey(event.accountId, event.threadId));
        publishRuntimeEvent(event.type, { accountId: event.accountId, ...(event.threadId ? { threadId: event.threadId } : {}), ...(event.turnId ? { turnId: event.turnId } : {}), ...(event.state ? { state: event.state } : {}), ...(event.historical ? { historical: true } : {}) });
      });
      if (isBotProfileAccountId(handle.account) && loginCoordinator) loginCoordinator.bindAppServer(handle.account, client);
      return client;
    },
  });
  for (const id of accountIds) {
    const rateLimits = root.accountRateLimits?.[id];
    if (rateLimits?.length) accounts.updateSnapshot(id, { rateLimits: mergeRateLimits([], rateLimits) });
  }
  for (const id of breakingChangeAccounts) accounts.updateSnapshot(id, { hasBreakingChange: true });
  const gitSynchronizer = new GitSynchronizer({
    pullLocal: () => gitRunner.pullLocal(),
    pullBot: (account) => gitRunner.pullAccount(account),
    profileSlots: () => profileSlots,
  });
  const mergeConflictSteerGate = new MergeConflictSteerGate();
  gitSynchronizer.onChange((target, status) => {
    const syncAccount = accountForGitSyncTarget(target);
    if (target === "local") localWorkspace.gitSync = status;
    accounts.updateSnapshot(syncAccount, { gitSync: status });
    publishRuntimeEvent("git_sync", { target, state: status.state, action: status.action });
    if (mergeConflictSteerGate.shouldSteer(syncAccount, status)) {
      for (const assignment of assignments.list().filter((item) => item.accountId === syncAccount && item.state === "assigned")) {
        const turnId = activeTurnIds.get(activeTurnKey(syncAccount, assignment.threadId));
        const client = accounts.client(syncAccount);
        if (!turnId || !(client instanceof AppServerClient) || !client.isConnected()) continue;
        void client.steerTurn({ threadId: assignment.threadId, turnId, clientUserMessageId: randomUUID(), text: "Pull origin/main and merge the incoming changes. Resolve any merge conflicts, run the affected checks, then continue." })
          .catch((error) => logger.warn("git_sync", { event: "merge_steer_failed", account: syncAccount, error: error instanceof Error ? error.message : "failed" }));
      }
    }
  });
  let manifest: TaskManifest | undefined;
  let nodes: TaskNode[] = [];
  let nodesByPass: Record<ManifestPass, TaskNode[]> = { planning: [], execution: [] };
  let completedByPass: Record<ManifestPass, Set<string>> = { planning: new Set(), execution: new Set() };
  if (completedTaskPass) completedByPass[completedTaskPass] = new Set(completedTaskIds);
  let manifestError: string | undefined;
  let tasksRefreshedAt = 0;
  let taskRefreshPromise: Promise<void> | undefined;
  const refreshTasks = async (force = true) => {
    if (!force && Date.now() - tasksRefreshedAt < 15_000) return;
    if (taskRefreshPromise) return taskRefreshPromise;
    taskRefreshPromise = (async () => {
      const priorProjection = JSON.stringify({ nodesByPass, manifestError, activePass: manifest?.lifecycle?.activePass });
      if (!config.masterplanPath) { manifest = undefined; nodes = []; manifestError = "MASTERPLAN_NOT_READY"; tasksRefreshedAt = Date.now(); return; }
      let candidatePasses: Record<ManifestPass, TaskNode[]> | undefined;
      let candidateCompleted: Record<ManifestPass, Set<string>> | undefined;
      const refreshed = await refreshTaskGraphAtomically({ manifest, nodes }, async () => {
        const fullManifest = await loadManifest(config.masterplanPath!, resolve(config.coordinationRoot ?? process.cwd()));
        const completion = await loadCompletionManifest(fullManifest, coordinationWorkspaceRoot);
        const passEntries = await Promise.all((["planning", "execution"] as const).map(async (pass) => {
          const candidateManifest = projectManifestToPass(fullManifest, pass);
          const receiptCompleted = completedTaskIdsForPass(completion, pass);
          const readiness = applyCompletionManifest(candidateManifest, { ...completion, completedTaskIds: receiptCompleted });
          return [pass, { nodes: taskNode(candidateManifest, readiness), completed: receiptCompleted }] as const;
        }));
        candidatePasses = Object.fromEntries(passEntries.map(([pass, value]) => [pass, value.nodes])) as Record<ManifestPass, TaskNode[]>;
        candidateCompleted = Object.fromEntries(passEntries.map(([pass, value]) => [pass, value.completed])) as Record<ManifestPass, Set<string>>;
        const activePass = fullManifest.lifecycle?.activePass ?? "planning";
        const retainedCompletedTaskIds = candidateCompleted[activePass];
        const candidateNodes = candidatePasses[activePass];
        const completionChanged = retainedCompletedTaskIds.size !== completedTaskIds.size
          || [...retainedCompletedTaskIds].some((taskId) => !completedTaskIds.has(taskId))
          || completedTaskPass !== activePass;
        if (completionChanged || !root.completedTaskIds) {
          await state.mutate((value) => { value.completedTaskIds = [...retainedCompletedTaskIds]; value.completedTaskPass = activePass; });
          completedTaskIds.clear();
          for (const taskId of retainedCompletedTaskIds) completedTaskIds.add(taskId);
          completedTaskPass = activePass;
        }
        return { manifest: fullManifest, nodes: candidateNodes };
      }, (error) => error instanceof Error && error.message.includes("MASTERPLAN") ? "MASTERPLAN_NOT_READY" : "MANIFEST_INVALID");
      manifest = refreshed.manifest;
      nodes = refreshed.nodes;
      if (!refreshed.manifestError && candidatePasses && candidateCompleted) { nodesByPass = candidatePasses; completedByPass = candidateCompleted; }
      manifestError = refreshed.manifestError;
      tasksRefreshedAt = Date.now();
      // Only a changed refresh requests another run, so the controller's own
      // force-refresh cannot turn its coalesced request queue into a busy loop.
      if (JSON.stringify({ nodesByPass, manifestError, activePass: manifest?.lifecycle?.activePass }) !== priorProjection) requestAutoPilot();
    })();
    try { await taskRefreshPromise; } finally { taskRefreshPromise = undefined; }
  };
  await refreshTasks();
  const passwordFor = (id: AccountId): string | undefined => {
    if (isMacosBotId(id)) return config.accountPasswords[id];
    const slot = slotFor(id);
    return slot ? config.accountPasswords[slot.macosUser] : undefined;
  };
  const liveClient = async (id: AccountId): Promise<AppServerClient> => {
    const client = accounts.client(id);
    if (client instanceof AppServerClient && client.isConnected()) return client;
    await accounts.connect({ account: id, password: passwordFor(id) });
    const recovered = accounts.client(id);
    if (!(recovered instanceof AppServerClient) || !recovered.isConnected()) throw new Error("ACCOUNT_OFFLINE");
    return recovered;
  };
  const accountSnapshot = () => accounts.snapshotsList().map((snapshot) => {
    const slot = slotFor(snapshot.id);
    return slot
      ? { ...snapshot, macosUser: slot.macosUser, accountNumber: slot.accountNumber, workspaceRoot: slot.workspaceRoot, isPrimary: primaryByBot.get(slot.macosUser) === slot.id }
      : snapshot;
  });
  const rateLimitRefresher = new AccountRateLimitRefresher({
    prepare: async (id) => {
      if (accounts.snapshot(id).authentication !== "unauthenticated") return;
      await accounts.recoverChangedCredentials({ account: id, password: passwordFor(id) }, { force: true });
    },
    read: async (id) => (await liveClient(id)).readRateLimitWindows(),
    current: (id) => accounts.snapshot(id),
    merge: mergeRateLimits,
    success: (id, rateLimits) => accounts.recordRateLimitReadSuccess(id, rateLimits),
    failure: (id, error) => accounts.recordRateLimitReadFailure(id, error),
    token: (id) => accounts.client(id),
  });
  const updateRateLimits = async (id: AccountId) => rateLimitRefresher.refresh(id);
  const threadCache = new Map<AccountId, ThreadSummary[]>();
  const cacheThreads = (id: AccountId, next: ThreadSummary[]) => {
    threadCache.set(id, next.map((thread) => ({ ...thread, capabilities: { ...thread.capabilities } })));
    return next;
  };
  const upsertCachedThread = (thread: ThreadSummary) => {
    const current = threadCache.get(thread.accountId) ?? [];
    cacheThreads(thread.accountId, [thread, ...current.filter((candidate) => candidate.id !== thread.id)]);
  };
  const threads = async (id: AccountId): Promise<ThreadSummary[]> => {
    const listed = (await (await liveClient(id)).listAllThreads()).map((thread) => asThread(id, thread, projectWorkspaceFor(id)));
    const recovered = await Promise.all(listed.map((thread) => recoverThreadActivity(thread, rolloutReaders.get(id)!)));
    return cacheThreads(id, recovered);
  };
  const refreshAllRateLimits = async () => {
    await refreshAllAccountRateLimits(accountSnapshot(), updateRateLimits);
    await Promise.allSettled(limitResumes.list().filter((record) => record.state === "waiting_for_limit").map((record) => scheduleLimitResume(record.accountId, record.threadId)));
    return accountSnapshot();
  };
  const health = async (): Promise<HealthSnapshot> => ({ server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: manifestError ? "degraded" : "ok", ...(manifestError ? { message: manifestError } : {}) }, outbox: { state: "ok" }, scheduler: { state: "ok" }, accounts: { state: accountSnapshot().some((item) => item.connection === "error") ? "degraded" : "ok" } });
  const reconcileAssignments = async (threadSummaries: ThreadSummary[]) => {
    const pass = manifest?.lifecycle?.activePass ?? "planning";
    await reconcileTaskAssignments(nodes, pass, threadSummaries, assignments, completedTaskIds);
  };
  const snapshot = async (): Promise<CoordinatorSnapshot> => {
    await refreshTasks(false);
    const dispatches = outbox.list();
    const threadSummaries = [...threadCache.values()].flat();
    await reconcileAssignments(threadSummaries);
    const assignmentList = assignments.list();
    const taskPasses = Object.fromEntries((["planning", "execution"] as const).map((pass) => [pass, projectDispatchState(
      nodesByPass[pass],
      dispatches.filter((record) => (record.pass ?? "planning") === pass),
      // Thread-title inference predates pass-aware assignments. Keep it for
      // planning recovery only so an old planning chat cannot make the
      // execution projection look in progress.
      pass === "planning" ? threadSummaries : [],
      assignmentList.filter((record) => (record.pass ?? "planning") === pass),
      completedByPass[pass],
    )])) as Record<ManifestPass, TaskNode[]>;
    const autoPilot = root.autoPilot ?? { enabled: false };
    return { generatedAt: Date.now(), autoPilot: { ...autoPilot }, accounts: accountSnapshot(), localWorkspace: { ...localWorkspace, gitSync: { ...localWorkspace.gitSync } }, tasks: taskPasses[manifest?.lifecycle?.activePass ?? "planning"], taskPasses, dispatches, workerAssignments: assignmentList, limitResumes: limitResumes.publicList(), threads: threadSummaries, pendingApprovals: journal.pending().map((entry) => entry.pending), health: await health() };
  };
  const allowedOrigins = () => dashboardOrigins(config.port, config.host);
  const createPrompt = async (task: TaskNode, id: AccountId) => {
    const relatedNodes = [...nodesByPass.planning, ...nodesByPass.execution];
    const execution = task.promptTemplate === "execution" ? executionLaunchMetadata(task, relatedNodes) : {};
    return renderWorkerPrompt(task.promptTemplate, { workerId: task.id, accountId: id, taskId: task.id, taskTitle: task.title, phase: task.readiness.phase, phaseTerminalCondition: task.promptTemplate === "planning" ? "Stop after the approved planning handoff is integrated on origin/main; do not begin implementation." : task.promptTemplate === "execution" ? "Stop after fresh acceptance evidence, closed review, and the final handoff are integrated on origin/main." : "Stop at the user's review boundary after the accepted presentation handoff is integrated on origin/main.", blueprintPath: manifest?.masterplanPath ?? "", masterplanPath: manifest?.masterplanPath ?? "", coordinationRoot: manifest?.coordinationRoot, statusPath: task.statusPath ?? "", specificationPath: task.specificationPath, implementationPlanPath: task.implementationPlanPath, ...taskArtifactLaunchMetadata(task, relatedNodes), ...execution, ...launchGitMetadata(id, workspaceFor(id)), ownedSurfaces: "Assigned task surfaces only", excludedSurfaces: "Other workers' owned surfaces" });
  };
  const launchAccounts = async () => {
    const current = accountSnapshot();
    return rankLaunchAccounts(current, [...threadCache.values()].flat());
  };
  const rateWaitTimers = new Map<string, NodeJS.Timeout>();
  const limitResumeTimers = new Map<string, NodeJS.Timeout>();
  const clearRateWait = (dispatchId: string) => { const timer = rateWaitTimers.get(dispatchId); if (timer) clearTimeout(timer); rateWaitTimers.delete(dispatchId); };
  const scheduleRateWait = async (record: DispatchRecord) => {
    clearRateWait(record.id);
    const next = nextRateLimitCheck(accounts.snapshot(record.accountId).rateLimits, record.id);
    await outbox.waitForLimit(record.id, next.at);
    const delay = Math.max(0, next.at - Date.now());
    const timer = setTimeout(() => {
      rateWaitTimers.delete(record.id);
      void (async () => {
        try {
          await updateRateLimits(record.accountId);
          if (!rankAccounts([accounts.snapshot(record.accountId)], Date.now()).length) { await scheduleRateWait(outbox.get(record.id) ?? record); return; }
          const active = outbox.get(record.id);
          if (!active || active.state !== "waiting_for_limit") return;
          const task = nodes.find((candidate) => candidate.id === active.taskId);
          if (!task || task.readiness.state !== "ready") { await outbox.abandon(active.id); return; }
          await outbox.markSubmitting(active.id);
          await (await liveClient(active.accountId)).startTurn({ threadId: active.threadId, clientUserMessageId: active.clientUserMessageId, text: await createPrompt(task, active.accountId), settings: active.settings });
          await outbox.markAccepted(active.id);
          requestAutoPilot();
          accounts.updateSnapshot(active.accountId, { activeTurns: accounts.snapshot(active.accountId).activeTurns + 1, lastAssignedAt: Date.now() });
          if (completedLaunchThreads.has(completedLaunchThreadKey(active.accountId, active.threadId))) await settleCompletedLaunchThread(active.accountId, active.threadId);
        } catch { const active = outbox.get(record.id); if (active?.state === "submitting" || active?.state === "waiting_for_limit") await outbox.abandon(active.id); }
      })();
    }, delay);
    timer.unref();
    rateWaitTimers.set(record.id, timer);
  };
  scheduleLimitResume = async (account, threadId, retryNotBefore = 0) => {
    const key = activeTurnKey(account, threadId);
    const existing = limitResumeTimers.get(key);
    if (existing) clearTimeout(existing);
    let nextAt: number;
    try {
      await updateRateLimits(account);
      nextAt = nextLimitResumeCheck(accounts.snapshot(account), key).at;
    } catch {
      nextAt = Date.now() + 60_000;
    }
    nextAt = Math.max(nextAt, retryNotBefore);
    const timer = setTimeout(() => {
      limitResumeTimers.delete(key);
      void (async () => {
        const clientUserMessageId = randomUUID();
        const resume = await limitResumes.claimResume(account, threadId, clientUserMessageId);
        if (!resume) return;
        const assignment = assignments.forThread(account, threadId);
        let accepted = false;
        try {
          await updateRateLimits(account);
          if (!rankAccounts([accounts.snapshot(account)], Date.now()).length) {
            await limitResumes.restoreWaitingFromResume(account, threadId, clientUserMessageId);
            await scheduleLimitResume(account, threadId);
            return;
          }
          const dispatch = outbox.list().find((record) => record.accountId === account && record.threadId === threadId);
          const resumeInput = limitResumes.resumeTurnInput(resume);
          await (await liveClient(account)).startTurn({ threadId, clientUserMessageId, text: resumeInput.text, settings: resumeInput.settings ?? dispatch?.settings });
          accepted = true;
          const hasNewerMessages = await limitResumes.completeAcceptedResume(account, threadId, clientUserMessageId);
          await assignments.markAssigned(account, threadId);
          if (hasNewerMessages) await scheduleLimitResume(account, threadId, Date.now() + 60_000);
          publishRuntimeEvent("task", { taskId: assignment?.taskId ?? "" });
          requestAutoPilot();
        } catch (error) {
          if (!accepted) {
            await limitResumes.restoreWaitingFromResume(account, threadId, clientUserMessageId);
            if (shouldRetireLimitResume(error)) await limitResumes.clear(account, threadId);
            else if (limitResumes.forThread(account, threadId)?.state === "waiting_for_limit") await scheduleLimitResume(account, threadId, Date.now() + 60_000);
          }
          logger.warn("resume", { event: accepted ? "limit_resume_reconcile_failed" : "limit_resume_failed", account, threadId, error: error instanceof Error ? error.message : "failed" });
        }
      })();
    }, Math.max(0, nextAt - Date.now()));
    timer.unref();
    limitResumeTimers.set(key, timer);
  };
  const profileClient = async (accountId: BotProfileAccountId): Promise<AppServerClient> => {
    const current = accounts.preAuthClient(accountId);
    if (current instanceof AppServerClient && current.isConnected()) return current;
    await accounts.connect({ account: accountId, password: passwordFor(accountId) }).catch((error) => {
      const recovered = accounts.preAuthClient(accountId);
      if (!(recovered instanceof AppServerClient) || !recovered.isConnected()) throw error;
    });
    const recovered = accounts.preAuthClient(accountId);
    if (!(recovered instanceof AppServerClient) || !recovered.isConnected()) throw new Error("DEVICE_AUTH_UNAVAILABLE");
    return recovered;
  };
  const profileProvisioner = new ProfileProvisioner({
    registry,
    repositoryUrl: config.repositoryUrl,
    passwordFor: (bot) => config.accountPasswords[bot],
  });
  const loginExpiryTimers = new Map<BotProfileAccountId, NodeJS.Timeout>();
  const clearLoginExpiry = (accountId: BotProfileAccountId): void => {
    const timer = loginExpiryTimers.get(accountId);
    if (timer) clearTimeout(timer);
    loginExpiryTimers.delete(accountId);
  };
  loginCoordinator = new LoginCoordinator({
    fingerprintSalt: config.sessionSecret,
    start: async (accountId, method) => {
      const client = await profileClient(accountId);
      return method === "device_code" ? client.startDeviceLogin() : client.startBrowserLogin();
    },
    cancel: async (accountId, loginId) => {
      const client = accounts.preAuthClient(accountId);
      if (client instanceof AppServerClient && client.isConnected()) await client.cancelLogin(loginId);
    },
    onCompletion: (accountId, identity) => {
      clearLoginExpiry(accountId);
      accounts.markAuthenticated(accountId, identity);
      void updateRateLimits(accountId).catch((error) => logger.warn("accounts", { event: "profile_login_rate_limits_failed", account: accountId, error: error instanceof Error ? error.message : "failed" }));
    },
    onFailure: (accountId, error) => {
      clearLoginExpiry(accountId);
      void accounts.rejectAuthentication(accountId, error.code)
        .catch((closeError) => logger.warn("accounts", { event: "profile_login_rejected_close_failed", account: accountId, error: closeError instanceof Error ? closeError.message : "failed" }));
    },
  });
  const services: CoordinatorRouteServices = {
    config: { ...config, secureCookies: false }, sessions, throttle, verifyTotp,
    snapshot, health,
    setAutoPilot: async (enabled) => {
      await state.mutate((value) => { value.autoPilot = { enabled }; });
      requestAutoPilot();
      publishRuntimeEvent("auto_pilot", { enabled });
      return { enabled };
    },
    resolveAccountId: (value) => {
      if (value === LOCAL_ACCOUNT_ID) return value;
      if (isBotProfileAccountId(value)) return slotFor(value) ? value : undefined;
      if (isMacosBotId(value)) return slotFor(`${value}/acc1` as BotProfileAccountId)?.id;
      return undefined;
    },
    makePrimary: async (accountId) => {
      const state = await primaryProfiles.makePrimary(accountId);
      if (!state.primaryAccountId) throw new Error("PRIMARY_SWITCH_FAILED");
      primaryByBot.set(state.macosUser, state.primaryAccountId);
      const changed = accountSnapshot().filter((snapshot) => snapshot.macosUser === state.macosUser);
      publishAccountSnapshots(changed);
      return changed;
    },
    addAccount: async (bot) => {
      const slot = await profileProvisioner.create(bot);
      refreshProfileRuntime();
      gitSynchronizer.refreshTargets();
      const snapshot = accountSnapshot().find((item) => item.id === slot.id);
      if (!snapshot) throw new Error("PROFILE_SETUP_FAILED");
      publishAccountSnapshots([snapshot]);
      return snapshot;
    },
    startAccountLogin: async (accountId, method) => {
      clearLoginExpiry(accountId);
      const challenge = await loginCoordinator!.start(accountId, method);
      const delay = Math.max(0, challenge.expiresAt - Date.now());
      const timer = setTimeout(() => {
        loginExpiryTimers.delete(accountId);
        void loginCoordinator?.cancel(accountId).catch(() => undefined);
      }, delay);
      timer.unref();
      loginExpiryTimers.set(accountId, timer);
      return challenge;
    },
    cancelAccountLogin: async (accountId) => {
      clearLoginExpiry(accountId);
      await loginCoordinator!.cancel(accountId);
    },
    connectAccount: async (id) => {
      const connected = await accounts.connect({ account: id, password: passwordFor(id) });
      await outbox.recover({ readThread: async (record) => {
        const result = await (await liveClient(record.accountId)).readThread(record.threadId, { includeTurns: true });
        const turns = Array.isArray(object(result).thread && object(object(result).thread).turns) ? object(object(result).thread).turns as Array<Record<string, unknown>> : [];
        return { turns: turns.map((turn) => ({ clientUserMessageId: typeof turn.clientUserMessageId === "string" ? turn.clientUserMessageId : undefined })) };
      } });
      for (const waiting of outbox.recoverWaitingTimers()) { const record = outbox.get(waiting.id); if (record?.accountId === id) await scheduleRateWait(record); }
      for (const resuming of limitResumes.list().filter((record) => record.accountId === id && record.state === "resuming")) {
        const clientUserMessageId = resuming.resumeClientUserMessageId;
        if (!clientUserMessageId) { await limitResumes.recoverOrphanedResume(id, resuming.threadId); continue; }
        try {
          const result = await (await liveClient(id)).readThread(resuming.threadId, { includeTurns: true });
          const thread = object(result).thread ? object(object(result).thread) : object(result);
          const turns = Array.isArray(thread.turns) ? thread.turns.map(object) : [];
          if (turns.some((turn) => turn.clientUserMessageId === clientUserMessageId)) {
            const hasNewerMessages = await limitResumes.completeAcceptedResume(id, resuming.threadId, clientUserMessageId);
            await assignments.markAssigned(id, resuming.threadId);
            if (hasNewerMessages) await scheduleLimitResume(id, resuming.threadId, Date.now() + 60_000);
          } else await limitResumes.restoreWaitingFromResume(id, resuming.threadId, clientUserMessageId);
        } catch {
          await limitResumes.restoreWaitingFromResume(id, resuming.threadId, clientUserMessageId);
        }
      }
      for (const waiting of limitResumes.waitingForAccount(id)) if (!limitResumeTimers.has(activeTurnKey(id, waiting.threadId))) await scheduleLimitResume(id, waiting.threadId);
      requestAutoPilot();
      return connected;
    },
    disconnectAccount: (id) => accounts.disconnect(id),
    openTerminal: (id) => accounts.openTerminal(id),
    refreshRateLimits: async (id) => {
      const updated = await updateRateLimits(id);
      await Promise.allSettled(limitResumes.waitingForAccount(id).map((record) => scheduleLimitResume(id, record.threadId)));
      return updated;
    },
    refreshAllRateLimits,
    listModels: async (id) => (await liveClient(id)).listModels(),
    previewLaunch: async (taskId, requested, requestedPass) => {
      await refreshTasks();
      if (!manifest) throw new Error(manifestError ?? "MASTERPLAN_NOT_READY");
      const pass = requestedPass ?? manifest.lifecycle?.activePass ?? "planning";
      const task = nodesByPass[pass].find((candidate) => candidate.id === taskId);
      if (!task) throw new Error("TASK_NOT_READY");
      let options = await launchAccounts();
      let selected = requested ? options.find((account) => account.id === requested && account.available) : options.find((account) => account.available);
      if (!selected && !requested) {
        await accounts.connect({ account: LOCAL_ACCOUNT_ID, password: undefined }).catch(() => undefined);
        options = await launchAccounts();
        selected = options.find((account) => account.available);
      }
      if (!selected) throw new Error("ACCOUNT_OFFLINE");
      return { task, accountId: selected.id, prompt: await createPrompt(task, selected.id), dependencies: task.dependsOn, accounts: options };
    },
    launch: async (taskId, input) => {
      const pass = input.pass ?? manifest?.lifecycle?.activePass ?? "planning";
      const preview = await services.previewLaunch(taskId, input.accountId, pass) as { task: TaskNode; accountId: AccountId; prompt: string };
      if (preview.task.readiness.state !== "ready") throw new Error(preview.task.readiness.blockingCodes[0] ?? "TASK_NOT_READY");
      const client = await liveClient(preview.accountId);
      if (input.origin === "auto_pilot") {
        const current = autoPilotSnapshot(pass);
        if (!selectAutoPilotLaunches({ ...current, tasks: current.tasks.filter((task) => task.id === taskId), accounts: current.accounts.filter((account) => account.id === preview.accountId) }).length) throw new Error("TASK_NOT_READY");
      }
      const rawThread = await client.startThread();
      const thread = asThread(preview.accountId, responseThread(rawThread), projectWorkspaceFor(preview.accountId));
      upsertCachedThread(thread);
      await client.setThreadName(thread.id, `${preview.task.id} · ${preview.task.title}`);
      const now = Date.now();
      const record: DispatchRecord = { id: randomUUID(), clientUserMessageId: randomUUID(), taskId, pass, accountId: preview.accountId, threadId: thread.id, state: "queued", origin: input.origin ?? "operator", createdAt: now, updatedAt: now, retryAt: null, settings: input.settings };
      await outbox.enqueue(record);
      await assignments.assign(taskId, preview.accountId, thread.id, now, pass);
      await outbox.markSubmitting(record.id);
      try { await client.startTurn({ threadId: thread.id, clientUserMessageId: record.clientUserMessageId, text: input.prompt ?? preview.prompt, settings: input.settings }); }
      catch (error) {
        if (error instanceof Error && /rate.?limit/i.test(error.message)) { await scheduleRateWait(record); return outbox.get(record.id); }
        await outbox.fail(record.id, "DISPATCH_FAILED");
        throw error;
      }
      await outbox.markAccepted(record.id);
      accounts.updateSnapshot(preview.accountId, { activeTurns: accounts.snapshot(preview.accountId).activeTurns + 1, lastAssignedAt: now });
      if (completedLaunchThreads.has(completedLaunchThreadKey(preview.accountId, thread.id))) await settleCompletedLaunchThread(preview.accountId, thread.id);
      return outbox.get(record.id);
    },
    listThreads: threads,
    readTranscript: async (id, threadId) => { const client = await liveClient(id); await client.readThread(threadId, { includeTurns: true }); return client.transcriptSnapshot().items.filter((item) => item.threadId === threadId); },
    startThread: async (id) => {
      const thread = asThread(id, responseThread(await (await liveClient(id)).startThread()), projectWorkspaceFor(id));
      upsertCachedThread(thread);
      return thread;
    },
    moveThreadToAccount: async (sourceAccountId, threadId, targetAccountId, settings?: ChatExecutionSettings) => {
      const resumeKey = activeTurnKey(sourceAccountId, threadId);
      const sourceResume = limitResumes.forThread(sourceAccountId, threadId);
      const sourceAssignment = assignments.forThread(sourceAccountId, threadId);
      const resumeTimer = limitResumeTimers.get(resumeKey);
      if (resumeTimer) clearTimeout(resumeTimer);
      limitResumeTimers.delete(resumeKey);
      let priorResumeState: NonNullable<typeof sourceResume>["state"] | undefined;
      let priorAssignmentState: NonNullable<typeof sourceAssignment>["state"] | undefined;
      const sourceThread = (threadCache.get(sourceAccountId) ?? []).find((thread) => thread.id === threadId);
      const clientUserMessageId = randomUUID();
      const dispatch = outbox.list().find((record) => record.accountId === sourceAccountId && record.threadId === threadId && record.state === "accepted");
      return moveWithJsonl({
        sourceAccountId,
        sourceThreadId: threadId,
        sourceName: sourceThread?.name ?? null,
        targetAccountId,
        targetWorkspace: projectWorkspaceFor(targetAccountId),
        clientUserMessageId,
        readJsonl: (accountId, sourceThreadId) => rolloutReaders.get(accountId)!.readJsonl(sourceThreadId),
        target: () => liveClient(targetAccountId),
        normalizeThread: (rawThread) => asThread(targetAccountId, responseThread(rawThread), projectWorkspaceFor(targetAccountId)),
        claimResume: async () => {
          if (!sourceResume) return;
          priorResumeState = await limitResumes.claimTransfer(sourceAccountId, threadId);
          if (!priorResumeState) throw new Error("WORKER_TRANSFER_BUSY: Wait for the current resume operation to settle, then try again.");
        },
        claimAssignment: async () => {
          if (!sourceAssignment) return;
          priorAssignmentState = await assignments.claimTransfer(sourceAccountId, threadId);
          if (!priorAssignmentState) throw new Error("WORKER_TRANSFER_BUSY: Wait for the current resume operation to settle, then try again.");
        },
        restoreResume: async () => {
          if (!sourceResume || !priorResumeState) return;
          await limitResumes.restoreTransfer(sourceAccountId, threadId, priorResumeState);
          if (priorResumeState === "waiting_for_limit") await scheduleLimitResume(sourceAccountId, threadId, Date.now() + 60_000);
        },
        restoreAssignment: async () => {
          if (!sourceAssignment || !priorAssignmentState) return;
          await assignments.restoreTransfer(sourceAccountId, threadId, priorAssignmentState);
          if (priorAssignmentState === "waiting_for_limit") await scheduleLimitResume(sourceAccountId, threadId, Date.now() + 60_000);
        },
        cache: upsertCachedThread,
        transfer: async (thread) => {
          await limitResumes.markTransferred(sourceAccountId, threadId);
          if (sourceAssignment) await assignments.transfer(sourceAccountId, threadId, targetAccountId, thread.id);
          await outbox.transferAcceptedThread(sourceAccountId, threadId, targetAccountId, thread.id, clientUserMessageId);
          publishRuntimeEvent("task", { taskId: assignments.forThread(targetAccountId, thread.id)?.taskId ?? "" });
        },
        onAcceptedTransferFailure: async () => {
          if (sourceResume && priorResumeState) await limitResumes.markTransferred(sourceAccountId, threadId);
          if (sourceAssignment && priorAssignmentState) await assignments.markAttentionRequired(sourceAccountId, threadId);
        },
        settings: settings ?? dispatch?.settings,
        queuedMessages: sourceResume ? limitResumes.queuedMessagesText(sourceResume) : "",
      });
    },
    archiveThread: async (id, threadId) => {
      await (await liveClient(id)).archiveThread(threadId);
      cacheThreads(id, (threadCache.get(id) ?? []).map((thread) => thread.id === threadId ? { ...thread, archived: true } : thread));
      requestAutoPilot();
    },
    renameThread: async (id, threadId, name) => {
      await (await liveClient(id)).setThreadName(threadId, name);
      cacheThreads(id, (threadCache.get(id) ?? []).map((thread) => thread.id === threadId ? { ...thread, name, updatedAt: Date.now() } : thread));
    },
    startTurn: async (id, threadId, input) => {
      const clientUserMessageId = input.clientUserMessageId ?? randomUUID();
      if (limitResumes.forThread(id, threadId)?.state === "transferring") throw new Error("WORKER_TRANSFER_BUSY: Wait for the account handoff to finish, then send this message again.");
      const queued = await limitResumes.enqueueMessage(id, threadId, { id: clientUserMessageId, text: input.text, queuedAt: Date.now(), ...(input.settings ? { settings: input.settings } : {}) });
      if (queued) {
        await scheduleLimitResume(id, threadId);
        publishRuntimeEvent("task", { accountId: id, threadId, queued: true });
        return { queued: true, clientUserMessageId };
      }
      return (await liveClient(id)).startTurn({ threadId, text: input.text, clientUserMessageId, settings: input.settings });
    },
    steerTurn: async (id, threadId, input) => { await (await liveClient(id)).steerTurn({ threadId, turnId: input.turnId, text: input.text, clientUserMessageId: input.clientUserMessageId ?? randomUUID() }); },
    interruptTurn: async (id, threadId, input) => { await (await liveClient(id)).interruptTurn(threadId, input.turnId); },
    readMarkdown: async (id, path) => { const file = await readWorkspaceMarkdown({ account: id, requestedPath: path, workspaceRoot: workspaceFor(id), appServer: await liveClient(id) }); return { filename: file.filename, content: file.text }; },
    decideApproval: async (id, input) => {
      const kind = input.decision === "grant_turn" || input.decision === "grant_turn_strict" ? input.decision : input.decision === "accept" || input.decision === "decline" || input.decision === "cancel" ? input.decision : input.decision === "deny" ? "deny" : undefined;
      if (!kind) throw new Error("HUMAN_APPROVAL_REQUIRED");
      await journal.decide(id, kind === "grant_turn" || kind === "grant_turn_strict" ? { kind, permissions: input.permissions ?? {} } : { kind });
    },
    allowedOrigins,
  };
  const autoPilotSnapshot = (pass: ManifestPass) => ({
    tasks: root.autoPilot?.enabled === true && !shuttingDown && !manifestError && pass === (manifest?.lifecycle?.activePass ?? "planning")
      ? projectDispatchState(nodesByPass[pass], outbox.list().filter((record) => (record.pass ?? "planning") === pass), pass === "planning" ? [...threadCache.values()].flat() : [], assignments.list().filter((record) => (record.pass ?? "planning") === pass), completedByPass[pass]) : [],
    accounts: accountSnapshot(),
    threads: [...threadCache.values()].flat(),
  });
  const reconcileAutoPilot = async () => {
    let pass: ManifestPass = "planning";
    await reconcileAutoPilotLaunches({
      refresh: async () => {
        await refreshTasks(true);
        pass = manifest?.lifecycle?.activePass ?? "planning";
        const refreshedAccounts = new Set<AccountId>();
        const refreshCandidates = accountSnapshot().filter((account) => account.id !== LOCAL_ACCOUNT_ID && account.connection === "connected" && account.authentication === "authenticated");
        await Promise.allSettled(refreshCandidates.map(async (account) => {
          try { await threads(account.id); }
          catch (error) {
            logger.warn("autoPilot", { event: "threads_refresh_failed", account: account.id, error: error instanceof Error ? error.message : "failed" });
            return;
          }
          refreshedAccounts.add(account.id);
        }));
        if (shuttingDown) return refreshedAccounts;
        await recoverAcceptedAutoPilotDispatches({
          records: () => outbox.list().filter((record) => {
            const resumeState = limitResumes.forThread(record.accountId, record.threadId)?.state;
            const assignmentState = assignments.forThread(record.accountId, record.threadId)?.state;
            return !["waiting_for_limit", "resuming", "transferring"].includes(resumeState ?? "")
              && !["waiting_for_limit", "resuming", "transferring"].includes(assignmentState ?? "");
          }),
          withRecovery: (record, operation) => autoPilotRecoveryGuard.run(record.accountId, record.threadId, operation),
          readCompleted: async (record) => latestThreadTurnCompleted(await (await liveClient(record.accountId)).readThread(record.threadId, { includeTurns: true })),
          provenComplete: (record) => !manifestError && completedByPass[record.pass ?? "planning"].has(record.taskId),
          settle: (record) => settleCompletedLaunchThread(record.accountId, record.threadId, "recovery"),
          log: (error) => logger.warn("autoPilot", { event: "accepted_recovery_failed", error: error.message }),
        });
        await retryAutoPilotArchives({
          records: () => outbox.list(),
          threads: () => [...threadCache.values()].flat(),
          provenComplete: (record) => !manifestError && completedByPass[record.pass ?? "planning"].has(record.taskId),
          archive: (record) => services.archiveThread(record.accountId, record.threadId),
          log: (error) => logger.warn("autoPilot", { event: "archive_retry_failed", error: error.message }),
        });
        return refreshedAccounts;
      },
      snapshot: () => autoPilotSnapshot(pass),
      launch: (pair) => services.launch(pair.taskId, { accountId: pair.accountId, pass, origin: "auto_pilot" }),
      log: (error) => logger.warn("autoPilot", { event: "launch_failed", error: error.message }),
    });
  };
  const autoPilot = new AutoPilotController({
    isEnabled: () => root.autoPilot?.enabled === true && !shuttingDown,
    reconcile: reconcileAutoPilot,
    intervalMs: 15_000,
    log: (error) => logger.warn("autoPilot", { event: "reconcile_failed", error: error.message }),
  });
  const gitStartTimer = setTimeout(() => gitSynchronizer.start(), 60_000);
  gitStartTimer.unref();
  const credentialRefreshTimer = setInterval(() => {
    void Promise.allSettled(accountIds.map((id) => accounts.recoverChangedCredentials({ account: id, password: passwordFor(id) })));
  }, 15_000);
  credentialRefreshTimer.unref();
  const connectInitialAccount = async (id: AccountId): Promise<void> => {
    if (shuttingDown) return;
    try {
      await services.connectAccount(id);
      await threads(id);
    } catch { /* AccountManager's credential recovery scheduler owns bounded retries. */ }
  };
  const coordinator = createCoordinatorApp({ services, staticDir: resolve(process.cwd(), "dist"), flush: () => state.persist(), shutdown: async () => {
    shuttingDown = true;
    autoPilot.stop();
    journal.rejectLive();
    clearTimeout(gitStartTimer);
    clearInterval(credentialRefreshTimer);
    gitSynchronizer.stop();
    for (const id of rateWaitTimers.keys()) clearRateWait(id);
    for (const timer of limitResumeTimers.values()) clearTimeout(timer);
    for (const timer of loginExpiryTimers.values()) clearTimeout(timer);
    await autoPilot.whenIdle();
    await accounts.shutdown();
  } });
  publishRuntimeEvent = (type, payload) => { coordinator.hub.publish(type, payload); };
  publishAccountSnapshots = (snapshots) => { coordinator.hub.publishAccountSnapshots(snapshots); };
  accounts.onChange((snapshot) => {
    coordinator.hub.publish("account", {} as Record<string, unknown>);
    if (snapshot.connection === "connected" && snapshot.authentication === "authenticated") requestAutoPilot();
    if (!snapshot.rateLimits.length) return;
    const prior = root.accountRateLimits?.[snapshot.id];
    if (JSON.stringify(prior) === JSON.stringify(snapshot.rateLimits)) return;
    void state.mutate((value) => {
      value.accountRateLimits ??= {};
      value.accountRateLimits[snapshot.id] = snapshot.rateLimits.map((window) => ({ ...window }));
    }).catch((error) => logger.warn("accounts", { event: "rate_limits_persist_failed", account: snapshot.id, error: error instanceof Error ? error.message : "failed" }));
  });
  void (async () => {
    for (let index = 0; index < accountIds.length; index += 2) {
      await Promise.all(accountIds.slice(index, index + 2).map((id) => connectInitialAccount(id)));
    }
    await snapshot().catch((error) => logger.warn("assignments", { event: "startup_reconcile_failed", error: error instanceof Error ? error.message : "failed" }));
    if (shuttingDown) return;
    requestAutoPilot = () => { autoPilot.request(); };
    autoPilot.start();
    gitSynchronizer.start();
  })();
  return coordinator;
}

export async function main(): Promise<void> {
  const envFile = process.env.SWARM_ENV_FILE ?? resolve(process.cwd(), ".env");
  dotenv.config({ path: envFile });
  process.env.SWARM_ENV_FILE = envFile;
  const coordinator = await createRuntime(await loadConfig());
  const bound = await coordinator.start();
  process.stdout.write(`Swarm coordinator listening on http://${bound.host}:${bound.port}\n`);
  const stop = () => { void coordinator.shutdown().finally(() => process.exit(0)); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) void main();
