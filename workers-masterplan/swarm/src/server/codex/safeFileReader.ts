import { realpath } from "node:fs/promises";
import { basename, extname, relative, resolve } from "node:path";
import type { AccountId } from "../../shared/contracts.js";
import { clonePath } from "./protocol.js";

const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024;

export interface MarkdownFileClient {
  readFile(path: string): Promise<{ dataBase64: string }>;
}

export interface ReadWorkspaceMarkdownInput {
  account: AccountId;
  requestedPath: string;
  appServer: MarkdownFileClient;
  /** Coordinator-owned root for the direct local account; bots use their assigned clone. */
  workspaceRoot?: string;
}

function contained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path !== "" && !path.startsWith("..") && !path.includes(`..${process.platform === "win32" ? "\\" : "/"}`) && !resolve(root, path).startsWith("..");
}

function markdownPath(path: string): boolean {
  const extension = extname(path).toLowerCase();
  return extension === ".md" || extension === ".markdown";
}

function decodeBase64(value: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("App-server returned malformed base64 content");
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) throw new Error("App-server returned malformed base64 content");
  return decoded;
}

/** Reads only a realpath-proven Markdown file through the owning app-server. */
export async function readWorkspaceMarkdown(input: ReadWorkspaceMarkdownInput): Promise<{ path: string; filename: string; text: string }> {
  const configuredRoot = input.workspaceRoot ?? clonePath(input.account);
  const root = await realpath(configuredRoot);
  const requested = resolve(root, input.requestedPath);
  if (!contained(root, requested)) throw new Error("FILE_OUTSIDE_WORKSPACE: requested path is outside workspace");
  if (!markdownPath(requested)) throw new Error("Only Markdown files may be read");
  const target = await realpath(requested);
  if (!contained(root, target)) throw new Error("FILE_OUTSIDE_WORKSPACE: resolved path is outside workspace");
  if (!markdownPath(target)) throw new Error("Only Markdown files may be read");

  const response = await input.appServer.readFile(target);
  // fs/readFile accepts only a path today. Recheck after the remote read to
  // detect pathname replacement; descriptor-safe no-follow reads require an
  // app-server protocol extension and remain the only residual race window.
  const targetAfterRead = await realpath(requested);
  if (targetAfterRead !== target || !contained(root, targetAfterRead)) {
    throw new Error("FILE_OUTSIDE_WORKSPACE: file changed outside workspace during read");
  }
  const bytes = decodeBase64(response.dataBase64);
  if (bytes.byteLength > MAX_MARKDOWN_BYTES) throw new Error("Markdown file exceeds the two MiB limit");
  return { path: target, filename: basename(target), text: bytes.toString("utf8") };
}
