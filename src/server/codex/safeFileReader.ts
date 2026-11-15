import { realpath } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import type { AccountId, CodexAccountSlot } from "../../shared/contracts.js";
import { clonePath } from "./protocol.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface MarkdownFileClient {
  readFile(path: string): Promise<{ dataBase64: string }>;
}

export interface ReadWorkspaceMarkdownInput {
  account: AccountId;
  requestedPath: string;
  appServer: MarkdownFileClient;
  /** Validated profile metadata required whenever the account is a logical profile. */
  slot?: CodexAccountSlot;
  /** Coordinator-owned root for the direct local account; bots use their assigned clone. */
  workspaceRoot?: string;
}

function contained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path !== "" && !path.startsWith("..") && !path.includes(`..${process.platform === "win32" ? "\\" : "/"}`) && !resolve(root, path).startsWith("..");
}

function decodeBase64(value: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("App-server returned malformed base64 content");
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) throw new Error("App-server returned malformed base64 content");
  return decoded;
}

/** Reads only a realpath-proven workspace file through the owning app-server. */
export async function readWorkspaceMarkdown(input: ReadWorkspaceMarkdownInput): Promise<{ path: string; filename: string; text: string }> {
  if (input.slot && input.slot.id !== input.account) throw new Error("Profile slot does not match requested account");
  const configuredRoot = input.slot?.workspaceRoot ?? input.workspaceRoot ?? clonePath(input.account);
  const root = await realpath(configuredRoot);
  const requested = resolve(root, input.requestedPath);
  if (!contained(root, requested)) throw new Error("FILE_OUTSIDE_WORKSPACE: requested path is outside workspace");
  const target = await realpath(requested);
  if (!contained(root, target)) throw new Error("FILE_OUTSIDE_WORKSPACE: resolved path is outside workspace");

  const response = await input.appServer.readFile(target);
  // fs/readFile accepts only a path today. Recheck after the remote read to
  // detect pathname replacement; descriptor-safe no-follow reads require an
  // app-server protocol extension and remain the only residual race window.
  const targetAfterRead = await realpath(requested);
  if (targetAfterRead !== target || !contained(root, targetAfterRead)) {
    throw new Error("FILE_OUTSIDE_WORKSPACE: file changed outside workspace during read");
  }
  const bytes = decodeBase64(response.dataBase64);
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("File exceeds the two MiB limit");
  return { path: target, filename: basename(target), text: bytes.toString("utf8") };
}
