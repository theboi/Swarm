import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createPasswordHash } from "../auth/password.js";
import { LoginThrottle, SessionStore } from "../auth/sessionStore.js";
import { createTotpVerifier, totpAt } from "../auth/totp.js";
import type { CoordinatorSnapshot, HealthSnapshot } from "../../shared/contracts.js";
import { createApiRouter, type CoordinatorRouteServices } from "./routes.js";

const health: HealthSnapshot = {
  server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: "ok" }, outbox: { state: "ok" }, scheduler: { state: "ok" }, ngrok: { state: "ok" }, accounts: { state: "ok" },
};
const snapshot: CoordinatorSnapshot = { generatedAt: 1, activeTurnLimit: 3, accounts: [], tasks: [], dispatches: [], threads: [], pendingApprovals: [], ngrok: { state: "stopped", publicUrl: null, message: null, nextBoundaryAt: null }, health };

async function fixture() {
  const passwordHash = await createPasswordHash("correct password", "route-test-salt");
  const sessionStore = new SessionStore("session-secret");
  const services: CoordinatorRouteServices = {
    config: { loginEmail: "claudio@example.test", loginPasswordHash: passwordHash, trustManagedProxy: false, host: "127.0.0.1", port: 4310 },
    sessions: sessionStore,
    throttle: new LoginThrottle(),
    verifyTotp: createTotpVerifier("JBSWY3DPEHPK3PXP"),
    snapshot: async () => snapshot,
    health: async () => health,
    connectAccount: vi.fn(async () => ({ id: "bot1" })),
    disconnectAccount: vi.fn(async () => undefined),
    refreshRateLimits: vi.fn(async () => []),
    previewLaunch: vi.fn(async () => ({ task: { id: "T1" }, accountId: "bot1", prompt: "prompt", dependencies: [], concurrencyImpact: "1 / 3" })),
    launch: vi.fn(async () => ({ id: "dispatch-1" })),
    listThreads: vi.fn(async () => []),
    readTranscript: vi.fn(async () => []),
    startThread: vi.fn(async () => ({ id: "thread-1", accountId: "bot1", name: null, archived: false, updatedAt: 1, capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false } })),
    archiveThread: vi.fn(async () => undefined),
    startTurn: vi.fn(async () => ({ turnId: "turn-1" })),
    steerTurn: vi.fn(async () => undefined),
    interruptTurn: vi.fn(async () => undefined),
    readMarkdown: vi.fn(async () => ({ filename: "notes.md", content: "# Notes" })),
    decideApproval: vi.fn(async () => undefined),
    ngrokSnapshot: async () => snapshot.ngrok,
    stopNgrokEarly: vi.fn(async () => undefined),
    allowedOrigins: () => new Set(["http://127.0.0.1:4310", "http://localhost:4310"]),
  };
  const app = express();
  app.use("/api/v1", createApiRouter(services));
  return { app, services };
}

describe("coordinator HTTP routes", () => {
  it("uses a generic two-step login and a strict session cookie", async () => {
    const { app } = await fixture();
    const agent = request.agent(app);

    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", "http://127.0.0.1:4310").send({ email: "claudio@example.test", password: "correct password" }).expect(200);
    expect(challenge.body).toEqual({ data: { challengeId: expect.any(String) } });
    const complete = await agent.post("/api/v1/auth/complete").set("origin", "http://127.0.0.1:4310").send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) }).expect(200);

    expect(complete.body).toEqual({ data: { authenticated: true } });
    expect(complete.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(complete.headers["set-cookie"][0]).toContain("SameSite=Strict");
    await agent.get("/api/v1/snapshot").expect(200, { data: snapshot });
  });

  it("rejects unauthenticated reads and wrong-origin mutations using an error envelope", async () => {
    const { app } = await fixture();
    await request(app).get("/api/v1/snapshot").expect(401, { error: { code: "AUTH_INVALID", message: "Authentication required" } });
    const result = await request(app).post("/api/v1/auth/challenge").set("origin", "https://attacker.example").send({ email: "claudio@example.test", password: "correct password" }).expect(403);
    expect(result.body.error).toMatchObject({ code: "AUTH_INVALID" });
  });

  it("keeps health in the shared shape without operational secrets", async () => {
    const { app } = await fixture();
    const agent = request.agent(app);
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", "http://127.0.0.1:4310").send({ email: "claudio@example.test", password: "correct password" });
    await agent.post("/api/v1/auth/complete").set("origin", "http://127.0.0.1:4310").send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) });
    const result = await agent.get("/api/v1/health").expect(200);
    expect(result.body).toEqual({ data: health });
    expect(JSON.stringify(result.body)).not.toMatch(/secret|password|token|transcript/i);
  });
});
