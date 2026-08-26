import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeAppServer, type FakeAppServer } from "../../test/fakeAppServer.js";
import { createApprovalContext, type ApprovalFilesystem } from "../safety/approvalPolicy.js";
import { ApprovalRouter } from "./approvalRouter.js";
import { AppServerClient } from "./appServerClient.js";
import { JsonRpcClient } from "./jsonRpcClient.js";

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

async function readyClient() {
  server = createFakeAppServer(tokenDigest);
  await server.start();
  server.onMessage((message, peer) => {
    const reply = (result: unknown) => peer.send(JSON.stringify({ id: message.id, result }));
    if (message.method === "initialize") reply({ codexHome: "/Users/bot1/.codex" });
    if (message.method === "account/read") reply({ account: { type: "chatgpt", email: "bot1@example.test" }, requiresOpenaiAuth: false });
    if (message.method === "thread/start" || message.method === "thread/resume") reply(safeThreadEcho());
    if (message.method === "turn/start") reply({ turn: { id: "turn-1" } });
    if (message.method === "thread/list") {
      const cursor = (message.params as { cursor?: string }).cursor;
      reply(cursor ? { data: [{ id: "thread-2", name: "Later" }], nextCursor: null } : { data: [{ id: "thread-1", name: "First" }], nextCursor: "page-2" });
    }
    if (message.method === "thread/read") reply({ thread: { id: "thread-1", turns: threadHistory } });
    if (message.method === "account/rateLimits/read") reply({
      rateLimits: { limitId: "codex", primary: { usedPercent: 20, resetsAt: 1_800 }, secondary: { usedPercent: 73, resetsAt: null } },
      rateLimitsByLimitId: {
        codex: { limitId: "codex", limitName: "Codex", primary: { usedPercent: 20, resetsAt: 1_800 }, secondary: { usedPercent: 73, resetsAt: null } },
        weekly: { limitId: "weekly", limitName: "Weekly", primary: { usedPercent: 7, resetsAt: 9_000 }, secondary: null },
      },
    });
    if (message.method === "fs/readFile") reply({ dataBase64: Buffer.from("# Checked\n", "utf8").toString("base64") });
    if (["thread/archive", "thread/name/set", "turn/steer", "turn/interrupt"].includes(message.method ?? "")) reply({});
  });
  const rpc = new JsonRpcClient({ launch: { endpoint: server.url, capabilityToken: token }, requestTimeoutMs: 100 });
  approvalJournal = { append: vi.fn(async () => undefined), waitForDecision: vi.fn(async () => ({ kind: "cancel" })) };
  const approvalRouter = new ApprovalRouter({
    context: createApprovalContext(account),
    journal: approvalJournal,
    filesystem: approvalFilesystem,
    requestTimeoutMs: 25,
  });
  const client = new AppServerClient({ account, rpc, approvalRouter });
  await client.connect();
  return client;
}

describe("AppServerClient", () => {
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

  it("installs the approval router before work and keeps a human-required v2 request within that policy boundary", async () => {
    const client = await readyClient();
    server!.send({
      id: "approval-1",
      method: "item/fileChange/requestApproval",
      params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", startedAtMs: 1_000, reason: "extra root", grantRoot: "/Users/bot2/Dev/EdenMind" },
    });
    await new Promise((resolve) => setTimeout(resolve, 15));

    expect(server!.received).toContainEqual({ id: "approval-1", result: { decision: "cancel" } });
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

  it("repeats the exact stable-v2 single-root workspace-write envelope on every turn", async () => {
    const client = await readyClient();
    await client.startTurn({ threadId: "thread-1", clientUserMessageId: "dispatch-1", text: "Proceed with the approved task." });
    const turn = server!.received.find((message) => message.method === "turn/start");

    expect(turn?.params).toEqual({
      threadId: "thread-1",
      clientUserMessageId: "dispatch-1",
      input: [{ type: "text", text: "Proceed with the approved task." }],
      cwd,
      approvalPolicy: "untrusted",
      approvalsReviewer: "user",
      sandboxPolicy: { type: "workspaceWrite", writableRoots: [cwd], networkAccess: true, excludeTmpdirEnvVar: true, excludeSlashTmp: true },
    });
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

    expect(server!.received.filter((message) => message.method === "thread/list").map((message) => message.params)).toEqual([{ archived: null, cursor: null }, { archived: null, cursor: "page-2" }]);
    expect(server!.received.find((message) => message.method === "thread/read")?.params).toEqual({ threadId: "thread-1", includeTurns: true });
    expect(server!.received.find((message) => message.method === "turn/steer")?.params).toEqual({ threadId: "thread-1", expectedTurnId: "turn-1", clientUserMessageId: "steer-1", input: [{ type: "text", text: "Focus on tests." }] });
    await client.close();
  });

  it("normalizes every v2 rate-limit bucket without converting Unix reset seconds", async () => {
    const client = await readyClient();

    await expect(client.readRateLimitWindows(1_000)).resolves.toEqual([
      { id: "codex:primary", label: "Codex primary", usedPercent: 20, resetsAt: 1_800, updatedAt: 1_000 },
      { id: "codex:secondary", label: "Codex secondary", usedPercent: 73, resetsAt: null, updatedAt: 1_000 },
      { id: "weekly:primary", label: "Weekly primary", usedPercent: 7, resetsAt: 9_000, updatedAt: 1_000 },
    ]);
    await client.close();
  });
});
