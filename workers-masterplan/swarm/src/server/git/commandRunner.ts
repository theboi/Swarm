import { spawn } from "node:child_process";

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

async function runAsBotExitCode(account: BotAccountId, password: string, command: string): Promise<number> {
  const child = spawn("/usr/bin/script", ["-q", "/dev/null", "/usr/bin/su", "-", account, "-c", command], { stdio: ["pipe", "ignore", "ignore"] });
  absorbStdinPipeErrors(child.stdin);
  let secret = password;
  child.stdin?.write(`${secret}\n`);
  secret = "";
  return waitForExitCode(child);
}

async function runAsBot(account: BotAccountId, password: string, command: string): Promise<void> {
  if (await runAsBotExitCode(account, password, command) !== 0) throw new Error("Git synchronization failed");
}

/** Executes only fixed Git transport commands; it intentionally never captures or exposes command output. */
export class GitCommandRunner {
  constructor(private readonly workspaceRoot: string, private readonly passwords: Readonly<Record<BotAccountId, string | undefined>>) {}

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
    const exitCode = await runAsBotExitCode(account, password, command);
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
      await waitForExit(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "push", "origin", "HEAD:main"], { stdio: "ignore" }));
      return;
    }
    const password = this.passwords[account];
    if (!password) return "skipped";
    const git = quote("/usr/bin/git");
    const root = quote(`/Users/${account}/Dev/EdenMind`);
    await runAsBot(account, password, `${git} -C ${root} add -A && (${git} -C ${root} diff --cached --quiet || ${git} -C ${root} commit -m ${quote(message)}) && ${git} -C ${root} push origin HEAD:main`);
  }

  async pushBot(account: BotAccountId): Promise<void | "skipped"> {
    const password = this.passwords[account];
    if (!password) return "skipped";
    await runAsBot(account, password, `${quote("/usr/bin/git")} -C ${quote(`/Users/${account}/Dev/EdenMind`)} push origin main`);
  }
}
