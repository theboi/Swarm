import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { LoginThrottle, SessionStore } from "../auth/sessionStore.js";
import { createTerminalControlApp } from "./terminalControl.js";
import type { CoordinatorRouteServices } from "./routes.js";

function fixture() {
  const sessions = new SessionStore("session-secret");
  const openTerminal = vi.fn(async () => undefined);
  const services = {
    config: { loginEmail: "claudio@example.test", loginPasswordHash: "hash", trustManagedProxy: false, host: "127.0.0.1", port: 4310, terminalPort: 4311 },
    sessions,
    throttle: new LoginThrottle(),
    verifyTotp: { verify: async () => false },
    openTerminal,
  } as unknown as CoordinatorRouteServices;
  return { app: createTerminalControlApp(services), sessions, openTerminal };
}

describe("loopback terminal controller", () => {
  it("accepts a session-authenticated local dashboard request for each allowlisted account", async () => {
    const { app, sessions, openTerminal } = fixture();
    const token = await sessions.createSession("claudio@example.test");
    const origin = "http://127.0.0.1:4310";

    await request(app).options("/api/v1/accounts/bot1/terminal").set("origin", origin).expect(204).expect("access-control-allow-origin", origin);
    await request(app).post("/api/v1/accounts/bot1/terminal").set("origin", origin).set("cookie", `swarm_session=${token}`).send({}).expect(200, { data: {} });
    await request(app).post("/api/v1/accounts/claudiothe/terminal").set("origin", origin).set("cookie", `swarm_session=${token}`).send({}).expect(200, { data: {} });

    expect(openTerminal).toHaveBeenNthCalledWith(1, "bot1");
    expect(openTerminal).toHaveBeenNthCalledWith(2, "claudiothe");
  });

  it("rejects unauthenticated, foreign-origin preflight, and unknown-account requests", async () => {
    const { app, sessions, openTerminal } = fixture();
    const token = await sessions.createSession("claudio@example.test");

    await request(app).post("/api/v1/accounts/bot1/terminal").set("origin", "http://127.0.0.1:4310").send({}).expect(401);
    await request(app).options("/api/v1/accounts/bot1/terminal").set("origin", "https://attacker.example").expect(403);
    await request(app).post("/api/v1/accounts/not-a-bot/terminal").set("origin", "http://127.0.0.1:4310").set("cookie", `swarm_session=${token}`).send({}).expect(400);
    expect(openTerminal).not.toHaveBeenCalled();
  });
});
