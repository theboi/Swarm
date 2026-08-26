import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { config as loadDotenv } from "dotenv";
import WebSocket from "ws";

import type { AccountId } from "../src/shared/contracts.js";
import { JsonRpcClient } from "../src/server/codex/jsonRpcClient.js";
import { clonePath, safeThreadSettings, safeTurnSettings } from "../src/server/codex/protocol.js";
import { SuLauncher, type LaunchHandle, type PortLease } from "../src/server/codex/suLauncher.js";
import { swarmUserPassword } from "../src/server/config/config.js";

const ACCOUNTS = new Set<AccountId>(["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"]);
const SMOKE_PROMPT = "Reply with SMOKE_OK. Do not use tools or modify files.";

export type SmokeEnvironment =
  | { kind: "skip"; code: "SWARM_SMOKE_SKIPPED"; message: string }
  | { kind: "run"; account: AccountId; password: string; codexBin: string; startTurn: boolean };

class SmokeError extends Error {
  constructor(readonly code: "ACCOUNT_AUTH_REQUIRED" | "SMOKE_CAPABILITY_TOKEN_REJECTED" | "SMOKE_TURN_FAILED") {
    super(code);
  }
}

function isAccount(value: string | undefined): value is AccountId {
  return Boolean(value && ACCOUNTS.has(value as AccountId));
}

export function resolveSmokeEnvironment(env: NodeJS.ProcessEnv): SmokeEnvironment {
  const account = env.SWARM_SMOKE_ACCOUNT;
  if (!isAccount(account)) {
    return { kind: "skip", code: "SWARM_SMOKE_SKIPPED", message: "Set SWARM_SMOKE_ACCOUNT to bot1 through bot8." };
  }
  const index = Number(account.slice(3));
  const password = swarmUserPassword(env, index);
  if (!password) {
    return {
      kind: "skip",
      code: "SWARM_SMOKE_SKIPPED",
      message: `Set SWARM_USER${index}=bot${index}:password in the local ignored .env before running the ${account} smoke.`,
    };
  }
  return {
    kind: "run",
    account,
    password,
    codexBin: env.SWARM_CODEX_BIN ?? "/opt/homebrew/bin/codex",
    startTurn: env.SWARM_SMOKE_START_TURN === "true",
  };
}

export function redactSmokeOutput(value: string, secrets: readonly string[]): string {
  const withoutBearer = value.replace(/(authorization:\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]");
  return secrets.reduce((redacted, secret) => secret ? redacted.split(secret).join("[REDACTED]") : redacted, withoutBearer);
}

function quoteForShell(value: string): string {
  if (!value || value.includes("\0")) throw new Error("Invalid command value");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function manualLoginCommand(account: AccountId, codexBin: string): string {
  return `/usr/bin/su - ${account} -c ${quoteForShell(`${codexBin} login`)}`;
}

export function repositoryIsUnchanged(before: string, after: string): boolean {
  return before === after;
}

async function readAccountGitStatus(account: AccountId, password: string): Promise<string> {
  const command = `${quoteForShell("/usr/bin/git")} -C ${quoteForShell(clonePath(account))} status --porcelain`;
  const child = spawn("/usr/bin/script", ["-q", "/dev/null", "/usr/bin/su", "-", account, "-c", command], { stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  let prompted = false;
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Timed out reading the bot repository status"));
    }, 30_000);
    timeout.unref();
    const receive = (chunk: Buffer | string) => {
      const text = String(chunk);
      output = `${output}${text}`.slice(-16_384);
      if (!prompted && /(?:^|[\r\n])Password:\s*$/.test(output)) {
        prompted = true;
        child.stdin?.write(`${password}\n`);
      }
    };
    child.stdout?.on("data", receive);
    child.stderr?.on("data", receive);
    child.once("error", () => {
      clearTimeout(timeout);
      reject(new Error("Unable to read the bot repository status"));
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error("Unable to read the bot repository status"));
      const withoutPrompt = output.replace(/(?:^|[\r\n])Password:\s*/g, "");
      resolve(redactSmokeOutput(withoutPrompt, [password]));
    });
  });
}

async function findUnusedPort(): Promise<PortLease> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to allocate a loopback port");
  }
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return { port: address.port, release: async () => undefined };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function connectWithToken(endpoint: string, token: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error("Timed out waiting for the app-server capability-token handshake"));
    }, 10_000);
    socket.once("open", () => {
      clearTimeout(timeout);
      socket.close();
      resolve();
    });
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timeout);
      response.resume();
      reject(new Error(`App-server capability-token handshake failed (${response.statusCode ?? "unknown"})`));
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function assertMissingTokenIsRejected(endpoint: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new SmokeError("SMOKE_CAPABILITY_TOKEN_REJECTED"));
    }, 10_000);
    const rejectForOpen = () => {
      clearTimeout(timeout);
      socket.close();
      reject(new SmokeError("SMOKE_CAPABILITY_TOKEN_REJECTED"));
    };
    socket.once("open", rejectForOpen);
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timeout);
      response.resume();
      if (response.statusCode === 401) resolve();
      else reject(new SmokeError("SMOKE_CAPABILITY_TOKEN_REJECTED"));
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      if (/401|unauthori[sz]ed|unexpected server response/i.test(error.message)) resolve();
      else reject(error);
    });
  });
}

function accountAuthenticated(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.account) && record.requiresOpenaiAuth !== true;
}

async function listAllThreads(rpc: JsonRpcClient): Promise<Array<Record<string, unknown>>> {
  const threads: Array<Record<string, unknown>> = [];
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page: { data: Array<Record<string, unknown>>; nextCursor: string | null } = await rpc.request("thread/list", { archived: null, cursor });
    threads.push(...page.data);
    cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error("App-server returned a repeated thread pagination cursor");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return threads;
}

function threadIdFrom(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  const thread = record.thread;
  return thread && typeof thread === "object" && typeof (thread as Record<string, unknown>).id === "string"
    ? (thread as Record<string, string>).id
    : undefined;
}

function hasSmokeOkAgentMessage(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSmokeOkAgentMessage);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const type = record.type;
  const text = record.text;
  if (type === "agentMessage" && typeof text === "string" && /\bSMOKE_OK\b/.test(text)) return true;
  return Object.values(record).some(hasSmokeOkAgentMessage);
}

async function runDisposableTurn(rpc: JsonRpcClient, account: AccountId): Promise<void> {
  const created = await rpc.request("thread/start", safeThreadSettings(account));
  const threadId = threadIdFrom(created);
  if (!threadId) throw new SmokeError("SMOKE_TURN_FAILED");
  try {
    await rpc.request("turn/start", {
      threadId,
      clientUserMessageId: randomUUID(),
      input: [{ type: "text", text: SMOKE_PROMPT }],
      ...safeTurnSettings(account),
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await delay(2_000);
      const thread = await rpc.request("thread/read", { threadId, includeTurns: true });
      if (hasSmokeOkAgentMessage(thread)) return;
    }
    throw new SmokeError("SMOKE_TURN_FAILED");
  } finally {
    await rpc.request("thread/archive", { threadId }).catch(() => undefined);
  }
}

function createLauncher(): SuLauncher {
  return new SuLauncher({
    spawn: (file, args, options) => spawn(file, args, options),
    allocatePort: findUnusedPort,
    pathExists: exists,
    verifyCodexBinary: async (path) => exists(path),
    waitForReady: connectWithToken,
    killProcessGroup: (pid, signal) => process.kill(pid, signal),
    log: () => undefined,
  });
}

export async function runSmoke(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const settings = resolveSmokeEnvironment(env);
  if (settings.kind === "skip") {
    process.stdout.write(`${settings.code}: ${settings.message}\n`);
    return 0;
  }

  let handle: LaunchHandle | undefined;
  let rpc: JsonRpcClient | undefined;
  try {
    handle = await createLauncher().launch({ account: settings.account, password: settings.password, codexBin: settings.codexBin });
    await assertMissingTokenIsRejected(handle.endpoint);
    rpc = new JsonRpcClient({ launch: handle });
    await rpc.connect();
    await rpc.request("initialize", { clientInfo: { name: "EdenMind Swarm smoke", version: "0.1.0" }, capabilities: null });
    rpc.notify("initialized");
    const account = await rpc.request("account/read", {});
    if (!accountAuthenticated(account)) throw new SmokeError("ACCOUNT_AUTH_REQUIRED");
    const rateLimits = await rpc.request("account/rateLimits/read");
    const threads = await listAllThreads(rpc);
    if (settings.startTurn) {
      const before = await readAccountGitStatus(settings.account, settings.password);
      await runDisposableTurn(rpc, settings.account);
      const after = await readAccountGitStatus(settings.account, settings.password);
      if (!repositoryIsUnchanged(before, after)) throw new SmokeError("SMOKE_TURN_FAILED");
    }
    const bucketCount = rateLimits && typeof rateLimits === "object" ? Object.keys(rateLimits as Record<string, unknown>).length : 0;
    process.stdout.write(`SMOKE_METADATA_OK account=${settings.account} rateLimitFields=${bucketCount} threads=${threads.length} startTurn=${settings.startTurn}\n`);
    return 0;
  } catch (error) {
    const code = error instanceof SmokeError && error.code === "ACCOUNT_AUTH_REQUIRED" ? error.code : error instanceof Error && error.message === "ACCOUNT_AUTH_REQUIRED" ? "ACCOUNT_AUTH_REQUIRED" : "SMOKE_FAILED";
    const details = error instanceof Error ? redactSmokeOutput(error.message, [settings.password]) : "Unknown smoke failure";
    process.stderr.write(`${code}: ${details}\n`);
    if (code === "ACCOUNT_AUTH_REQUIRED") process.stderr.write(`Manual login: ${manualLoginCommand(settings.account, settings.codexBin)}\n`);
    return 1;
  } finally {
    await rpc?.close().catch(() => undefined);
    await handle?.stop().catch(() => undefined);
  }
}

function main(): Promise<number> {
  loadDotenv({ path: process.env.SWARM_ENV_FILE ?? ".env" });
  return runSmoke();
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  void main().then((code) => { process.exitCode = code; });
}
