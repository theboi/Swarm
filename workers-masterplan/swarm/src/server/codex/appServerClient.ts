import type { AccountId, RateLimitWindow } from "../../shared/contracts.js";
import type { ApprovalRouter } from "./approvalRouter.js";
import { JsonRpcClient } from "./jsonRpcClient.js";
import { clonePath, safeThreadSettings, safeTurnSettings } from "./protocol.js";
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
}

export interface AccountReadResult {
  account: Record<string, unknown> | null;
  requiresOpenaiAuth: boolean;
}

export interface StartTurnInput {
  threadId: string;
  clientUserMessageId: string;
  text: string;
}

export interface SteerTurnInput {
  threadId: string;
  turnId: string;
  clientUserMessageId: string;
  text: string;
}

export interface NormalizedAppServerEvent {
  type: "turn" | "thread" | "rate_limit" | "account" | "connection";
  accountId: AccountId;
  threadId?: string;
  turnId?: string;
  state?: string;
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
  private readonly eventListeners = new Set<(event: NormalizedAppServerEvent) => void>();
  private needsTranscriptRecovery = false;

  constructor(options: AppServerClientOptions) {
    this.account = options.account;
    this.rpc = options.rpc;
    this.rpc.installApprovalHandler(options.approvalRouter);
    this.rpc.onDisconnect(() => this.markTrackedTranscriptsDisconnected());
    this.rpc.onNotification((notification) => this.applyTranscriptNotification(notification));
  }

  async connect(): Promise<AccountReadResult> {
    try {
      await this.rpc.connect();
      const account = await this.rpc.initializeAndReadAccount<AccountReadResult>();
      if (!account.account || account.requiresOpenaiAuth) throw new Error("ACCOUNT_AUTH_REQUIRED");
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

  onEvent(listener: (event: NormalizedAppServerEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async listAllThreads(): Promise<Array<Record<string, unknown>>> {
    this.requireReady();
    const threads: Array<Record<string, unknown>> = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const page: { data: Array<Record<string, unknown>>; nextCursor: string | null } = await this.rpc.request("thread/list", { archived: null, cursor });
      threads.push(...page.data);
      cursor = page.nextCursor;
      if (cursor && seenCursors.has(cursor)) throw new Error("App-server returned a repeated thread pagination cursor");
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    return threads;
  }

  async readThread(threadId: string, options: { includeTurns: true }): Promise<{ thread: Record<string, unknown> }> {
    this.requireReady();
    this.trackedThreadIds.add(threadId);
    const response = await this.rpc.request<{ thread: Record<string, unknown> }>("thread/read", { threadId, includeTurns: options.includeTurns });
    this.hydrateThreadRead(threadId, response);
    return response;
  }

  async startThread(): Promise<Record<string, unknown>> {
    this.requireReady();
    const response = await this.rpc.request<Record<string, unknown>>("thread/start", safeThreadSettings(this.account));
    this.assertSafeThreadEcho(response);
    return response;
  }

  async resumeThread(threadId: string): Promise<Record<string, unknown>> {
    this.requireReady();
    const response = await this.rpc.request<Record<string, unknown>>("thread/resume", { threadId, ...safeThreadSettings(this.account) });
    this.assertSafeThreadEcho(response);
    return response;
  }

  archiveThread(threadId: string): Promise<Record<string, never>> {
    this.requireReady();
    return this.rpc.request("thread/archive", { threadId });
  }

  setThreadName(threadId: string, name: string): Promise<Record<string, never>> {
    this.requireReady();
    return this.rpc.request("thread/name/set", { threadId, name });
  }

  startTurn(input: StartTurnInput): Promise<{ turn: Record<string, unknown> }> {
    this.requireReady();
    return this.rpc.request("turn/start", {
      threadId: input.threadId,
      clientUserMessageId: input.clientUserMessageId,
      input: [{ type: "text", text: input.text }],
      ...safeTurnSettings(this.account),
    });
  }

  steerTurn(input: SteerTurnInput): Promise<Record<string, never>> {
    this.requireReady();
    return this.rpc.request("turn/steer", {
      threadId: input.threadId,
      expectedTurnId: input.turnId,
      clientUserMessageId: input.clientUserMessageId,
      input: [{ type: "text", text: input.text }],
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
    const expected = clonePath(this.account);
    const settings = response as ThreadSettingsEcho;
    const sandbox = settings.sandbox as Record<string, unknown> | undefined;
    const correctSandbox = sandbox?.type === "workspaceWrite"
      && Array.isArray(sandbox.writableRoots)
      && sandbox.writableRoots.length === 1
      && sandbox.writableRoots[0] === expected
      && sandbox.networkAccess === true
      && sandbox.excludeTmpdirEnvVar === true
      && sandbox.excludeSlashTmp === true;
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
  }

  private applyTranscriptNotification(notification: { method: string; params?: unknown }): void {
    const params = notification.params;
    if (params === null || typeof params !== "object" || Array.isArray(params)) return;
    const threadId = (params as Record<string, unknown>).threadId;
    const recordParams = params as Record<string, unknown>;
    const turnId = typeof recordParams.turnId === "string" ? recordParams.turnId : undefined;
    if (notification.method.startsWith("turn/")) this.emit({ type: "turn", accountId: this.account, threadId: typeof threadId === "string" ? threadId : undefined, turnId, state: notification.method.slice("turn/".length) });
    else if (notification.method.startsWith("thread/")) this.emit({ type: "thread", accountId: this.account, threadId: typeof threadId === "string" ? threadId : undefined, state: notification.method.slice("thread/".length) });
    else if (notification.method === "account/rateLimits/updated") this.emit({ type: "rate_limit", accountId: this.account, state: "updated" });
    else if (notification.method === "account/updated") this.emit({ type: "account", accountId: this.account, state: "updated" });
    if (typeof threadId !== "string" || !this.trackedThreadIds.has(threadId)) return;
    this.transcript = reduceTranscriptEvent(this.transcript, {
      method: notification.method,
      params: { ...recordParams, accountId: this.account },
    });
  }

  private emit(event: NormalizedAppServerEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }
}
