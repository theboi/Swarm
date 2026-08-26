import { access, realpath } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";

import type { AccountId, CoordinatorSnapshot, DispatchRecord, HealthSnapshot, NgrokSnapshot, TaskManifest, TaskNode, ThreadSummary } from "../shared/contracts.js";
import { createPasswordHash } from "./auth/password.js";
import { LoginThrottle, SessionStore } from "./auth/sessionStore.js";
import { createTotpVerifier } from "./auth/totp.js";
import { DurableApprovalJournal } from "./approvals/journal.js";
import type { ApprovalJournalEntry } from "./codex/approvalRouter.js";
import { ApprovalRouter } from "./codex/approvalRouter.js";
import { AccountManager } from "./codex/accountManager.js";
import { AppServerClient } from "./codex/appServerClient.js";
import { JsonRpcClient } from "./codex/jsonRpcClient.js";
import { readWorkspaceMarkdown } from "./codex/safeFileReader.js";
import { SuLauncher, type PortLease } from "./codex/suLauncher.js";
import { createApprovalContext } from "./safety/approvalPolicy.js";
import { loadConfig, type SwarmConfig } from "./config/config.js";
import { DispatchOutbox } from "./dispatch/outbox.js";
import { createLogger } from "./logging/logger.js";
import { NgrokController } from "./ngrok/controller.js";
import { createCoordinatorApp } from "./app.js";
import type { CoordinatorRouteServices } from "./http/routes.js";
import { mergeRateLimits, rankAccounts } from "./scheduler/accountScheduler.js";
import { nextRateLimitCheck } from "./scheduler/accountScheduler.js";
import { CoordinatorState } from "./state/coordinatorState.js";
import { createCoordinatorStateStore } from "./state/atomicStateStore.js";
import { evaluateTaskReadiness, loadBlueprintEvidence } from "./tasks/blueprintEvidence.js";
import { loadManifest } from "./tasks/manifestLoader.js";
import { renderWorkerPrompt } from "./tasks/promptTemplates.js";

type DurableState = {
  auth?: { challenges?: Record<string, unknown>; sessions?: Record<string, unknown>; loginThrottle?: Record<string, { failures: number; retryAt: number }>; usedTotp?: Record<string, true> };
  dispatches?: DispatchRecord[];
  approvals?: ApprovalJournalEntry[];
  ngrok?: { suppressUntil?: number; publicUrl?: string | null; managedTunnelId?: string | null };
};

const accountIds = ["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"] as const;
function accountId(value: string): AccountId { if (!(accountIds as readonly string[]).includes(value)) throw new Error("ACCOUNT_OFFLINE"); return value as AccountId; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringAt(value: unknown, field: string): string | undefined { const result = object(value)[field]; return typeof result === "string" && result ? result : undefined; }
function asThread(account: AccountId, source: Record<string, unknown>): ThreadSummary {
  const id = stringAt(source, "id");
  if (!id) throw new Error("App-server did not return a thread identifier");
  const updated = source.updatedAt;
  return { id, accountId: account, name: typeof source.name === "string" ? source.name : null, archived: source.archived === true, updatedAt: typeof updated === "number" ? updated : Date.now(), capabilities: { canArchive: true, canInterrupt: true, canStartTurn: true, canSteer: true } };
}
function responseThread(value: unknown): Record<string, unknown> { const response = object(value); return response.thread && typeof response.thread === "object" && !Array.isArray(response.thread) ? object(response.thread) : response; }

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
  const logger = createLogger({ secrets: [config.loginPasswordHash, config.totpSecret, config.sessionSecret, config.ngrok.authtoken, ...Object.values(config.accountPasswords)].filter((value): value is string => Boolean(value)) });
  const store = createCoordinatorStateStore<DurableState>(resolve(process.cwd(), ".data", "state.json"), config);
  const state = new CoordinatorState(await store.read(), async (value) => store.write(value));
  const root = state.root();
  root.auth ??= {};
  root.ngrok ??= {};
  const sessions = new SessionStore(config.sessionSecret, { persistence: root.auth as never, persist: () => state.persist() });
  const throttle = new LoginThrottle({ persistence: root.auth as never, persist: () => state.persist() });
  const verifyTotp = createTotpVerifier(config.totpSecret, { persistence: root.auth as never, persist: () => state.persist() });
  const journal = new DurableApprovalJournal(root.approvals ?? [], async (entries) => state.mutate((value) => { value.approvals = entries; }));
  let publishRuntimeEvent: (type: string, payload: Record<string, unknown>) => void = () => undefined;
  const launcher = new SuLauncher({
    spawn: (file, args, options) => spawn(file, args, options) as never,
    allocatePort: leasePort,
    pathExists: async (path) => access(path).then(() => true).catch(() => false),
    verifyCodexBinary: async (path) => access(path).then(() => true).catch(() => false),
    waitForReady: async (endpoint, capabilityToken) => { const probe = new JsonRpcClient({ launch: { endpoint, capabilityToken } }); await probe.connect(); await probe.close(); },
    killProcessGroup: (pid, signal) => { try { process.kill(pid, signal); } catch { /* process already gone */ } },
    log: (entry) => logger.info("suLauncher", entry),
  });
  const accounts = new AccountManager({
    launcher,
    codexBin: config.codexBin,
    createClient: (handle) => {
      const client = new AppServerClient({ account: handle.account, rpc: new JsonRpcClient({ launch: handle }), approvalRouter: new ApprovalRouter({ context: createApprovalContext(handle.account), journal }) });
      client.onEvent((event) => publishRuntimeEvent(event.type, { accountId: event.accountId, ...(event.threadId ? { threadId: event.threadId } : {}), ...(event.turnId ? { turnId: event.turnId } : {}), ...(event.state ? { state: event.state } : {}) }));
      return client;
    },
  });
  const outbox = new DispatchOutbox(root.dispatches ?? [], async (records) => state.mutate((value) => { value.dispatches = records; }));
  let manifest: TaskManifest | undefined;
  let nodes: TaskNode[] = [];
  let manifestError: string | undefined;
  const refreshTasks = async () => {
    if (!config.masterplanPath) { manifest = undefined; nodes = []; manifestError = "MASTERPLAN_NOT_READY"; return; }
    try {
      manifest = await loadManifest(config.masterplanPath, resolve(config.coordinationRoot ?? process.cwd()));
      nodes = taskNode(manifest, evaluateTaskReadiness(manifest, await loadBlueprintEvidence(manifest)));
      manifestError = undefined;
    } catch (error) { manifest = undefined; nodes = []; manifestError = error instanceof Error && error.message.includes("MASTERPLAN") ? "MASTERPLAN_NOT_READY" : "MANIFEST_INVALID"; }
  };
  await refreshTasks();
  let ngrokChild: ReturnType<typeof spawn> | undefined;
  const ngrok = new NgrokController({
    timezone: config.timezone,
    persistence: root.ngrok,
    persist: () => state.persist(),
    start: async () => {
      if (ngrokChild && !ngrokChild.killed) return { id: `pid:${ngrokChild.pid}` };
      const args = ["http", `127.0.0.1:${config.port}`];
      if (config.ngrok.domain) args.push("--domain", config.ngrok.domain);
      ngrokChild = spawn(config.ngrok.bin, args, { detached: true, stdio: "ignore", env: { ...process.env, ...(config.ngrok.authtoken ? { NGROK_AUTHTOKEN: config.ngrok.authtoken } : {}) } });
      if (!ngrokChild.pid) throw new Error("ngrok did not start");
      ngrokChild.once("exit", () => { ngrokChild = undefined; void ngrok.notifyProcessExit(); });
      return { id: `pid:${ngrokChild.pid}` };
    },
    stop: async () => { if (!ngrokChild?.pid) return; try { process.kill(-ngrokChild.pid, "SIGTERM"); } catch { /* stopped */ } ngrokChild = undefined; },
    isHealthy: async () => Boolean(ngrokChild && !ngrokChild.killed),
  });
  if (config.ngrok.enabled) { ngrok.startHeartbeat(); await ngrok.reconcile().catch((error) => logger.warn("ngrok", { event: "reconcile_failed", error: error instanceof Error ? error.message : "failed" })); }

  const liveClient = (id: AccountId): AppServerClient => {
    const client = accounts.client(id);
    if (!(client instanceof AppServerClient)) throw new Error("ACCOUNT_OFFLINE");
    return client;
  };
  const accountSnapshot = () => accounts.snapshotsList();
  const updateRateLimits = async (id: AccountId) => {
    const client = liveClient(id);
    const rateLimits = mergeRateLimits(accounts.snapshot(id).rateLimits, await client.readRateLimitWindows());
    return accounts.updateSnapshot(id, { rateLimits });
  };
  const threads = async (id: AccountId): Promise<ThreadSummary[]> => (await liveClient(id).listAllThreads()).map((thread) => asThread(id, thread));
  const ngrokSnapshot = async (): Promise<NgrokSnapshot> => { const current = ngrok.snapshot(); return { state: (config.ngrok.enabled ? current.state : "disabled") as NgrokSnapshot["state"], publicUrl: current.publicUrl, message: current.error, nextBoundaryAt: current.nextBoundaryAt }; };
  const health = async (): Promise<HealthSnapshot> => ({ server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: manifestError ? "degraded" : "ok", ...(manifestError ? { message: manifestError } : {}) }, outbox: { state: "ok" }, scheduler: { state: "ok" }, ngrok: { state: (await ngrokSnapshot()).state === "error" ? "error" : "ok" }, accounts: { state: accountSnapshot().some((item) => item.connection === "error") ? "degraded" : "ok" } });
  const snapshot = async (): Promise<CoordinatorSnapshot> => ({ generatedAt: Date.now(), activeTurnLimit: config.defaultConcurrency, accounts: accountSnapshot(), tasks: nodes, dispatches: outbox.list(), threads: (await Promise.all(accountSnapshot().filter((item) => item.connection === "connected").map((item) => threads(item.id).catch(() => [])))).flat(), pendingApprovals: journal.pending().map((entry) => entry.pending), ngrok: await ngrokSnapshot(), health: await health() });
  const allowedOrigins = () => {
    const values = new Set([`http://127.0.0.1:${config.port}`, `http://localhost:${config.port}`]);
    const url = ngrok.snapshot().publicUrl;
    if (url) { try { values.add(new URL(url).origin); } catch { /* sanitized controller prevents this */ } }
    return values;
  };
  const createPrompt = async (task: TaskNode, id: AccountId) => renderWorkerPrompt(task.promptTemplate, { workerId: task.id, accountId: id, taskId: task.id, taskTitle: task.title, phase: task.readiness.phase, phaseTerminalCondition: task.promptTemplate === "planning" ? "Stop after the approved planning handoff is integrated on origin/main; do not begin implementation." : task.promptTemplate === "execution" ? "Stop after fresh acceptance evidence, closed review, and the final handoff are integrated on origin/main." : "Stop at Claudio's review boundary after the accepted presentation handoff is integrated on origin/main.", blueprintPath: manifest?.masterplanPath ?? "", masterplanPath: manifest?.masterplanPath ?? "", coordinationRoot: manifest?.coordinationRoot, statusPath: task.statusPath ?? "", specificationPath: task.specificationPath, implementationPlanPath: task.implementationPlanPath, checkoutMode: "coordinator_managed_same_mac_clones", mainMutationLock: "swarm-main-mutation-lock", mainPushQueue: "swarm-main-push-queue", edenmindClonePath: `/Users/${id}/Dev/EdenMind`, ownedSurfaces: "Assigned task surfaces only", excludedSurfaces: "Other workers' owned surfaces" });
  const suggested = (requested?: AccountId) => requested ?? rankAccounts(accountSnapshot(), Date.now())[0]?.id;
  const rateWaitTimers = new Map<string, NodeJS.Timeout>();
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
          await liveClient(active.accountId).startTurn({ threadId: active.threadId, clientUserMessageId: active.clientUserMessageId, text: await createPrompt(task, active.accountId) });
          await outbox.markAccepted(active.id);
        } catch { const active = outbox.get(record.id); if (active?.state === "submitting" || active?.state === "waiting_for_limit") await outbox.abandon(active.id); }
      })();
    }, delay);
    timer.unref();
    rateWaitTimers.set(record.id, timer);
  };
  const services: CoordinatorRouteServices = {
    config: { ...config, secureCookies: config.trustManagedProxy && (ngrok.snapshot().publicUrl?.startsWith("https:") ?? false) }, sessions, throttle, verifyTotp,
    snapshot, health,
    connectAccount: async (id) => {
      const connected = await accounts.connect({ account: id, password: config.accountPasswords[id] });
      await outbox.recover({ readThread: async (record) => {
        const result = await liveClient(record.accountId).readThread(record.threadId, { includeTurns: true });
        const turns = Array.isArray(object(result).thread && object(object(result).thread).turns) ? object(object(result).thread).turns as Array<Record<string, unknown>> : [];
        return { turns: turns.map((turn) => ({ clientUserMessageId: typeof turn.clientUserMessageId === "string" ? turn.clientUserMessageId : undefined })) };
      } });
      for (const waiting of outbox.recoverWaitingTimers()) { const record = outbox.get(waiting.id); if (record?.accountId === id) await scheduleRateWait(record); }
      return connected;
    },
    disconnectAccount: (id) => accounts.disconnect(id),
    refreshRateLimits: updateRateLimits,
    previewLaunch: async (taskId, requested) => {
      await refreshTasks();
      if (!manifest) throw new Error(manifestError ?? "MASTERPLAN_NOT_READY");
      const task = nodes.find((candidate) => candidate.id === taskId);
      if (!task || task.readiness.state !== "ready") throw new Error(task?.readiness.blockingCodes[0] ?? "TASK_NOT_READY");
      const selected = suggested(requested);
      if (!selected) throw new Error("ACCOUNT_OFFLINE");
      return { task, accountId: selected, prompt: await createPrompt(task, selected), dependencies: task.dependsOn, concurrencyImpact: `${outbox.list().filter((item) => item.state === "submitting" || item.state === "accepted").length} / ${config.defaultConcurrency}` };
    },
    launch: async (taskId, input) => {
      const preview = await services.previewLaunch(taskId, input.accountId) as { task: TaskNode; accountId: AccountId; prompt: string };
      const active = outbox.list().filter((item) => item.state === "submitting" || item.state === "accepted").length;
      if (active >= config.defaultConcurrency && !input.overrideConcurrency) throw new Error("GLOBAL_CONCURRENCY_REACHED");
      const client = liveClient(preview.accountId);
      const rawThread = await client.startThread();
      const thread = asThread(preview.accountId, responseThread(rawThread));
      await client.setThreadName(thread.id, `${preview.task.id} · ${preview.task.title}`);
      const now = Date.now();
      const record: DispatchRecord = { id: randomUUID(), clientUserMessageId: randomUUID(), taskId, accountId: preview.accountId, threadId: thread.id, state: "queued", createdAt: now, updatedAt: now, retryAt: null };
      await outbox.enqueue(record);
      await outbox.markSubmitting(record.id);
      try { await client.startTurn({ threadId: thread.id, clientUserMessageId: record.clientUserMessageId, text: preview.prompt }); }
      catch (error) {
        if (error instanceof Error && /rate.?limit/i.test(error.message)) { await scheduleRateWait(record); return outbox.get(record.id); }
        await outbox.fail(record.id, "DISPATCH_FAILED");
        throw error;
      }
      await outbox.markAccepted(record.id);
      accounts.updateSnapshot(preview.accountId, { activeTurns: accounts.snapshot(preview.accountId).activeTurns + 1, lastAssignedAt: now });
      return outbox.get(record.id);
    },
    listThreads: threads,
    readTranscript: async (id, threadId) => { const client = liveClient(id); await client.readThread(threadId, { includeTurns: true }); return client.transcriptSnapshot().items.filter((item) => item.threadId === threadId); },
    startThread: async (id) => asThread(id, responseThread(await liveClient(id).startThread())),
    archiveThread: async (id, threadId) => { await liveClient(id).archiveThread(threadId); },
    startTurn: async (id, threadId, input) => liveClient(id).startTurn({ threadId, text: input.text, clientUserMessageId: input.clientUserMessageId ?? randomUUID() }),
    steerTurn: async (id, threadId, input) => { await liveClient(id).steerTurn({ threadId, turnId: input.turnId, text: input.text, clientUserMessageId: input.clientUserMessageId ?? randomUUID() }); },
    interruptTurn: async (id, threadId, input) => { await liveClient(id).interruptTurn(threadId, input.turnId); },
    readMarkdown: async (id, path) => { const file = await readWorkspaceMarkdown({ account: id, requestedPath: path, appServer: liveClient(id) }); return { filename: file.filename, content: file.text }; },
    decideApproval: async (id, input) => {
      const kind = input.decision === "grant_turn" || input.decision === "grant_turn_strict" ? input.decision : input.decision === "accept" || input.decision === "decline" || input.decision === "cancel" ? input.decision : input.decision === "deny" ? "deny" : undefined;
      if (!kind) throw new Error("HUMAN_APPROVAL_REQUIRED");
      await journal.decide(id, kind === "grant_turn" || kind === "grant_turn_strict" ? { kind, permissions: input.permissions ?? {} } : { kind });
    },
    ngrokSnapshot,
    stopNgrokEarly: () => ngrok.stopEarly(),
    allowedOrigins,
  };
  const coordinator = createCoordinatorApp({ services, staticDir: resolve(process.cwd(), "dist"), flush: () => state.persist(), shutdown: async () => { journal.rejectLive(); for (const id of rateWaitTimers.keys()) clearRateWait(id); await accounts.shutdown(); await ngrok.shutdown().catch(() => undefined); } });
  publishRuntimeEvent = (type, payload) => { coordinator.hub.publish(type, payload); };
  accounts.onChange(() => coordinator.hub.publish("account", {} as Record<string, unknown>));
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
