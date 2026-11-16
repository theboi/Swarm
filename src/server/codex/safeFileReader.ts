import { basename, resolve } from "node:path";
import { isMacosBotId, LOCAL_ACCOUNT_ID, type AccountId, type CodexAccountSlot } from "../../shared/contracts.js";
import { clonePath } from "./protocol.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface AccountFileClient {
  readFile(path: string): Promise<{ dataBase64: string }>;
}

export interface ReadAccountFileInput {
  account: AccountId;
  requestedPath: string;
  appServer: AccountFileClient;
  /** Validated profile metadata required whenever the account is a logical profile. */
  slot?: CodexAccountSlot;
  /** Coordinator-owned root for the direct local account; bots use their assigned clone. */
  workspaceRoot?: string;
}

function decodeBase64(value: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("App-server returned malformed base64 content");
  const decoded = Buffer.from(value, "base64");
  if (decoded.toString("base64") !== value) throw new Error("App-server returned malformed base64 content");
  return decoded;
}

/** The selected account's OS permissions own access; the checkout only resolves relative paths. */
export async function readAccountFile(input: ReadAccountFileInput): Promise<{ path: string; filename: string; text: string }> {
  if (input.slot && input.slot.id !== input.account) throw new Error("Profile slot does not match requested account");
  if (!input.requestedPath.trim() || input.requestedPath.includes("\0")) throw new Error("A valid file path is required");
  const root = input.slot?.workspaceRoot ?? input.workspaceRoot ?? (input.account === LOCAL_ACCOUNT_ID ? process.cwd() : clonePath(input.account));
  const owner = input.slot?.macosUser ?? (isMacosBotId(input.account) ? input.account : LOCAL_ACCOUNT_ID);
  const requested = input.requestedPath.startsWith("~/")
    ? `/Users/${owner}/${input.requestedPath.slice(2)}`
    : input.requestedPath;
  const target = resolve(root, requested);
  // Do not realpath as the coordinator: bot-private paths may only be traversed
  // by that bot. fs/readFile executes under the selected account's identity.
  const response = await input.appServer.readFile(target);
  const bytes = decodeBase64(response.dataBase64);
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("File exceeds the two MiB limit");
  if (bytes.includes(0)) throw new Error("Binary files cannot be opened in the text viewer");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("File is not valid UTF-8 text"); }
  return { path: target, filename: basename(target), text };
}
