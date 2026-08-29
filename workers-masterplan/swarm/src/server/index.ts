import { access, realpath } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { spawn as spawnPty } from "node-pty";

import { ACCOUNT_IDS, LOCAL_ACCOUNT_ID, type AccountId, type ChatExecutionSettings, type CoordinatorSnapshot, type DispatchRecord, type HealthSnapshot, type LimitResumeRecord, type LocalWorkspaceSnapshot, type RateLimitWindow, type TaskManifest, type TaskNode, type ThreadSummary, type WorkerAssignmentRecord } from "../shared/contracts.js";
import { createPasswordHash } from "./auth/password.js";
import { LoginThrottle, SessionStore } from "./auth/sessionStore.js";
import { createTotpVerifier } from "./auth/totp.js";
import { DurableApprovalJournal } from "./approvals/journal.js";
import type { ApprovalJournalEntry } from "./codex/approvalRouter.js";
import { ApprovalRouter } from "./codex/approvalRouter.js";
import { AccountManager } from "./codex/accountManager.js";
import { AppServerClient } from "./codex/appServerClient.js";
import { JsonRpcClient } from "./codex/jsonRpcClient.js";
import { LocalRolloutTranscriptReader } from "./codex/localRolloutReader.js";
import { readWorkspaceMarkdown } from "./codex/safeFileReader.js";
import { SuLauncher, type PortLease } from "./codex/suLauncher.js";
import { openMacOsTerminal } from "./codex/terminalConsole.js";
import { workspaceRoot } from "./codex/protocol.js";
import { normalizeThreadActivity, normalizeThreadCapabilities } from "./codex/threadCapabilities.js";
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
import { nextRateLimitCheck } from "./scheduler/accountScheduler.js";
import { CoordinatorState } from "./state/coordinatorState.js";
import { createCoordinatorStateStore } from "./state/atomicStateStore.js";
import { evaluateTaskReadiness, loadBlueprintEvidence } from "./tasks/blueprintEvidence.js";
import { latestUnarchivedTaskThread, projectDispatchState } from "./tasks/taskProjection.js";
import { WorkerAssignmentManifest } from "./tasks/workerAssignments.js";
import { LimitResumeManifest } from "./tasks/limitResumes.js";
import { handoffThreadName } from "./tasks/handoff.js";
import { loadManifest } from "./tasks/manifestLoader.js";
import { executionLaunchMetadata, taskArtifactLaunchMetadata } from "./tasks/launchMetadata.js";
import { launchGitMetadata } from "./tasks/launchGitMetadata.js";
import { renderWorkerPrompt } from "./tasks/promptTemplates.js";

type DurableState = {
  auth?: { challenges?: Record<string, unknown>; sessions?: Record<string, unknown>; loginThrottle?: Record<string, { failures: number; retryAt: number }>; usedTotp?: Record<string, true> };
  dispatches?: DispatchRecord[];
  workerAssignments?: WorkerAssignmentRecord[];
  limitResumes?: LimitResumeRecord[];
  completedTaskIds?: string[];
  approvals?: ApprovalJournalEntry[];
  notifications?: { breakingChangeAccounts?: AccountId[] };
  accountRateLimits?: Partial<Record<AccountId, RateLimitWindow[]>>;
};

const accountIds = ACCOUNT_IDS;
function accountId(value: string): AccountId { if (!(accountIds as readonly string[]).includes(value)) throw new Error("ACCOUNT_OFFLINE"); return value as AccountId; }
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

function handoffSource(threadId: string, thread: Record<string, unknown>): { jsonl: string; originalPrompt: string } {
  const turns = Array.isArray(thread.turns) ? thread.turns.filter((turn): turn is Record<string, unknown> => Boolean(turn) && typeof turn === "object" && !Array.isArray(turn)) : [];
  let originalPrompt: string | undefined;
  const lines: string[] = [];
  for (const turn of turns) {
    const turnId = stringAt(turn, "id") ?? "unknown";
    const items = Array.isArray(turn.items) ? turn.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
    for (const item of items) {
      lines.push(JSON.stringify({ threadId, turnId, startedAt: turn.startedAt ?? null, item }));
      if (!originalPrompt && item.type === "userMessage") {
        const content = Array.isArray(item.content) ? item.content : [];
        const text = content.map((part) => object(part)).filter((part): part is Record<string, unknown> => Boolean(part)).map((part) => typeof part.text === "string" ? part.text : "").join("").trim();
        if (text) originalPrompt = text;
      }
    }
  }
  return { jsonl: `${lines.join("\n")}${lines.length ? "\n" : ""}`, originalPrompt: originalPrompt ?? "Continue the work in the attached previous session." };
}

function handoffFilename(account: AccountId, threadId: string): string {
  const suffix = createHash("sha256").update(`${account}\u0000${threadId}`).digest("hex").slice(0, 12);
  return `swarm-handoff-${account}-${suffix}.jsonl`;
}

async function leasePort(): Promise<PortLease> {
  const listener = createNetServer();
  await new Promise<void>((resolveListen, rejectListen) => { listener.once("error", rejectListen); listener.listen(0, "127.0.0.1", () => resolveListen()); });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a loopback port");
  return { port: address.port, release: async () => new Promise<void>((resolveClose) => listener.close(() => resolveClose())) };
}

function taskNode(manifest: TaskManifest, readiness: ReturnType<typeof evaluateTaskReadiness>): TaskNode[] {
  return manifest.tasks.map((task) => ({ ...task, readiness: readiness.find((candidate) => candidate.taskId === task.id) ?? { taskId: task.id, phase: task.kind, state: "blocked", evidence: [], blockingCodes: ["TASK_NOT_READY"] } }));
}

async function createRuntime(config: SwarmConfig) {
  const logger = createLogger({ secrets: [config.loginPasswordHash, config.totpSecret, config.sessionSecret, ...Object.values(config.accountPasswords)].filter((value): value is string => Boolean(value)) });
  const store = createCoordinatorStateStore<DurableState>(resolve(process.cwd(), ".data", "state.json"), config);
  const state = new CoordinatorState(await store.read(), async (value) => store.write(value));
  const root = state.root();
  root.auth ??= {};
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
  const completedTaskIds = new Set([...(root.completedTaskIds ?? []), ...(root.dispatches ?? []).filter((record) => record.state === "completed").map((record) => record.taskId)]);
  const coordinationWorkspaceRoot = resolve(config.coordinationRoot ?? process.cwd());
  const workspaceFor = (account: AccountId): string | undefined => account === LOCAL_ACCOUNT_ID ? coordinationWorkspaceRoot : undefined;
  const projectWorkspaceFor = (account: AccountId): string => workspaceRoot(account, workspaceFor(account));
  const localWorkspace: LocalWorkspaceSnapshot = { label: `${config.localAccount} (local)`, gitSync: { state: "idle", action: "pull", lastAttemptAt: null } };
  let publishRuntimeEvent: (type: string, payload: Record<string, unknown>) => void = () => undefined;
  const gitRunner = new GitCommandRunner(coordinationWorkspaceRoot, config.accountPasswords);
  const activeTurnIds = new Map<string, string>();
  const activeTurnKey = (account: AccountId, threadId: string) => `${account}\u0000${threadId}`;
  let scheduleLimitResume: (account: AccountId, threadId: string, retryNotBefore?: number) => Promise<void> = async () => undefined;
  const launcher = new SuLauncher({
    spawnPty: (file, args, options) => spawnPty(file, args, options),
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
  const localRollouts = new LocalRolloutTranscriptReader(`/Users/${config.localAccount}/.codex`);
  const completedLaunchThreads = new Set<string>();
  const completedLaunchThreadKey = (account: AccountId, threadId: string) => `${account}\u0000${threadId}`;
  let accounts: AccountManager;
  const breakingChangeAccounts = new Set<AccountId>(root.notifications.breakingChangeAccounts);
  const recordBreakingChange = (account: AccountId) => {
    accounts.updateSnapshot(account, { hasBreakingChange: true });
    void state.mutate((value) => {
      value.notifications ??= {};
      value.notifications.breakingChangeAccounts ??= [];
      if (!value.notifications.breakingChangeAccounts.includes(account)) value.notifications.breakingChangeAccounts.push(account);
    }).catch((error) => logger.warn("notifications", { event: "breaking_change_persist_failed", account, error: error instanceof Error ? error.message : "failed" }));
  };
  const settleCompletedLaunchThread = async (account: AccountId, threadId: string) => {
    const assignment = assignments.forThread(account, threadId);
    const accepted = outbox.list().find((record) => record.accountId === account && record.threadId === threadId && record.state === "accepted");
    const taskId = assignment?.taskId ?? accepted?.taskId;
    if (!taskId) return;
    await refreshTasks(true);
    const provenComplete = nodes.find((node) => node.id === taskId)?.readiness.state === "complete";
    if (provenComplete) {
      await assignments.complete(account, threadId);
      await outbox.completeAcceptedForThread(account, threadId);
      completedTaskIds.add(taskId);
    } else {
      await assignments.markAttentionRequired(account, threadId);
      if (accepted) await outbox.abandon(accepted.id);
      completedTaskIds.delete(taskId);
    }
    await state.mutate((value) => { value.completedTaskIds = [...completedTaskIds]; });
    completedLaunchThreads.delete(completedLaunchThreadKey(account, threadId));
    const snapshot = accounts.snapshot(account);
    accounts.updateSnapshot(account, { activeTurns: Math.max(0, snapshot.activeTurns - 1) });
  };
  accounts = new AccountManager({
    launcher,
    codexBin: config.codexBin,
    onRateLimitReadError: (account, error) => logger.warn("accounts", { event: "rate_limits_read_failed", account, error: error instanceof Error ? error.message : "failed" }),
    createClient: (handle) => {
      const localWorkspaceRoot = workspaceFor(handle.account);
      const client = new AppServerClient({ account: handle.account, workspaceRoot: localWorkspaceRoot, rpc: new JsonRpcClient({ launch: handle }), approvalRouter: new ApprovalRouter({ context: createApprovalContext(handle.account, localWorkspaceRoot), journal }), ...(handle.account === LOCAL_ACCOUNT_ID ? { readLockedThread: (threadId: string) => localRollouts.readThread(threadId) } : {}) });
      client.onEvent((event) => {
        if (event.type === "breaking_change") recordBreakingChange(event.accountId);
        if (event.type === "turn" && event.threadId && event.turnId && event.state === "started") {
          activeTurnIds.set(activeTurnKey(event.accountId, event.threadId), event.turnId);
          void limitResumes.clear(event.accountId, event.threadId).catch((error) => logger.warn("resume", { event: "clear_started_failed", error: error instanceof Error ? error.message : "failed" }));
          void assignments.markAssigned(event.accountId, event.threadId).catch((error) => logger.warn("assignments", { event: "mark_assigned_failed", error: error instanceof Error ? error.message : "failed" }));
        }
        if (event.type === "turn" && event.threadId && event.state === "limit_exhausted") {
          const exhaustedThreadId = event.threadId;
          activeTurnIds.delete(activeTurnKey(event.accountId, exhaustedThreadId));
          void (async () => {
            await limitResumes.markWaiting(event.accountId, exhaustedThreadId);
            if (limitResumes.forThread(event.accountId, exhaustedThreadId)?.state !== "waiting_for_limit") return;
            await assignments.markWaitingForLimit(event.accountId, exhaustedThreadId);
            try { await gitRunner.checkpointAndPush(event.accountId); }
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
        if (event.type === "turn" && event.state === "completed" && event.threadId) {
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
        publishRuntimeEvent(event.type, { accountId: event.accountId, ...(event.threadId ? { threadId: event.threadId } : {}), ...(event.turnId ? { turnId: event.turnId } : {}), ...(event.state ? { state: event.state } : {}) });
      });
      return client;
    },
  });
  for (const id of accountIds) {
    const rateLimits = root.accountRateLimits?.[id];
    if (rateLimits?.length) accounts.updateSnapshot(id, { rateLimits });
  }
  for (const id of breakingChangeAccounts) accounts.updateSnapshot(id, { hasBreakingChange: true });
  const gitSynchronizer = new GitSynchronizer({
    pullLocal: () => gitRunner.pullLocal(),
    pullBot: (account) => gitRunner.pullAccount(account),
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
  let manifestError: string | undefined;
  let tasksRefreshedAt = 0;
  let taskRefreshPromise: Promise<void> | undefined;
  const refreshTasks = async (force = true) => {
    if (!force && Date.now() - tasksRefreshedAt < 15_000) return;
    if (taskRefreshPromise) return taskRefreshPromise;
    taskRefreshPromise = (async () => {
      if (!config.masterplanPath) { manifest = undefined; nodes = []; manifestError = "MASTERPLAN_NOT_READY"; tasksRefreshedAt = Date.now(); return; }
      try {
        manifest = await loadManifest(config.masterplanPath, resolve(config.coordinationRoot ?? process.cwd()));
        const readiness = evaluateTaskReadiness(manifest, await loadBlueprintEvidence(manifest));
        const provenCompletedTaskIds = new Set(readiness.filter((task) => task.state === "complete").map((task) => task.taskId));
        const completionChanged = provenCompletedTaskIds.size !== completedTaskIds.size || [...provenCompletedTaskIds].some((taskId) => !completedTaskIds.has(taskId));
        if (completionChanged || !root.completedTaskIds) {
          completedTaskIds.clear();
          for (const taskId of provenCompletedTaskIds) completedTaskIds.add(taskId);
          await state.mutate((value) => { value.completedTaskIds = [...completedTaskIds]; });
        }
        nodes = taskNode(manifest, readiness);
        manifestError = undefined;
      } catch (error) { manifest = undefined; nodes = []; manifestError = error instanceof Error && error.message.includes("MASTERPLAN") ? "MASTERPLAN_NOT_READY" : "MANIFEST_INVALID"; }
      finally { tasksRefreshedAt = Date.now(); }
    })();
    try { await taskRefreshPromise; } finally { taskRefreshPromise = undefined; }
  };
  await refreshTasks();
  const liveClient = async (id: AccountId): Promise<AppServerClient> => {
    const client = accounts.client(id);
    if (client instanceof AppServerClient && client.isConnected()) return client;
    await accounts.connect({ account: id, password: id === LOCAL_ACCOUNT_ID ? undefined : config.accountPasswords[id] });
    const recovered = accounts.client(id);
    if (!(recovered instanceof AppServerClient) || !recovered.isConnected()) throw new Error("ACCOUNT_OFFLINE");
    return recovered;
  };
  const accountSnapshot = () => accounts.snapshotsList();
  const updateRateLimits = async (id: AccountId) => {
    const client = await liveClient(id);
    const rateLimits = mergeRateLimits(accounts.snapshot(id).rateLimits, await client.readRateLimitWindows());
    return accounts.updateSnapshot(id, { rateLimits });
  };
  const threadCache = new Map<AccountId, ThreadSummary[]>();
  const cacheThreads = (id: AccountId, next: ThreadSummary[]) => {
    threadCache.set(id, next.map((thread) => ({ ...thread, capabilities: { ...thread.capabilities } })));
    return next;
  };
  const upsertCachedThread = (thread: ThreadSummary) => {
    const current = threadCache.get(thread.accountId) ?? [];
    cacheThreads(thread.accountId, [thread, ...current.filter((candidate) => candidate.id !== thread.id)]);
  };
  const threads = async (id: AccountId): Promise<ThreadSummary[]> => cacheThreads(id, (await (await liveClient(id)).listAllThreads()).map((thread) => asThread(id, thread, projectWorkspaceFor(id))));
  const refreshAllRateLimits = async () => {
    await Promise.allSettled(accountSnapshot().filter((account) => account.connection === "connected" && account.authentication === "authenticated").map((account) => updateRateLimits(account.id)));
    await Promise.allSettled(limitResumes.list().filter((record) => record.state === "waiting_for_limit").map((record) => scheduleLimitResume(record.accountId, record.threadId)));
    return accountSnapshot();
  };
  const health = async (): Promise<HealthSnapshot> => ({ server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: manifestError ? "degraded" : "ok", ...(manifestError ? { message: manifestError } : {}) }, outbox: { state: "ok" }, scheduler: { state: "ok" }, accounts: { state: accountSnapshot().some((item) => item.connection === "error") ? "degraded" : "ok" } });
  const reconcileAssignments = async (threadSummaries: ThreadSummary[]) => {
    for (const node of nodes) {
      const existing = assignments.forTask(node.id);
      if (existing) {
        if (node.readiness.state === "complete" && existing.state !== "completed") await assignments.complete(existing.accountId, existing.threadId);
        else if (node.readiness.state !== "complete" && existing.state === "completed") await assignments.markAttentionRequired(existing.accountId, existing.threadId);
        continue;
      }
      const thread = latestUnarchivedTaskThread(threadSummaries, node.id);
      if (!thread) continue;
      await assignments.assign(node.id, thread.accountId, thread.id, thread.updatedAt);
      if (node.readiness.state === "complete") await assignments.complete(thread.accountId, thread.id, thread.updatedAt);
    }
  };
  const snapshot = async (): Promise<CoordinatorSnapshot> => {
    await refreshTasks(false);
    const dispatches = outbox.list();
    const threadSummaries = [...threadCache.values()].flat();
    await reconcileAssignments(threadSummaries);
    return { generatedAt: Date.now(), accounts: accountSnapshot(), localWorkspace: { ...localWorkspace, gitSync: { ...localWorkspace.gitSync } }, tasks: projectDispatchState(nodes, dispatches, threadSummaries, assignments.list(), completedTaskIds), dispatches, workerAssignments: assignments.list(), limitResumes: limitResumes.list(), threads: threadSummaries, pendingApprovals: journal.pending().map((entry) => entry.pending), health: await health() };
  };
  const allowedOrigins = () => dashboardOrigins(config.port, config.host);
  const createPrompt = async (task: TaskNode, id: AccountId) => {
    const execution = task.promptTemplate === "execution" ? executionLaunchMetadata(task) : {};
    return renderWorkerPrompt(task.promptTemplate, { workerId: task.id, accountId: id, taskId: task.id, taskTitle: task.title, phase: task.readiness.phase, phaseTerminalCondition: task.promptTemplate === "planning" ? "Stop after the approved planning handoff is integrated on origin/main; do not begin implementation." : task.promptTemplate === "execution" ? "Stop after fresh acceptance evidence, closed review, and the final handoff are integrated on origin/main." : "Stop at the user's review boundary after the accepted presentation handoff is integrated on origin/main.", blueprintPath: manifest?.masterplanPath ?? "", masterplanPath: manifest?.masterplanPath ?? "", coordinationRoot: manifest?.coordinationRoot, statusPath: task.statusPath ?? "", specificationPath: task.specificationPath, implementationPlanPath: task.implementationPlanPath, ...taskArtifactLaunchMetadata(task, nodes), ...execution, ...launchGitMetadata(id, workspaceFor(id)), ownedSurfaces: "Assigned task surfaces only", excludedSurfaces: "Other workers' owned surfaces" });
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
        try {
          await updateRateLimits(account);
          if (!rankAccounts([accounts.snapshot(account)], Date.now()).length) {
            await limitResumes.restoreWaitingFromResume(account, threadId, clientUserMessageId);
            await scheduleLimitResume(account, threadId);
            return;
          }
          const dispatch = outbox.list().find((record) => record.accountId === account && record.threadId === threadId);
          await (await liveClient(account)).startTurn({ threadId, clientUserMessageId, text: "Continue from where you stopped after the usage limit reset.", settings: dispatch?.settings });
          await limitResumes.clear(account, threadId);
          await assignments.markAssigned(account, threadId);
          publishRuntimeEvent("task", { taskId: assignment?.taskId ?? "" });
        } catch (error) {
          await limitResumes.restoreWaitingFromResume(account, threadId, clientUserMessageId);
          if (limitResumes.forThread(account, threadId)?.state === "waiting_for_limit") await scheduleLimitResume(account, threadId, Date.now() + 60_000);
          logger.warn("resume", { event: "limit_resume_failed", account, threadId, error: error instanceof Error ? error.message : "failed" });
        }
      })();
    }, Math.max(0, nextAt - Date.now()));
    timer.unref();
    limitResumeTimers.set(key, timer);
  };
  const services: CoordinatorRouteServices = {
    config: { ...config, secureCookies: false }, sessions, throttle, verifyTotp,
    snapshot, health,
    connectAccount: async (id) => {
      const connected = await accounts.connect({ account: id, password: id === LOCAL_ACCOUNT_ID ? undefined : config.accountPasswords[id] });
      await outbox.recover({ readThread: async (record) => {
        const result = await (await liveClient(record.accountId)).readThread(record.threadId, { includeTurns: true });
        const turns = Array.isArray(object(result).thread && object(object(result).thread).turns) ? object(object(result).thread).turns as Array<Record<string, unknown>> : [];
        return { turns: turns.map((turn) => ({ clientUserMessageId: typeof turn.clientUserMessageId === "string" ? turn.clientUserMessageId : undefined })) };
      } });
      for (const waiting of outbox.recoverWaitingTimers()) { const record = outbox.get(waiting.id); if (record?.accountId === id) await scheduleRateWait(record); }
      for (const resuming of limitResumes.list().filter((record) => record.accountId === id && record.state === "resuming")) {
        const clientUserMessageId = resuming.resumeClientUserMessageId;
        if (!clientUserMessageId) { await limitResumes.markWaiting(id, resuming.threadId); continue; }
        try {
          const result = await (await liveClient(id)).readThread(resuming.threadId, { includeTurns: true });
          const thread = object(result).thread ? object(object(result).thread) : object(result);
          const turns = Array.isArray(thread.turns) ? thread.turns.map(object) : [];
          if (turns.some((turn) => turn.clientUserMessageId === clientUserMessageId)) {
            await limitResumes.clear(id, resuming.threadId);
            await assignments.markAssigned(id, resuming.threadId);
          } else await limitResumes.restoreWaitingFromResume(id, resuming.threadId, clientUserMessageId);
        } catch {
          await limitResumes.restoreWaitingFromResume(id, resuming.threadId, clientUserMessageId);
        }
      }
      for (const waiting of limitResumes.waitingForAccount(id)) await scheduleLimitResume(id, waiting.threadId);
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
    previewLaunch: async (taskId, requested) => {
      await refreshTasks();
      if (!manifest) throw new Error(manifestError ?? "MASTERPLAN_NOT_READY");
      const task = nodes.find((candidate) => candidate.id === taskId);
      if (!task || task.readiness.state !== "ready") throw new Error(task?.readiness.blockingCodes[0] ?? "TASK_NOT_READY");
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
      const preview = await services.previewLaunch(taskId, input.accountId) as { task: TaskNode; accountId: AccountId; prompt: string };
      const client = await liveClient(preview.accountId);
      const rawThread = await client.startThread();
      const thread = asThread(preview.accountId, responseThread(rawThread), projectWorkspaceFor(preview.accountId));
      upsertCachedThread(thread);
      await client.setThreadName(thread.id, `${preview.task.id} · ${preview.task.title}`);
      const now = Date.now();
      const record: DispatchRecord = { id: randomUUID(), clientUserMessageId: randomUUID(), taskId, accountId: preview.accountId, threadId: thread.id, state: "queued", createdAt: now, updatedAt: now, retryAt: null, settings: input.settings };
      await outbox.enqueue(record);
      await assignments.assign(taskId, preview.accountId, thread.id, now);
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
      const priorResumeState = sourceResume ? await limitResumes.claimTransfer(sourceAccountId, threadId) : undefined;
      if (sourceResume && !priorResumeState) throw new Error("WORKER_TRANSFER_BUSY: Wait for the current resume operation to settle, then try again.");
      const sourceAssignment = assignments.forThread(sourceAccountId, threadId);
      const priorAssignmentState = sourceAssignment ? await assignments.claimTransfer(sourceAccountId, threadId) : undefined;
      if (sourceAssignment && !priorAssignmentState) throw new Error("WORKER_TRANSFER_BUSY: Wait for the current resume operation to settle, then try again.");
      const resumeTimer = limitResumeTimers.get(resumeKey);
      if (resumeTimer) clearTimeout(resumeTimer);
      limitResumeTimers.delete(resumeKey);
      let targetAccepted = false;
      try {
        try { await gitRunner.checkpointAndPush(sourceAccountId); }
        catch { throw new Error(`GIT_HANDOFF_PUSH_FAILED: Push ${sourceAccountId}'s changes manually, then try moving this worker again.`); }
        const source = await liveClient(sourceAccountId);
        const sourceResult = await source.readThread(threadId, { includeTurns: true });
        const sourceThread = sourceResult.thread;
        const handoff = handoffSource(threadId, sourceThread);
        const target = await liveClient(targetAccountId);
        const rawThread = await target.startThread();
        const thread = asThread(targetAccountId, responseThread(rawThread), projectWorkspaceFor(targetAccountId));
        const filename = handoffFilename(sourceAccountId, threadId);
        const path = resolve(workspaceRoot(targetAccountId, workspaceFor(targetAccountId)), filename);
        await target.writeFile(path, handoff.jsonl);
        const threadName = handoffThreadName(sourceThread.name);
        await target.setThreadName(thread.id, threadName);
        upsertCachedThread({ ...thread, name: threadName });
        const clientUserMessageId = randomUUID();
        const dispatch = outbox.list().find((record) => record.accountId === sourceAccountId && record.threadId === threadId && record.state === "accepted");
        const originalPrompt = handoff.originalPrompt.replace(/^Account:\s*\S+/m, `Account: ${targetAccountId}`);
        await target.startTurn({ threadId: thread.id, clientUserMessageId, text: `${originalPrompt}\n\nYou are now assigned to the macOS profile ${targetAccountId}. Pull origin/main before continuing. Resume from the previous session on ${sourceAccountId}; the attached ${filename} contains that session. Continue from where it left off.`, attachments: [{ name: filename, path }], settings: settings ?? dispatch?.settings });
        targetAccepted = true;
        await limitResumes.markTransferred(sourceAccountId, threadId);
        if (sourceAssignment) await assignments.transfer(sourceAccountId, threadId, targetAccountId, thread.id);
        await outbox.transferAcceptedThread(sourceAccountId, threadId, targetAccountId, thread.id, clientUserMessageId);
        publishRuntimeEvent("task", { taskId: assignments.forThread(targetAccountId, thread.id)?.taskId ?? "" });
        return thread;
      } catch (error) {
        if (sourceResume && priorResumeState) {
          if (targetAccepted) await limitResumes.markTransferred(sourceAccountId, threadId);
          else {
            await limitResumes.restoreTransfer(sourceAccountId, threadId, priorResumeState);
            if (priorResumeState === "waiting_for_limit") await scheduleLimitResume(sourceAccountId, threadId, Date.now() + 60_000);
          }
        }
        if (sourceAssignment && priorAssignmentState) {
          if (targetAccepted) await assignments.markAttentionRequired(sourceAccountId, threadId);
          else {
            await assignments.restoreTransfer(sourceAccountId, threadId, priorAssignmentState);
            if (priorAssignmentState === "waiting_for_limit") await scheduleLimitResume(sourceAccountId, threadId, Date.now() + 60_000);
          }
        }
        throw error;
      }
    },
    archiveThread: async (id, threadId) => {
      await (await liveClient(id)).archiveThread(threadId);
      cacheThreads(id, (threadCache.get(id) ?? []).map((thread) => thread.id === threadId ? { ...thread, archived: true } : thread));
    },
    renameThread: async (id, threadId, name) => {
      await (await liveClient(id)).setThreadName(threadId, name);
      cacheThreads(id, (threadCache.get(id) ?? []).map((thread) => thread.id === threadId ? { ...thread, name, updatedAt: Date.now() } : thread));
    },
    startTurn: async (id, threadId, input) => (await liveClient(id)).startTurn({ threadId, text: input.text, clientUserMessageId: input.clientUserMessageId ?? randomUUID(), settings: input.settings }),
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
  const accountRetryTimers = new Map<AccountId, NodeJS.Timeout>();
  const gitStartTimer = setTimeout(() => gitSynchronizer.start(), 60_000);
  gitStartTimer.unref();
  const connectWithRetry = async (id: AccountId): Promise<void> => {
    try {
      await services.connectAccount(id);
      await reconcileAssignments(await threads(id));
      const timer = accountRetryTimers.get(id);
      if (timer) clearTimeout(timer);
      accountRetryTimers.delete(id);
    } catch {
      if (accountRetryTimers.has(id)) return;
      const timer = setTimeout(() => { accountRetryTimers.delete(id); void connectWithRetry(id); }, 30_000);
      timer.unref();
      accountRetryTimers.set(id, timer);
    }
  };
  const coordinator = createCoordinatorApp({ services, staticDir: resolve(process.cwd(), "dist"), flush: () => state.persist(), shutdown: async () => { journal.rejectLive(); clearTimeout(gitStartTimer); gitSynchronizer.stop(); for (const timer of accountRetryTimers.values()) clearTimeout(timer); for (const id of rateWaitTimers.keys()) clearRateWait(id); for (const timer of limitResumeTimers.values()) clearTimeout(timer); await accounts.shutdown(); } });
  publishRuntimeEvent = (type, payload) => { coordinator.hub.publish(type, payload); };
  accounts.onChange((snapshot) => {
    coordinator.hub.publish("account", {} as Record<string, unknown>);
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
      await Promise.all(accountIds.slice(index, index + 2).map((id) => connectWithRetry(id)));
    }
    await snapshot().catch((error) => logger.warn("assignments", { event: "startup_reconcile_failed", error: error instanceof Error ? error.message : "failed" }));
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
