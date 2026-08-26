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

export interface SafeTurnSandboxPolicy {
  type: "workspaceWrite";
  writableRoots: [string];
  networkAccess: true;
  excludeTmpdirEnvVar: true;
  excludeSlashTmp: true;
}

export interface SafeThreadSettings {
  cwd: string;
  runtimeWorkspaceRoots: [string];
  approvalPolicy: "untrusted";
  approvalsReviewer: "user";
  sandbox: "workspace-write";
}

export interface SafeTurnSettings {
  cwd: string;
  runtimeWorkspaceRoots: [string];
  approvalPolicy: "untrusted";
  approvalsReviewer: "user";
  sandboxPolicy: SafeTurnSandboxPolicy;
}

export function clonePath(account: AccountId): string {
  return `/Users/${account}/Dev/EdenMind`;
}

export function safeThreadSettings(account: AccountId): SafeThreadSettings {
  const cwd = clonePath(account);
  return { cwd, runtimeWorkspaceRoots: [cwd], approvalPolicy: "untrusted", approvalsReviewer: "user", sandbox: "workspace-write" };
}

export function safeTurnSettings(account: AccountId): SafeTurnSettings {
  const cwd = clonePath(account);
  return {
    cwd,
    runtimeWorkspaceRoots: [cwd],
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

export function isJsonRpcResponse(message: JsonRpcInbound): message is JsonRpcResponse {
  return "id" in message && !("method" in message);
}

export function isJsonRpcRequest(message: JsonRpcInbound): message is JsonRpcRequest {
  return "id" in message && "method" in message;
}
