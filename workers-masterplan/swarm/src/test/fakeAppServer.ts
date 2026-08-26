import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface FakeAppServer {
  url: string;
  received: JsonRpcMessage[];
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: JsonRpcMessage): void;
  closeClients(): void;
  onMessage(handler: (message: JsonRpcMessage, peer: WebSocket) => void): void;
}

/** A local v2-shaped websocket fixture that enforces the launch token digest. */
export function createFakeAppServer(capabilityTokenDigest: string): FakeAppServer {
  const http = createServer();
  const websocket = new WebSocketServer({ noServer: true });
  const peers = new Set<WebSocket>();
  const received: JsonRpcMessage[] = [];
  let handler: ((message: JsonRpcMessage, peer: WebSocket) => void) | undefined;
  let port = 0;

  http.on("upgrade", (request, socket, head) => {
    const authorization = request.headers.authorization;
    const bearer = typeof authorization === "string" && /^Bearer\s+(.+)$/.exec(authorization)?.[1];
    const digest = bearer ? createHash("sha256").update(bearer).digest("hex") : "";
    const authorized = digest.length === capabilityTokenDigest.length
      && timingSafeEqual(Buffer.from(digest), Buffer.from(capabilityTokenDigest));
    if (!authorized) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    websocket.handleUpgrade(request, socket, head, (peer) => websocket.emit("connection", peer, request));
  });

  websocket.on("connection", (peer) => {
    peers.add(peer);
    peer.on("close", () => peers.delete(peer));
    peer.on("message", (wire) => {
      const message = JSON.parse(String(wire)) as JsonRpcMessage;
      received.push(message);
      handler?.(message, peer);
    });
  });

  return {
    get url() { return `ws://127.0.0.1:${port}`; },
    received,
    start: () => new Promise<void>((resolve, reject) => {
      http.once("error", reject);
      http.listen(0, "127.0.0.1", () => {
        http.off("error", reject);
        const address = http.address();
        if (!address || typeof address === "string") return reject(new Error("Fake server did not bind a TCP port"));
        port = address.port;
        resolve();
      });
    }),
    stop: async () => {
      for (const peer of peers) peer.close();
      await new Promise<void>((resolve, reject) => http.close((error) => error ? reject(error) : resolve()));
    },
    send: (message) => {
      const encoded = JSON.stringify(message);
      for (const peer of peers) peer.send(encoded);
    },
    closeClients: () => {
      for (const peer of peers) peer.close();
    },
    onMessage: (next) => { handler = next; },
  };
}
