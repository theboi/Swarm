import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { SuLauncher, type SpawnedChild } from "./suLauncher.js";

class FakeChild extends EventEmitter implements SpawnedChild {
  pid = 4201;
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  readonly writes: string[] = [];
  readonly stdin = { write: (value: string) => { this.writes.push(value); return true; } };
}

function launcherFixture() {
  const child = new FakeChild();
  const spawn = vi.fn(() => child);
  const release = vi.fn(async () => undefined);
  const kill = vi.fn();
  const waitForReady = vi.fn(async () => undefined);
  const verifyCodexBinary = vi.fn(async (path: string) => path === "/opt/homebrew/bin/codex");
  const launcher = new SuLauncher({
    spawn,
    allocatePort: async () => ({ port: 45123, release }),
    pathExists: async (path) => path === "/opt/homebrew/bin/codex" || path === "/Users/bot1/.codex",
    verifyCodexBinary,
    waitForReady,
    killProcessGroup: kill,
    log: () => undefined,
    startupTimeoutMs: 250,
  });
  return { launcher, child, spawn, release, kill, waitForReady, verifyCodexBinary };
}

async function waitForSpawn(spawn: ReturnType<typeof vi.fn>) {
  await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
}

describe("SuLauncher", () => {
  it("runs only an allowlisted account through script and su, writing its password only after a prompt", async () => {
    const { launcher, child, spawn, waitForReady, verifyCodexBinary } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });

    await waitForSpawn(spawn);

    expect(spawn).toHaveBeenCalledWith(
      "/usr/bin/script",
      ["-q", "/dev/null", "/usr/bin/su", "-", "bot1", "-c", expect.any(String)],
      expect.objectContaining({ detached: true }),
    );
    expect(child.writes).toEqual([]);
    child.stdout.emit("data", Buffer.from("Password:"));
    const handle = await launching;

    try {
      expect(verifyCodexBinary).toHaveBeenCalledWith("/opt/homebrew/bin/codex");
      expect(child.writes).toEqual(["bot-password\n"]);
      expect(waitForReady).toHaveBeenCalledWith(handle.endpoint, handle.capabilityToken);
      expect(JSON.stringify(spawn.mock.calls)).not.toContain("bot-password");
    } finally {
      await handle.stop();
    }
  });

  it("uses an OS-allocated loopback port and puts only a SHA-256 capability digest on the su command line", async () => {
    const { launcher, child, spawn, release } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);
    child.stdout.emit("data", Buffer.from("Password:"));
    const handle = await launching;
    const command = ((spawn.mock.calls[0] as unknown as [string, string[]])[1][6]) as string;

    expect(handle.endpoint).toBe("ws://127.0.0.1:45123");
    expect(command).toMatch(/--listen ws:\/\/127\.0\.0\.1:45123/);
    expect(command).toMatch(/--ws-auth capability-token --ws-token-sha256 [a-f0-9]{64}/);
    expect(command).not.toContain(handle.capabilityToken);
    expect(command).not.toContain("bot-password");
    await handle.stop();
    expect(release).toHaveBeenCalledOnce();
  });

  it("recognizes an exact su password prompt across PTY chunks without treating ordinary output as a credential prompt", async () => {
    const { launcher, child, spawn } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);

    child.stdout.emit("data", Buffer.from("app output: password: is documentation\n"));
    expect(child.writes).toEqual([]);
    child.stderr.emit("data", Buffer.from("Pass"));
    child.stderr.emit("data", Buffer.from("word:"));
    const handle = await launching;

    expect(child.writes).toEqual(["bot-password\n"]);
    await handle.stop();
  });

  it("rejects non-bot accounts and launcher failures as account-auth-required without exposing credentials", async () => {
    const { launcher, child, spawn } = launcherFixture();
    await expect(launcher.launch({ account: "bot9" as never, password: "bot-password", codexBin: "/opt/homebrew/bin/codex" })).rejects.toThrow(/allowlisted/i);
    expect(spawn).not.toHaveBeenCalled();

    const failed = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);
    child.emit("exit", 1);
    await expect(failed).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
  });

  it("terminates the detached process group when startup readiness fails", async () => {
    const { child, kill, launcher, release, spawn, waitForReady } = launcherFixture();
    waitForReady.mockRejectedValueOnce(new Error("handshake failed"));

    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);
    child.stdout.emit("data", Buffer.from("Password:"));

    await expect(launching).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(kill).toHaveBeenCalledWith(-4201, "SIGTERM");
    expect(release).toHaveBeenCalledOnce();
  });

  it("terminates the complete detached process group on handle shutdown and launcher shutdown", async () => {
    const { launcher, child, kill } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await vi.waitFor(() => expect(child.stdout.listenerCount("data")).toBe(1));
    child.stdout.emit("data", Buffer.from("Password:"));
    const handle = await launching;

    await handle.stop();
    expect(kill).toHaveBeenCalledWith(-4201, "SIGTERM");
    await launcher.shutdown();
    expect(kill).toHaveBeenCalledTimes(1);
  });
});
