import { createServer, type Server } from "node:http";
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
  const http = createServer((_request, response) => {
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

function runtimeUnavailable(): never {
  throw new Error("Task 5 HTTP/WebSocket runtime is required before browser E2E can start; fake app-server fixtures are available only through startE2eFixtureServer.");
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    runtimeUnavailable();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Browser E2E runtime unavailable"}\n`);
    process.exitCode = 1;
  }
}
