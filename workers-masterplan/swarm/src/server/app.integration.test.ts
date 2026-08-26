import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createPasswordHash } from "./auth/password.js";
import { LoginThrottle, SessionStore } from "./auth/sessionStore.js";
import { createTotpVerifier } from "./auth/totp.js";
import { createCoordinatorApp } from "./app.js";
import type { CoordinatorRouteServices } from "./http/routes.js";
import type { CoordinatorSnapshot, HealthSnapshot } from "../shared/contracts.js";

const health: HealthSnapshot = { server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: "ok" }, outbox: { state: "ok" }, scheduler: { state: "ok" }, ngrok: { state: "ok" }, accounts: { state: "ok" } };
const snapshot: CoordinatorSnapshot = { generatedAt: 1, activeTurnLimit: 3, accounts: [], tasks: [], dispatches: [], threads: [], pendingApprovals: [], ngrok: { state: "stopped", publicUrl: null, message: null, nextBoundaryAt: null }, health };
let stop: (() => Promise<void>) | undefined;
afterEach(async () => { await stop?.(); stop = undefined; });

describe("coordinator application composition", () => {
  it("mounts only the versioned API and flushes runtime dependencies before closing", async () => {
    const passwordHash = await createPasswordHash("password", "app-test-salt");
    const services: CoordinatorRouteServices = {
      config: { loginEmail: "claudio@example.test", loginPasswordHash: passwordHash, trustManagedProxy: false, host: "127.0.0.1", port: 4310 }, sessions: new SessionStore("session"), throttle: new LoginThrottle(), verifyTotp: createTotpVerifier("JBSWY3DPEHPK3PXP"), snapshot: async () => snapshot, health: async () => health,
      connectAccount: async () => ({}), disconnectAccount: async () => undefined, refreshRateLimits: async () => [], previewLaunch: async () => ({}), launch: async () => ({}), listThreads: async () => [], readTranscript: async () => [], startThread: async () => ({}), archiveThread: async () => undefined, startTurn: async () => ({}), steerTurn: async () => undefined, interruptTurn: async () => undefined, readMarkdown: async () => ({ filename: "x.md", content: "" }), decideApproval: async () => undefined, ngrokSnapshot: async () => snapshot.ngrok, stopNgrokEarly: async () => undefined, allowedOrigins: () => new Set(["http://127.0.0.1:4310"]),
    };
    const flush = vi.fn(async () => undefined);
    const shutdown = vi.fn(async () => undefined);
    const coordinator = createCoordinatorApp({ services, flush, shutdown });
    stop = coordinator.shutdown;

    await request(coordinator.app).get("/not-an-api-route").expect(404);
    await coordinator.shutdown();

    expect(flush).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledOnce();
  });
});
