import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { AccountId } from "../../shared/contracts.js";
import { clonePath } from "../codex/protocol.js";

export interface ApprovalRequest {
  method: string;
  params: Record<string, unknown>;
}

const approvalContextBrand = Symbol("ApprovalContext");

export interface ApprovalContext {
  account: AccountId;
  workspaceRoot: string;
  readonly [approvalContextBrand]: true;
}

export interface ApprovalClassification {
  outcome: "auto_accept" | "human_required" | "decline";
  reason: string;
  targets: string[];
}

export type ApprovalChoice =
  | { kind: "accept" }
  | { kind: "decline" }
  | { kind: "cancel" }
  | { kind: "grant"; permissions: Record<string, unknown>; scope: "turn" | "session"; strictAutoReview?: boolean };

const V2_COMMAND = "item/commandExecution/requestApproval";
const V2_FILE = "item/fileChange/requestApproval";
const V2_PERMISSIONS = "item/permissions/requestApproval";
const LEGACY_COMMAND = "execCommandApproval";
const LEGACY_PATCH = "applyPatchApproval";

export function createApprovalContext(account: AccountId): ApprovalContext {
  return { account, workspaceRoot: clonePath(account), [approvalContextBrand]: true };
}

/** Test-only factory for temporary, realpath-resolved fixture workspaces. */
export function createTestApprovalContext(account: AccountId, workspaceRoot: string): ApprovalContext {
  return { account, workspaceRoot, [approvalContextBrand]: true };
}

function validContext(context: ApprovalContext): ApprovalContext {
  if (!context || context[approvalContextBrand] !== true) throw new Error("Approval context must be created by the coordinator");
  return context;
}

function contained(root: string, target: string): boolean {
  if (root === target) return true;
  const path = relative(root, target);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

async function provenTarget(root: string, candidate: string): Promise<string | undefined> {
  const resolved = resolve(root, candidate);
  if (!contained(root, resolved)) return undefined;
  try {
    const actual = await realpath(resolved);
    return contained(root, actual) ? actual : undefined;
  } catch {
    return undefined;
  }
}

function human(reason: string, targets: string[] = []): ApprovalClassification {
  return { outcome: "human_required", reason, targets };
}

function dangerous(command: string): boolean {
  return /(?:^|\s)(?:diskutil|fdisk|newfs|dscl|launchctl|sudo|chmod\s+[-+]?R|chown\s+-R)(?:\s|$)/i.test(command)
    || /(?:^|\s)rm\s+-[^\n]*r[^\n]*(?:\s+\/|\s+~\/|\s+\/Users(?:\/|\s|$))/i.test(command)
    || /~\/(?:\.ssh|\.codex|\.gitconfig|\.zshrc|\.bashrc)(?:\/|\s|$)/i.test(command);
}

function isAmbiguousShell(command: string): boolean {
  return /(?:&&|\|\||[|;`]|\$\(|\*|\?|\[|\]|\{\}|\b(?:sh|bash|zsh|fish|python|python3|node|perl|ruby)\b)/i.test(command);
}

function exactLegacyCommand(params: Record<string, unknown>): string | undefined {
  if (typeof params.command === "string") return params.command;
  if (Array.isArray(params.command) && params.command.every((part) => typeof part === "string")) return (params.command as string[]).join(" ");
  return undefined;
}

async function classifyCommand(params: Record<string, unknown>, root: string, canAutoAccept: boolean): Promise<ApprovalClassification> {
  const command = exactLegacyCommand(params);
  const cwd = typeof params.cwd === "string" ? await provenTarget(root, params.cwd) : undefined;
  if (!command || !cwd) return human("Command or working directory cannot be proven inside the assigned clone");
  if (dangerous(command)) return human("Command targets a dangerous system, home, or cross-account location", [cwd]);
  if (isAmbiguousShell(command)) return human("Compound, globbed, or interpreter command cannot be positively contained", [cwd]);

  if ((command === "git pull" || command === "git push") && cwd === root) {
    if (canAutoAccept) return { outcome: "auto_accept", reason: "Exact Git transport in enforced clone", targets: [root] };
    return human("Stable v2 has no per-request offered decision metadata, so automatic acceptance is disabled", [root]);
  }

  const remove = /^rm\s+-rf\s+([^\s]+)$/.exec(command);
  if (remove) {
    const target = await provenTarget(root, remove[1]);
    if (!target) return human("Deletion target cannot be realpath-proven inside the assigned clone", [cwd]);
    if (canAutoAccept) return { outcome: "auto_accept", reason: "Realpath-proven clone-contained deletion", targets: [target] };
    return human("Stable v2 has no per-request offered decision metadata, so automatic acceptance is disabled", [target]);
  }

  return human("Command is not an exact containment-proven allowlisted operation", [cwd]);
}

async function classifyPatch(params: Record<string, unknown>, root: string): Promise<ApprovalClassification> {
  const changes = params.fileChanges;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return human("Patch targets are unavailable for containment proof");
  const targets: string[] = [];
  for (const path of Object.keys(changes as Record<string, unknown>)) {
    const target = await provenTarget(root, path);
    if (!target) return human("Patch target cannot be realpath-proven inside the assigned clone", targets);
    targets.push(target);
  }
  if (targets.length === 0) return human("Patch has no explicit clone-contained targets");
  return { outcome: "auto_accept", reason: "All patch targets are realpath-proven inside the assigned clone", targets };
}

/** Conservative approval classifier. It authorizes only operations whose complete targets are proven. */
export async function classifyApproval(request: ApprovalRequest, context: ApprovalContext): Promise<ApprovalClassification> {
  const root = await realpath(validContext(context).workspaceRoot);
  switch (request.method) {
    case V2_COMMAND:
      return classifyCommand(request.params, root, false);
    case LEGACY_COMMAND:
      return classifyCommand(request.params, root, true);
    case LEGACY_PATCH:
      return classifyPatch(request.params, root);
    case V2_FILE:
      return human("V2 file-change request lacks an explicit realpath-proven target set");
    case V2_PERMISSIONS:
      return human("Permissions grants require a method-specific human decision");
    default:
      return { outcome: "decline", reason: "Unknown app-server approval method", targets: [] };
  }
}

function v2Decision(choice: Extract<ApprovalChoice, { kind: "accept" | "decline" | "cancel" }>): { decision: "decline" | "cancel" } {
  if (choice.kind === "accept") throw new Error("Stable v2 does not expose a per-request offered accept decision");
  return { decision: choice.kind };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function requestedPathSubset(value: unknown, requested: unknown, root: string, label: string): string[] {
  if (!Array.isArray(value) || !value.every((path) => typeof path === "string")) throw new Error(`Permission grant ${label} must be a string array`);
  if (!Array.isArray(requested) || !requested.every((path) => typeof path === "string")) throw new Error(`Requested permission ${label} is malformed`);
  const requestedPaths = requested as string[];
  return value.map((path) => {
    const resolved = resolve(root, path);
    if (!contained(root, resolved)) throw new Error(`Permission grant ${label} is outside the assigned clone`);
    if (!requestedPaths.some((requestedPath) => resolve(root, requestedPath) === resolved)) {
      throw new Error(`Permission grant ${label} was not requested`);
    }
    return path;
  });
}

function validatePermissionGrant(request: ApprovalRequest, choice: Extract<ApprovalChoice, { kind: "grant" }>, context: ApprovalContext): Record<string, unknown> {
  if (choice.scope !== "turn") throw new Error("Session-scoped permission grants are not permitted");
  const root = validContext(context).workspaceRoot;
  const requested = record(request.params.permissions);
  const grant = record(choice.permissions);
  if (!requested || !grant) throw new Error("Permission request or grant is malformed");
  if (Object.keys(grant).some((key) => key !== "network" && key !== "fileSystem")) throw new Error("Permission grant contains unsupported capabilities");
  const permissions: Record<string, unknown> = {};

  if (grant.network !== undefined) {
    const requestedNetwork = record(requested.network);
    const network = record(grant.network);
    if (!requestedNetwork || !network || Object.keys(network).some((key) => key !== "enabled") || network.enabled !== true || requestedNetwork.enabled !== true) {
      throw new Error("Network permission grant was not requested");
    }
    permissions.network = { enabled: true };
  }

  if (grant.fileSystem !== undefined) {
    const requestedFileSystem = record(requested.fileSystem);
    const fileSystem = record(grant.fileSystem);
    if (!requestedFileSystem || !fileSystem || Object.keys(fileSystem).some((key) => key !== "read" && key !== "write")) {
      throw new Error("File-system permission grant is malformed or unsupported");
    }
    const grantedFileSystem: Record<string, unknown> = {};
    if (fileSystem.read !== undefined) grantedFileSystem.read = requestedPathSubset(fileSystem.read, requestedFileSystem.read, root, "read");
    if (fileSystem.write !== undefined) grantedFileSystem.write = requestedPathSubset(fileSystem.write, requestedFileSystem.write, root, "write");
    if (Object.keys(grantedFileSystem).length === 0) throw new Error("File-system permission grant is empty");
    permissions.fileSystem = grantedFileSystem;
  }

  if (Object.keys(permissions).length === 0) throw new Error("Permission grant is empty");
  return permissions;
}

/** Builds the exact response value required by the specified v2 or legacy request method. */
export function buildApprovalResponse(request: ApprovalRequest, choice: ApprovalChoice, context?: ApprovalContext): Record<string, unknown> {
  switch (request.method) {
    case V2_COMMAND:
    case V2_FILE:
      if (choice.kind === "grant") throw new Error("This approval method does not accept permission grants");
      return v2Decision(choice);
    case V2_PERMISSIONS:
      if (choice.kind !== "grant") throw new Error("Permissions approvals require explicit permissions and scope");
      if (!context) throw new Error("Permissions approvals require a bound approval context");
      return { permissions: validatePermissionGrant(request, choice, context), scope: "turn", ...(choice.strictAutoReview ? { strictAutoReview: true } : {}) };
    case LEGACY_COMMAND:
    case LEGACY_PATCH:
      if (choice.kind === "accept") return { decision: "approved" };
      if (choice.kind === "cancel") return { decision: "abort" };
      if (choice.kind === "decline") return { decision: "denied" };
      throw new Error("Legacy approvals do not accept permission grants");
    default:
      throw new Error("Unknown app-server approval method");
  }
}
