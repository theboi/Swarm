import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

import { PROFILE_WORKER_READY } from "./profileWorkerProtocol.js";

const execute = promisify(execFile);

export interface ProfileWorkerInput {
  codexHome: string;
  workspaceRoot: string;
  repositoryUrl: string;
}

function isInput(value: unknown): value is ProfileWorkerInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 3
    && typeof record.codexHome === "string"
    && typeof record.workspaceRoot === "string"
    && typeof record.repositoryUrl === "string";
}

async function privateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const details = await lstat(path);
  const uid = process.getuid?.();
  if (uid === undefined || details.isSymbolicLink() || !details.isDirectory() || details.uid !== uid) throw new Error("Profile path is not a private owned directory");
  await chmod(path, 0o700);
}

export async function ensureCredentialStore(codexHome: string): Promise<void> {
  const configuration = join(codexHome, "config.toml");
  let existing = "";
  try { existing = await readFile(configuration, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const declarations = existing.split(/\r?\n/).filter((line) => /^\s*cli_auth_credentials_store\s*=/.test(line));
  const fileBacked = declarations.length === 1 && /^\s*cli_auth_credentials_store\s*=\s*["']file["']\s*(?:#.*)?$/.test(declarations[0]!);
  if (declarations.length > 0 && !fileBacked) throw new Error("PROFILE_AUTH_ISOLATION_UNAVAILABLE");
  if (!fileBacked) {
    await writeFile(configuration, `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}cli_auth_credentials_store = "file"\n`, { mode: 0o600 });
  }
  await chmod(configuration, 0o600);
}

async function verifyOwnedCheckout(workspaceRoot: string, repositoryUrl?: string): Promise<void> {
  const details = await lstat(workspaceRoot);
  const uid = process.getuid?.();
  if (uid === undefined || details.isSymbolicLink() || !details.isDirectory() || details.uid !== uid) throw new Error("Workspace is not an owned directory");
  const git = join(workspaceRoot, ".git");
  if (!(await lstat(git)).isDirectory()) throw new Error("Workspace is unmanaged");
  await execute("/usr/bin/git", ["-C", workspaceRoot, "rev-parse", "--verify", "HEAD^{commit}"]);
  if (repositoryUrl !== undefined) {
    const remote = (await execute("/usr/bin/git", ["-C", workspaceRoot, "remote", "get-url", "origin"])).stdout.trim();
    if (remote !== repositoryUrl) throw new Error("Workspace remote does not match configured repository");
  }
}

export async function ensureProfileCheckout(workspaceRoot: string, repositoryUrl: string): Promise<void> {
  try {
    await lstat(workspaceRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw new Error("Shared workspace does not exist");
  }
  await verifyOwnedCheckout(workspaceRoot, repositoryUrl);
}

export async function setupProfileWorker(input: ProfileWorkerInput): Promise<void> {
  const profile = isInput(input) ? /^\/Users\/(bot[1-8])\/\.swarm\/codex-profiles\/acc([2-9]|[1-9][0-9]+)$/.exec(input.codexHome) : undefined;
  if (!profile || input.workspaceRoot !== `/Users/${profile[1]}/Dev/EdenMind` || !/^https:\/\//.test(input.repositoryUrl)) throw new Error("Invalid profile setup input");
  await privateDirectory(dirname(dirname(input.codexHome)));
  await privateDirectory(dirname(input.codexHome));
  await privateDirectory(input.codexHome);
  const profileRoot = dirname(input.codexHome);
  if (await realpath(profileRoot) !== profileRoot) throw new Error("Profile root must not be a symbolic link");
  await ensureCredentialStore(input.codexHome);
  await ensureProfileCheckout(input.workspaceRoot, input.repositoryUrl);
}

export async function readProfileWorkerInput(inputStream: NodeJS.ReadableStream): Promise<ProfileWorkerInput> {
  const lines = createInterface({ input: inputStream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      const input: unknown = JSON.parse(line);
      if (!isInput(input)) throw new Error("Invalid profile setup input");
      return input;
    }
    throw new Error("Profile setup input ended before a JSON line was received");
  } finally {
    lines.close();
  }
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === new URL(`file://${executedPath}`).href) {
  process.stdout.write(`${PROFILE_WORKER_READY}\n`);
  readProfileWorkerInput(process.stdin).then(setupProfileWorker).catch((error: unknown) => {
    process.exitCode = error instanceof Error && error.message === "PROFILE_AUTH_ISOLATION_UNAVAILABLE" ? 65 : 1;
  });
}
