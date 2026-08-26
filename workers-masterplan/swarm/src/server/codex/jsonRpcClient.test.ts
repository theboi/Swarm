import { afterEach, describe, expect, it } from "vitest";
import { createFakeAppServer, type FakeAppServer } from "../../test/fakeAppServer.js";
import { JsonRpcClient } from "./jsonRpcClient.js";

const token = "capability-token-used-only-on-the-loopback-handshake";
let server: FakeAppServer | undefined;

afterEach(async () => {
  await server?.stop();
  server = undefined;
});

async function connectedClient() {
  server = createFakeAppServer(token);
  await server.start();
  const client = new JsonRpcClient({ url: server.url, capabilityToken: token, requestTimeoutMs: 100 });
  await client.connect();
  return client;
}

describe("JsonRpcClient", () => {
  it("correlates unique request ids and delivers notifications", async () => {
    const client = await connectedClient();
    server!.onMessage((message, peer) => {
      if (message.method === "first") peer.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { value: 1 } }));
      if (message.method === "second") peer.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { value: 2 } }));
    });
    const notifications: string[] = [];
    client.onNotification((event) => notifications.push(event.method));

    await expect(Promise.all([client.request("first", {}), client.request("second", {})])).resolves.toEqual([{ value: 1 }, { value: 2 }]);
    server!.send({ jsonrpc: "2.0", method: "thread/started", params: { thread: { id: "t1" } } });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(server!.received.map((message) => message.id)).toEqual([1, 2]);
    expect(notifications).toEqual(["thread/started"]);
    await client.close();
  });

  it("completes initialize then initialized then account/read before reporting ready", async () => {
    const client = await connectedClient();
    const order: string[] = [];
    server!.onMessage((message, peer) => {
      if (message.method) order.push(message.method);
      if (message.method === "initialize") peer.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { codexHome: "/Users/bot1/.codex" } }));
      if (message.method === "account/read") peer.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { account: { type: "chatgpt" }, requiresOpenaiAuth: false } }));
    });

    await expect(client.initializeAndReadAccount()).resolves.toEqual({ account: { type: "chatgpt" }, requiresOpenaiAuth: false });
    expect(order).toEqual(["initialize", "initialized", "account/read"]);
    await client.close();
  });

  it("uses a method-specific server-request response and safely refuses unknown requests", async () => {
    const client = await connectedClient();
    client.onServerRequest(async (request) => request.method === "item/commandExecution/requestApproval"
      ? { decision: "decline" }
      : undefined);

    server!.send({ jsonrpc: "2.0", id: "command-1", method: "item/commandExecution/requestApproval", params: { availableDecisions: ["accept", "decline"] } });
    server!.send({ jsonrpc: "2.0", id: "unknown-1", method: "unknown/request", params: {} });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(server!.received).toContainEqual({ jsonrpc: "2.0", id: "command-1", result: { decision: "decline" } });
    expect(server!.received).toContainEqual(expect.objectContaining({ jsonrpc: "2.0", id: "unknown-1", error: expect.objectContaining({ code: -32601 }) }));
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
    server = createFakeAppServer(token);
    await server.start();
    const missing = new JsonRpcClient({ url: server.url, capabilityToken: "", requestTimeoutMs: 100 });
    const wrong = new JsonRpcClient({ url: server.url, capabilityToken: "not-the-token", requestTimeoutMs: 100 });

    await expect(missing.connect()).rejects.toThrow(/401|unauthorized/i);
    await expect(wrong.connect()).rejects.toThrow(/401|unauthorized/i);
  });
});
