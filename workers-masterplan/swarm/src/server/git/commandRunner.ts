import { spawn as spawnChildProcess } from "node:child_process";
import { spawn as spawnPty } from "node-pty";
import { fileURLToPath } from "node:url";

import { isMacosBotId, LOCAL_ACCOUNT_ID, type AccountId, type BotAccountId, type CodexAccountSlot } from "../../shared/contracts.js";
import { GitMergeConflictError } from "./sync.js";

function quote(value: string): string {
  if (!value || value.includes("\0")) throw new Error("Invalid Git command value");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function absorbStdinPipeErrors(stream: { on(event: "error", listener: (error: Error) => void): unknown } | null | undefined): void {
  stream?.on("error", () => undefined);
}

function waitForExitCode(child: ReturnType<typeof spawnChildProcess>): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("Git synchronization could not start")));
    child.once("exit", (code) => typeof code === "number" ? resolve(code) : reject(new Error("Git synchronization was interrupted")));
  });
}

async function waitForExit(child: ReturnType<typeof spawnChildProcess>): Promise<void> {
  if (await waitForExitCode(child) !== 0) throw new Error("Git synchronization failed");
}

export interface BotPtyProcess {
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void };
  write(data: string): void;
  kill(signal?: string): void;
  dispose(): void;
}

export type SpawnBotPty = (file: string, args: string[], options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> }) => BotPtyProcess;
export type RunBotCommand = (account: BotAccountId, password: string, command: string) => Promise<number>;

function legacyWorkspaceRoot(macosUser: BotAccountId): string {
  return `/Users/${macosUser}/Dev/EdenMind`;
}

function botWorkspace(account: Exclude<AccountId, typeof LOCAL_ACCOUNT_ID> | CodexAccountSlot): { macosUser: BotAccountId; workspaceRoot: string } | undefined {
  if (typeof account !== "string") return { macosUser: account.macosUser, workspaceRoot: account.workspaceRoot };
  return isMacosBotId(account) ? { macosUser: account, workspaceRoot: legacyWorkspaceRoot(account) } : undefined;
}

const spawnManagedBotPty: SpawnBotPty = (file, args, options) => {
  const child = spawnPty(file, args, options);
  return {
    onData: (listener) => child.onData(listener),
    onExit: (listener) => child.onExit(listener),
    write: (data) => child.write(data),
    kill: (signal) => child.kill(signal),
    dispose: () => (child as unknown as { destroy(): void }).destroy(),
  };
};

/** Runs the password-prompt exchange inside a process that can be discarded with its native PTY descriptor. */
export function runBotPtyCommand(account: BotAccountId, password: string, command: string, spawnBotPty: SpawnBotPty = spawnManagedBotPty): Promise<number> {
  return new Promise((resolve, reject) => {
    let tail = "";
    let passwordSent = false;
    let settled = false;
    let cleaned = false;
    const child = spawnBotPty("/usr/bin/su", ["-", account, "-c", command], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: "/tmp",
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
    });
    let timer: NodeJS.Timeout | undefined;
    let dataSubscription: { dispose(): void } | undefined;
    let exitSubscription: { dispose(): void } | undefined;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (timer) clearTimeout(timer);
      dataSubscription?.dispose();
      exitSubscription?.dispose();
      try { child.dispose(); } catch { /* descriptor already closed */ }
    };
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill("SIGTERM"); } finally { cleanup(); }
      reject(new Error("Git synchronization timed out"));
    }, 120_000);
    timer.unref();
    dataSubscription = child.onData((data) => {
      if (passwordSent) return;
      tail = `${tail}${data}`.slice(-256);
      if (!/Password:/i.test(tail)) return;
      passwordSent = true;
      tail = "";
      child.write(`${password}\r`);
    });
    exitSubscription = child.onExit(({ exitCode }) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(exitCode);
    });
  });
}

/**
 * Starts a fixed worker as the bot user. The password is sent only to su's PTY
 * prompt; worker input is a separate JSON line and must not contain the password.
 */
export function runBotPtyJsonWorker(account: BotAccountId, password: string, workerPath: string, payload: { codexHome: string; workspaceRoot: string; repositoryUrl: string }, spawnBotPty: SpawnBotPty = spawnManagedBotPty): Promise<void> {
  if (!workerPath.startsWith("/") || !password) return Promise.reject(new Error("Profile setup could not start"));
  const input = JSON.stringify(payload);
  if (input.includes(password)) return Promise.reject(new Error("Profile setup input must not contain a password"));
  const command = `${quote(process.execPath)} ${quote(workerPath)}`;
  return new Promise((resolve, reject) => {
    let prompted = false;
    let settled = false;
    let tail = "";
    let timer: NodeJS.Timeout | undefined;
    let dataSubscription: { dispose(): void } | undefined;
    let exitSubscription: { dispose(): void } | undefined;
    const child = spawnBotPty("/usr/bin/su", ["-", account, "-c", command], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: "/tmp",
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
    });
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      dataSubscription?.dispose();
      exitSubscription?.dispose();
      try { child.dispose(); } catch { /* descriptor already closed */ }
      if (error) reject(error);
      else resolve();
    };
    timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } finally { finish(new Error("Profile setup timed out")); }
    }, 120_000);
    timer.unref();
    dataSubscription = child.onData((data) => {
      if (prompted) return;
      tail = `${tail}${data}`.slice(-256);
      if (!/Password:/i.test(tail)) return;
      prompted = true;
      tail = "";
      child.write(`${password}\r`);
      child.write(`${input}\n`);
    });
    exitSubscription = child.onExit(({ exitCode }) => finish(exitCode === 0 ? undefined : new Error(exitCode === 65 ? "PROFILE_AUTH_ISOLATION_UNAVAILABLE" : "Profile setup failed")));
  });
}

const runBotCommandInIsolatedProcess: RunBotCommand = (account, password, command) => new Promise((resolve, reject) => {
  const worker = spawnChildProcess(process.execPath, [fileURLToPath(new URL("./botGitWorker.js", import.meta.url))], { stdio: ["pipe", "ignore", "ignore"] });
  let settled = false;
  const finish = (result: number | Error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    if (result instanceof Error) reject(result);
    else resolve(result);
  };
  const timeout = setTimeout(() => {
    worker.kill("SIGTERM");
    finish(new Error("Git synchronization timed out"));
  }, 120_000);
  timeout.unref();
  worker.once("error", () => finish(new Error("Git synchronization could not start")));
  worker.once("exit", (code) => finish(typeof code === "number" ? code : new Error("Git synchronization was interrupted")));
  worker.stdin?.once("error", () => {
    worker.kill("SIGTERM");
    finish(new Error("Git synchronization could not start"));
  });
  worker.stdin?.end(JSON.stringify({ account, password, command }));
});

/** Executes only fixed Git transport commands; it intentionally never captures or exposes command output. */
export class GitCommandRunner {
  constructor(
    private readonly workspaceRoot: string,
    private readonly passwords: Readonly<Partial<Record<BotAccountId, string | undefined>>>,
    private readonly runBotCommand: RunBotCommand = runBotCommandInIsolatedProcess,
  ) {}

  private runAsBotExitCode(account: BotAccountId, password: string, command: string): Promise<number> {
    return this.runBotCommand(account, password, command);
  }

  private async runAsBot(account: BotAccountId, password: string, command: string): Promise<void> {
    if (await this.runAsBotExitCode(account, password, command) !== 0) throw new Error("Git synchronization failed");
  }

  async pullLocal(): Promise<void> {
    const pullCode = await waitForExitCode(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "pull", "--no-rebase", "--no-edit", "origin", "main"], { stdio: "ignore" }));
    if (pullCode === 0) return;
    const conflictCode = await waitForExitCode(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "diff", "--quiet", "--diff-filter=U"], { stdio: "ignore" }));
    if (conflictCode === 1) throw new GitMergeConflictError();
    throw new Error("Git synchronization failed");
  }

  async pullAccount(account: AccountId | CodexAccountSlot): Promise<void | "skipped"> {
    if (account === LOCAL_ACCOUNT_ID) return this.pullLocal();
    const target = botWorkspace(account);
    if (!target) return "skipped";
    const password = this.passwords[target.macosUser];
    if (!password) return "skipped";
    const git = quote("/usr/bin/git");
    const root = quote(target.workspaceRoot);
    const command = `${git} -C ${root} pull --no-rebase --no-edit origin main; pull_code=$?; if [ "$pull_code" -eq 0 ]; then exit 0; fi; ${git} -C ${root} diff --quiet --diff-filter=U; conflict_code=$?; if [ "$conflict_code" -eq 1 ]; then exit 86; fi; exit "$pull_code"`;
    const exitCode = await this.runAsBotExitCode(target.macosUser, password, command);
    if (exitCode === 86) throw new GitMergeConflictError();
    if (exitCode !== 0) throw new Error("Git synchronization failed");
  }

  /** Checkpoints all workspace changes and pushes them before a limit stop or account handoff. */
  async checkpointAndPush(account: AccountId | CodexAccountSlot): Promise<void | "skipped"> {
    const message = "chore: checkpoint swarm handoff";
    if (account === LOCAL_ACCOUNT_ID) {
      await waitForExit(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "add", "-A"], { stdio: "ignore" }));
      const diff = spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "diff", "--cached", "--quiet"], { stdio: "ignore" });
      const changed = await new Promise<boolean>((resolve, reject) => {
        diff.once("error", () => reject(new Error("Git synchronization could not start")));
        diff.once("exit", (code) => code === 0 ? resolve(false) : code === 1 ? resolve(true) : reject(new Error("Git synchronization failed")));
      });
      if (changed) await waitForExit(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "commit", "-m", message], { stdio: "ignore" }));
      await waitForExit(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "fetch", "origin", "main"], { stdio: "ignore" }));
      const rebaseCode = await waitForExitCode(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "rebase", "origin/main"], { stdio: "ignore" }));
      if (rebaseCode !== 0) {
        await waitForExitCode(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "rebase", "--abort"], { stdio: "ignore" })).catch(() => undefined);
        throw new Error("Git checkpoint rebase failed");
      }
      await waitForExit(spawnChildProcess("/usr/bin/git", ["-C", this.workspaceRoot, "push", "origin", "HEAD:main"], { stdio: "ignore" }));
      return;
    }
    const target = botWorkspace(account);
    if (!target) return "skipped";
    const password = this.passwords[target.macosUser];
    if (!password) return "skipped";
    const git = quote("/usr/bin/git");
    const root = quote(target.workspaceRoot);
    const checkpoint = `${git} -C ${root} add -A && (${git} -C ${root} diff --cached --quiet || ${git} -C ${root} commit -m ${quote(message)})`;
    const rebase = `${git} -C ${root} fetch origin main && (${git} -C ${root} rebase origin/main || { ${git} -C ${root} rebase --abort >/dev/null 2>&1 || true; exit 86; })`;
    await this.runAsBot(target.macosUser, password, `${checkpoint} && ${rebase} && ${git} -C ${root} push origin HEAD:main`);
  }

  async pushBot(account: BotAccountId): Promise<void | "skipped"> {
    const password = this.passwords[account];
    if (!password) return "skipped";
    await this.runAsBot(account, password, `${quote("/usr/bin/git")} -C ${quote(legacyWorkspaceRoot(account))} push origin main`);
  }
}
