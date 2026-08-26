import type { AccountId } from "../../shared/contracts.js";

/** The Codex app-server wire protocol deliberately omits a JSON-RPC version field. */
export type AppServerId = number | string;

export interface AppServerRequest {
  id: AppServerId;
  method: string;
  params?: unknown;
  /** Opaque tracing context sent by the app-server; the coordinator does not synthesize it. */
  trace?: unknown;
}

export interface AppServerNotification {
  method: string;
  params?: unknown;
}

export interface AppServerSuccessResponse {
  id: AppServerId;
  result: unknown;
}

export interface AppServerErrorResponse {
  id: AppServerId;
  error: { code: number; message: string; data?: unknown };
}

export type AppServerResponse = AppServerSuccessResponse | AppServerErrorResponse;
export type AppServerInbound = AppServerRequest | AppServerNotification | AppServerResponse;

/** Coordinator-local telemetry. It is never an app-server wire message. */
export interface ProtocolDiagnostic {
  method: string;
  params: unknown;
}

export const APP_SERVER_METHODS = [
  "initialize",
  "account/read",
  "account/rateLimits/read",
  "thread/list",
  "thread/read",
  "thread/start",
  "thread/resume",
  "thread/archive",
  "thread/name/set",
  "turn/start",
  "turn/steer",
  "turn/interrupt",
  "fs/readFile",
] as const;

export type AppServerMethod = (typeof APP_SERVER_METHODS)[number];

export const APPROVAL_METHODS = [
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "execCommandApproval",
  "applyPatchApproval",
] as const;

export type ApprovalMethod = (typeof APPROVAL_METHODS)[number];

export function isApprovalMethod(method: string): method is ApprovalMethod {
  return (APPROVAL_METHODS as readonly string[]).includes(method);
}

/** Method-compatible timeout/error response; a selected human denial is built separately. */
export function safeApprovalDecline(method: ApprovalMethod): Record<string, unknown> {
  switch (method) {
    case "item/commandExecution/requestApproval":
    case "item/fileChange/requestApproval":
      return { decision: "cancel" };
    case "item/permissions/requestApproval":
      return { permissions: {}, scope: "turn", strictAutoReview: true };
    case "execCommandApproval":
    case "applyPatchApproval":
      return { decision: "timed_out" };
  }
}

/** Stable v2 server notifications consumed by the coordinator transport. */
export const APP_SERVER_NOTIFICATION_METHODS = new Set<string>([
  "error", "thread/started", "thread/status/changed", "thread/archived", "thread/deleted", "thread/unarchived", "thread/closed",
  "skills/changed", "thread/name/updated", "thread/goal/updated", "thread/goal/cleared", "thread/settings/updated", "thread/tokenUsage/updated",
  "turn/started", "hook/started", "turn/completed", "hook/completed", "turn/diff/updated", "turn/plan/updated", "item/started",
  "item/autoApprovalReview/started", "item/autoApprovalReview/completed", "item/completed", "rawResponseItem/completed",
  "item/agentMessage/delta", "item/plan/delta", "command/exec/outputDelta", "process/outputDelta", "process/exited",
  "item/commandExecution/outputDelta", "item/commandExecution/terminalInteraction", "item/fileChange/outputDelta", "item/fileChange/patchUpdated",
  "serverRequest/resolved", "item/mcpToolCall/progress", "mcpServer/oauthLogin/completed", "mcpServer/startupStatus/updated",
  "account/updated", "account/rateLimits/updated", "app/list/updated", "remoteControl/status/changed", "externalAgentConfig/import/progress",
  "externalAgentConfig/import/completed", "fs/changed", "item/reasoning/summaryTextDelta", "item/reasoning/summaryPartAdded",
  "item/reasoning/textDelta", "thread/compacted", "model/rerouted", "model/verification", "turn/moderationMetadata",
  "model/safetyBuffering/updated", "warning", "guardianWarning", "deprecationNotice", "configWarning", "fuzzyFileSearch/sessionUpdated",
  "fuzzyFileSearch/sessionCompleted", "thread/realtime/started", "thread/realtime/itemAdded", "thread/realtime/transcript/delta",
  "thread/realtime/transcript/done", "thread/realtime/outputAudio/delta", "thread/realtime/sdp", "thread/realtime/error",
  "thread/realtime/closed", "windows/worldWritableWarning", "windowsSandbox/setupCompleted", "account/login/completed",
]);

export interface SafeTurnSandboxPolicy {
  type: "workspaceWrite";
  writableRoots: [string];
  networkAccess: true;
  excludeTmpdirEnvVar: true;
  excludeSlashTmp: true;
}

export interface SafeThreadSettings {
  cwd: string;
  approvalPolicy: "untrusted";
  approvalsReviewer: "user";
  sandbox: "workspace-write";
}

export interface SafeTurnSettings {
  cwd: string;
  approvalPolicy: "untrusted";
  approvalsReviewer: "user";
  sandboxPolicy: SafeTurnSandboxPolicy;
}

export function clonePath(account: AccountId): string {
  return `/Users/${account}/Dev/EdenMind`;
}

export function safeThreadSettings(account: AccountId): SafeThreadSettings {
  const cwd = clonePath(account);
  return { cwd, approvalPolicy: "untrusted", approvalsReviewer: "user", sandbox: "workspace-write" };
}

export function safeTurnSettings(account: AccountId): SafeTurnSettings {
  const cwd = clonePath(account);
  return {
    cwd,
    approvalPolicy: "untrusted",
    approvalsReviewer: "user",
    sandboxPolicy: {
      type: "workspaceWrite",
      writableRoots: [cwd],
      networkAccess: true,
      excludeTmpdirEnvVar: true,
      excludeSlashTmp: true,
    },
  };
}

function isAppServerId(value: unknown): value is AppServerId {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value));
}

function hasOwn(message: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(message, key);
}

export function isAppServerObject(message: unknown): message is Record<string, unknown> {
  return message !== null && typeof message === "object" && !Array.isArray(message);
}

function isAppServerError(value: unknown): value is AppServerErrorResponse["error"] {
  return isAppServerObject(value)
    && typeof value.code === "number"
    && Number.isFinite(value.code)
    && typeof value.message === "string";
}

export function isAppServerResponse(message: unknown): message is AppServerResponse {
  if (!isAppServerObject(message) || !isAppServerId(message.id) || typeof message.method === "string") return false;
  const hasResult = hasOwn(message, "result");
  const hasError = hasOwn(message, "error");
  return (hasResult && !hasError) || (!hasResult && hasError && isAppServerError(message.error));
}

export function isAppServerRequest(message: unknown): message is AppServerRequest {
  return isAppServerObject(message)
    && isAppServerId(message.id)
    && typeof message.method === "string"
    && !hasOwn(message, "result")
    && !hasOwn(message, "error");
}

export function isAppServerNotification(message: unknown): message is AppServerNotification {
  return isAppServerObject(message)
    && !hasOwn(message, "id")
    && typeof message.method === "string"
    && !hasOwn(message, "result")
    && !hasOwn(message, "error");
}
