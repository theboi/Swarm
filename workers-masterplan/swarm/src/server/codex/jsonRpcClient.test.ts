import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";
import { createFakeAppServer, type FakeAppServer } from "../../test/fakeAppServer.js";
import { JsonRpcClient } from "./jsonRpcClient.js";

const token = "capability-token-used-only-on-the-loopback-handshake";
const tokenDigest = createHash("sha256").update(token).digest("hex");
let server: FakeAppServer | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function connectedClient() {
  server = createFakeAppServer(tokenDigest);
  await server.start();
  const client = new JsonRpcClient({ launch: { endpoint: server.url, capabilityToken: token }, requestTimeoutMs: 100 });
  await client.connect();
  return client;
}

describe("JsonRpcClient", () => {
  it("correlates unique request ids and delivers notifications", async () => {
    const client = await connectedClient();
    server!.onMessage((message, peer) => {
      if (message.method === "first") peer.send(JSON.stringify({ id: message.id, result: { value: 1 } }));
      if (message.method === "second") peer.send(JSON.stringify({ id: message.id, result: { value: 2 } }));
    });
    const notifications: string[] = [];
    client.onNotification((event) => notifications.push(event.method));

    await expect(Promise.all([client.request("first", {}), client.request("second", {})])).resolves.toEqual([{ value: 1 }, { value: 2 }]);
    server!.send({ method: "thread/started", params: { thread: { id: "t1" } } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(server!.received.map((message) => message.id)).toEqual([1, 2]);
    expect(server!.received.every((message) => !Object.prototype.hasOwnProperty.call(message, "jsonrpc"))).toBe(true);
    expect(notifications).toEqual(["thread/started"]);
    await client.close();
  });

  it("completes initialize then initialized then account/read before reporting ready", async () => {
    const client = await connectedClient();
    const order: string[] = [];
    server!.onMessage((message, peer) => {
      if (message.method) order.push(message.method);
      if (message.method === "initialize") peer.send(JSON.stringify({ id: message.id, result: { codexHome: "/Users/bot1/.codex" } }));
      if (message.method === "account/read") peer.send(JSON.stringify({ id: message.id, result: { account: { type: "chatgpt" }, requiresOpenaiAuth: false } }));
    });

    await expect(client.initializeAndReadAccount()).resolves.toEqual({ account: { type: "chatgpt" }, requiresOpenaiAuth: false });
    expect(order).toEqual(["initialize", "initialized", "account/read"]);
    await client.close();
  });

  it("uses a method-compatible fallback for approvals and safely refuses unknown requests", async () => {
    const client = await connectedClient();

    server!.send({ id: "command-1", method: "item/commandExecution/requestApproval", params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", startedAtMs: 1_000, environmentId: null, command: "git status", cwd: "/Users/bot1/Dev/EdenMind" } });
    server!.send({ id: "unknown-1", method: "unknown/request", params: {} });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(server!.received).toContainEqual({ id: "command-1", result: { decision: "cancel" } });
    expect(server!.received).toContainEqual(expect.objectContaining({ id: "unknown-1", error: expect.objectContaining({ code: -32601 }) }));
    await client.close();
  });

  it("rejects pending calls when the connection disconnects", async () => {
    const client = await connectedClient();
    server!.onMessage((message) => { if (message.method === "disconnect-me") server!.closeClients(); });

    await expect(client.request("disconnect-me", {})).rejects.toThrow(/disconnected/i);
    await client.close();
  });

  it("rejects a request that the app-server does not answer before its deadline", async () => {
    const client = await connectedClient();

    await expect(client.request("never-responds", {})).rejects.toThrow(/timed out/i);
    await client.close();
  });

  it("fails the connection when the capability token is missing or incorrect", async () => {
    server = createFakeAppServer(tokenDigest);
    await server.start();
    const missing = new JsonRpcClient({ launch: { endpoint: server.url, capabilityToken: "" }, requestTimeoutMs: 100 });
    const wrong = new JsonRpcClient({ launch: { endpoint: server.url, capabilityToken: "not-the-token" }, requestTimeoutMs: 100 });

    await expect(missing.connect()).rejects.toThrow(/401|unauthorized/i);
    await expect(wrong.connect()).rejects.toThrow(/401|unauthorized/i);
  });

  it("refuses a non-loopback endpoint before the plaintext token reaches a socket factory", async () => {
    const factory = vi.fn();
    const client = new JsonRpcClient({
      launch: { endpoint: "ws://app-server.example.test:45123", capabilityToken: token },
      webSocketFactory: factory as never,
    });

    await expect(client.connect()).rejects.toThrow(/loopback/i);
    expect(factory).not.toHaveBeenCalled();
  });

  it("takes its endpoint and capability token from a launch handle rather than arbitrary connection options", async () => {
    server = createFakeAppServer(tokenDigest);
    await server.start();
    const client = new JsonRpcClient({
      launch: { endpoint: server.url, capabilityToken: token },
      requestTimeoutMs: 100,
    });

    await expect(client.connect()).resolves.toBeUndefined();
    await client.close();
  });

  it("handles JSON primitives safely and redacts unknown notification payloads", async () => {
    const client = await connectedClient();
    const notifications: Array<{ method: string; params?: unknown }> = [];
    client.onNotification((event) => notifications.push(event));

    server!.send(null as never);
    server!.send({ method: "future/secret", params: { token: "never-expose-this" } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(notifications).toContainEqual(expect.objectContaining({ method: "protocol/unknownNotification", params: expect.objectContaining({ method: "future/secret" }) }));
    expect(JSON.stringify(notifications)).not.toContain("never-expose-this");
    expect(client.getDiagnostics()).toContainEqual(expect.objectContaining({ method: "protocol/unknownMessage" }));
    await client.close();
  });

  it("delivers every generated-v2 notification family rather than classifying a known method as unknown", async () => {
    const client = await connectedClient();
    const notifications: string[] = [];
    client.onNotification((event) => notifications.push(event.method));

    server!.send({ method: "account/login/completed", params: { account: { type: "chatgpt" } } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(notifications).toEqual(["account/login/completed"]);
    await client.close();
  });

  it.each([
    ["throws", async () => { throw new Error("journal unavailable"); }],
    ["times out", async () => new Promise<never>(() => undefined)],
  ])("does not leave an approval request pending when its policy handler %s", async (_case, handle) => {
    const client = await connectedClient();
    client.installApprovalHandler({ handle });

    server!.send({ id: `approval-${_case}`, method: "item/fileChange/requestApproval", params: { threadId: "thread-1", turnId: "turn-1", itemId: "item-1", startedAtMs: 1_000, reason: null, grantRoot: null } });
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(server!.received).toContainEqual({ id: `approval-${_case}`, result: { decision: "cancel" } });
    expect(client.getDiagnostics()).toContainEqual(expect.objectContaining({ method: "protocol/serverRequestFailed" }));
    await client.close();
  });

  it("does not let primitive, array, ambiguous, result-less, or malformed-error frames settle a pending request", async () => {
    const client = await connectedClient();
    server!.onMessage((message, peer) => {
      if (message.method !== "await-valid-response") return;
      peer.send(JSON.stringify(null));
      peer.send(JSON.stringify([]));
      peer.send(JSON.stringify({ id: message.id, method: "ambiguous", result: {} }));
      peer.send(JSON.stringify({ id: message.id }));
      peer.send(JSON.stringify({ id: message.id, error: { code: "bad", message: 42 } }));
      setTimeout(() => peer.send(JSON.stringify({ id: message.id, result: { settled: true } })), 5);
    });

    await expect(client.request("await-valid-response", {})).resolves.toEqual({ settled: true });
    expect(client.getDiagnostics().filter((event) => event.method === "protocol/unknownMessage")).toHaveLength(5);
    await client.close();
  });

  it("proves the local fixture returns 401 for missing or wrong bearer tokens and 101 only for the digest match", async () => {
    server = createFakeAppServer(tokenDigest);
    await server.start();
    const upgradeStatus = (authorization?: string) => new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(server!.url, authorization ? { headers: { Authorization: authorization } } : undefined);
      socket.once("open", () => { socket.close(); resolve(101); });
      socket.once("unexpected-response", (_request, response) => {
        const status = response.statusCode ?? 0;
        response.resume();
        resolve(status);
      });
      socket.once("error", (error) => {
        if ((error as Error & { message?: string }).message?.includes("Unexpected server response")) return;
        reject(error);
      });
    });

    await expect(upgradeStatus()).resolves.toBe(401);
    await expect(upgradeStatus("Bearer wrong-token")).resolves.toBe(401);
    await expect(upgradeStatus(`Bearer ${token}`)).resolves.toBe(101);
  });
});
