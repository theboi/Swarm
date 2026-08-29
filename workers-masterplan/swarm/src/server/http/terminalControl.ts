import express, { type Request, type Response } from "express";

import { ACCOUNT_IDS, type AccountId } from "../../shared/contracts.js";
import { apiError, requireSession } from "./authMiddleware.js";
import type { CoordinatorRouteServices } from "./routes.js";

const accounts = new Set<AccountId>(ACCOUNT_IDS);

function account(value: unknown): AccountId | undefined {
  return typeof value === "string" && accounts.has(value as AccountId) ? value as AccountId : undefined;
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response): void => {
    void handler(request, response).catch(() => apiError(response, 400, "OPERATION_FAILED", "Unable to open the requested terminal"));
  };
}

/**
 * This router is mounted on a separate port and accepts only the coordinator's
 * explicit local-machine origins, including its Tailscale interface.
 */
export function createTerminalControlApp(services: Pick<CoordinatorRouteServices, "config" | "sessions" | "openTerminal" | "allowedOrigins">): express.Express {
  const app = express();
  app.disable("x-powered-by");
  const allowedOrigins = services.allowedOrigins();
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (typeof origin !== "string" || !allowedOrigins.has(origin)) {
      apiError(response, 403, "AUTH_INVALID", "Request origin is not allowed");
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (request.method === "OPTIONS") { response.status(204).end(); return; }
    next();
  });
  app.use(express.json({ limit: "64kb", type: "application/json" }));
  app.post("/api/v1/accounts/:account/terminal", requireSession(services.sessions), asyncRoute(async (request, response) => {
    const id = account(request.params.account);
    if (!id) {
      apiError(response, 400, "INVALID_REQUEST", "Unknown account");
      return;
    }
    await services.openTerminal(id);
    response.status(200).json({ data: {} });
  }));
  app.use((_request, response) => apiError(response, 404, "NOT_FOUND", "Terminal control route not found"));
  return app;
}
