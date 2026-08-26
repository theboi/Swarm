import type { NextFunction, Request, Response } from "express";

import type { SessionStore } from "../auth/sessionStore.js";

export const SESSION_COOKIE = "swarm_session";

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
  const token = readCookie(request, SESSION_COOKIE);
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

/** Origin is an authorization input. It is never derived from Host or forwarded host headers. */
export function requireAllowedOrigin(origins: () => ReadonlySet<string>) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.headers.origin;
    if (typeof origin !== "string" || !origins().has(origin)) {
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
