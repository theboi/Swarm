import express, { type Request, type Response } from "express";

import type { AccountId, CoordinatorSnapshot, HealthSnapshot, PendingApproval } from "../../shared/contracts.js";
import { verifyPassword } from "../auth/password.js";
import { LoginThrottle, resolveLoginSource, SessionStore } from "../auth/sessionStore.js";
import { type createTotpVerifier } from "../auth/totp.js";
import { apiError, requireAllowedOrigin, requireJson, requireSession, SESSION_COOKIE } from "./authMiddleware.js";

export interface CoordinatorRouteServices {
  config: { loginEmail: string; loginPasswordHash: string; trustManagedProxy: boolean; host: string; port: number; secureCookies?: boolean };
  sessions: SessionStore;
  throttle: LoginThrottle;
  verifyTotp: ReturnType<typeof createTotpVerifier>;
  snapshot(): Promise<CoordinatorSnapshot>;
  health(): Promise<HealthSnapshot>;
  connectAccount(accountId: AccountId): Promise<unknown>;
  disconnectAccount(accountId: AccountId): Promise<void>;
  refreshRateLimits(accountId: AccountId): Promise<unknown>;
  previewLaunch(taskId: string, accountId?: AccountId): Promise<unknown>;
  launch(taskId: string, input: { accountId?: AccountId; overrideConcurrency?: boolean }): Promise<unknown>;
  listThreads(accountId: AccountId): Promise<unknown>;
  readTranscript(accountId: AccountId, threadId: string): Promise<unknown>;
  startThread(accountId: AccountId): Promise<unknown>;
  archiveThread(accountId: AccountId, threadId: string): Promise<void>;
  startTurn(accountId: AccountId, threadId: string, input: { text: string; clientUserMessageId?: string }): Promise<unknown>;
  steerTurn(accountId: AccountId, threadId: string, input: { text: string; turnId: string; clientUserMessageId?: string }): Promise<void>;
  interruptTurn(accountId: AccountId, threadId: string, input: { turnId: string }): Promise<void>;
  readMarkdown(accountId: AccountId, path: string): Promise<{ filename: string; content: string }>;
  decideApproval(id: string, input: { decision: string; permissions?: Record<string, unknown> }): Promise<void>;
  ngrokSnapshot(): Promise<unknown>;
  stopNgrokEarly(): Promise<void>;
  allowedOrigins(): ReadonlySet<string>;
}

const accounts = new Set<AccountId>(["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"]);
function account(value: unknown): AccountId | undefined { return typeof value === "string" && accounts.has(value as AccountId) ? value as AccountId : undefined; }
function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown, field: string): string | undefined { return typeof value === "string" && value.trim() ? value : undefined; }
function param(value: string | string[] | undefined): string { return typeof value === "string" ? value : ""; }

function codeFor(error: unknown): { status: number; code: string; message: string } {
  const message = error instanceof Error ? error.message : "Coordinator operation failed";
  const code = /MASTERPLAN_NOT_READY|TASK_NOT_READY|GLOBAL_CONCURRENCY_REACHED|RATE_LIMIT_WAIT|ACCOUNT_AUTH_REQUIRED|ACCOUNT_OFFLINE|FILE_OUTSIDE_WORKSPACE|DANGEROUS_APPROVAL_REQUIRED|HUMAN_APPROVAL_REQUIRED/.exec(message)?.[0] ?? "OPERATION_FAILED";
  const status = code === "FILE_OUTSIDE_WORKSPACE" ? 403 : code === "ACCOUNT_OFFLINE" ? 409 : code === "TASK_NOT_READY" || code === "MASTERPLAN_NOT_READY" || code === "GLOBAL_CONCURRENCY_REACHED" || code === "RATE_LIMIT_WAIT" ? 409 : 400;
  return { status, code, message: code === "OPERATION_FAILED" ? "Coordinator operation failed" : message };
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response): void => { void handler(request, response).catch((error) => { const mapped = codeFor(error); apiError(response, mapped.status, mapped.code, mapped.message); }); };
}

function sendData(response: Response, data: unknown): void { response.status(200).json({ data }); }

/** Versioned browser API. The only unwrapped internal values are immediately enveloped at this boundary. */
export function createApiRouter(services: CoordinatorRouteServices) {
  const router = express.Router();
  const mutation = [requireAllowedOrigin(services.allowedOrigins), requireJson] as const;
  const securedMutation = [requireSession(services.sessions), ...mutation] as const;
  router.use(express.json({ limit: "64kb", type: "application/json" }));

  router.post("/auth/challenge", ...mutation, asyncRoute(async (request, response) => {
    const body = record(request.body);
    const email = text(body.email, "email")?.trim().toLowerCase() ?? "";
    const password = text(body.password, "password") ?? "";
    const source = resolveLoginSource({ directAddress: request.socket.remoteAddress ?? "unknown", forwardedFor: typeof request.headers["x-forwarded-for"] === "string" ? request.headers["x-forwarded-for"] : undefined, trustManagedProxy: services.config.trustManagedProxy });
    if (!email || !password || !services.throttle.check(email, source).allowed) {
      await services.throttle.recordFailure(email || "invalid", source);
      apiError(response, 401, "AUTH_INVALID", "Unable to sign in");
      return;
    }
    const valid = email === services.config.loginEmail && await verifyPassword(password, services.config.loginPasswordHash);
    if (!valid) {
      await services.throttle.recordFailure(email, source);
      apiError(response, 401, "AUTH_INVALID", "Unable to sign in");
      return;
    }
    await services.throttle.recordSuccess(email, source);
    const challenge = await services.sessions.createChallenge(email);
    sendData(response, { challengeId: challenge.id });
  }));

  router.post("/auth/complete", ...mutation, asyncRoute(async (request, response) => {
    const body = record(request.body);
    const challengeId = text(body.challengeId, "challengeId");
    const code = text(body.code, "code");
    if (!challengeId || !code || !(await services.verifyTotp.verify(code, Date.now(), challengeId))) { apiError(response, 401, "AUTH_INVALID", "Unable to sign in"); return; }
    const challenge = await services.sessions.consumeChallenge(challengeId);
    if (!challenge || challenge.email !== services.config.loginEmail) { apiError(response, 401, "AUTH_INVALID", "Unable to sign in"); return; }
    const session = await services.sessions.createSession(challenge.email);
    response.cookie(SESSION_COOKIE, session, { httpOnly: true, sameSite: "strict", path: "/", secure: services.config.secureCookies === true, maxAge: 12 * 60 * 60_000 });
    sendData(response, { authenticated: true });
  }));

  router.get("/auth/session", requireSession(services.sessions), (_request, response) => sendData(response, { authenticated: true }));
  router.post("/auth/logout", ...securedMutation, (_request, response) => { response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "strict", path: "/", secure: services.config.secureCookies === true }); sendData(response, { authenticated: false }); });
  router.get("/snapshot", requireSession(services.sessions), asyncRoute(async (_request, response) => sendData(response, await services.snapshot())));
  router.get("/health", requireSession(services.sessions), asyncRoute(async (_request, response) => sendData(response, await services.health())));

  router.post("/accounts/:account/connect", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.connectAccount(id)); }));
  router.post("/accounts/:account/disconnect", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } await services.disconnectAccount(id); sendData(response, {}); }));
  router.post("/accounts/:account/rate-limits/refresh", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.refreshRateLimits(id)); }));
  router.get("/accounts/:account/threads", requireSession(services.sessions), asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.listThreads(id)); }));
  router.post("/accounts/:account/threads", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.startThread(id)); }));
  router.get("/accounts/:account/threads/:thread", requireSession(services.sessions), asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.readTranscript(id, param(request.params.thread))); }));
  router.post("/accounts/:account/threads/:thread/archive", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } await services.archiveThread(id, param(request.params.thread)); sendData(response, {}); }));
  router.post("/accounts/:account/threads/:thread/turns", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const body = record(request.body); const value = text(body.text, "text"); if (!id || !value) { apiError(response, 400, "INVALID_REQUEST", "A known account and text are required"); return; } sendData(response, await services.startTurn(id, param(request.params.thread), { text: value, clientUserMessageId: text(body.clientUserMessageId, "clientUserMessageId") })); }));
  router.post("/accounts/:account/threads/:thread/steer", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const body = record(request.body); const value = text(body.text, "text"); const turnId = text(body.turnId, "turnId"); if (!id || !value || !turnId) { apiError(response, 400, "INVALID_REQUEST", "A known account, turnId, and text are required"); return; } await services.steerTurn(id, param(request.params.thread), { text: value, turnId, clientUserMessageId: text(body.clientUserMessageId, "clientUserMessageId") }); sendData(response, {}); }));
  router.post("/accounts/:account/threads/:thread/interrupt", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const turnId = text(record(request.body).turnId, "turnId"); if (!id || !turnId) { apiError(response, 400, "INVALID_REQUEST", "A known account and turnId are required"); return; } await services.interruptTurn(id, param(request.params.thread), { turnId }); sendData(response, {}); }));
  router.post("/accounts/:account/files/read", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const path = text(record(request.body).path, "path"); if (!id || !path) { apiError(response, 400, "INVALID_REQUEST", "A known account and file path are required"); return; } sendData(response, await services.readMarkdown(id, path)); }));

  router.post("/tasks/:task/preview", ...securedMutation, asyncRoute(async (request, response) => { const body = record(request.body); sendData(response, await services.previewLaunch(param(request.params.task), account(body.accountId))); }));
  router.post("/tasks/:task/launch", ...securedMutation, asyncRoute(async (request, response) => { const body = record(request.body); const accountId = body.accountId === undefined ? undefined : account(body.accountId); if (body.accountId !== undefined && !accountId) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.launch(param(request.params.task), { accountId, overrideConcurrency: body.overrideConcurrency === true })); }));
  router.post("/approvals/:approval", ...securedMutation, asyncRoute(async (request, response) => { const body = record(request.body); const decision = text(body.decision, "decision"); if (!decision) { apiError(response, 400, "INVALID_REQUEST", "An approval decision is required"); return; } await services.decideApproval(param(request.params.approval), { decision, permissions: record(body.permissions) }); sendData(response, {}); }));
  router.get("/ngrok", requireSession(services.sessions), asyncRoute(async (_request, response) => sendData(response, await services.ngrokSnapshot())));
  router.post("/ngrok/stop", ...securedMutation, asyncRoute(async (_request, response) => { await services.stopNgrokEarly(); sendData(response, {}); }));

  router.use((_request, response) => apiError(response, 404, "NOT_FOUND", "API route not found"));
  return router;
}
