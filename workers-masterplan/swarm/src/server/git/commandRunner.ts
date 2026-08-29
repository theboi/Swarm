import { spawn } from "node:child_process";
import { spawn as spawnPty } from "node-pty";

import { LOCAL_ACCOUNT_ID, type AccountId, type BotAccountId } from "../../shared/contracts.js";
import { GitMergeConflictError } from "./sync.js";

function quote(value: string): string {
  if (!value || value.includes("\0")) throw new Error("Invalid Git command value");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function absorbStdinPipeErrors(stream: { on(event: "error", listener: (error: Error) => void): unknown } | null | undefined): void {
  stream?.on("error", () => undefined);
}

function waitForExitCode(child: ReturnType<typeof spawn>): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("Git synchronization could not start")));
    child.once("exit", (code) => typeof code === "number" ? resolve(code) : reject(new Error("Git synchronization was interrupted")));
  });
}

async function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  if (await waitForExitCode(child) !== 0) throw new Error("Git synchronization failed");
}

export interface BotPtyProcess {
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void };
  write(data: string): void;
  kill(signal?: string): void;
}

export type SpawnBotPty = (file: string, args: string[], options: { name: string; cols: number; rows: number; cwd: string; env: Record<string, string> }) => BotPtyProcess;

/** Executes only fixed Git transport commands; it intentionally never captures or exposes command output. */
export class GitCommandRunner {
  constructor(
    private readonly workspaceRoot: string,
    private readonly passwords: Readonly<Partial<Record<BotAccountId, string | undefined>>>,
    private readonly spawnBotPty: SpawnBotPty = spawnPty,
  ) {}

  private runAsBotExitCode(account: BotAccountId, password: string, command: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let tail = "";
      let passwordSent = false;
      let settled = false;
      const child = this.spawnBotPty("/usr/bin/su", ["-", account, "-c", command], {
        name: "xterm-256color",
        cols: 80,
        rows: 24,
        cwd: "/tmp",
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      });
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGTERM");
        reject(new Error("Git synchronization timed out"));
      }, 120_000);
      timer.unref();
      const dataSubscription = child.onData((data) => {
        if (passwordSent) return;
        tail = `${tail}${data}`.slice(-256);
        if (!/Password:/i.test(tail)) return;
        passwordSent = true;
        tail = "";
        child.write(`${password}\r`);
      });
      child.onExit(({ exitCode }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        dataSubscription.dispose();
        resolve(exitCode);
      });
    });
  }

  private async runAsBot(account: BotAccountId, password: string, command: string): Promise<void> {
    if (await this.runAsBotExitCode(account, password, command) !== 0) throw new Error("Git synchronization failed");
  }

  async pullLocal(): Promise<void> {
    const pullCode = await waitForExitCode(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "pull", "--no-rebase", "--no-edit", "origin", "main"], { stdio: "ignore" }));
    if (pullCode === 0) return;
    const conflictCode = await waitForExitCode(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "diff", "--quiet", "--diff-filter=U"], { stdio: "ignore" }));
    if (conflictCode === 1) throw new GitMergeConflictError();
    throw new Error("Git synchronization failed");
  }

  async pullAccount(account: AccountId): Promise<void | "skipped"> {
    if (account === LOCAL_ACCOUNT_ID) return this.pullLocal();
    const password = this.passwords[account];
    if (!password) return "skipped";
    const git = quote("/usr/bin/git");
    const root = quote(`/Users/${account}/Dev/EdenMind`);
    const command = `${git} -C ${root} pull --no-rebase --no-edit origin main; pull_code=$?; if [ "$pull_code" -eq 0 ]; then exit 0; fi; ${git} -C ${root} diff --quiet --diff-filter=U; conflict_code=$?; if [ "$conflict_code" -eq 1 ]; then exit 86; fi; exit "$pull_code"`;
    const exitCode = await this.runAsBotExitCode(account, password, command);
    if (exitCode === 86) throw new GitMergeConflictError();
    if (exitCode !== 0) throw new Error("Git synchronization failed");
  }

  /** Checkpoints all workspace changes and pushes them before a limit stop or account handoff. */
  async checkpointAndPush(account: AccountId): Promise<void | "skipped"> {
    const message = "chore: checkpoint swarm handoff";
    if (account === LOCAL_ACCOUNT_ID) {
      await waitForExit(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "add", "-A"], { stdio: "ignore" }));
      const diff = spawn("/usr/bin/git", ["-C", this.workspaceRoot, "diff", "--cached", "--quiet"], { stdio: "ignore" });
      const changed = await new Promise<boolean>((resolve, reject) => {
        diff.once("error", () => reject(new Error("Git synchronization could not start")));
        diff.once("exit", (code) => code === 0 ? resolve(false) : code === 1 ? resolve(true) : reject(new Error("Git synchronization failed")));
      });
      if (changed) await waitForExit(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "commit", "-m", message], { stdio: "ignore" }));
      await waitForExit(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "fetch", "origin", "main"], { stdio: "ignore" }));
      const rebaseCode = await waitForExitCode(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "rebase", "origin/main"], { stdio: "ignore" }));
      if (rebaseCode !== 0) {
        await waitForExitCode(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "rebase", "--abort"], { stdio: "ignore" })).catch(() => undefined);
        throw new Error("Git checkpoint rebase failed");
      }
      await waitForExit(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "push", "origin", "HEAD:main"], { stdio: "ignore" }));
      return;
    }
    const password = this.passwords[account];
    if (!password) return "skipped";
    const git = quote("/usr/bin/git");
    const root = quote(`/Users/${account}/Dev/EdenMind`);
    const checkpoint = `${git} -C ${root} add -A && (${git} -C ${root} diff --cached --quiet || ${git} -C ${root} commit -m ${quote(message)})`;
    const rebase = `${git} -C ${root} fetch origin main && (${git} -C ${root} rebase origin/main || { ${git} -C ${root} rebase --abort >/dev/null 2>&1 || true; exit 86; })`;
    await this.runAsBot(account, password, `${checkpoint} && ${rebase} && ${git} -C ${root} push origin HEAD:main`);
  }

  async pushBot(account: BotAccountId): Promise<void | "skipped"> {
    const password = this.passwords[account];
    if (!password) return "skipped";
    await this.runAsBot(account, password, `${quote("/usr/bin/git")} -C ${quote(`/Users/${account}/Dev/EdenMind`)} push origin main`);
  }
}
