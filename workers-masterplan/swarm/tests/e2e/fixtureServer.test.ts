import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";

import { startE2eFixtureServer, type E2eFixtureServer } from "./fixtureServer.js";

let fixture: E2eFixtureServer | undefined;

afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

function rejectedHandshake(endpoint: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    socket.once("unexpected-response", (_request, response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    socket.once("open", () => reject(new Error("Missing fixture capability token unexpectedly connected")));
    socket.once("error", reject);
  });
}

function call(socket: WebSocket, id: number, method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${method}`)), 2_000);
    socket.once("message", (raw) => {
      clearTimeout(timeout);
      const response = JSON.parse(String(raw)) as { id: number; result?: unknown; error?: { message: string } };
      if (response.id !== id) return reject(new Error(`Unexpected response ID for ${method}`));
      if (response.error) return reject(new Error(response.error.message));
      resolve(response.result);
    });
    socket.send(JSON.stringify({ id, method, ...(params === undefined ? {} : { params }) }));
  });
}

describe("E2E fixture app servers", () => {
  it("runs deterministic fake app-server endpoints for all nine accounts and rejects missing tokens", async () => {
    fixture = await startE2eFixtureServer({ manifest: "ready" });

    expect(Object.keys(fixture.accounts)).toEqual(["claudiothe", "bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"]);
    await expect(rejectedHandshake(fixture.accounts.bot3.endpoint)).resolves.toBe(401);

    const account = fixture.accounts.bot3;
    const socket = new WebSocket(account.endpoint, { headers: { Authorization: `Bearer ${account.capabilityToken}` } });
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    try {
      await expect(call(socket, 1, "initialize", { clientInfo: { name: "fixture-test", version: "1" }, capabilities: null })).resolves.toEqual({});
      socket.send(JSON.stringify({ method: "initialized" }));
      await expect(call(socket, 2, "account/read", {})).resolves.toMatchObject({ requiresOpenaiAuth: false, account: { id: "bot3" } });
      await expect(call(socket, 3, "account/rateLimits/read")).resolves.toHaveProperty("rateLimitsByLimitId");
      await expect(call(socket, 4, "thread/list", { archived: null, cursor: null })).resolves.toMatchObject({ data: [{ id: "thread-1" }], nextCursor: "1" });
      await expect(call(socket, 5, "thread/list", { archived: null, cursor: "1" })).resolves.toMatchObject({ data: [{ id: "thread-2" }], nextCursor: null });
    } finally {
      await new Promise<void>((resolve) => {
        socket.once("close", resolve);
        socket.close();
      });
    }
  });
});
