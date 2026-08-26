import { createServer } from "node:http";
import { once } from "node:events";
import WebSocket from "ws";
import { afterEach, describe, expect, it } from "vitest";

import type { CoordinatorSnapshot } from "../../shared/contracts.js";
import { SessionStore } from "../auth/sessionStore.js";
import { BrowserHub } from "./browserHub.js";

const snapshot: CoordinatorSnapshot = { generatedAt: 1, activeTurnLimit: 3, accounts: [], tasks: [], dispatches: [], threads: [], pendingApprovals: [], ngrok: { state: "stopped", publicUrl: null, message: null, nextBoundaryAt: null }, health: { server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: "ok" }, outbox: { state: "ok" }, scheduler: { state: "ok" }, ngrok: { state: "ok" }, accounts: { state: "ok" } } };
let close: (() => Promise<void>) | undefined;

afterEach(async () => { await close?.(); close = undefined; });

describe("BrowserHub", () => {
  it("authenticates upgrades, sends a snapshot first, and resyncs after a client gap", async () => {
    const http = createServer();
    const sessions = new SessionStore("session-secret");
    const token = await sessions.createSession("claudio@example.test");
    const hub = new BrowserHub({ server: http, sessions, allowedOrigins: () => new Set(["http://127.0.0.1:4310"]), snapshot: async () => snapshot });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    if (!address || typeof address === "string") throw new Error("missing listener");
    close = async () => { await hub.close(); await new Promise<void>((resolve) => http.close(() => resolve())); };

    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, { headers: { origin: "http://127.0.0.1:4310", cookie: `swarm_session=${encodeURIComponent(token)}` } });
    const received: Array<Record<string, unknown>> = [];
    socket.on("message", (data) => received.push(JSON.parse(data.toString()) as Record<string, unknown>));
    await once(socket, "open");
    await new Promise((resolve) => setTimeout(resolve, 10));
    hub.publish("rate_limit", { accountId: "bot1" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    socket.send(JSON.stringify({ type: "resync" }));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(received[0]).toMatchObject({ type: "snapshot", sequence: 0, payload: snapshot });
    expect(received[1]).toMatchObject({ type: "rate_limit", sequence: 1, payload: { accountId: "bot1" } });
    expect(received[2]).toMatchObject({ type: "snapshot", sequence: 1, payload: snapshot });
    socket.close();
  });
});
