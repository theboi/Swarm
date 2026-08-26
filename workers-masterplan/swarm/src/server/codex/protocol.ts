import type { AccountId } from "../../shared/contracts.js";

export type JsonRpcId = number | string;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type JsonRpcInbound = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

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

/** Method-compatible no-grant response for a failed or timed-out approval path. */
export function safeApprovalDecline(method: ApprovalMethod): Record<string, unknown> {
  switch (method) {
    case "item/commandExecution/requestApproval":
    case "item/fileChange/requestApproval":
      return { decision: "cancel" };
    case "item/permissions/requestApproval":
      return { permissions: {}, scope: "turn", strictAutoReview: true };
    case "execCommandApproval":
      return { decision: "timed_out" };
    case "applyPatchApproval":
      return { decision: "denied" };
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

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === "string" || typeof value === "number";
}

export function isJsonRpcObject(message: unknown): message is Record<string, unknown> {
  return message !== null && typeof message === "object" && !Array.isArray(message);
}

export function isJsonRpcResponse(message: unknown): message is JsonRpcResponse {
  return isJsonRpcObject(message) && message.jsonrpc === "2.0" && isJsonRpcId(message.id) && typeof message.method !== "string";
}

export function isJsonRpcRequest(message: unknown): message is JsonRpcRequest {
  return isJsonRpcObject(message) && message.jsonrpc === "2.0" && isJsonRpcId(message.id) && typeof message.method === "string";
}

export function isJsonRpcNotification(message: unknown): message is JsonRpcNotification {
  return isJsonRpcObject(message) && message.jsonrpc === "2.0" && !("id" in message) && typeof message.method === "string";
}
