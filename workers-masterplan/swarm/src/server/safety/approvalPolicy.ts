import { realpath as nodeRealpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { AccountId } from "../../shared/contracts.js";
import { clonePath } from "../codex/protocol.js";

export interface ApprovalRequest { method: string; params: Record<string, unknown>; }

/** Contexts are capabilities issued only for an account's fixed clone. */
export interface ApprovalContext { readonly account: AccountId; readonly workspaceRoot: string; }
const issuedContexts = new WeakSet<object>();

export interface ApprovalFilesystem { realpath(path: string): Promise<string>; }
const hostFilesystem: ApprovalFilesystem = { realpath: nodeRealpath };

export interface ApprovalClassification { outcome: "auto_accept" | "human_required" | "decline"; reason: string; targets: string[]; }
export type ApprovalChoice =
  | { kind: "accept" }
  | { kind: "decline" }
  | { kind: "cancel" }
  | { kind: "deny" }
  | { kind: "grant_turn"; permissions: Record<string, unknown> }
  | { kind: "grant_turn_strict"; permissions: Record<string, unknown> };

const V2_COMMAND = "item/commandExecution/requestApproval";
const V2_FILE = "item/fileChange/requestApproval";
const V2_PERMISSIONS = "item/permissions/requestApproval";
const LEGACY_COMMAND = "execCommandApproval";
const LEGACY_PATCH = "applyPatchApproval";

export function createApprovalContext(account: AccountId): ApprovalContext {
  const context = Object.freeze({ account, workspaceRoot: clonePath(account) });
  issuedContexts.add(context);
  return context;
}

/** This is intentionally a verifier, not an authority factory. */
export function validContext(context: unknown): context is ApprovalContext {
  return typeof context === "object" && context !== null && issuedContexts.has(context);
}

function requireContext(context: unknown): ApprovalContext {
  if (!validContext(context)) throw new Error("Approval context must be created by the coordinator");
  if (context.workspaceRoot !== clonePath(context.account)) throw new Error("Approval context is not bound to its account clone");
  return context;
}

function contained(root: string, target: string): boolean {
  if (root === target) return true;
  const path = relative(root, target);
  return path !== "" && !path.startsWith("..") && !isAbsolute(path);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function pathIsAmbiguous(path: string): boolean {
  return !path || path.includes("\0") || /[*?\[\]{}]/.test(path) || path.startsWith("~") || path.startsWith("file:");
}

async function canonicalCloneRoot(context: ApprovalContext, filesystem: ApprovalFilesystem): Promise<string> {
  const expected = clonePath(context.account);
  const canonical = await filesystem.realpath(expected);
  if (canonical !== expected) throw new Error("Assigned clone root must not be a symlink");
  return canonical;
}

async function provenTarget(root: string, candidate: string, filesystem: ApprovalFilesystem): Promise<string | undefined> {
  if (pathIsAmbiguous(candidate)) return undefined;
  const lexical = resolve(root, candidate);
  if (!contained(root, lexical)) return undefined;
  try {
    const canonical = await filesystem.realpath(lexical);
    return canonical === lexical && contained(root, canonical) ? canonical : undefined;
  } catch { return undefined; }
}

function human(reason: string, targets: string[] = []): ApprovalClassification { return { outcome: "human_required", reason, targets }; }
function dangerous(command: string): boolean {
  return /(?:^|\s)(?:diskutil|fdisk|newfs|dscl|launchctl|sudo|chmod\s+[-+]?R|chown\s+-R)(?:\s|$)/i.test(command)
    || /(?:^|\s)rm\s+-[^\n]*r[^\n]*(?:\s+\/|\s+~\/|\s+\/Users(?:\/|\s|$))/i.test(command)
    || /~\/(?:\.ssh|\.codex|\.gitconfig|\.zshrc|\.bashrc)(?:\/|\s|$)/i.test(command);
}
function isAmbiguousShell(command: string): boolean { return /(?:&&|\|\||[|;`]|\$\(|\*|\?|\[|\]|\{\}|\b(?:sh|bash|zsh|fish|python|python3|node|perl|ruby)\b)/i.test(command); }
function exactCommand(params: Record<string, unknown>): string | undefined {
  if (typeof params.command === "string") return params.command;
  if (Array.isArray(params.command) && params.command.every((part) => typeof part === "string")) return (params.command as string[]).join(" ");
  return undefined;
}

async function classifyCommand(params: Record<string, unknown>, root: string, filesystem: ApprovalFilesystem): Promise<ApprovalClassification> {
  const command = exactCommand(params);
  const cwd = typeof params.cwd === "string" ? await provenTarget(root, params.cwd, filesystem) : undefined;
  if (!command || !cwd) return human("Command or working directory cannot be proven inside the assigned clone");
  if (dangerous(command)) return human("Command targets a dangerous system, home, or cross-account location", [cwd]);
  if (isAmbiguousShell(command)) return human("Compound, globbed, or interpreter command cannot be positively contained", [cwd]);
  if ((command === "git pull" || command === "git push") && cwd === root) return { outcome: "auto_accept", reason: "Exact Git transport in enforced clone", targets: [root] };
  const remove = /^rm\s+-rf\s+([^\s]+)$/.exec(command);
  if (remove) {
    const target = await provenTarget(root, remove[1], filesystem);
    if (!target) return human("Deletion target cannot be realpath-proven inside the assigned clone", [cwd]);
    return { outcome: "auto_accept", reason: "Realpath-proven clone-contained deletion", targets: [target] };
  }
  return human("Command is not an exact containment-proven allowlisted operation", [cwd]);
}

async function classifyPatch(params: Record<string, unknown>, root: string, filesystem: ApprovalFilesystem): Promise<ApprovalClassification> {
  const changes = record(params.fileChanges);
  if (!changes) return human("Patch targets are unavailable for containment proof");
  const targets: string[] = [];
  for (const path of Object.keys(changes)) {
    const target = await provenTarget(root, path, filesystem);
    if (!target) return human("Patch target cannot be realpath-proven inside the assigned clone", targets);
    targets.push(target);
  }
  if (targets.length === 0) return human("Patch has no explicit clone-contained targets");
  return { outcome: "auto_accept", reason: "All patch targets are realpath-proven inside the assigned clone", targets };
}

/** Conservative classifier: only complete, literal, clone-contained operations are automatic. */
export async function classifyApproval(request: ApprovalRequest, context: ApprovalContext, filesystem: ApprovalFilesystem = hostFilesystem): Promise<ApprovalClassification> {
  const root = await canonicalCloneRoot(requireContext(context), filesystem);
  switch (request.method) {
    case V2_COMMAND:
    case LEGACY_COMMAND: return classifyCommand(request.params, root, filesystem);
    case V2_FILE:
    case LEGACY_PATCH: return classifyPatch(request.params, root, filesystem);
    case V2_PERMISSIONS: return human("Permissions grants require a method-specific human decision");
    default: return { outcome: "decline", reason: "Unknown app-server approval method", targets: [] };
  }
}

async function canonicalPathSet(value: unknown, root: string, label: string, filesystem: ApprovalFilesystem): Promise<string[]> {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) throw new Error(`Permission ${label} must be a string array`);
  const canonical: string[] = [];
  for (const raw of value) {
    if (pathIsAmbiguous(raw)) throw new Error(`Permission ${label} has an ambiguous path`);
    const lexical = resolve(root, raw);
    if (!contained(root, lexical)) throw new Error(`Permission ${label} is outside the assigned clone`);
    let actual: string;
    try { actual = await filesystem.realpath(lexical); } catch { throw new Error(`Permission ${label} target does not exist`); }
    if (actual !== lexical || !contained(root, actual)) throw new Error(`Permission ${label} path is a symlink or escapes the assigned clone`);
    canonical.push(actual);
  }
  return [...new Set(canonical)];
}

/**
 * Pure canonicalization seam for tests and callers that only need validation.
 * It cannot mint approval authority or serialize a response without a real context.
 */
export async function canonicalizeFilesystemGrant(requested: unknown, grant: unknown, root: string, filesystem: ApprovalFilesystem = hostFilesystem): Promise<Record<string, unknown>> {
  const requestedFileSystem = record(requested);
  const grantFileSystem = record(grant);
  if (!requestedFileSystem || !grantFileSystem) throw new Error("File-system permission request or grant is malformed");
  if (Object.keys(requestedFileSystem).some((key) => key !== "read" && key !== "write") || Object.keys(grantFileSystem).some((key) => key !== "read" && key !== "write")) {
    throw new Error("File-system permission uses unsupported entries");
  }
  const result: Record<string, unknown> = {};
  for (const mode of ["read", "write"] as const) {
    if (grantFileSystem[mode] === undefined) continue;
    const requestedPaths = await canonicalPathSet(requestedFileSystem[mode], root, mode, filesystem);
    const grantedPaths = await canonicalPathSet(grantFileSystem[mode], root, mode, filesystem);
    if (!grantedPaths.every((path) => requestedPaths.includes(path))) throw new Error(`Permission grant ${mode} was not requested`);
    result[mode] = grantedPaths;
  }
  if (Object.keys(result).length === 0) throw new Error("File-system permission grant is empty");
  return result;
}

async function validatePermissionGrant(request: ApprovalRequest, choice: Extract<ApprovalChoice, { kind: "grant_turn" | "grant_turn_strict" }>, context: ApprovalContext, filesystem: ApprovalFilesystem): Promise<Record<string, unknown>> {
  const root = await canonicalCloneRoot(requireContext(context), filesystem);
  const requested = record(request.params.permissions);
  const grant = record(choice.permissions);
  if (!requested || !grant || Object.keys(grant).some((key) => key !== "network" && key !== "fileSystem")) throw new Error("Permission grant contains unsupported capabilities");
  const permissions: Record<string, unknown> = {};
  if (grant.network !== undefined) {
    const requestedNetwork = record(requested.network);
    const network = record(grant.network);
    if (!requestedNetwork || !network || Object.keys(network).some((key) => key !== "enabled") || network.enabled !== true || requestedNetwork.enabled !== true) throw new Error("Network permission grant was not requested");
    permissions.network = { enabled: true };
  }
  if (grant.fileSystem !== undefined) permissions.fileSystem = await canonicalizeFilesystemGrant(requested.fileSystem, grant.fileSystem, root, filesystem);
  if (Object.keys(permissions).length === 0) throw new Error("Permission grant is empty");
  return permissions;
}

/** Builds an installed-v2/legacy method-specific response after final permission revalidation. */
export async function buildApprovalResponse(request: ApprovalRequest, choice: ApprovalChoice, context?: ApprovalContext, filesystem: ApprovalFilesystem = hostFilesystem): Promise<Record<string, unknown>> {
  switch (request.method) {
    case V2_COMMAND:
    case V2_FILE:
      if (choice.kind === "accept" || choice.kind === "decline" || choice.kind === "cancel") return { decision: choice.kind };
      throw new Error("This approval method does not accept permission grants");
    case V2_PERMISSIONS:
      if (choice.kind === "deny") return { permissions: {}, scope: "turn" };
      if ((choice.kind !== "grant_turn" && choice.kind !== "grant_turn_strict") || !context) throw new Error("Permissions approvals require an explicit turn-scoped grant and bound context");
      return { permissions: await validatePermissionGrant(request, choice, context, filesystem), scope: "turn", ...(choice.kind === "grant_turn_strict" ? { strictAutoReview: true } : {}) };
    case LEGACY_COMMAND:
    case LEGACY_PATCH:
      if (choice.kind === "accept") return { decision: "approved" };
      if (choice.kind === "cancel") return { decision: "abort" };
      if (choice.kind === "decline") return { decision: "denied" };
      throw new Error("Legacy approvals do not accept permission grants");
    default: throw new Error("Unknown app-server approval method");
  }
}
