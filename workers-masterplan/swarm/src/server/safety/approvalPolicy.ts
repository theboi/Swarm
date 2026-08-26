import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { AccountId } from "../../shared/contracts.js";

export interface ApprovalRequest {
  method: string;
  params: Record<string, unknown>;
}

export interface ApprovalContext {
  account: AccountId;
  workspaceRoot: string;
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

function offered(params: Record<string, unknown>, decision: string): boolean {
  return Array.isArray(params.availableDecisions) && params.availableDecisions.includes(decision);
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

async function classifyCommand(params: Record<string, unknown>, root: string): Promise<ApprovalClassification> {
  const command = exactLegacyCommand(params);
  const cwd = typeof params.cwd === "string" ? await provenTarget(root, params.cwd) : undefined;
  if (!command || !cwd) return human("Command or working directory cannot be proven inside the assigned clone");
  if (dangerous(command)) return human("Command targets a dangerous system, home, or cross-account location", [cwd]);
  if (isAmbiguousShell(command)) return human("Compound, globbed, or interpreter command cannot be positively contained", [cwd]);

  if ((command === "git pull" || command === "git push") && cwd === root) {
    if (!Array.isArray(params.availableDecisions) || offered(params, "accept")) return { outcome: "auto_accept", reason: "Exact Git transport in enforced clone", targets: [root] };
    return human("Safe accept decision is not offered by the protocol", [root]);
  }

  const remove = /^rm\s+-rf\s+([^\s]+)$/.exec(command);
  if (remove) {
    const target = await provenTarget(root, remove[1]);
    if (!target) return human("Deletion target cannot be realpath-proven inside the assigned clone", [cwd]);
    if (!Array.isArray(params.availableDecisions) || offered(params, "accept")) return { outcome: "auto_accept", reason: "Realpath-proven clone-contained deletion", targets: [target] };
    return human("Safe accept decision is not offered by the protocol", [target]);
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
  const root = await realpath(context.workspaceRoot);
  switch (request.method) {
    case V2_COMMAND:
    case LEGACY_COMMAND:
      return classifyCommand(request.params, root);
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

function v2Decision(params: Record<string, unknown>, choice: Extract<ApprovalChoice, { kind: "accept" | "decline" | "cancel" }>): { decision: string } {
  const decision = choice.kind;
  // Codex 0.146 omits this field entirely. When present, it is authoritative;
  // when absent, the v2 method's generated response union is the fixed allowlist.
  if (Array.isArray(params.availableDecisions) && !offered(params, decision)) {
    throw new Error(`Decision ${decision} is not offered by this app-server request`);
  }
  return { decision };
}

/** Builds the exact response value required by the specified v2 or legacy request method. */
export function buildApprovalResponse(request: ApprovalRequest, choice: ApprovalChoice): Record<string, unknown> {
  switch (request.method) {
    case V2_COMMAND:
    case V2_FILE:
      if (choice.kind === "grant") throw new Error("This approval method does not accept permission grants");
      return v2Decision(request.params, choice);
    case V2_PERMISSIONS:
      if (choice.kind !== "grant") throw new Error("Permissions approvals require explicit permissions and scope");
      return { permissions: choice.permissions, scope: choice.scope, ...(choice.strictAutoReview ? { strictAutoReview: true } : {}) };
    case LEGACY_COMMAND:
    case LEGACY_PATCH:
      if (choice.kind === "accept") return { decision: "approved" };
      if (choice.kind === "cancel") return { decision: "abort" };
      if (choice.kind === "decline") return { decision: { denied: { rejection: "Declined by coordinator safety policy" } } };
      throw new Error("Legacy approvals do not accept permission grants");
    default:
      throw new Error("Unknown app-server approval method");
  }
}
