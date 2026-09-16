import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createPasswordHash } from "./auth/password.js";
import { LoginThrottle, SessionStore } from "./auth/sessionStore.js";
import { createTotpVerifier } from "./auth/totp.js";
import { createCoordinatorApp } from "./app.js";
import type { CoordinatorRouteServices } from "./http/routes.js";
import type { CoordinatorSnapshot, HealthSnapshot } from "../shared/contracts.js";

const health: HealthSnapshot = { server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: "ok" }, outbox: { state: "ok" }, scheduler: { state: "ok" }, accounts: { state: "ok" } };
const snapshot: CoordinatorSnapshot = { generatedAt: 1, autoPilot: { enabled: false }, accounts: [], tasks: [], dispatches: [], threads: [], pendingApprovals: [], health };
let stop: (() => Promise<void>) | undefined;
afterEach(async () => { await stop?.(); stop = undefined; });

async function servicesFixture(): Promise<CoordinatorRouteServices> {
  const passwordHash = await createPasswordHash("password", "app-test-salt");
  return {
    config: { loginEmail: "claudio@example.test", loginPasswordHash: passwordHash, trustManagedProxy: false, host: "127.0.0.1", port: 4310, terminalPort: 4311 }, sessions: new SessionStore("session"), throttle: new LoginThrottle(), verifyTotp: createTotpVerifier("JBSWY3DPEHPK3PXP"), snapshot: async () => snapshot, health: async () => health, setAutoPilot: async (enabled) => ({ enabled }),
    resolveAccountId: (value) => value === "bot1" ? value : undefined, makePrimary: async () => [], addAccount: async () => ({ id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, connection: "disconnected", authentication: "unknown", rateLimits: [], activeTurns: 0, lastAssignedAt: null }), startAccountLogin: async () => ({ accountId: "bot1/acc2", loginId: "private", method: "device_code", verificationUrl: "https://auth.example.test", expiresAt: 1 }), cancelAccountLogin: async () => undefined,
    connectAccount: async () => ({}), disconnectAccount: async () => undefined, openTerminal: async () => undefined, refreshRateLimits: async () => [], refreshAllRateLimits: async () => [], listModels: async () => [], previewLaunch: async () => ({}), launch: async () => ({}), listThreads: async () => [], readTranscript: async () => [], startThread: async () => ({}), moveThreadToAccount: async () => ({}), renameThread: async () => undefined, archiveThread: async () => undefined, startTurn: async () => ({}), steerTurn: async () => undefined, interruptTurn: async () => undefined, readMarkdown: async () => ({ filename: "x.md", content: "" }), decideApproval: async () => undefined, allowedOrigins: () => new Set(["http://127.0.0.1:4310"]),
  };
}

describe("coordinator application composition", () => {
  it("mounts only the versioned API and flushes runtime dependencies before closing", async () => {
    const services = await servicesFixture();
    const flush = vi.fn(async () => undefined);
    const shutdown = vi.fn(async () => undefined);
    const coordinator = createCoordinatorApp({ services, flush, shutdown });
    stop = coordinator.shutdown;

    await request(coordinator.app).get("/not-an-api-route").expect(404);
    await coordinator.shutdown();

    expect(flush).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledOnce();
  });

  it("serves the compiled SPA and its client routes without shadowing API errors", async () => {
    const staticDir = await mkdtemp(join(tmpdir(), ".swarm-client-"));
    await writeFile(join(staticDir, "index.html"), "<main>Swarm client</main>");
    const coordinator = createCoordinatorApp({ services: await servicesFixture(), staticDir, flush: async () => undefined, shutdown: async () => undefined });
    stop = coordinator.shutdown;
    try {
      await request(coordinator.app).get("/").expect(200, "<main>Swarm client</main>");
      await request(coordinator.app).get("/flowchart").expect(200, "<main>Swarm client</main>");
      await request(coordinator.app).get("/api/v1/not-found").expect(404);
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });
});
