import type { AccountId, RateLimitWindow } from "../../shared/contracts.js";
import { JsonRpcClient } from "./jsonRpcClient.js";
import { clonePath, safeThreadSettings, safeTurnSettings } from "./protocol.js";

export interface AppServerClientOptions {
  account: AccountId;
  rpc: JsonRpcClient;
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

type ThreadSettingsEcho = {
  cwd?: unknown;
  runtimeWorkspaceRoots?: unknown;
  approvalPolicy?: unknown;
  approvalsReviewer?: unknown;
  sandbox?: unknown;
};

/** Typed coordinator facade for the v2 methods used by this application. */
export class AppServerClient {
  readonly account: AccountId;
  readonly rpc: JsonRpcClient;
  accountInfo: AccountReadResult | undefined;

  constructor(options: AppServerClientOptions) {
    this.account = options.account;
    this.rpc = options.rpc;
  }

  async connect(): Promise<AccountReadResult> {
    await this.rpc.connect();
    const account = await this.rpc.initializeAndReadAccount<AccountReadResult>();
    if (!account.account || account.requiresOpenaiAuth) {
      await this.rpc.close();
      throw new Error("ACCOUNT_AUTH_REQUIRED");
    }
    this.accountInfo = account;
    return account;
  }

  async reconnect(): Promise<AccountReadResult> {
    await this.rpc.close();
    this.accountInfo = undefined;
    return this.connect();
  }

  close(): Promise<void> { return this.rpc.close(); }

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

  readThread(threadId: string, options: { includeTurns: true }): Promise<{ thread: Record<string, unknown> }> {
    this.requireReady();
    return this.rpc.request("thread/read", { threadId, includeTurns: options.includeTurns });
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

  private requireReady(): void {
    if (!this.accountInfo) throw new Error("App-server client is not initialized");
  }

  private assertSafeThreadEcho(response: Record<string, unknown>): void {
    const expected = clonePath(this.account);
    const settings = response as ThreadSettingsEcho;
    const sandbox = settings.sandbox as Record<string, unknown> | undefined;
    const correctRoots = Array.isArray(settings.runtimeWorkspaceRoots)
      && settings.runtimeWorkspaceRoots.length === 1
      && settings.runtimeWorkspaceRoots[0] === expected;
    const correctSandbox = sandbox?.type === "workspaceWrite"
      && Array.isArray(sandbox.writableRoots)
      && sandbox.writableRoots.length === 1
      && sandbox.writableRoots[0] === expected
      && sandbox.networkAccess === true
      && sandbox.excludeTmpdirEnvVar === true
      && sandbox.excludeSlashTmp === true;
    if (settings.cwd !== expected || !correctRoots || settings.approvalPolicy !== "untrusted" || settings.approvalsReviewer !== "user" || !correctSandbox) {
      throw new Error("App-server returned an unsafe thread execution policy");
    }
  }
}
