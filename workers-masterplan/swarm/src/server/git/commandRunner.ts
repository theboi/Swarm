import { spawn } from "node:child_process";

import type { AccountId } from "../../shared/contracts.js";

function quote(value: string): string {
  if (!value || value.includes("\0")) throw new Error("Invalid Git command value");
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function waitForExit(child: ReturnType<typeof spawn>): Promise<void> {
  return new Promise((resolve, reject) => {
    child.once("error", () => reject(new Error("Git synchronization could not start")));
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Git synchronization failed")));
  });
}

async function runAsBot(account: AccountId, password: string, command: string): Promise<void> {
  const child = spawn("/usr/bin/script", ["-q", "/dev/null", "/usr/bin/su", "-", account, "-c", command], { stdio: ["pipe", "ignore", "ignore"] });
  let secret = password;
  child.stdin?.write(`${secret}\n`);
  secret = "";
  await waitForExit(child);
}

/** Executes only fixed Git transport commands; it intentionally never captures or exposes command output. */
export class GitCommandRunner {
  constructor(private readonly workspaceRoot: string, private readonly passwords: Readonly<Record<AccountId, string | undefined>>) {}

  async pullLocal(): Promise<void> {
    await waitForExit(spawn("/usr/bin/git", ["-C", this.workspaceRoot, "pull", "--ff-only", "origin", "main"], { stdio: "ignore" }));
  }

  async pushBot(account: AccountId): Promise<void | "skipped"> {
    const password = this.passwords[account];
    if (!password) return "skipped";
    await runAsBot(account, password, `${quote("/usr/bin/git")} -C ${quote(`/Users/${account}/Dev/EdenMind`)} push origin main`);
  }
}
