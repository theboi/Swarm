import type { IncomingMessage, Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";

import type { AccountSnapshot, CoordinatorEvent, CoordinatorSnapshot } from "../../shared/contracts.js";
import { readCookie, sessionCookieName } from "../http/authMiddleware.js";
import { isAllowedDashboardOrigin } from "../http/dashboardOrigins.js";
import type { SessionStore } from "../auth/sessionStore.js";

export interface BrowserHubOptions {
  server: Server;
  sessions: SessionStore;
  allowedOrigins(): ReadonlySet<string>;
  snapshot(): Promise<CoordinatorSnapshot>;
  maxBufferedBytes?: number;
  onError?: (error: unknown) => void;
}

function rejectUpgrade(socket: { write(data: string): unknown; destroy(): void }): void {
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  socket.destroy();
}

function resyncMessage(data: WebSocket.RawData): boolean {
  try { const parsed = JSON.parse(data.toString()) as unknown; return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed) && (parsed as { type?: unknown }).type === "resync"); } catch { return false; }
}

/** Read-only browser stream. Commands deliberately stay on origin-protected HTTP routes. */
export class BrowserHub {
  private readonly websocket = new WebSocketServer({ noServer: true });
  private sequence = 0;
  private closed = false;
  private readonly upgrade = (request: IncomingMessage, socket: Parameters<Server["emit"]>[1], head: Buffer) => {
    void this.handleUpgrade(request, socket as never, head).catch((error) => {
      this.options.onError?.(error);
      rejectUpgrade(socket as never);
    });
  };

  constructor(private readonly options: BrowserHubOptions) {
    options.server.on("upgrade", this.upgrade);
    this.websocket.on("connection", (socket) => this.configureSocket(socket));
  }

  publish(type: string, payload: Record<string, unknown>): CoordinatorEvent {
    const event: CoordinatorEvent = { sequence: ++this.sequence, type, occurredAt: Date.now(), payload: { ...payload } };
    const serialized = JSON.stringify(event);
    for (const socket of this.websocket.clients) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      if (socket.bufferedAmount > (this.options.maxBufferedBytes ?? 512 * 1024)) { socket.close(1013, "slow browser client"); continue; }
      socket.send(serialized);
    }
    return event;
  }

  /** Emits every changed profile for one atomic primary-switch transaction together. */
  publishAccountSnapshots(accounts: AccountSnapshot[]): CoordinatorEvent {
    return this.publish("account", {
      accounts: accounts.map((account) => ({ ...account, rateLimits: account.rateLimits.map((window) => ({ ...window })) })),
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.options.server.off("upgrade", this.upgrade);
    for (const socket of this.websocket.clients) socket.close(1001, "coordinator shutdown");
    await new Promise<void>((resolve) => this.websocket.close(() => resolve()));
  }

  private async handleUpgrade(request: IncomingMessage, socket: { write(data: string): unknown; destroy(): void }, head: Buffer): Promise<void> {
    if (this.closed || new URL(request.url ?? "/", "http://localhost").pathname !== "/ws") { rejectUpgrade(socket); return; }
    const origin = request.headers.origin;
    if (!isAllowedDashboardOrigin(origin, request.headers.host, this.options.allowedOrigins())) { rejectUpgrade(socket); return; }
    const cookie = readCookie(request as never, sessionCookieName());
    const auth = cookie ? await this.options.sessions.useSession(cookie) : undefined;
    if (!auth) { rejectUpgrade(socket); return; }
    this.websocket.handleUpgrade(request, socket as never, head, (client) => this.websocket.emit("connection", client, request));
  }

  private configureSocket(socket: WebSocket): void {
    this.sendSnapshotSafely(socket);
    socket.on("message", (data) => {
      if (!resyncMessage(data)) { socket.close(1008, "only resync messages are permitted"); return; }
      this.sendSnapshotSafely(socket);
    });
  }

  private sendSnapshotSafely(socket: WebSocket): void {
    void this.sendSnapshot(socket).catch((error) => {
      this.options.onError?.(error);
      if (socket.readyState === WebSocket.OPEN) socket.close(1011, "snapshot unavailable");
    });
  }

  private async sendSnapshot(socket: WebSocket): Promise<void> {
    const snapshot = await this.options.snapshot();
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "snapshot", sequence: this.sequence, occurredAt: Date.now(), payload: snapshot }));
  }
}
