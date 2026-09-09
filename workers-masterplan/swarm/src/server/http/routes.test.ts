import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createPasswordHash } from "../auth/password.js";
import { LoginThrottle, SessionStore } from "../auth/sessionStore.js";
import { createTotpVerifier, totpAt } from "../auth/totp.js";
import type { CoordinatorSnapshot, HealthSnapshot } from "../../shared/contracts.js";
import { createApiRouter, type CoordinatorRouteServices } from "./routes.js";

const health: HealthSnapshot = {
  server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: "ok" }, outbox: { state: "ok" }, scheduler: { state: "ok" }, accounts: { state: "ok" },
};
const snapshot: CoordinatorSnapshot = { generatedAt: 1, autoPilot: { enabled: false }, accounts: [], tasks: [], dispatches: [], threads: [], pendingApprovals: [], health };

async function fixture() {
  const passwordHash = await createPasswordHash("correct password", "route-test-salt");
  const sessionStore = new SessionStore("session-secret");
  const openTerminal = vi.fn(async () => undefined);
  const origins = new Set(["http://127.0.0.1:4310", "http://localhost:4310"]);
  const services: CoordinatorRouteServices = {
    config: { loginEmail: "claudio@example.test", loginPasswordHash: passwordHash, trustManagedProxy: false, host: "127.0.0.1", port: 4310, terminalPort: 4311 },
    sessions: sessionStore,
    throttle: new LoginThrottle(),
    verifyTotp: createTotpVerifier("JBSWY3DPEHPK3PXP"),
    snapshot: async () => snapshot,
    health: async () => health,
    setAutoPilot: vi.fn(async (enabled: boolean) => ({ enabled })),
    connectAccount: vi.fn(async () => ({ id: "bot1" })),
    disconnectAccount: vi.fn(async () => undefined),
    openTerminal,
    refreshRateLimits: vi.fn(async () => []),
    refreshAllRateLimits: vi.fn(async () => []),
    listModels: vi.fn(async () => []),
    previewLaunch: vi.fn(async () => ({ task: { id: "T1" }, accountId: "bot1", prompt: "prompt", dependencies: [], concurrencyImpact: "1 / 3" })),
    launch: vi.fn(async () => ({ id: "dispatch-1" })),
    listThreads: vi.fn(async () => []),
    readTranscript: vi.fn(async () => []),
    startThread: vi.fn(async () => ({ id: "thread-1", accountId: "bot1", name: null, archived: false, updatedAt: 1, capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false } })),
    renameThread: vi.fn(async () => undefined),
    moveThreadToAccount: vi.fn(async () => ({ id: "thread-2", accountId: "bot2", name: null, archived: false, updatedAt: 1, capabilities: { canArchive: false, canInterrupt: true, canStartTurn: false, canSteer: true } })),
    archiveThread: vi.fn(async () => undefined),
    startTurn: vi.fn(async () => ({ turnId: "turn-1" })),
    steerTurn: vi.fn(async () => undefined),
    interruptTurn: vi.fn(async () => undefined),
    readMarkdown: vi.fn(async () => ({ filename: "notes.md", content: "# Notes" })),
    decideApproval: vi.fn(async () => undefined),
    allowedOrigins: () => origins,
  };
  const app = express();
  app.use("/api/v1", createApiRouter(services));
  return { app, services, openTerminal, origins };
}

describe("coordinator HTTP routes", () => {
  it("never accepts autonomous dispatch provenance from the browser", async () => {
    const { app, services } = await fixture();
    const session = await services.sessions.createSession("claudio@example.test");
    await request(app).post("/api/v1/tasks/T0/launch")
      .set("origin", "http://127.0.0.1:4310").set("Cookie", `swarm_session=${session}`)
      .send({ accountId: "bot1", origin: "auto_pilot" }).expect(200);
    expect(services.launch).toHaveBeenCalledWith("T0", { accountId: "bot1", prompt: undefined });
  });
  it("uses a generic two-step login and a strict session cookie", async () => {
    const { app } = await fixture();
    const agent = request.agent(app);

    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", "http://127.0.0.1:4310").send({ email: "claudio@example.test", password: "correct password" }).expect(200);
    expect(challenge.body).toEqual({ data: { challengeId: expect.any(String) } });
    const complete = await agent.post("/api/v1/auth/complete").set("origin", "http://127.0.0.1:4310").send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) }).expect(200);

    expect(complete.body).toEqual({ data: { authenticated: true } });
    expect(complete.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(complete.headers["set-cookie"][0]).toContain("SameSite=Strict");
    expect(complete.headers["set-cookie"][0]).toContain("Max-Age=2592000");
    await agent.get("/api/v1/snapshot").expect(200, { data: snapshot });
  });

  it("rejects unauthenticated reads and wrong-origin mutations using an error envelope", async () => {
    const { app } = await fixture();
    await request(app).get("/api/v1/snapshot").expect(401, { error: { code: "AUTH_INVALID", message: "Authentication required" } });
    const result = await request(app).post("/api/v1/auth/challenge").set("origin", "https://attacker.example").send({ email: "claudio@example.test", password: "correct password" }).expect(403);
    expect(result.body.error).toMatchObject({ code: "AUTH_INVALID" });
  });

  it("sets auto-pilot only for an authenticated boolean request", async () => {
    const { app, services } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" }).expect(200);
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) }).expect(200);

    await agent.post("/api/v1/auto-pilot").set("origin", origin).send({ enabled: true }).expect(200, { data: { enabled: true } });
    await agent.post("/api/v1/auto-pilot").set("origin", origin).send({ enabled: "true" }).expect(400, { error: { code: "INVALID_REQUEST", message: "Auto-pilot enabled must be a boolean" } });
    await request(app).post("/api/v1/auto-pilot").set("origin", origin).send({ enabled: true }).expect(401, { error: { code: "AUTH_INVALID", message: "Authentication required" } });

    expect(services.setAutoPilot).toHaveBeenCalledOnce();
    expect(services.setAutoPilot).toHaveBeenCalledWith(true);
  });

  it("accepts a same-host Tailscale origin even when its address was not in the startup allowlist", async () => {
    const { app } = await fixture();
    const origin = "http://100.87.251.123:4310";

    await request(app)
      .post("/api/v1/auth/challenge")
      .set("host", "100.87.251.123:4310")
      .set("origin", origin)
      .send({ email: "claudio@example.test", password: "correct password" })
      .expect(200);
  });

  it("does not expose terminal launch through the externally served API", async () => {
    const { app, openTerminal, origins } = await fixture();
    const agent = request.agent(app);
    const localOrigin = "http://127.0.0.1:4310";
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", localOrigin).send({ email: "claudio@example.test", password: "correct password" }).expect(200);
    await agent.post("/api/v1/auth/complete").set("origin", localOrigin).send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) }).expect(200);
    origins.add("https://swarm.example.test");

    const result = await agent.post("/api/v1/accounts/bot1/terminal").set("origin", "https://swarm.example.test").send({}).expect(404);

    expect(result.body).toEqual({ error: { code: "NOT_FOUND", message: "API route not found" } });
    expect(openTerminal).not.toHaveBeenCalled();
  });

  it("refreshes every connected account's usage, forwards an edited prompt, and rejects caller-supplied dispatch origin", async () => {
    const { app, services } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" });
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) });

    await agent.post("/api/v1/accounts/rate-limits/refresh").set("origin", origin).send({}).expect(200);
    await agent.post("/api/v1/tasks/T1/preview").set("origin", origin).send({ accountId: "bot1" }).expect(200);
    const settings = { model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" };
    await agent.post("/api/v1/tasks/T1/launch").set("origin", origin).send({ accountId: "bot1", prompt: "Use this edited worker prompt.", settings, origin: "auto_pilot" }).expect(200);

    expect(services.refreshAllRateLimits).toHaveBeenCalledOnce();
    expect(services.previewLaunch).toHaveBeenCalledWith("T1", "bot1");
    expect(services.launch).toHaveBeenCalledWith("T1", { accountId: "bot1", prompt: "Use this edited worker prompt.", settings });
  });

  it("forwards only valid explicit chat execution settings", async () => {
    const { app, services } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" });
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) });
    const settings = { model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" };

    await agent.post("/api/v1/accounts/bot1/threads/thread-1/turns").set("origin", origin).send({ text: "Run the release checks.", settings }).expect(200);
    await agent.post("/api/v1/accounts/bot1/threads/thread-1/turns").set("origin", origin).send({ text: "Run this.", settings: { permissionMode: "unsafe" } }).expect(400, { error: { code: "INVALID_REQUEST", message: "Invalid chat execution settings" } });

    expect(services.startTurn).toHaveBeenCalledWith("bot1", "thread-1", { text: "Run the release checks.", clientUserMessageId: undefined, settings });
  });

  it("explains an active Codex turn without falling back to a generic coordinator error", async () => {
    const { app, services } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" });
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) });
    (services.startTurn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Codex app-server RPC turn/start failed: a turn is already in progress"));

    await agent.post("/api/v1/accounts/bot1/threads/thread-1/turns").set("origin", origin).send({ text: "Continue." }).expect(409, {
      error: { code: "TURN_ACTIVE", message: "This chat is already working. Use Steer to guide it." },
    });

    (services.startTurn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Codex app-server RPC thread/resume failed: thread thread-1 already has an active writer"));
    await agent.post("/api/v1/accounts/bot1/threads/thread-1/turns").set("origin", origin).send({ text: "Follow up." }).expect(409, {
      error: { code: "TURN_ACTIVE", message: "This chat is already working. Use Steer to guide it." },
    });
  });

  it("validates and forwards a cross-account chat continuation", async () => {
    const { app, services } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" });
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) });

    const settings = { model: "gpt-5.6-terra", effort: "xhigh", serviceTier: "standard", permissionMode: "full_access" };
    await agent.post("/api/v1/accounts/bot1/threads/thread-1/move").set("origin", origin).send({ targetAccountId: "bot2", settings }).expect(200);
    await agent.post("/api/v1/accounts/bot1/threads/thread-1/move").set("origin", origin).send({ targetAccountId: "bot1" }).expect(400, { error: { code: "INVALID_REQUEST", message: "Choose a different known account" } });

    expect(services.moveThreadToAccount).toHaveBeenCalledWith("bot1", "thread-1", "bot2", settings);
  });

  it("validates and forwards a chat rename", async () => {
    const { app, services } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";
    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" });
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) });

    await agent.post("/api/v1/accounts/bot1/threads/thread-1/name").set("origin", origin).send({ name: "Graph plan review" }).expect(200);

    expect(services.renameThread).toHaveBeenCalledWith("bot1", "thread-1", "Graph plan review");
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

  it("consumes a challenge after any TOTP attempt and revokes a logged-out session", async () => {
    const { app } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";
    const first = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" }).expect(200);

    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: first.body.data.challengeId, code: "000000" }).expect(401);
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: first.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) }).expect(401);

    const second = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" }).expect(200);
    const complete = await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: second.body.data.challengeId, code: totpAt("JBSWY3DPEHPK3PXP", Date.now()) }).expect(200);
    const priorCookie = complete.headers["set-cookie"][0].split(";")[0];

    await agent.post("/api/v1/auth/logout").set("origin", origin).send({}).expect(200);
    await request(app).get("/api/v1/snapshot").set("cookie", priorCookie).expect(401);
  });

  it("reports a throttle after the fifth failed authentication code", async () => {
    const { app } = await fixture();
    const agent = request.agent(app);
    const origin = "http://127.0.0.1:4310";

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" }).expect(200);
      await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: "invalid" }).expect(401, { error: { code: "AUTH_INVALID", message: "Unable to sign in" } });
    }

    const challenge = await agent.post("/api/v1/auth/challenge").set("origin", origin).send({ email: "claudio@example.test", password: "correct password" }).expect(200);
    await agent.post("/api/v1/auth/complete").set("origin", origin).send({ challengeId: challenge.body.data.challengeId, code: "invalid" }).expect(429, { error: { code: "AUTH_THROTTLED", message: "Too many sign-in attempts" } });
  });

});
