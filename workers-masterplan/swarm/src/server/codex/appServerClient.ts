import type { AccountId, ChatExecutionSettings, ChatModelOption, RateLimitWindow } from "../../shared/contracts.js";
import type { ApprovalRouter } from "./approvalRouter.js";
import { JsonRpcClient } from "./jsonRpcClient.js";
import { safeThreadSettings, safeTurnSettings, workspaceRoot } from "./protocol.js";
import {
  hydrateTranscript,
  initialTranscriptState,
  reduceTranscriptEvent,
  transcriptRecoveryState,
  type RawThreadTurn,
  type TranscriptState,
} from "./transcriptReducer.js";

export interface AppServerClientOptions {
  account: AccountId;
  rpc: JsonRpcClient;
  approvalRouter: ApprovalRouter;
  /** Coordinator-owned workspace path for the direct local account only. */
  workspaceRoot?: string;
  /** Read-only filesystem fallback when app-server cannot hydrate a persisted rollout. */
  readLockedThread?: (threadId: string) => Promise<{ thread: Record<string, unknown> }>;
}

export interface AccountReadResult {
  account: Record<string, unknown> | null;
  requiresOpenaiAuth: boolean;
}

export interface StartTurnInput {
  threadId: string;
  clientUserMessageId: string;
  text: string;
  settings?: ChatExecutionSettings;
  attachments?: Array<{ name: string; path: string }>;
}

export interface SteerTurnInput {
  threadId: string;
  turnId: string;
  clientUserMessageId: string;
  text: string;
}

export interface NormalizedAppServerEvent {
  type: "turn" | "thread" | "rate_limit" | "account" | "connection" | "transcript" | "breaking_change";
  accountId: AccountId;
  threadId?: string;
  turnId?: string;
  state?: string;
  historical?: boolean;
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function turnLimitExhausted(value: unknown): boolean {
  const error = object(object(value)?.error);
  if (error?.codexErrorInfo === "sessionBudgetExceeded" || error?.codexErrorInfo === "usageLimitExceeded") return true;
  return error ? /(?:session|usage|rate).{0,24}limit|limit.{0,24}(?:exceed|reset)/i.test(JSON.stringify(error)) : false;
}

function turnActivityState(turn: Record<string, unknown>): "started" | "completed" | "failed" | "interrupted" | "limit_exhausted" | undefined {
  const status = typeof turn.status === "string" ? turn.status : object(turn.status)?.type;
  if (typeof status !== "string") return undefined;
  switch (status.replace(/[ _-]/g, "").toLowerCase()) {
    case "active":
    case "inprogress":
    case "running":
    case "started":
      return "started";
    case "completed":
    case "complete":
      return turnLimitExhausted(turn) ? "limit_exhausted" : "completed";
    case "failed":
      return turnLimitExhausted(turn) ? "limit_exhausted" : "failed";
    case "interrupted":
    case "cancelled":
    case "canceled":
      return "interrupted";
    default:
      return undefined;
  }
}

type ThreadSettingsEcho = {
  cwd?: unknown;
  approvalPolicy?: unknown;
  approvalsReviewer?: unknown;
  sandbox?: unknown;
};

/** Typed coordinator facade for the v2 methods used by this application. */
export class AppServerClient {
  readonly account: AccountId;
  readonly rpc: JsonRpcClient;
  accountInfo: AccountReadResult | undefined;
  private transcript = initialTranscriptState;
  private readonly trackedThreadIds = new Set<string>();
  private readonly unloadedThreadIds = new Set<string>();
  private readonly eventListeners = new Set<(event: NormalizedAppServerEvent) => void>();
  private needsTranscriptRecovery = false;
  private readonly workspaceRootOverride: string | undefined;
  private readonly readLockedThread: AppServerClientOptions["readLockedThread"];

  constructor(options: AppServerClientOptions) {
    this.account = options.account;
    this.rpc = options.rpc;
    this.workspaceRootOverride = options.workspaceRoot;
    this.readLockedThread = options.readLockedThread;
    this.rpc.installApprovalHandler(options.approvalRouter);
    this.rpc.onDisconnect(() => this.markTrackedTranscriptsDisconnected());
    this.rpc.onNotification((notification) => this.applyTranscriptNotification(notification));
  }

  async connect(): Promise<AccountReadResult> {
    try {
      await this.rpc.connect();
      const account = await this.rpc.initializeAndReadAccount<AccountReadResult>();
      if (!account.account) throw new Error("ACCOUNT_AUTH_REQUIRED");
      this.accountInfo = account;
      await this.recoverTrackedTranscripts();
      return account;
    } catch (error) {
      await this.rpc.close().catch(() => undefined);
      throw error;
    }
  }

  async reconnect(): Promise<AccountReadResult> {
    this.markTrackedTranscriptsDisconnected();
    await this.rpc.close();
    this.accountInfo = undefined;
    return this.connect();
  }

  close(): Promise<void> { return this.rpc.close(); }

  isConnected(): boolean { return this.rpc.isConnected(); }

  onEvent(listener: (event: NormalizedAppServerEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async listAllThreads(): Promise<Array<Record<string, unknown>>> {
    this.requireReady();
    const cwd = workspaceRoot(this.account, this.workspaceRootOverride);
    const threads: Array<Record<string, unknown>> = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const page: { data: Array<Record<string, unknown>>; nextCursor: string | null } = await this.rpc.request("thread/list", {
        archived: null,
        cursor,
        cwd,
        limit: 100,
        sortDirection: "desc",
        sortKey: "updated_at",
        useStateDbOnly: true,
      });
      threads.push(...page.data);
      cursor = page.nextCursor;
      if (cursor && seenCursors.has(cursor)) throw new Error("App-server returned a repeated thread pagination cursor");
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    for (const thread of threads) {
      const status = object(thread.status);
      if (typeof thread.id === "string" && status?.type === "notLoaded") this.unloadedThreadIds.add(thread.id);
      else if (typeof thread.id === "string") this.unloadedThreadIds.delete(thread.id);
    }
    return threads;
  }

  async readThread(threadId: string, options: { includeTurns: true }): Promise<{ thread: Record<string, unknown> }> {
    this.requireReady();
    let response: { thread: Record<string, unknown> } | undefined;
    if (this.unloadedThreadIds.has(threadId) && this.readLockedThread) {
      try {
        response = await this.readLockedThread(threadId);
      } catch { /* fall through to app-server */ }
    }
    if (!response) {
      try {
        response = await this.rpc.request<{ thread: Record<string, unknown> }>("thread/read", { threadId, includeTurns: options.includeTurns });
      } catch (error) {
        if (!this.readLockedThread) throw error;
        try {
          response = await this.readLockedThread(threadId);
        } catch {
          throw error;
        }
      }
    }
    this.trackedThreadIds.add(threadId);
    this.hydrateThreadRead(threadId, response);
    return response;
  }

  async startThread(): Promise<Record<string, unknown>> {
    this.requireReady();
    const response = await this.rpc.request<Record<string, unknown>>("thread/start", safeThreadSettings(this.account, this.workspaceRootOverride));
    this.assertSafeThreadEcho(response);
    return response;
  }

  async resumeThread(threadId: string): Promise<Record<string, unknown>> {
    this.requireReady();
    const response = await this.rpc.request<Record<string, unknown>>("thread/resume", { threadId, ...safeThreadSettings(this.account, this.workspaceRootOverride) });
    this.assertSafeThreadEcho(response);
    this.unloadedThreadIds.delete(threadId);
    return response;
  }

  archiveThread(threadId: string): Promise<Record<string, never>> {
    this.requireReady();
    return this.rpc.request("thread/archive", { threadId });
  }

  async setThreadName(threadId: string, name: string): Promise<Record<string, never>> {
    this.requireReady();
    try {
      return await this.rpc.request("thread/name/set", { threadId, name });
    } catch (error) {
      // Codex creates the thread before its rollout exists. A title set in that
      // small window is cosmetic, so it must not cancel a dispatched worker.
      if (error instanceof Error && /no rollout found for thread id/i.test(error.message)) return {};
      throw error;
    }
  }

  async startTurn(input: StartTurnInput): Promise<{ turn: Record<string, unknown> }> {
    this.requireReady();
    if (this.unloadedThreadIds.has(input.threadId)) await this.resumeThread(input.threadId);
    return this.rpc.request("turn/start", {
      threadId: input.threadId,
      clientUserMessageId: input.clientUserMessageId,
      input: [{ type: "text", text: input.text, text_elements: [] }, ...(input.attachments ?? []).map((attachment) => ({ type: "mention", name: attachment.name, path: attachment.path }))],
      ...safeTurnSettings(this.account, this.workspaceRootOverride, input.settings),
    });
  }

  async listModels(): Promise<ChatModelOption[]> {
    this.requireReady();
    const models: ChatModelOption[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const page: { data?: unknown; nextCursor?: unknown } = await this.rpc.request("model/list", { cursor, limit: 50 });
      if (Array.isArray(page.data)) models.push(...page.data.map(normalizeModelOption).filter((model): model is ChatModelOption => model !== undefined));
      cursor = typeof page.nextCursor === "string" && page.nextCursor ? page.nextCursor : null;
      if (cursor && seenCursors.has(cursor)) throw new Error("App-server returned a repeated model pagination cursor");
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    return models;
  }

  steerTurn(input: SteerTurnInput): Promise<Record<string, never>> {
    this.requireReady();
    return this.rpc.request("turn/steer", {
      threadId: input.threadId,
      expectedTurnId: input.turnId,
      clientUserMessageId: input.clientUserMessageId,
      input: [{ type: "text", text: input.text, text_elements: [] }],
    });
  }

  interruptTurn(threadId: string, turnId: string): Promise<Record<string, never>> {
    this.requireReady();
    return this.rpc.request("turn/interrupt", { threadId, turnId });
  }

  readRateLimits(): Promise<Record<string, unknown>> {
    this.requireReady();
    return this.rpc.request("account/rateLimits/read", undefined);
  }

  async readRateLimitWindows(updatedAt = Date.now()): Promise<RateLimitWindow[]> {
    const response = await this.readRateLimits();
    const multiBucket = response.rateLimitsByLimitId;
    const buckets: Array<[string, unknown]> = multiBucket && typeof multiBucket === "object" && !Array.isArray(multiBucket)
      ? Object.entries(multiBucket as Record<string, unknown>)
      : [["default", response.rateLimits]];
    const windows: RateLimitWindow[] = [];
    for (const [fallbackId, rawBucket] of buckets.sort(([left], [right]) => left.localeCompare(right))) {
      const bucket = rawBucket && typeof rawBucket === "object" && !Array.isArray(rawBucket) ? rawBucket as Record<string, unknown> : undefined;
      if (!bucket) {
        windows.push({ id: `${fallbackId}:invalid`, label: `${fallbackId} invalid`, usedPercent: null, resetsAt: null, updatedAt });
        continue;
      }
      const id = typeof bucket.limitId === "string" && bucket.limitId ? bucket.limitId : fallbackId;
      const label = typeof bucket.limitName === "string" && bucket.limitName ? bucket.limitName : id;
      for (const phase of ["primary", "secondary"] as const) {
        const rawWindow = bucket[phase];
        if (rawWindow === null || rawWindow === undefined) continue;
        const window = rawWindow && typeof rawWindow === "object" && !Array.isArray(rawWindow) ? rawWindow as Record<string, unknown> : undefined;
        const usedPercent = typeof window?.usedPercent === "number" && Number.isFinite(window.usedPercent) && window.usedPercent >= 0 && window.usedPercent <= 100 ? window.usedPercent : null;
        const rawReset = window?.resetsAt;
        const resetValid = rawReset === null || (typeof rawReset === "number" && Number.isInteger(rawReset) && rawReset > 0);
        windows.push({ id: `${id}:${phase}`, label: `${label} ${phase}`, usedPercent: resetValid ? usedPercent : null, resetsAt: resetValid ? rawReset as number | null : null, updatedAt });
      }
    }
    return windows;
  }

  readFile(path: string): Promise<{ dataBase64: string }> {
    this.requireReady();
    return this.rpc.request("fs/readFile", { path });
  }

  writeFile(path: string, text: string): Promise<Record<string, never>> {
    this.requireReady();
    return this.rpc.request("fs/writeFile", { path, dataBase64: Buffer.from(text, "utf8").toString("base64") });
  }

  /** Snapshot is copied so UI consumers cannot mutate retained transcript state. */
  transcriptSnapshot(): TranscriptState {
    return {
      items: this.transcript.items.map((item) => ({ ...item, payload: { ...item.payload } })),
      recoveryByScope: new Map(this.transcript.recoveryByScope),
    };
  }

  private requireReady(): void {
    if (!this.accountInfo) throw new Error("App-server client is not initialized");
  }

  private assertSafeThreadEcho(response: Record<string, unknown>): void {
    const expected = workspaceRoot(this.account, this.workspaceRootOverride);
    const settings = response as ThreadSettingsEcho;
    const sandbox = settings.sandbox as Record<string, unknown> | undefined;
    const correctSandbox = sandbox?.type === "workspaceWrite"
      && Array.isArray(sandbox.writableRoots)
      // Codex represents the default workspace root as an empty list. Its
      // returned `cwd` below remains the authoritative single-root boundary.
      && (sandbox.writableRoots.length === 0 || (sandbox.writableRoots.length === 1 && sandbox.writableRoots[0] === expected))
      // `thread/start` accepts only the legacy string "workspace-write".
      // Codex acknowledges that mode with no network access (the secure default);
      // network policy is supplied separately when a turn actually starts.
      && sandbox.networkAccess !== true;
    if (settings.cwd !== expected || settings.approvalPolicy !== "untrusted" || settings.approvalsReviewer !== "user" || !correctSandbox) {
      throw new Error("App-server returned an unsafe thread execution policy");
    }
  }

  private markTrackedTranscriptsDisconnected(): void {
    if (this.trackedThreadIds.size === 0) return;
    for (const threadId of this.trackedThreadIds) {
      this.transcript = reduceTranscriptEvent(this.transcript, {
        method: "transcript/disconnected",
        params: { accountId: this.account, threadId },
      });
    }
    this.needsTranscriptRecovery = true;
  }

  private async recoverTrackedTranscripts(): Promise<void> {
    if (!this.needsTranscriptRecovery) return;
    for (const threadId of this.trackedThreadIds) {
      this.transcript = reduceTranscriptEvent(this.transcript, {
        method: "transcript/recoveryStarted",
        params: { accountId: this.account, threadId },
      });
    }
    for (const threadId of this.trackedThreadIds) await this.readThread(threadId, { includeTurns: true });
    this.needsTranscriptRecovery = [...this.trackedThreadIds].some((threadId) => transcriptRecoveryState(this.transcript, { accountId: this.account, threadId }) !== "complete");
  }

  private hydrateThreadRead(threadId: string, response: { thread: Record<string, unknown> }): void {
    const thread = response.thread;
    if (thread.id !== threadId || !Array.isArray(thread.turns)) return;
    this.transcript = hydrateTranscript(this.transcript, {
      accountId: this.account,
      threadId,
      turns: thread.turns as RawThreadTurn[],
    });
    const latest = [...thread.turns]
      .filter((turn): turn is Record<string, unknown> => Boolean(turn) && typeof turn === "object" && !Array.isArray(turn))
      .sort((left, right) => (typeof left.startedAt === "number" ? left.startedAt : -1) - (typeof right.startedAt === "number" ? right.startedAt : -1))
      .at(-1);
    const turnId = latest && typeof latest.id === "string" ? latest.id : undefined;
    const state = latest ? turnActivityState(latest) : undefined;
    if (turnId && state) this.emit({ type: "turn", accountId: this.account, threadId, turnId, state, historical: true });
  }

  private applyTranscriptNotification(notification: { method: string; params?: unknown }): void {
    const params = notification.params;
    if (params === null || typeof params !== "object" || Array.isArray(params)) return;
    const threadId = (params as Record<string, unknown>).threadId;
    const recordParams = params as Record<string, unknown>;
    const turn = object(recordParams.turn);
    const turnId = typeof recordParams.turnId === "string" ? recordParams.turnId : typeof turn?.id === "string" ? turn.id : undefined;
    const state = notification.method.startsWith("turn/") && turnLimitExhausted(turn) ? "limit_exhausted" : notification.method.slice("turn/".length);
    if (notification.method.startsWith("turn/")) this.emit({ type: "turn", accountId: this.account, threadId: typeof threadId === "string" ? threadId : undefined, turnId, state });
    else if (notification.method.startsWith("thread/")) this.emit({ type: "thread", accountId: this.account, threadId: typeof threadId === "string" ? threadId : undefined, state: notification.method.slice("thread/".length) });
    else if (notification.method === "account/rateLimits/updated") this.emit({ type: "rate_limit", accountId: this.account, state: "updated" });
    else if (notification.method === "account/updated") this.emit({ type: "account", accountId: this.account, state: "updated" });
    if (notification.method === "item/completed" && isBreakingChangeHandoff(recordParams.item)) this.emit({ type: "breaking_change", accountId: this.account, threadId: typeof threadId === "string" ? threadId : undefined, turnId, state: "reported" });
    if (typeof threadId !== "string" || !this.trackedThreadIds.has(threadId)) return;
    this.transcript = reduceTranscriptEvent(this.transcript, {
      method: notification.method,
      params: { ...recordParams, accountId: this.account },
    });
    if (notification.method.startsWith("item/")) this.emit({ type: "transcript", accountId: this.account, threadId, turnId, state: "updated" });
  }

  private emit(event: NormalizedAppServerEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }
}

function normalizeModelOption(value: unknown): ChatModelOption | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const model = value as Record<string, unknown>;
  if (typeof model.model !== "string" || !model.model) return undefined;
  const supportedEfforts = Array.isArray(model.supportedReasoningEfforts)
    ? model.supportedReasoningEfforts.flatMap((option) => option && typeof option === "object" && !Array.isArray(option) && typeof (option as Record<string, unknown>).reasoningEffort === "string" ? [(option as Record<string, unknown>).reasoningEffort as string] : [])
    : [];
  const serviceTiers = Array.isArray(model.serviceTiers)
    ? model.serviceTiers.flatMap((tier) => tier && typeof tier === "object" && !Array.isArray(tier) && typeof (tier as Record<string, unknown>).id === "string" && typeof (tier as Record<string, unknown>).name === "string" ? [{ id: (tier as Record<string, unknown>).id as string, name: (tier as Record<string, unknown>).name as string }] : [])
    : [];
  return {
    model: model.model,
    displayName: typeof model.displayName === "string" && model.displayName ? model.displayName : model.model,
    supportedEfforts,
    defaultEffort: typeof model.defaultReasoningEffort === "string" ? model.defaultReasoningEffort : null,
    serviceTiers,
    defaultServiceTier: typeof model.defaultServiceTier === "string" ? model.defaultServiceTier : null,
    isDefault: model.isDefault === true,
  };
}

/** Only a deliberate handoff marker raises the persistent breaking-change signal. */
function isBreakingChangeHandoff(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (item.type !== "agentMessage") return false;
  const text = typeof item.text === "string" ? item.text : "";
  return /(?:^|\n)\s*BREAKING CHANGE\s*:/i.test(text);
}
