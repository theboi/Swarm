import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

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

async function ensureCredentialStore(codexHome: string): Promise<void> {
  const configuration = join(codexHome, "config.toml");
  let existing = "";
  try { existing = await readFile(configuration, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const conflicting = /^\s*cli_auth_credentials_store\s*=\s*(?!"file"\s*$)/m.test(existing);
  if (conflicting) throw new Error("PROFILE_AUTH_ISOLATION_UNAVAILABLE");
  if (!/^\s*cli_auth_credentials_store\s*=\s*"file"\s*$/m.test(existing)) {
    await writeFile(configuration, `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}cli_auth_credentials_store = "file"\n`, { mode: 0o600 });
  }
  await chmod(configuration, 0o600);
}

async function ensureCheckout(workspaceRoot: string, repositoryUrl: string): Promise<void> {
  try {
    const details = await lstat(workspaceRoot);
    const uid = process.getuid?.();
    if (uid === undefined || details.isSymbolicLink() || !details.isDirectory() || details.uid !== uid) throw new Error("Workspace is not an owned directory");
    const git = join(workspaceRoot, ".git");
    if (!(await lstat(git)).isDirectory()) throw new Error("Workspace is unmanaged");
    const remote = (await execute("/usr/bin/git", ["-C", workspaceRoot, "remote", "get-url", "origin"])).stdout.trim();
    if (remote !== repositoryUrl) throw new Error("Workspace remote does not match configured repository");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await mkdir(dirname(workspaceRoot), { recursive: true, mode: 0o700 });
    await execute("/usr/bin/git", ["clone", "--origin", "origin", repositoryUrl, workspaceRoot]);
    if (!(await stat(join(workspaceRoot, ".git"))).isDirectory()) throw new Error("Workspace clone verification failed");
  }
}

export async function setupProfileWorker(input: ProfileWorkerInput): Promise<void> {
  const profile = isInput(input) ? /^\/Users\/(bot[1-8])\/\.swarm\/codex-profiles\/acc([2-9]|[1-9][0-9]+)$/.exec(input.codexHome) : undefined;
  if (!profile || input.workspaceRoot !== `/Users/${profile[1]}/Dev/EdenMind-acc${profile[2]}` || !/^https:\/\//.test(input.repositoryUrl)) throw new Error("Invalid profile setup input");
  await privateDirectory(dirname(dirname(input.codexHome)));
  await privateDirectory(dirname(input.codexHome));
  await privateDirectory(input.codexHome);
  const profileRoot = dirname(input.codexHome);
  if (await realpath(profileRoot) !== profileRoot) throw new Error("Profile root must not be a symbolic link");
  await ensureCredentialStore(input.codexHome);
  await ensureCheckout(input.workspaceRoot, input.repositoryUrl);
  await chmod(input.workspaceRoot, 0o700);
}

async function readInput(): Promise<ProfileWorkerInput> {
  let raw = "";
  for await (const chunk of process.stdin) raw += String(chunk);
  const input: unknown = JSON.parse(raw);
  if (!isInput(input)) throw new Error("Invalid profile setup input");
  return input;
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === new URL(`file://${executedPath}`).href) {
  readInput().then(setupProfileWorker).catch((error: unknown) => {
    process.exitCode = error instanceof Error && error.message === "PROFILE_AUTH_ISOLATION_UNAVAILABLE" ? 65 : 1;
  });
}
