import { createServer as createHttpServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import express, { type Express, type Request, type Response } from "express";
import WebSocket, { WebSocketServer } from "ws";

import type { AccountId, AccountSnapshot, ThreadSummary } from "../../src/shared/contracts.js";
import { createFixtureState, type FixtureManifest, type FixtureState } from "./fixtureData.js";

export interface FixtureAppServerEndpoint {
  endpoint: string;
  capabilityToken: string;
}

export interface E2eFixtureServer {
  state: FixtureState;
  accounts: Record<AccountId, FixtureAppServerEndpoint>;
  close(): Promise<void>;
}

export interface BrowserFixtureServer {
  port: number;
  close(): Promise<void>;
}

type Resource = { http: Server; websocket: WebSocketServer };

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Fixture server did not bind a loopback port"));
      resolve(address.port);
    });
  });
}

function close(resource: Resource): Promise<void> {
  for (const client of resource.websocket.clients) client.terminate();
  return new Promise((resolve, reject) => {
    resource.websocket.close((websocketError) => {
      if (websocketError) return reject(websocketError);
      resource.http.close((httpError) => httpError ? reject(httpError) : resolve());
    });
  });
}

function rateLimitResponse(account: AccountSnapshot): Record<string, unknown> {
  const [primary, secondary] = account.rateLimits;
  return {
    rateLimitsByLimitId: {
      fixture: {
        limitId: "fixture",
        limitName: "Fixture",
        primary: primary ? { usedPercent: primary.usedPercent, resetsAt: primary.resetsAt } : null,
        secondary: secondary ? { usedPercent: secondary.usedPercent, resetsAt: secondary.resetsAt } : null,
      },
    },
  };
}

function threadPage(threads: ThreadSummary[], params: unknown): { data: ThreadSummary[]; nextCursor: string | null } {
  const record = params && typeof params === "object" ? params as Record<string, unknown> : {};
  const rawCursor = record.cursor;
  const offset = rawCursor === null || rawCursor === undefined ? 0 : typeof rawCursor === "string" && /^\d+$/.test(rawCursor) ? Number(rawCursor) : -1;
  if (offset < 0 || offset > threads.length) throw new Error("Invalid fixture thread cursor");
  const data = threads.slice(offset, offset + 1);
  const nextOffset = offset + data.length;
  return { data, nextCursor: nextOffset < threads.length ? String(nextOffset) : null };
}

function send(socket: WebSocket, id: unknown, result?: unknown, error?: { code: number; message: string }): void {
  socket.send(JSON.stringify(error ? { id, error } : { id, result }));
}

function attachProtocol(socket: WebSocket, account: AccountId, state: FixtureState): void {
  socket.on("message", (raw) => {
    let message: unknown;
    try {
      message = JSON.parse(String(raw));
    } catch {
      socket.close(1002, "Invalid JSON");
      return;
    }
    if (!message || typeof message !== "object" || Array.isArray(message)) return;
    const request = message as Record<string, unknown>;
    if (!(typeof request.id === "string" || typeof request.id === "number") || typeof request.method !== "string") return;
    try {
      const accountSnapshot = state.snapshot.accounts.find((candidate) => candidate.id === account);
      const threads = state.snapshot.threads.filter((thread) => thread.accountId === account);
      switch (request.method) {
        case "initialize":
          send(socket, request.id, {});
          return;
        case "account/read":
          send(socket, request.id, { account: accountSnapshot?.authentication === "authenticated" ? { id: account } : null, requiresOpenaiAuth: accountSnapshot?.authentication !== "authenticated" });
          return;
        case "account/rateLimits/read":
          send(socket, request.id, rateLimitResponse(accountSnapshot ?? { id: account, connection: "error", authentication: "unknown", rateLimits: [], activeTurns: 0, lastAssignedAt: null }));
          return;
        case "thread/list":
          send(socket, request.id, threadPage(threads, request.params));
          return;
        case "thread/read": {
          const params = request.params && typeof request.params === "object" ? request.params as Record<string, unknown> : {};
          const thread = threads.find((candidate) => candidate.id === params.threadId);
          if (!thread) throw new Error("Unknown fixture thread");
          send(socket, request.id, { thread, turns: state.transcripts.get(`${account}:${thread.id}`) ?? [] });
          return;
        }
        default:
          send(socket, request.id, undefined, { code: -32601, message: `Unsupported fixture method ${request.method}` });
      }
    } catch (error) {
      send(socket, request.id, undefined, { code: -32602, message: error instanceof Error ? error.message : "Fixture request failed" });
    }
  });
}

async function startAccountServer(account: AccountId, state: FixtureState): Promise<{ endpoint: FixtureAppServerEndpoint; resource: Resource }> {
  const capabilityToken = `fixture-capability-${account}`;
  const websocket = new WebSocketServer({ noServer: true });
  const http = createHttpServer((_request, response) => {
    response.statusCode = 404;
    response.end();
  });
  http.on("upgrade", (request, socket, head) => {
    if (request.headers.authorization !== `Bearer ${capabilityToken}`) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    websocket.handleUpgrade(request, socket, head, (client) => websocket.emit("connection", client, request));
  });
  websocket.on("connection", (socket) => attachProtocol(socket, account, state));
  const port = await listen(http);
  return { endpoint: { endpoint: `ws://127.0.0.1:${port}`, capabilityToken }, resource: { http, websocket } };
}

export async function startE2eFixtureServer(options: { manifest?: FixtureManifest } = {}): Promise<E2eFixtureServer> {
  const state = createFixtureState(options);
  const started = await Promise.all(state.snapshot.accounts.map(async ({ id }) => [id, await startAccountServer(id, state)] as const));
  const accounts = Object.fromEntries(started.map(([account, { endpoint }]) => [account, endpoint])) as Record<AccountId, FixtureAppServerEndpoint>;
  const resources = started.map(([, { resource }]) => resource);
  return {
    state,
    accounts,
    async close() {
      await Promise.all(resources.map(close));
    },
  };
}

function fixtureSession(request: Request): boolean {
  return request.headers.cookie?.split(";").some((part) => part.trim() === "swarm-fixture-session=authenticated") ?? false;
}

function sendData<T>(response: Response, data: T): void {
  response.json({ data });
}

function sendError(response: Response, status: number, code: string, message = code): void {
  response.status(status).json({ error: { code, message } });
}

function requireFixtureSession(request: Request, response: Response): boolean {
  if (fixtureSession(request)) return true;
  sendError(response, 401, "UNAUTHENTICATED");
  return false;
}

function selectedThread(state: FixtureState, accountId: AccountId, threadId: string) {
  return state.snapshot.threads.find((thread) => thread.accountId === accountId && thread.id === threadId);
}

function attachFixtureApi(app: Express, state: FixtureState): void {
  app.use(express.json());
  const challengeId = "fixture-login-challenge";

  app.get("/api/v1/auth/session", (request, response) => sendData(response, { authenticated: fixtureSession(request) }));
  app.post("/api/v1/auth/challenge", (request, response) => {
    const { email, password } = request.body as { email?: unknown; password?: unknown };
    if (email !== "operator@fixture.test" || password !== "fixture-only-password") return sendError(response, 401, "INVALID_CREDENTIALS");
    sendData(response, { challengeId });
  });
  app.post("/api/v1/auth/complete", (request, response) => {
    const { challengeId: suppliedChallenge, code } = request.body as { challengeId?: unknown; code?: unknown };
    if (suppliedChallenge !== challengeId || code !== "123456") return sendError(response, 401, "INVALID_TOTP");
    response.setHeader("Set-Cookie", "swarm-fixture-session=authenticated; HttpOnly; Path=/; SameSite=Lax");
    sendData(response, { authenticated: true });
  });

  app.use("/api/v1", (request, response, next) => requireFixtureSession(request, response) ? next() : undefined);
  app.get("/api/v1/snapshot", (_request, response) => sendData(response, state.snapshot));
  app.post("/api/v1/tasks/:taskId/preview", (request, response) => {
    const task = state.snapshot.tasks.find((candidate) => candidate.id === request.params.taskId);
    if (!task || task.readiness.state !== "ready") return sendError(response, 409, task?.readiness.blockingCodes[0] ?? "MASTERPLAN_NOT_READY");
    sendData(response, { task, accountId: task.readiness.suggestedAccount ?? "bot3", prompt: `Fixture ${task.promptTemplate} prompt for ${task.id}`, dependencies: task.dependsOn, concurrencyImpact: "1 / 3" });
  });
  app.post("/api/v1/tasks/:taskId/launch", (request, response) => {
    const task = state.snapshot.tasks.find((candidate) => candidate.id === request.params.taskId);
    const accountId = typeof request.body?.accountId === "string" ? request.body.accountId : task?.readiness.suggestedAccount;
    if (!task || task.readiness.state !== "ready" || !accountId) return sendError(response, 409, "MASTERPLAN_NOT_READY");
    sendData(response, { id: `dispatch-${randomUUID()}`, taskId: task.id, accountId });
  });
  app.get("/api/v1/accounts/:accountId/threads/:threadId", (request, response) => {
    const accountId = request.params.accountId as AccountId;
    if (!selectedThread(state, accountId, request.params.threadId)) return sendError(response, 404, "THREAD_NOT_FOUND");
    sendData(response, state.transcripts.get(`${accountId}:${request.params.threadId}`) ?? []);
  });
  app.post("/api/v1/accounts/:accountId/threads", (request, response) => {
    const accountId = request.params.accountId as AccountId;
    const thread = { id: `thread-${state.snapshot.threads.length + 1}`, accountId, name: "New fixture chat", archived: false, updatedAt: Date.now(), capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false } };
    state.snapshot.threads.push(thread);
    state.transcripts.set(`${accountId}:${thread.id}`, []);
    sendData(response, thread);
  });
  app.post("/api/v1/accounts/:accountId/threads/:threadId/archive", (request, response) => {
    const thread = selectedThread(state, request.params.accountId as AccountId, request.params.threadId);
    if (!thread || !thread.capabilities.canArchive) return sendError(response, 409, "ARCHIVE_NOT_AVAILABLE");
    thread.archived = true;
    sendData(response, {});
  });
  app.post("/api/v1/accounts/:accountId/threads/:threadId/turns", (request, response) => {
    const accountId = request.params.accountId as AccountId;
    const thread = selectedThread(state, accountId, request.params.threadId);
    if (!thread || !thread.capabilities.canStartTurn) return sendError(response, 409, "TURN_NOT_AVAILABLE");
    sendData(response, {});
  });
  app.post("/api/v1/accounts/:accountId/threads/:threadId/steer", (request, response) => {
    const thread = selectedThread(state, request.params.accountId as AccountId, request.params.threadId);
    if (!thread || !thread.capabilities.canSteer) return sendError(response, 409, "STEER_NOT_AVAILABLE");
    sendData(response, {});
  });
  app.post("/api/v1/accounts/:accountId/threads/:threadId/interrupt", (request, response) => {
    const thread = selectedThread(state, request.params.accountId as AccountId, request.params.threadId);
    if (!thread || !thread.capabilities.canInterrupt) return sendError(response, 409, "INTERRUPT_NOT_AVAILABLE");
    sendData(response, {});
  });
  app.post("/api/v1/accounts/:accountId/files/read", (request, response) => {
    const path = typeof request.body?.path === "string" ? request.body.path : "";
    const file = state.markdownFiles.get(`${request.params.accountId}:${path}`);
    if (!file) return sendError(response, 404, "FILE_NOT_FOUND");
    sendData(response, file);
  });
  app.post("/api/v1/approvals/:approvalId", (request, response) => {
    const approval = state.snapshot.pendingApprovals.find((candidate) => candidate.id === request.params.approvalId);
    const decision = typeof request.body?.decision === "string" ? request.body.decision : "";
    if (!approval || !approval.availableDecisions.includes(decision)) return sendError(response, 409, "HUMAN_APPROVAL_REQUIRED");
    state.snapshot.pendingApprovals = state.snapshot.pendingApprovals.filter((candidate) => candidate.id !== approval.id);
    sendData(response, {});
  });
}

export async function startBrowserFixtureServer(options: { port: number; manifest?: FixtureManifest } ): Promise<BrowserFixtureServer> {
  const appServers = await startE2eFixtureServer({ manifest: options.manifest ?? "ready" });
  const app = express();
  attachFixtureApi(app, appServers.state);
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ root: resolve(process.cwd()), appType: "spa", server: { hmr: false, middlewareMode: true } });
  app.use(vite.middlewares);
  const server = createHttpServer(app);
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(options.port, "127.0.0.1", () => resolveListen());
  });
  return {
    port: options.port,
    async close() {
      await new Promise<void>((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose()));
      await vite.close();
      await appServers.close();
    },
  };
}

function commandLinePort(): number {
  const flag = process.argv.indexOf("--port");
  const value = flag >= 0 ? Number(process.argv[flag + 1]) : Number.NaN;
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error("Fixture server requires a numeric --port argument");
  return value;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const fixture = await startBrowserFixtureServer({ port: commandLinePort() });
  process.stdout.write(`Swarm E2E fixture listening on http://127.0.0.1:${fixture.port}\n`);
  const stop = () => { void fixture.close().finally(() => process.exit(0)); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
