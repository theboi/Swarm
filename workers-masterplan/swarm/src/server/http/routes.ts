import express, { type Request, type Response } from "express";

import { ACCOUNT_IDS, type AccountId, type AutoPilotState, type ChatExecutionSettings, type ChatModelOption, type CoordinatorSnapshot, type DispatchOrigin, type HealthSnapshot, type ManifestPass, type PendingApproval } from "../../shared/contracts.js";
import { verifyPassword } from "../auth/password.js";
import { LoginThrottle, resolveLoginSource, SessionStore } from "../auth/sessionStore.js";
import { type createTotpVerifier } from "../auth/totp.js";
import { apiError, readCookie, requireAllowedOrigin, requireJson, requireSession, SESSION_COOKIE } from "./authMiddleware.js";

export interface CoordinatorRouteServices {
  config: { loginEmail: string; loginPasswordHash: string; trustManagedProxy: boolean; host: string; port: number; terminalPort: number; secureCookies?: boolean };
  sessions: SessionStore;
  throttle: LoginThrottle;
  verifyTotp: ReturnType<typeof createTotpVerifier>;
  snapshot(): Promise<CoordinatorSnapshot>;
  health(): Promise<HealthSnapshot>;
  setAutoPilot(enabled: boolean): Promise<AutoPilotState>;
  connectAccount(accountId: AccountId): Promise<unknown>;
  disconnectAccount(accountId: AccountId): Promise<void>;
  openTerminal(accountId: AccountId): Promise<void>;
  refreshRateLimits(accountId: AccountId): Promise<unknown>;
  refreshAllRateLimits(): Promise<unknown>;
  listModels(accountId: AccountId): Promise<ChatModelOption[]>;
  previewLaunch(taskId: string, accountId?: AccountId, pass?: ManifestPass): Promise<unknown>;
  launch(taskId: string, input: { accountId?: AccountId; prompt?: string; settings?: ChatExecutionSettings; pass?: ManifestPass; origin?: DispatchOrigin }): Promise<unknown>;
  listThreads(accountId: AccountId): Promise<unknown>;
  readTranscript(accountId: AccountId, threadId: string): Promise<unknown>;
  startThread(accountId: AccountId): Promise<unknown>;
  moveThreadToAccount(sourceAccountId: AccountId, threadId: string, targetAccountId: AccountId, settings?: ChatExecutionSettings): Promise<unknown>;
  renameThread(accountId: AccountId, threadId: string, name: string): Promise<void>;
  archiveThread(accountId: AccountId, threadId: string): Promise<void>;
  startTurn(accountId: AccountId, threadId: string, input: { text: string; clientUserMessageId?: string; settings?: ChatExecutionSettings }): Promise<unknown>;
  steerTurn(accountId: AccountId, threadId: string, input: { text: string; turnId: string; clientUserMessageId?: string }): Promise<void>;
  interruptTurn(accountId: AccountId, threadId: string, input: { turnId: string }): Promise<void>;
  readMarkdown(accountId: AccountId, path: string): Promise<{ filename: string; content: string }>;
  decideApproval(id: string, input: { decision: string; permissions?: Record<string, unknown> }): Promise<void>;
  allowedOrigins(): ReadonlySet<string>;
}

const accounts = new Set<AccountId>(ACCOUNT_IDS);
function manifestPass(value: unknown): ManifestPass | undefined { return value === "planning" || value === "execution" ? value : undefined; }
function account(value: unknown): AccountId | undefined { return typeof value === "string" && accounts.has(value as AccountId) ? value as AccountId : undefined; }
function record(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown, field: string): string | undefined { return typeof value === "string" && value.trim() ? value : undefined; }
function settingText(value: unknown): string | undefined | null { return value === undefined ? undefined : typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : null; }
function executionSettings(value: unknown): ChatExecutionSettings | undefined | null {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = value as Record<string, unknown>;
  if (Object.keys(settings).some((key) => !["model", "effort", "serviceTier", "permissionMode"].includes(key))) return null;
  const model = settingText(settings.model);
  const effort = settingText(settings.effort);
  const serviceTier = settingText(settings.serviceTier);
  const permissionMode = settings.permissionMode === undefined ? undefined : settings.permissionMode === "ask_for_approval" || settings.permissionMode === "ask_me" || settings.permissionMode === "full_access" ? settings.permissionMode : null;
  if (model === null || effort === null || serviceTier === null || permissionMode === null) return null;
  return { ...(model ? { model } : {}), ...(effort ? { effort } : {}), ...(serviceTier ? { serviceTier } : {}), ...(permissionMode ? { permissionMode } : {}) };
}
function param(value: string | string[] | undefined): string { return typeof value === "string" ? value : ""; }
function codeFor(error: unknown): { status: number; code: string; message: string } {
  const message = error instanceof Error ? error.message : "Codex request did not complete";
  if (/turn.*(?:already|is).*(?:active|in progress|running)|(?:active|in progress|running).*turn/i.test(message)) {
    return { status: 409, code: "TURN_ACTIVE", message: "This chat is already working. Use Steer to guide it." };
  }
  if (/model|reasoning effort|service tier/i.test(message) && /(?:unsupported|unavailable|invalid|rejected|failed)/i.test(message)) {
    return { status: 400, code: "TURN_OPTIONS_UNAVAILABLE", message: "One or more selected turn options are not available on this account." };
  }
  if (/app-server.*(?:not connected|disconnected|timed out)|connection.*(?:closed|lost)/i.test(message)) {
    return { status: 503, code: "ACCOUNT_UNAVAILABLE", message: "This account's Codex connection was interrupted. Try again in a moment." };
  }
  if (message.includes("GIT_HANDOFF_PUSH_FAILED")) return { status: 409, code: "GIT_HANDOFF_PUSH_FAILED", message: message.replace(/^GIT_HANDOFF_PUSH_FAILED:\s*/, "") };
  const code = /MASTERPLAN_NOT_READY|TASK_NOT_READY|RATE_LIMIT_WAIT|ACCOUNT_AUTH_REQUIRED|ACCOUNT_OFFLINE|FILE_OUTSIDE_WORKSPACE|DANGEROUS_APPROVAL_REQUIRED|HUMAN_APPROVAL_REQUIRED/.exec(message)?.[0] ?? "OPERATION_FAILED";
  const status = code === "FILE_OUTSIDE_WORKSPACE" ? 403 : code === "ACCOUNT_OFFLINE" ? 409 : code === "TASK_NOT_READY" || code === "MASTERPLAN_NOT_READY" || code === "RATE_LIMIT_WAIT" ? 409 : 400;
  return { status, code, message: code === "OPERATION_FAILED" ? "Codex could not complete this request. Try again, or check that the selected account is connected." : message };
}

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response): void => { void handler(request, response).catch((error) => { const mapped = codeFor(error); apiError(response, mapped.status, mapped.code, mapped.message); }); };
}

function sendData(response: Response, data: unknown): void { response.status(200).json({ data }); }

function secureCookie(request: Request, config: CoordinatorRouteServices["config"]): boolean {
  return config.secureCookies === true
    && (request.protocol === "https" || (config.trustManagedProxy && request.headers["x-forwarded-proto"] === "https"));
}

/** Versioned browser API. The only unwrapped internal values are immediately enveloped at this boundary. */
export function createApiRouter(services: CoordinatorRouteServices) {
  const router = express.Router();
  const mutation = [requireAllowedOrigin(services.allowedOrigins), requireJson] as const;
  const securedMutation = [requireSession(services.sessions), ...mutation] as const;
  const sendThrottled = (response: express.Response) => apiError(response, 429, "AUTH_THROTTLED", "Too many sign-in attempts");
  const sendInvalid = async (response: express.Response, email: string, source: string) => {
    await services.throttle.recordFailure(email, source);
    if (!services.throttle.check(email, source).allowed) sendThrottled(response);
    else apiError(response, 401, "AUTH_INVALID", "Unable to sign in");
  };
  router.use(express.json({ limit: "64kb", type: "application/json" }));

  router.post("/auth/challenge", ...mutation, asyncRoute(async (request, response) => {
    const body = record(request.body);
    const email = text(body.email, "email")?.trim().toLowerCase() ?? "";
    const password = text(body.password, "password") ?? "";
    const source = resolveLoginSource({ directAddress: request.socket.remoteAddress ?? "unknown", forwardedFor: typeof request.headers["x-forwarded-for"] === "string" ? request.headers["x-forwarded-for"] : undefined, trustManagedProxy: services.config.trustManagedProxy });
    const throttleEmail = email || "invalid";
    if (!services.throttle.check(throttleEmail, source).allowed) {
      sendThrottled(response);
      return;
    }
    if (!email || !password) {
      await sendInvalid(response, throttleEmail, source);
      return;
    }
    const valid = email === services.config.loginEmail && await verifyPassword(password, services.config.loginPasswordHash);
    if (!valid) {
      await sendInvalid(response, email, source);
      return;
    }
    const challenge = await services.sessions.createChallenge(email);
    sendData(response, { challengeId: challenge.id });
  }));

  router.post("/auth/complete", ...mutation, asyncRoute(async (request, response) => {
    const body = record(request.body);
    const challengeId = text(body.challengeId, "challengeId");
    const code = text(body.code, "code");
    const source = resolveLoginSource({ directAddress: request.socket.remoteAddress ?? "unknown", forwardedFor: typeof request.headers["x-forwarded-for"] === "string" ? request.headers["x-forwarded-for"] : undefined, trustManagedProxy: services.config.trustManagedProxy });
    const challenge = challengeId ? await services.sessions.consumeChallenge(challengeId) : undefined;
    const throttleEmail = challenge?.email ?? "invalid";
    if (!services.throttle.check(throttleEmail, source).allowed) {
      sendThrottled(response);
      return;
    }
    if (!challenge || !code || challenge.email !== services.config.loginEmail || !(await services.verifyTotp.verify(code, Date.now(), challengeId ?? ""))) {
      await sendInvalid(response, throttleEmail, source);
      return;
    }
    await services.throttle.recordSuccess(challenge.email, source);
    const session = await services.sessions.createSession(challenge.email);
    response.cookie(SESSION_COOKIE, session, { httpOnly: true, sameSite: "strict", path: "/", secure: secureCookie(request, services.config), maxAge: 30 * 24 * 60 * 60_000 });
    sendData(response, { authenticated: true });
  }));

  router.get("/auth/session", requireSession(services.sessions), (_request, response) => sendData(response, { authenticated: true }));
  router.post("/auth/logout", ...securedMutation, asyncRoute(async (request, response) => {
    const session = readCookie(request, SESSION_COOKIE);
    if (session) await services.sessions.revokeSession(session);
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "strict", path: "/", secure: secureCookie(request, services.config) });
    sendData(response, { authenticated: false });
  }));
  router.get("/snapshot", requireSession(services.sessions), asyncRoute(async (_request, response) => sendData(response, await services.snapshot())));
  router.get("/health", requireSession(services.sessions), asyncRoute(async (_request, response) => sendData(response, await services.health())));
  router.post("/auto-pilot", ...securedMutation, asyncRoute(async (request, response) => {
    const enabled = record(request.body).enabled;
    if (typeof enabled !== "boolean") {
      apiError(response, 400, "INVALID_REQUEST", "Auto-pilot enabled must be a boolean");
      return;
    }
    sendData(response, await services.setAutoPilot(enabled));
  }));

  router.post("/accounts/rate-limits/refresh", ...securedMutation, asyncRoute(async (_request, response) => sendData(response, await services.refreshAllRateLimits())));
  router.post("/accounts/:account/connect", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.connectAccount(id)); }));
  router.post("/accounts/:account/disconnect", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } await services.disconnectAccount(id); sendData(response, {}); }));
  router.post("/accounts/:account/rate-limits/refresh", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.refreshRateLimits(id)); }));
  router.get("/accounts/:account/models", requireSession(services.sessions), asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.listModels(id)); }));
  router.get("/accounts/:account/threads", requireSession(services.sessions), asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.listThreads(id)); }));
  router.post("/accounts/:account/threads", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.startThread(id)); }));
  router.post("/accounts/:account/threads/:thread/move", ...securedMutation, asyncRoute(async (request, response) => { const source = account(request.params.account); const body = record(request.body); const target = account(body.targetAccountId); const settings = executionSettings(body.settings); if (!source || !target || source === target) { apiError(response, 400, "INVALID_REQUEST", "Choose a different known account"); return; } if (settings === null) { apiError(response, 400, "INVALID_REQUEST", "Invalid chat execution settings"); return; } sendData(response, await services.moveThreadToAccount(source, param(request.params.thread), target, settings)); }));
  router.get("/accounts/:account/threads/:thread", requireSession(services.sessions), asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } sendData(response, await services.readTranscript(id, param(request.params.thread))); }));
  router.post("/accounts/:account/threads/:thread/name", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const name = text(record(request.body).name, "name")?.trim(); if (!id || !name || name.length > 200) { apiError(response, 400, "INVALID_REQUEST", "A known account and chat name of at most 200 characters are required"); return; } await services.renameThread(id, param(request.params.thread), name); sendData(response, {}); }));
  router.post("/accounts/:account/threads/:thread/archive", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); if (!id) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } await services.archiveThread(id, param(request.params.thread)); sendData(response, {}); }));
  router.post("/accounts/:account/threads/:thread/turns", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const body = record(request.body); const value = text(body.text, "text"); const settings = executionSettings(body.settings); if (!id || !value) { apiError(response, 400, "INVALID_REQUEST", "A known account and text are required"); return; } if (settings === null) { apiError(response, 400, "INVALID_REQUEST", "Invalid chat execution settings"); return; } sendData(response, await services.startTurn(id, param(request.params.thread), { text: value, clientUserMessageId: text(body.clientUserMessageId, "clientUserMessageId"), ...(settings ? { settings } : {}) })); }));
  router.post("/accounts/:account/threads/:thread/steer", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const body = record(request.body); const value = text(body.text, "text"); const turnId = text(body.turnId, "turnId"); if (!id || !value || !turnId) { apiError(response, 400, "INVALID_REQUEST", "A known account, turnId, and text are required"); return; } await services.steerTurn(id, param(request.params.thread), { text: value, turnId, clientUserMessageId: text(body.clientUserMessageId, "clientUserMessageId") }); sendData(response, {}); }));
  router.post("/accounts/:account/threads/:thread/interrupt", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const turnId = text(record(request.body).turnId, "turnId"); if (!id || !turnId) { apiError(response, 400, "INVALID_REQUEST", "A known account and turnId are required"); return; } await services.interruptTurn(id, param(request.params.thread), { turnId }); sendData(response, {}); }));
  router.post("/accounts/:account/files/read", ...securedMutation, asyncRoute(async (request, response) => { const id = account(request.params.account); const path = text(record(request.body).path, "path"); if (!id || !path) { apiError(response, 400, "INVALID_REQUEST", "A known account and file path are required"); return; } sendData(response, await services.readMarkdown(id, path)); }));

  router.post("/tasks/:task/preview", ...securedMutation, asyncRoute(async (request, response) => { const body = record(request.body); const accountId = body.accountId === undefined ? undefined : account(body.accountId); const pass = body.pass === undefined ? undefined : manifestPass(body.pass); if (body.accountId !== undefined && !accountId) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } if (body.pass !== undefined && !pass) { apiError(response, 400, "INVALID_REQUEST", "Unknown worker pass"); return; } sendData(response, pass ? await services.previewLaunch(param(request.params.task), accountId, pass) : await services.previewLaunch(param(request.params.task), accountId)); }));
  router.post("/tasks/:task/launch", ...securedMutation, asyncRoute(async (request, response) => { const body = record(request.body); const accountId = body.accountId === undefined ? undefined : account(body.accountId); const prompt = body.prompt === undefined ? undefined : text(body.prompt, "prompt"); const settings = executionSettings(body.settings); const pass = body.pass === undefined ? undefined : manifestPass(body.pass); if (body.accountId !== undefined && !accountId) { apiError(response, 400, "INVALID_REQUEST", "Unknown account"); return; } if (body.pass !== undefined && !pass) { apiError(response, 400, "INVALID_REQUEST", "Unknown worker pass"); return; } if (body.prompt !== undefined && !prompt) { apiError(response, 400, "INVALID_REQUEST", "A non-empty prompt is required"); return; } if (settings === null) { apiError(response, 400, "INVALID_REQUEST", "Invalid chat execution settings"); return; } sendData(response, await services.launch(param(request.params.task), { accountId, prompt, ...(settings ? { settings } : {}), ...(pass ? { pass } : {}) })); }));
  router.post("/approvals/:approval", ...securedMutation, asyncRoute(async (request, response) => { const body = record(request.body); const decision = text(body.decision, "decision"); if (!decision) { apiError(response, 400, "INVALID_REQUEST", "An approval decision is required"); return; } await services.decideApproval(param(request.params.approval), { decision, permissions: record(body.permissions) }); sendData(response, {}); }));
  router.use((_request, response) => apiError(response, 404, "NOT_FOUND", "API route not found"));
  return router;
}
