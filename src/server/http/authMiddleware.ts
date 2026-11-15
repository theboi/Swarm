import { swarmInstanceId } from "../instance.js";
import type { NextFunction, Request, Response } from "express";

import type { SessionStore } from "../auth/sessionStore.js";
import { isAllowedDashboardOrigin } from "./dashboardOrigins.js";

export function sessionCookieName(): string {
  const instance = swarmInstanceId();
  return instance ? `swarm_session_${instance}` : "swarm_session";
}

export interface RequestAuthentication {
  email: string;
}

declare global {
  namespace Express {
    interface Request { swarmAuth?: RequestAuthentication }
  }
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 1) continue;
    if (segment.slice(0, separator).trim() !== name) continue;
    try { return decodeURIComponent(segment.slice(separator + 1).trim()); } catch { return undefined; }
  }
  return undefined;
}

export async function authenticateRequest(request: Request, sessions: SessionStore): Promise<RequestAuthentication | undefined> {
  const token = readCookie(request, sessionCookieName());
  if (!token) return undefined;
  return sessions.useSession(token);
}

export function apiError(response: Response, status: number, code: string, message: string, details?: unknown): Response {
  return response.status(status).json({ error: { code, message, ...(details === undefined ? {} : { details }) } });
}

export function requireSession(sessions: SessionStore) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const auth = await authenticateRequest(request, sessions);
      if (!auth) { apiError(response, 401, "AUTH_INVALID", "Authentication required"); return; }
      request.swarmAuth = auth;
      next();
    } catch { apiError(response, 503, "STATE_UNAVAILABLE", "Authentication state is unavailable"); }
  };
}

/** Origin is accepted only from the machine allowlist or the request's exact direct Host authority. */
export function requireAllowedOrigin(origins: () => ReadonlySet<string>) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.headers.origin;
    if (!isAllowedDashboardOrigin(origin, request.headers.host, origins())) {
      apiError(response, 403, "AUTH_INVALID", "Request origin is not allowed");
      return;
    }
    next();
  };
}

export function requireJson(request: Request, response: Response, next: NextFunction): void {
  if (!request.is("application/json")) {
    apiError(response, 415, "INVALID_REQUEST", "Expected application/json request body");
    return;
  }
  next();
}
