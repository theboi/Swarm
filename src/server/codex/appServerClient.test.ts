import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeAppServer, type FakeAppServer } from "../../test/fakeAppServer.js";
import { createApprovalContext, type ApprovalFilesystem } from "../safety/approvalPolicy.js";
import { ApprovalRouter } from "./approvalRouter.js";
import { AppServerClient } from "./appServerClient.js";
import { JsonRpcClient } from "./jsonRpcClient.js";
import type { AccountId } from "../../shared/contracts.js";

const token = "one-time-loopback-capability-token";
const tokenDigest = createHash("sha256").update(token).digest("hex");
const account = "bot1" as const;
const cwd = "/Users/bot1/Dev/EdenMind";
const approvalFilesystem: ApprovalFilesystem = {
  async realpath(path) {
    if (path !== cwd) throw new Error(`ENOENT ${path}`);
    return path;
  },
};
let server: FakeAppServer | undefined;
let approvalJournal: { append: ReturnType<typeof vi.fn>; waitForDecision: ReturnType<typeof vi.fn> } | undefined;
function fullThreadHistory(): Array<Record<string, unknown>> {
  return [{ id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "agentMessage", id: "item-1", text: "hello" }] }];
}

let threadHistory = fullThreadHistory();

afterEach(async () => {
  await server?.stop();
  server = undefined;
  approvalJournal = undefined;
  threadHistory = fullThreadHistory();
  vi.restoreAllMocks();
});

function safeThreadEcho(overrides: Record<string, unknown> = {}) {
  return {
    thread: { id: "thread-1" },
    cwd,
    approvalPolicy: "untrusted",
    approvalsReviewer: "user",
    sandbox: { type: "workspaceWrite", writableRoots: [cwd], networkAccess: true, excludeTmpdirEnvVar: true, excludeSlashTmp: true },
    ...overrides,
  };
}

async function readyClient(options: { requireCredentialRefresh?: boolean; account?: AccountId; workspaceRoot?: string; requiresOpenaiAuth?: boolean; loginVerificationUrl?: string; threadStartNetworkAccess?: boolean; threadStartWritableRoots?: string[]; threadNameError?: string; threadReadError?: string; threadResumeError?: string; turnStartErrorOnce?: string; threadStatus?: "notLoaded" | "idle" | "active"; readLockedThread?: (threadId: string) => Promise<{ thread: Record<string, unknown> }>; rateLimitResponse?: Record<string, unknown> } = {}) {
  const clientAccount = options.account ?? account;
  const clientCwd = options.workspaceRoot ?? cwd;
  server = createFakeAppServer(tokenDigest);
  await server.start();
  let turnStartFailed = false;
  server.onMessage((message, peer) => {
    const reply = (result: unknown) => peer.send(JSON.stringify({ id: message.id, result }));
    if (message.method === "initialize") reply({ codexHome: "/Users/bot1/.codex" });
    if (message.method === "account/read") {
      const stale = options.requireCredentialRefresh && (message.params as { refreshToken?: boolean }).refreshToken !== true;
      reply({ account: stale ? null : { type: "chatgpt", email: `${clientAccount}@example.test` }, requiresOpenaiAuth: stale || (options.requiresOpenaiAuth ?? false) });
    }
    if (message.method === "account/login/start") reply({ loginId: "login-1", verificationUrl: options.loginVerificationUrl ?? "https://auth.example.test/device", userCode: "ABCD-EFGH" });
    if (message.method === "thread/resume" && options.threadResumeError) peer.send(JSON.stringify({ id: message.id, error: { code: -32000, message: options.threadResumeError } }));
    else if (message.method === "thread/start" || message.method === "thread/resume") reply(safeThreadEcho({ cwd: clientCwd, sandbox: { type: "workspaceWrite", writableRoots: options.threadStartWritableRoots ?? [clientCwd], networkAccess: options.threadStartNetworkAccess ?? false, excludeTmpdirEnvVar: false, excludeSlashTmp: false } }));
    if (message.method === "turn/start" && options.turnStartErrorOnce && !turnStartFailed) {
      turnStartFailed = true;
      peer.send(JSON.stringify({ id: message.id, error: { code: -32000, message: options.turnStartErrorOnce } }));
    } else if (message.method === "turn/start") reply({ turn: { id: "turn-1" } });
    if (message.method === "model/list") reply({
      data: [{ id: "gpt-5.3-codex", model: "gpt-5.3-codex", displayName: "GPT-5.3 Codex", description: "Coding", hidden: false, supportedReasoningEfforts: [{ reasoningEffort: "low" }, { reasoningEffort: "high" }], defaultReasoningEffort: "high", serviceTiers: [{ id: "standard", name: "Standard" }, { id: "priority", name: "Fast" }], defaultServiceTier: "standard", isDefault: true }],
      nextCursor: null,
    });
    if (message.method === "thread/list") {
      const cursor = (message.params as { cursor?: string }).cursor;
      reply(cursor ? { data: [{ id: "thread-2", name: "Later" }], nextCursor: null } : { data: [{ id: "thread-1", name: "First", ...(options.threadStatus ? { status: { type: options.threadStatus } } : {}) }], nextCursor: "page-2" });
    }
    if (message.method === "thread/read" && options.threadReadError) peer.send(JSON.stringify({ id: message.id, error: { code: -32000, message: options.threadReadError } }));
    else if (message.method === "thread/read") reply({ thread: { id: "thread-1", turns: threadHistory } });
    if (message.method === "account/rateLimits/read") reply(options.rateLimitResponse ?? {
      rateLimits: { limitId: "codex", primary: { usedPercent: 20, resetsAt: 1_800 }, secondary: { usedPercent: 73, resetsAt: null } },
      rateLimitsByLimitId: {
        codex: { limitId: "codex", limitName: "Codex", primary: { usedPercent: 20, resetsAt: 1_800 }, secondary: { usedPercent: 73, resetsAt: null } },
        weekly: { limitId: "weekly", limitName: "Weekly", primary: { usedPercent: 7, resetsAt: 9_000 }, secondary: null },
      },
    });
    if (message.method === "fs/readFile") reply({ dataBase64: Buffer.from("# Checked\n", "utf8").toString("base64") });
    if (message.method === "fs/writeFile") reply({});
    if (message.method === "thread/name/set" && options.threadNameError) {
      peer.send(JSON.stringify({ id: message.id, error: { code: -32000, message: options.threadNameError } }));
    } else if (["thread/archive", "thread/name/set", "turn/steer", "turn/interrupt"].includes(message.method ?? "")) reply({});
  });
  const rpc = new JsonRpcClient({ launch: { endpoint: server.url, capabilityToken: token }, requestTimeoutMs: 100 });
  approvalJournal = { append: vi.fn(async () => undefined), waitForDecision: vi.fn(async () => ({ kind: "cancel" })) };
  const approvalRouter = new ApprovalRouter({
    context: createApprovalContext(clientAccount, options.workspaceRoot),
    journal: approvalJournal,
    filesystem: { async realpath(path) { if (path !== clientCwd) throw new Error(`ENOENT ${path}`); return path; } },
    requestTimeoutMs: 25,
  });
  const client = new AppServerClient({ account: clientAccount, rpc, approvalRouter, workspaceRoot: options.workspaceRoot, readLockedThread: options.readLockedThread });
  await client.connect();
  return client;
}

describe("AppServerClient", () => {
  it("hydrates a tracked transcript once and serves later live refreshes from its incremental cache", async () => {
    const client = await readyClient();

    await expect(client.readTranscript("thread-1")).resolves.toEqual([
      expect.objectContaining({ id: "item-1", type: "agentMessage" }),
    ]);
    server!.send({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        completedAtMs: 11_000,
        item: { id: "item-2", type: "agentMessage", text: "live update" },
      },
    });
    await vi.waitFor(() => expect(client.transcriptSnapshot().items).toContainEqual(expect.objectContaining({ id: "item-2" })));

    await expect(client.readTranscript("thread-1")).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "item-1" }),
      expect.objectContaining({ id: "item-2", payload: expect.objectContaining({ text: "live update" }) }),
    ]));
    expect(server!.received.filter((message) => message.method === "thread/read")).toHaveLength(1);
    await client.close();
  });

  it("refreshes hydrated history after its freshness window even without live events", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const client = await readyClient();
    await client.readTranscript("thread-1");
    threadHistory = [{ id: "turn-1", startedAt: 10, status: "completed", itemsView: "full", items: [
      { type: "agentMessage", id: "item-1", text: "hello" },
      { type: "agentMessage", id: "item-final", text: "Final answer from another connection" },
    ] }];
    clock.mockReturnValue(now + 5_000);
    await expect(client.readTranscript("thread-1")).resolves.toContainEqual(expect.objectContaining({ id: "item-final", turnStatus: "completed" }));
    expect(server!.received.filter((message) => message.method === "thread/read")).toHaveLength(2);
    await client.close();
  });

  it("retains cached content after a failed refresh and retries the next request", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const fallback = vi.fn()
      .mockResolvedValueOnce({ thread: { id: "thread-1", turns: fullThreadHistory() } })
      .mockRejectedValueOnce(new Error("rollout temporarily unavailable"))
      .mockResolvedValueOnce({ thread: { id: "thread-1", turns: [{ id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "agentMessage", id: "item-final", text: "Recovered ending" }] }] } });
    const client = await readyClient({ threadReadError: "active writer", readLockedThread: fallback });
    await client.readTranscript("thread-1");
    clock.mockReturnValue(now + 5_000);
    await expect(client.readTranscript("thread-1")).rejects.toThrow("active writer");
    expect(client.transcriptSnapshot().items).toContainEqual(expect.objectContaining({ id: "item-1" }));
    await expect(client.readTranscript("thread-1")).resolves.toContainEqual(expect.objectContaining({ id: "item-final" }));
    expect(fallback).toHaveBeenCalledTimes(3);
    await client.close();
  });

  it("shares one canonical read across simultaneous transcript refreshes", async () => {
    const client = await readyClient();
    await Promise.all([client.readTranscript("thread-1"), client.readTranscript("thread-1")]);
    expect(server!.received.filter((message) => message.method === "thread/read")).toHaveLength(1);
    await client.close();
  });

  it("replaces tracked transcripts from full history after reconnect without replaying stale output", async () => {
    threadHistory = [{
      id: "turn-1",
      startedAt: 10,
      itemsView: "full",
      items: [{ type: "commandExecution", id: "command-1", command: "git status", cwd, status: "inProgress", aggregatedOutput: "authoritative", commandActions: [] }],
    }];
    const client = await readyClient();
    await client.readThread("thread-1", { includeTurns: true });
    server!.send({ method: "item/commandExecution/outputDelta", params: { threadId: "thread-1", turnId: "turn-1", itemId: "command-1", delta: " live" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    server!.closeClients();
    await new Promise((resolve) => setTimeout(resolve, 10));

    await client.reconnect();

    expect(server!.received.filter((message) => message.method === "thread/read")).toHaveLength(2);
    const snapshot = (client as unknown as { transcriptSnapshot?: () => { items: Array<{ id: string; payload: Record<string, unknown> }>; recoveryByScope: ReadonlyMap<string, string> } }).transcriptSnapshot?.();
    expect(snapshot?.items.find((item) => item.id === "command-1")?.payload.aggregatedOutput).toBe("authoritative");
    expect(snapshot?.recoveryByScope.get("bot1\u0000thread-1")).toBe("complete");
    await client.close();
  });

  it("loads the authenticated account only after the required v2 initialization lifecycle", async () => {
    const client = await readyClient();

    expect(client.accountInfo).toEqual({ account: { type: "chatgpt", email: "bot1@example.test" }, requiresOpenaiAuth: false });
    expect(server!.received.map((message) => message.method)).toEqual(["initialize", "initialized", "account/read"]);
    await client.close();
  });

  it("refreshes stale credentials when connecting and rechecking sign-in", async () => {
    const client = await readyClient({ requireCredentialRefresh: true });
    expect(client.accountInfo?.account).toMatchObject({ type: "chatgpt" });
    await expect(client.readAccount()).resolves.toMatchObject({ account: { type: "chatgpt" }, requiresOpenaiAuth: false });
    await client.close();
  });

  it("keeps a returned account available when the app server recommends OpenAI authentication", async () => {
    const client = await readyClient({ requiresOpenaiAuth: true });

    expect(client.accountInfo).toEqual({ account: { type: "chatgpt", email: "bot1@example.test" }, requiresOpenaiAuth: true });
    await expect(client.readRateLimitWindows()).resolves.toHaveLength(2);
    await client.close();
  });

  it("retains an unauthenticated transport for login while rejecting all work methods", async () => {
    const rpc = {
      connect: vi.fn(async () => undefined),
      initializeAndReadAccount: vi.fn(async () => ({ account: null, requiresOpenaiAuth: true })),
      request: vi.fn(async (method: string) => {
        if (method === "account/login/start") return { loginId: "login-1", verificationUrl: "https://auth.example.test/device", userCode: "ABCD-EFGH" };
        if (method === "account/login/cancel") return {};
        throw new Error(`Unexpected request: ${method}`);
      }),
      close: vi.fn(async () => undefined),
      isConnected: vi.fn(() => true),
      installApprovalHandler: vi.fn(),
      onDisconnect: vi.fn(),
      onNotification: vi.fn(),
    };
    const router = new ApprovalRouter({
      context: createApprovalContext(account),
      journal: { append: async () => undefined, waitForDecision: async () => ({ kind: "cancel" as const }) },
      filesystem: approvalFilesystem,
    });
    const client = new AppServerClient({ account, rpc: rpc as unknown as JsonRpcClient, approvalRouter: router });

    await expect(client.connect()).resolves.toEqual({ account: null, requiresOpenaiAuth: true });
    await expect(client.startDeviceLogin()).resolves.toMatchObject({ accountId: "bot1/acc1", loginId: "login-1", method: "device_code", userCode: "ABCD-EFGH" });
    await expect(client.startBrowserLogin()).resolves.toMatchObject({ accountId: "bot1/acc1", loginId: "login-1", method: "same_mac_browser" });
    await client.cancelLogin("login-1");
    await expect(client.listModels()).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    await expect(client.startThread()).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(() => client.readRateLimits()).toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(rpc.close).not.toHaveBeenCalled();
    expect(rpc.request).toHaveBeenCalledWith("account/login/start", { type: "chatgptDeviceCode" });
    expect(rpc.request).toHaveBeenCalledWith("account/login/start", { type: "chatgpt" });
    expect(rpc.request).toHaveBeenCalledWith("account/login/cancel", { loginId: "login-1" });
  });

  it("rejects a non-HTTPS verification URL before it reaches the dashboard", async () => {
    const client = await readyClient({ loginVerificationUrl: "javascript:alert(1)" });

    await expect(client.startDeviceLogin()).rejects.toThrow("DEVICE_AUTH_UNAVAILABLE");
    await client.close();
  });

  it("installs the approval router before work and keeps a human-required v2 request within that policy boundary", async () => {
    const client = await readyClient();
    server!.send({
      id: "approval-1",
      method: "item/fileChange/requestApproval",
      params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", startedAtMs: 1_000, reason: "extra root", grantRoot: "/Users/bot2/Dev/EdenMind" },
    });

    await vi.waitFor(() => expect(server!.received).toContainEqual({ id: "approval-1", result: { decision: "cancel" } }));
    expect(approvalJournal?.append).toHaveBeenCalledWith(expect.objectContaining({ pending: expect.objectContaining({ id: "approval-1" }) }));
    await client.close();
  });

  it("closes the transport when the connect lifecycle fails", async () => {
    const rpc = {
      connect: vi.fn(async () => undefined),
      initializeAndReadAccount: vi.fn(async () => { throw new Error("initialize failed"); }),
      close: vi.fn(async () => undefined),
      installApprovalHandler: vi.fn(),
      onDisconnect: vi.fn(),
      onNotification: vi.fn(),
    };
    const router = new ApprovalRouter({
      context: createApprovalContext(account),
      journal: { append: async () => undefined, waitForDecision: async () => ({ kind: "cancel" }) },
      filesystem: approvalFilesystem,
    });
    const client = new AppServerClient({ account, rpc: rpc as unknown as JsonRpcClient, approvalRouter: router });

    await expect(client.connect()).rejects.toThrow("initialize failed");
    expect(rpc.close).toHaveBeenCalledOnce();
  });

  it("uses only stable v2 thread fields and rejects an unsafe echoed policy", async () => {
    const client = await readyClient();
    await expect(client.startThread()).resolves.toEqual(expect.objectContaining({ thread: { id: "thread-1" } }));
    await expect(client.resumeThread("thread-1")).resolves.toEqual(expect.objectContaining({ thread: { id: "thread-1" } }));

    const starts = server!.received.filter((message) => message.method === "thread/start" || message.method === "thread/resume");
    expect(starts).toHaveLength(2);
    for (const start of starts) {
      expect(start.params).toEqual({
        ...(start.method === "thread/resume" ? { threadId: "thread-1" } : {}),
        cwd,
        ...(start.method === "thread/start" ? { threadSource: "user" } : {}),
        approvalPolicy: "untrusted",
        approvalsReviewer: "user",
        sandbox: "workspace-write",
      });
      expect(start.params).not.toHaveProperty("runtimeWorkspaceRoots");
      expect(JSON.stringify(start.params)).not.toContain("danger-full-access");
      expect(JSON.stringify(start.params)).not.toContain('"never"');
    }
    await client.close();

    const unsafe = await readyClient();
    server!.onMessage((message, peer) => {
      if (message.method === "thread/start") peer.send(JSON.stringify({ id: message.id, result: safeThreadEcho({ approvalPolicy: "never" }) }));
    });
    await expect(unsafe.startThread()).rejects.toThrow(/unsafe|approval/i);
    await unsafe.close();
  });

  it("accepts Codex's safe no-network acknowledgement for a workspace-write thread start", async () => {
    const client = await readyClient({ threadStartNetworkAccess: false });

    await expect(client.startThread()).resolves.toEqual(expect.objectContaining({ thread: { id: "thread-1" } }));

    await client.close();
  });

  it("accepts Codex's empty writable-root acknowledgement when it is bound to the requested cwd", async () => {
    const client = await readyClient({ threadStartWritableRoots: [] });

    await expect(client.startThread()).resolves.toEqual(expect.objectContaining({ thread: { id: "thread-1" } }));

    await client.close();
  });

  it("treats Codex's fresh-thread no-rollout title error as non-fatal", async () => {
    const client = await readyClient({ threadNameError: "no rollout found for thread id thread-1" });

    await client.startThread();
    await expect(client.setThreadName("thread-1", "T1 · Worker task")).resolves.toEqual({});

    await client.close();
  });

  it("repeats the exact stable-v2 single-root workspace-write envelope on every turn", async () => {
    const client = await readyClient();
    await client.startTurn({ threadId: "thread-1", clientUserMessageId: "dispatch-1", text: "Proceed with the approved task." });
    const turn = server!.received.find((message) => message.method === "turn/start");

    expect(turn?.params).toEqual({
      threadId: "thread-1",
      clientUserMessageId: "dispatch-1",
      input: [{ type: "text", text: "Proceed with the approved task.", text_elements: [] }],
      cwd,
      approvalPolicy: "untrusted",
      approvalsReviewer: "user",
      sandboxPolicy: { type: "workspaceWrite", writableRoots: [cwd], networkAccess: true, excludeTmpdirEnvVar: true, excludeSlashTmp: true },
    });
    await client.close();
  });

  it("resumes a persisted not-loaded chat before starting its next turn", async () => {
    const client = await readyClient({ threadStatus: "notLoaded" });
    await client.listAllThreads();
    await client.startTurn({ threadId: "thread-1", clientUserMessageId: "resume-before-turn", text: "Continue." });

    expect(server!.received.filter((message) => message.method === "thread/resume")).toHaveLength(1);
    expect(server!.received.filter((message) => message.method === "turn/start")).toHaveLength(1);
    await client.close();
  });

  it("reopens a persisted chat and retries once when turn start reports thread not found", async () => {
    const client = await readyClient({ turnStartErrorOnce: "thread not found: thread-1" });

    await expect(client.startTurn({ threadId: "thread-1", clientUserMessageId: "resume-after-miss", text: "Continue." })).resolves.toEqual({ turn: { id: "turn-1" } });

    expect(server!.received.filter((message) => message.method === "turn/start")).toHaveLength(2);
    expect(server!.received.filter((message) => message.method === "thread/resume")).toHaveLength(1);
    await client.close();
  });

  it("reads a persisted not-loaded transcript without resuming the worker", async () => {
    const client = await readyClient({ threadStatus: "notLoaded" });
    await client.listAllThreads();
    await client.readThread("thread-1", { includeTurns: true });

    const methods = server!.received.map((message) => message.method);
    expect(methods).not.toContain("thread/resume");
    expect(methods.indexOf("thread/read")).toBeGreaterThan(methods.lastIndexOf("thread/list"));
    await client.close();
  });

  it("prefers Codex's canonical transcript for a persisted not-loaded chat", async () => {
    const readLockedThread = vi.fn(async () => ({ thread: { id: "thread-1", turns: [] } }));
    const client = await readyClient({ threadStatus: "notLoaded", readLockedThread });
    await client.listAllThreads();

    await expect(client.readThread("thread-1", { includeTurns: true })).resolves.toEqual({
      thread: { id: "thread-1", turns: fullThreadHistory() },
    });

    expect(server!.received.filter((message) => message.method === "thread/read")).toHaveLength(1);
    expect(readLockedThread).not.toHaveBeenCalled();
    expect(client.transcriptSnapshot().items).toEqual([expect.objectContaining({ id: "item-1", type: "agentMessage" })]);
    await client.close();
  });

  it("reads a desktop-owned local transcript without stealing its active writer", async () => {
    const readLockedThread = vi.fn(async () => ({ thread: { id: "thread-1", turns: fullThreadHistory() } }));
    const client = await readyClient({ account: "claudiothe", workspaceRoot: "/Users/claudiothe/Dev/EdenMind", threadStatus: "notLoaded", threadReadError: "thread thread-1 already has an active writer", readLockedThread });
    await client.listAllThreads();

    await expect(client.readThread("thread-1", { includeTurns: true })).resolves.toEqual(expect.objectContaining({ thread: expect.objectContaining({ turns: expect.any(Array) }) }));
    expect(readLockedThread).toHaveBeenCalledWith("thread-1");
    expect(server!.received.filter((message) => message.method === "thread/read")).toHaveLength(1);
    expect(client.transcriptSnapshot().items).toEqual([expect.objectContaining({ id: "item-1", type: "agentMessage" })]);
    await client.close();
  });

  it("recovers a desktop-owned usage-limit failure from its local transcript", async () => {
    const readLockedThread = vi.fn(async () => ({ thread: { id: "thread-1", turns: [{ id: "turn-limited", startedAt: 10, status: "failed", error: { codex_error_info: "usage_limit_exceeded" }, itemsView: "full", items: [] }] } }));
    const client = await readyClient({ account: "claudiothe", workspaceRoot: "/Users/claudiothe/Dev/EdenMind", threadStatus: "notLoaded", threadReadError: "thread thread-1 already has an active writer", readLockedThread });
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));

    await client.readThread("thread-1", { includeTurns: true });

    expect(events).toContainEqual({ type: "turn", accountId: "claudiothe", threadId: "thread-1", turnId: "turn-limited", state: "limit_exhausted", historical: true });
    await client.close();
  });

  it("falls back to the account rollout when app-server cannot read a persisted bot chat", async () => {
    const readLockedThread = vi.fn(async () => ({ thread: { id: "thread-1", turns: fullThreadHistory() } }));
    const client = await readyClient({ account: "bot2", threadStatus: "notLoaded", threadReadError: "no rollout found for thread id thread-1", readLockedThread });
    await client.listAllThreads();

    await expect(client.readThread("thread-1", { includeTurns: true })).resolves.toEqual(expect.objectContaining({ thread: expect.objectContaining({ turns: expect.any(Array) }) }));
    expect(readLockedThread).toHaveBeenCalledWith("thread-1");
    expect(client.transcriptSnapshot().items).toEqual([expect.objectContaining({ id: "item-1", type: "agentMessage" })]);
    await client.close();
  });

  it("uses the account-provided model settings and only grants full access when explicitly selected", async () => {
    const client = await readyClient();

    await expect(client.listModels()).resolves.toEqual([{
      model: "gpt-5.3-codex", displayName: "GPT-5.3 Codex", supportedEfforts: ["low", "high"], defaultEffort: "high", serviceTiers: [{ id: "standard", name: "Standard" }, { id: "priority", name: "Fast" }], defaultServiceTier: "standard", isDefault: true,
    }]);
    await client.startTurn({
      threadId: "thread-1", clientUserMessageId: "dispatch-full", text: "Proceed.",
      settings: { model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" },
    });

    expect(server!.received.find((message) => message.method === "turn/start")?.params).toEqual({
      threadId: "thread-1",
      clientUserMessageId: "dispatch-full",
      input: [{ type: "text", text: "Proceed.", text_elements: [] }],
      cwd,
      approvalPolicy: "never",
      approvalsReviewer: "user",
      sandboxPolicy: { type: "dangerFullAccess" },
      model: "gpt-5.3-codex",
      effort: "high",
      serviceTier: "priority",
    });

    await client.startTurn({ threadId: "thread-1", clientUserMessageId: "dispatch-ask", text: "Check with me first.", settings: { permissionMode: "ask_me" } });
    expect(server!.received.filter((message) => message.method === "turn/start").at(-1)?.params).toEqual(expect.objectContaining({
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandboxPolicy: { type: "workspaceWrite", writableRoots: [cwd], networkAccess: true, excludeTmpdirEnvVar: true, excludeSlashTmp: true },
    }));
    await client.close();
  });

  it("retains the exact options of the latest turn for usage-limit recovery", async () => {
    const client = await readyClient();
    const settings = { model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" } as const;

    await client.startTurn({ threadId: "thread-1", clientUserMessageId: "turn-settings", text: "Continue.", settings });

    expect(client.turnSettings("thread-1")).toEqual(settings);
    await client.close();
  });

  it("lists local chats across workspaces after the coordinator moves", async () => {
    const client = await readyClient({ account: "claudiothe", workspaceRoot: "/Users/claudiothe/Dev/Swarm" });
    await client.listAllThreads();
    const requests = server!.received.filter((message) => message.method === "thread/list");
    expect(requests).toHaveLength(2);
    for (const request of requests) expect(request.params).not.toHaveProperty("cwd");
    await client.close();
  });

  it("uses the configured coordinator workspace for claudiothe rather than a bot clone", async () => {
    const localWorkspace = "/Users/claudiothe/Dev/EdenMind";
    const client = await readyClient({ account: "claudiothe", workspaceRoot: localWorkspace });
    await client.startThread();
    await client.startTurn({ threadId: "thread-1", clientUserMessageId: "dispatch-local", text: "Proceed." });

    const start = server!.received.find((message) => message.method === "thread/start");
    const turn = server!.received.find((message) => message.method === "turn/start");
    expect(start?.params).toMatchObject({ cwd: localWorkspace, threadSource: "user" });
    expect(turn?.params).toMatchObject({ cwd: localWorkspace, sandboxPolicy: { writableRoots: [localWorkspace] } });
    await client.close();
  });

  it("uses typed app-server methods for pagination, history, controls, rate limits, and file reads", async () => {
    const client = await readyClient();

    await expect(client.listAllThreads()).resolves.toEqual([{ id: "thread-1", name: "First" }, { id: "thread-2", name: "Later" }]);
    await expect(client.readThread("thread-1", { includeTurns: true })).resolves.toEqual(expect.objectContaining({ thread: expect.objectContaining({ turns: expect.any(Array) }) }));
    await client.archiveThread("thread-1");
    await client.setThreadName("thread-1", "Renamed");
    await client.steerTurn({ threadId: "thread-1", turnId: "turn-1", text: "Focus on tests.", clientUserMessageId: "steer-1" });
    await client.interruptTurn("thread-1", "turn-1");
    await expect(client.readRateLimits()).resolves.toEqual(expect.objectContaining({ rateLimitsByLimitId: expect.any(Object) }));
    await expect(client.readFile(`${cwd}/notes.md`)).resolves.toEqual({ dataBase64: "IyBDaGVja2VkCg==" });
    await client.writeFile(`${cwd}/handoff.jsonl`, "{\"turn\":1}\n");

    expect(server!.received.filter((message) => message.method === "thread/list").map((message) => message.params)).toEqual([
      { archived: null, cursor: null, cwd, limit: 100, sortDirection: "desc", sortKey: "updated_at", useStateDbOnly: true },
      { archived: null, cursor: "page-2", cwd, limit: 100, sortDirection: "desc", sortKey: "updated_at", useStateDbOnly: true },
    ]);
    expect(server!.received.find((message) => message.method === "thread/read")?.params).toEqual({ threadId: "thread-1", includeTurns: true });
    expect(server!.received.find((message) => message.method === "turn/steer")?.params).toEqual({ threadId: "thread-1", expectedTurnId: "turn-1", clientUserMessageId: "steer-1", input: [{ type: "text", text: "Focus on tests.", text_elements: [] }] });
    expect(server!.received.find((message) => message.method === "fs/writeFile")?.params).toEqual({ path: `${cwd}/handoff.jsonl`, dataBase64: "eyJ0dXJuIjoxfQo=" });
    await client.close();
  });

  it("normalizes only the v2 Codex bucket without converting Unix reset seconds", async () => {
    const client = await readyClient();

    await expect(client.readRateLimitWindows(1_000)).resolves.toEqual([
      { id: "codex:primary", label: "Codex primary", usedPercent: 20, resetsAt: 1_800, updatedAt: 1_000 },
      { id: "codex:secondary", label: "Codex secondary", usedPercent: 73, resetsAt: null, updatedAt: 1_000 },
    ]);
    await client.close();
  });

  it("keeps only the authoritative Codex bucket when reserve buckets sort first", async () => {
    const client = await readyClient({ rateLimitResponse: {
      rateLimits: { limitId: "codex", limitName: "Codex", primary: { usedPercent: 100, resetsAt: 1_800 }, secondary: { usedPercent: 47, resetsAt: 9_000 } },
      rateLimitsByLimitId: {
        base_model_inference: { limitId: "base_model_inference", limitName: "GPT Reserve", primary: { usedPercent: 0, resetsAt: 7_200 }, secondary: null },
        luna_reserve: { limitId: "luna_reserve", limitName: "Luna Reserve", primary: { usedPercent: 0, resetsAt: 7_200 }, secondary: null },
        codex: { limitId: "codex", limitName: "Codex", primary: { usedPercent: 100, resetsAt: 1_800 }, secondary: { usedPercent: 47, resetsAt: 9_000 } },
      },
    } });

    await expect(client.readRateLimitWindows(1_000)).resolves.toEqual([
      { id: "codex:primary", label: "Codex primary", usedPercent: 100, resetsAt: 1_800, updatedAt: 1_000 },
      { id: "codex:secondary", label: "Codex secondary", usedPercent: 47, resetsAt: 9_000, updatedAt: 1_000 },
    ]);
    await client.close();
  });

  it("emits normalized account/thread activity without exposing transcript content in the event", async () => {
    const client = await readyClient();
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));

    server!.send({ method: "turn/started", params: { threadId: "thread-1", turnId: "turn-1", text: "secret transcript" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events).toContainEqual({ type: "turn", accountId: account, threadId: "thread-1", turnId: "turn-1", state: "started" });
    expect(JSON.stringify(events)).not.toContain("secret transcript");
    await client.close();
  });

  it("recovers active-turn state from a thread read when the browser opens after the turn started", async () => {
    threadHistory = [{
      id: "turn-live",
      status: "inProgress",
      startedAt: 10,
      itemsView: "full",
      items: [{ type: "reasoning", id: "reason-1", summary: ["Working"] }],
    }];
    const client = await readyClient();
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));

    await client.readThread("thread-1", { includeTurns: true });

    expect(events).toContainEqual({ type: "turn", accountId: account, threadId: "thread-1", turnId: "turn-live", state: "started", historical: true });
    await client.close();
  });

  it("marks a completed turn recovered from thread history as historical", async () => {
    threadHistory = [{ id: "turn-old", status: "completed", startedAt: 10, items: [] }];
    const client = await readyClient();
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));

    await client.readThread("thread-1", { includeTurns: true });

    expect(events).toContainEqual({ type: "turn", accountId: account, threadId: "thread-1", turnId: "turn-old", state: "completed", historical: true });
    await client.close();
  });

  it("uses the nested v2 turn record for activity and marks an exhausted session", async () => {
    const client = await readyClient();
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));

    server!.send({ method: "turn/started", params: { threadId: "thread-1", turn: { id: "turn-live" } } });
    server!.send({ method: "turn/completed", params: { threadId: "thread-1", turn: { id: "turn-live", error: { codexErrorInfo: "sessionBudgetExceeded" } } } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events).toContainEqual({ type: "turn", accountId: account, threadId: "thread-1", turnId: "turn-live", state: "started" });
    expect(events).toContainEqual({ type: "turn", accountId: account, threadId: "thread-1", turnId: "turn-live", state: "limit_exhausted" });
    await client.close();
  });

  it("marks usage exhaustion even when app-server reports the stopped turn as failed", async () => {
    threadHistory = [{ id: "turn-limited", status: "failed", error: { message: "You've hit your usage limit" } }];
    const client = await readyClient();
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));

    await client.readThread("thread-1", { includeTurns: true });
    server!.send({ method: "turn/failed", params: { threadId: "thread-1", turn: { id: "turn-limited", error: { codexErrorInfo: "usageLimitExceeded" } } } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events.filter((event) => (event as { turnId?: string }).turnId === "turn-limited")).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: "limit_exhausted" }),
    ]));
    await client.close();
  });

  it("emits a transcript revision for a tracked chat without sending its contents to the browser event", async () => {
    const client = await readyClient();
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));
    await client.readThread("thread-1", { includeTurns: true });

    server!.send({ method: "item/reasoning/summaryTextDelta", params: { threadId: "thread-1", turnId: "turn-1", itemId: "reason-1", delta: "secret summary" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(events).toContainEqual(expect.objectContaining({ type: "transcript", accountId: account, threadId: "thread-1", state: "updated" }));
    expect(JSON.stringify(events)).not.toContain("secret summary");
    await client.close();
  });
});
