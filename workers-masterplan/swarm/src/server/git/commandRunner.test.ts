import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

import { GitCommandRunner, absorbStdinPipeErrors, type BotPtyProcess } from "./commandRunner.js";

const run = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  return (await run("/usr/bin/git", ["-C", cwd, ...args])).stdout.trim();
}

async function repositories(): Promise<{ local: string; peer: string; remote: string }> {
  const root = await mkdtemp(join(tmpdir(), "swarm-git-runner-"));
  const remote = join(root, "origin.git");
  const seed = join(root, "seed");
  const local = join(root, "local");
  const peer = join(root, "peer");
  await run("/usr/bin/git", ["init", "--bare", remote]);
  await run("/usr/bin/git", ["clone", remote, seed]);
  await git(seed, "config", "user.name", "Swarm test");
  await git(seed, "config", "user.email", "swarm@example.test");
  await writeFile(join(seed, "shared.txt"), "base\n");
  await git(seed, "add", "shared.txt");
  await git(seed, "commit", "-m", "seed");
  await git(seed, "push", "origin", "HEAD:main");
  await run("/usr/bin/git", ["--git-dir", remote, "symbolic-ref", "HEAD", "refs/heads/main"]);
  await run("/usr/bin/git", ["clone", remote, local]);
  await run("/usr/bin/git", ["clone", remote, peer]);
  for (const repository of [local, peer]) {
    await git(repository, "config", "user.name", "Swarm test");
    await git(repository, "config", "user.email", "swarm@example.test");
    await git(repository, "config", "commit.gpgsign", "false");
  }
  return { local, peer, remote };
}

describe("GitCommandRunner", () => {
  it("absorbs a late password-pipe EPIPE so a failed su pull cannot terminate Swarm", () => {
    const stdin = new EventEmitter();

    absorbStdinPipeErrors(stdin);

    expect(stdin.listenerCount("error")).toBe(1);
    expect(() => stdin.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }))).not.toThrow();
  });

  it("uses a PTY and waits for the su password prompt before running bot Git commands", async () => {
    let dataListener: ((data: string) => void) | undefined;
    let exitListener: ((event: { exitCode: number; signal?: number }) => void) | undefined;
    const dispose = vi.fn();
    const process = {
      onData: vi.fn((listener) => { dataListener = listener; return { dispose: vi.fn() }; }),
      onExit: vi.fn((listener) => { exitListener = listener; return { dispose: vi.fn() }; }),
      write: vi.fn(),
      kill: vi.fn(),
      dispose,
    } as BotPtyProcess & { dispose: typeof dispose };
    const spawnBotPty = vi.fn(() => process);
    const runner = new GitCommandRunner("/workspace", { bot6: "correct horse" }, spawnBotPty);

    const pull = runner.pullAccount("bot6");
    expect(process.write).not.toHaveBeenCalled();
    dataListener?.("Password:");
    expect(process.write).toHaveBeenCalledWith("correct horse\r");
    exitListener?.({ exitCode: 0 });

    await expect(pull).resolves.toBeUndefined();
    expect(spawnBotPty).toHaveBeenCalledWith("/usr/bin/su", expect.arrayContaining(["bot6"]), expect.any(Object));
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("commits local changes, rebases a newer origin/main, and pushes the checkpoint", async () => {
    const { local, peer } = await repositories();
    await writeFile(join(peer, "remote.txt"), "remote\n");
    await git(peer, "add", "remote.txt");
    await git(peer, "commit", "-m", "remote change");
    await git(peer, "push", "origin", "main");
    await writeFile(join(local, "local.txt"), "local\n");

    await new GitCommandRunner(local, {}).checkpointAndPush("claudiothe");

    expect(await git(local, "rev-list", "--left-right", "--count", "HEAD...origin/main")).toBe("0\t0");
    expect(await readFile(join(local, "remote.txt"), "utf8")).toBe("remote\n");
    expect(await git(local, "log", "-1", "--pretty=%s")).toBe("chore: checkpoint swarm handoff");
  });

  it("aborts a failed checkpoint rebase and leaves the local checkpoint for manual resolution", async () => {
    const { local, peer } = await repositories();
    await writeFile(join(peer, "shared.txt"), "remote\n");
    await git(peer, "commit", "-am", "remote conflict");
    await git(peer, "push", "origin", "main");
    await writeFile(join(local, "shared.txt"), "local\n");

    await expect(new GitCommandRunner(local, {}).checkpointAndPush("claudiothe")).rejects.toThrow("Git checkpoint rebase failed");

    expect(await readFile(join(local, "shared.txt"), "utf8")).toBe("local\n");
    expect(await git(local, "status", "--porcelain")).toBe("");
    expect(await git(local, "log", "-1", "--pretty=%s")).toBe("chore: checkpoint swarm handoff");
  });
});
