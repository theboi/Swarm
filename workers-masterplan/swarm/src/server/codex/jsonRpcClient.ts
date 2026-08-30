import WebSocket from "ws";
import type { LaunchHandle } from "./suLauncher.js";
import { APP_SERVER_NOTIFICATION_METHODS, isAppServerNotification, isAppServerRequest, isAppServerResponse, isApprovalMethod, safeApprovalDecline, type AppServerId, type AppServerNotification, type AppServerRequest, type AppServerResponse, type ProtocolDiagnostic } from "./protocol.js";

export interface JsonRpcClientOptions {
  launch: Pick<LaunchHandle, "endpoint" | "capabilityToken">;
  requestTimeoutMs?: number;
  webSocketFactory?: (url: string, options: { headers: { Authorization: string } }) => WebSocket;
}

type PendingRequest = {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export type ServerRequestHandler = (request: AppServerRequest) => Promise<unknown | undefined> | unknown | undefined;
export type NotificationHandler = (notification: AppServerNotification | ProtocolDiagnostic) => void;
export interface ApprovalRequestHandler {
  handle(request: AppServerRequest): Promise<Record<string, unknown>>;
}

export class JsonRpcRequestError extends Error {
  constructor(message: string, readonly code: number, readonly data?: unknown) {
    super(message);
    this.name = "JsonRpcRequestError";
  }
}

/** Codex app-server RPC transport that holds the only plaintext loopback capability token. */
export class JsonRpcClient {
  private readonly pending = new Map<AppServerId, PendingRequest>();
  private readonly notificationHandlers = new Set<NotificationHandler>();
  private readonly disconnectHandlers = new Set<() => void>();
  private readonly serverRequestHandlers = new Set<ServerRequestHandler>();
  private readonly diagnostics: ProtocolDiagnostic[] = [];
  private approvalHandler: ApprovalRequestHandler | undefined;
  private socket: WebSocket | undefined;
  private nextId = 1;
  private closing = false;

  constructor(private readonly options: JsonRpcClientOptions) {}

  async connect(): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) return;
    this.assertLoopbackEndpoint();
    const capabilityToken = this.options.launch.capabilityToken;
    if (!capabilityToken) throw new Error("Unauthorized app-server connection: missing capability token");
    this.closing = false;
    const factory = this.options.webSocketFactory ?? ((url, init) => new WebSocket(url, init));
    const socket = factory(this.options.launch.endpoint, { headers: { Authorization: `Bearer ${capabilityToken}` } });
    this.socket = socket;

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const succeed = () => { if (!settled) { settled = true; resolve(); } };
      const fail = (error: Error) => { if (!settled) { settled = true; reject(error); } };
      socket.once("open", succeed);
      socket.once("error", (error) => fail(error instanceof Error ? error : new Error(String(error))));
      socket.once("close", (code) => {
        if (!settled) fail(new Error(`App-server connection closed before ready (${code})`));
      });
    });

    socket.on("message", (data) => this.receive(String(data)));
    socket.on("close", () => {
      this.rejectAllPending(new Error("App-server disconnected"));
      if (!this.closing) for (const handler of this.disconnectHandlers) handler();
    });
    socket.on("error", () => undefined);
  }

  async close(): Promise<void> {
    this.closing = true;
    const socket = this.socket;
    this.socket = undefined;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  onNotification(handler: NotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  onServerRequest(handler: ServerRequestHandler): () => void {
    this.serverRequestHandlers.add(handler);
    return () => this.serverRequestHandlers.delete(handler);
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /** Installs the only handler allowed to answer app-server approval methods. */
  installApprovalHandler(handler: ApprovalRequestHandler): () => void {
    if (this.approvalHandler) throw new Error("An approval policy handler is already installed");
    this.approvalHandler = handler;
    return () => { if (this.approvalHandler === handler) this.approvalHandler = undefined; };
  }

  getDiagnostics(): ProtocolDiagnostic[] { return [...this.diagnostics]; }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("App-server is not connected"));
    const id = this.nextId++;
    const message: AppServerRequest = { id, method, ...(params === undefined ? {} : { params }) };
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server RPC request ${method} timed out`));
      }, this.options.requestTimeoutMs ?? 15_000);
      this.pending.set(id, { method, resolve: (value) => resolve(value as T), reject, timeout });
      socket.send(JSON.stringify(message), (error) => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  notify(method: string, params?: unknown): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) throw new Error("App-server is not connected");
    socket.send(JSON.stringify({ method, ...(params === undefined ? {} : { params }) }));
  }

  async initializeAndReadAccount<T = unknown>(): Promise<T> {
    await this.request("initialize", { clientInfo: { name: "EdenMind Swarm Coordinator", version: "0.1.0" }, capabilities: null });
    this.notify("initialized");
    return this.request<T>("account/read", {});
  }

  private receive(raw: string): void {
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      this.recordDiagnostic("protocol/invalidMessage", { raw: "[REDACTED]" });
      return;
    }
    if (isAppServerResponse(message)) {
      this.receiveResponse(message);
      return;
    }
    if (isAppServerRequest(message)) {
      void this.receiveServerRequest(message);
      return;
    }
    if (isAppServerNotification(message)) {
      const notification: AppServerNotification = { method: message.method, ...(message.params === undefined ? {} : { params: message.params }) };
      if (!APP_SERVER_NOTIFICATION_METHODS.has(notification.method)) {
        this.recordDiagnostic("protocol/unknownNotification", {
          method: notification.method,
          payloadShape: this.redactedShape(notification.params),
        });
        return;
      }
      for (const handler of this.notificationHandlers) handler(notification);
      return;
    }
    this.recordDiagnostic("protocol/unknownMessage", {});
  }

  private receiveResponse(message: AppServerResponse): void {
    const pending = this.pending.get(message.id);
    if (!pending) {
      this.recordDiagnostic("protocol/orphanResponse", { id: message.id });
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    if ("error" in message) {
      pending.reject(new JsonRpcRequestError(`Codex app-server RPC ${pending.method} failed: ${message.error.message}`, message.error.code, message.error.data));
    } else {
      pending.resolve(message.result);
    }
  }

  private async receiveServerRequest(request: AppServerRequest): Promise<void> {
    if (isApprovalMethod(request.method)) {
      try {
        if (!this.approvalHandler) throw new Error("No approval policy handler is installed");
        const result = await this.withDeadline(this.approvalHandler.handle(request), request.method);
        this.sendResponse({ id: request.id, result });
      } catch {
        this.recordDiagnostic("protocol/serverRequestFailed", { method: request.method, id: request.id, outcome: "safe_decline" });
        this.sendResponse({ id: request.id, result: safeApprovalDecline(request.method) });
      }
      return;
    }

    let result: unknown | undefined;
    try {
      for (const handler of this.serverRequestHandlers) {
        result = await this.withDeadline(Promise.resolve(handler(request)), request.method);
        if (result !== undefined) break;
      }
    } catch {
      this.recordDiagnostic("protocol/serverRequestFailed", { method: request.method, id: request.id, outcome: "error" });
      this.sendResponse({ id: request.id, error: { code: -32603, message: "Server request handler failed" } });
      return;
    }
    if (result !== undefined) {
      this.sendResponse({ id: request.id, result });
      return;
    }
    this.recordDiagnostic("protocol/unknownServerRequest", { method: request.method, id: request.id });
    this.sendResponse({ id: request.id, error: { code: -32601, message: "Request requires human review" } });
  }

  private sendResponse(response: AppServerResponse): void {
    const socket = this.socket;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(response));
  }

  private recordDiagnostic(method: string, params: unknown): void {
    const event: ProtocolDiagnostic = { method, params };
    this.diagnostics.push(event);
    for (const handler of this.notificationHandlers) handler(event);
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private assertLoopbackEndpoint(): void {
    let endpoint: URL;
    try { endpoint = new URL(this.options.launch.endpoint); }
    catch { throw new Error("App-server endpoint must be a valid loopback ws URL"); }
    if (endpoint.protocol !== "ws:" || endpoint.hostname !== "127.0.0.1" || !endpoint.port) {
      throw new Error("App-server capability tokens may be sent only to the launch-derived loopback ws endpoint");
    }
  }

  private redactedShape(value: unknown): { type: string; size: number } {
    if (value === null) return { type: "null", size: 0 };
    if (Array.isArray(value)) return { type: "array", size: value.length };
    if (typeof value === "object") return { type: "object", size: Object.keys(value as Record<string, unknown>).length };
    if (typeof value === "string") return { type: "string", size: value.length };
    return { type: typeof value, size: 0 };
  }

  private withDeadline<T>(operation: Promise<T>, method: string): Promise<T> {
    const timeoutMs = this.options.requestTimeoutMs ?? 15_000;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server request ${method} timed out`)), timeoutMs);
      timer.unref();
      operation.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); },
      );
    });
  }
}
