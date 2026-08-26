import { createServer, type Server } from "node:http";
import express from "express";
import { resolve } from "node:path";

import type { CoordinatorRouteServices } from "./http/routes.js";
import { createApiRouter } from "./http/routes.js";
import { BrowserHub } from "./realtime/browserHub.js";

export interface CoordinatorAppDependencies {
  services: CoordinatorRouteServices;
  /** Stops launches/timers/children before the durable final state is released. */
  shutdown(): Promise<void>;
  flush(): Promise<void>;
  staticDir?: string;
}

export interface CoordinatorApp {
  app: express.Express;
  server: Server;
  hub: BrowserHub;
  start(): Promise<{ host: string; port: number }>;
  shutdown(): Promise<void>;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolveClose) => server.close((error) => { if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING") throw error; resolveClose(); }));
}

/** Owns listener lifecycle; no direct route can mutate the app after shutdown begins. */
export function createCoordinatorApp(dependencies: CoordinatorAppDependencies): CoordinatorApp {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api/v1", createApiRouter(dependencies.services));
  if (dependencies.staticDir) {
    const staticDir = resolve(dependencies.staticDir);
    app.use(express.static(staticDir, { index: "index.html", fallthrough: true }));
    app.use((_request, response) => response.sendFile(resolve(staticDir, "index.html")));
  }
  const server = createServer(app);
  const hub = new BrowserHub({ server, sessions: dependencies.services.sessions, allowedOrigins: dependencies.services.allowedOrigins, snapshot: dependencies.services.snapshot });
  let stopping: Promise<void> | undefined;

  return {
    app,
    server,
    hub,
    async start() {
      await new Promise<void>((resolveListen, rejectListen) => {
        const onError = (error: Error) => { server.off("listening", onListening); rejectListen(error); };
        const onListening = () => { server.off("error", onError); resolveListen(); };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(dependencies.services.config.port, dependencies.services.config.host);
      });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Coordinator did not bind a loopback listener");
      return { host: dependencies.services.config.host, port: address.port };
    },
    shutdown() {
      stopping ??= (async () => {
        await dependencies.shutdown();
        await hub.close();
        await dependencies.flush();
        await closeServer(server);
      })();
      return stopping;
    },
  };
}
