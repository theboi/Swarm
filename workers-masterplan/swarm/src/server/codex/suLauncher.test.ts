import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { SuLauncher, type SpawnedPty } from "./suLauncher.js";

class FakeChild extends EventEmitter implements SpawnedPty {
  pid = 4201;
  readonly writes: string[] = [];
  readonly kill = vi.fn();
  readonly dispose = vi.fn();

  write(value: string): void { this.writes.push(value); }

  onData(listener: (data: string) => void): { dispose(): void } {
    this.on("data", listener);
    return { dispose: () => this.off("data", listener) };
  }

  onExit(listener: (event: { exitCode: number; signal?: number }) => void): { dispose(): void } {
    const callback = (exitCode: number, signal?: number) => listener({ exitCode, signal });
    this.on("exit", callback);
    return { dispose: () => this.off("exit", callback) };
  }
}

function launcherFixture(options: { profileVisible?: boolean; autoPrompt?: boolean } = {}) {
  const child = new FakeChild();
  const spawn = vi.fn(() => {
    if (options.autoPrompt) queueMicrotask(() => child.emit("data", "Password:"));
    return child;
  });
  const release = vi.fn(async () => undefined);
  const kill = vi.fn();
  const waitForReady = vi.fn(async () => undefined);
  const openTerminal = vi.fn(async () => undefined);
  const verifyCodexBinary = vi.fn(async (path: string) => path === "/opt/homebrew/bin/codex");
  const launcher = new SuLauncher({
    spawnPty: spawn,
    allocatePort: async () => ({ port: 45123, release }),
    pathExists: async (path) => path === "/Users/bot1/.codex" || (options.profileVisible !== false && path === "/Users/bot1/.swarm/codex-profiles/acc2") || path === "/Users/claudiothe/.codex",
    verifyCodexBinary,
    waitForReady,
    killProcessGroup: kill,
    openTerminal,
    log: () => undefined,
    startupTimeoutMs: 250,
  });
  return { launcher, child, spawn, release, kill, waitForReady, verifyCodexBinary, openTerminal };
}

async function waitForSpawn(spawn: ReturnType<typeof vi.fn>) {
  await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
}

describe("SuLauncher", () => {
  it("launches an isolated slot when its owner-only profile directory is not visible to the coordinator", async () => {
    const { launcher, spawn } = launcherFixture({ profileVisible: false, autoPrompt: true });

    const handle = await launcher.launch({
      slot: { id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, codexHome: "/Users/bot1/.swarm/codex-profiles/acc2", workspaceRoot: "/Users/bot1/Dev/EdenMind-acc2" },
      password: "bot-password",
      codexBin: "/opt/homebrew/bin/codex",
    });

    expect(spawn).toHaveBeenCalledOnce();
    await handle.stop();
  });

  it("launches bot1/acc2 through bot1 with an explicit isolated CODEX_HOME", async () => {
    const { launcher, child, spawn } = launcherFixture();
    const launching = launcher.launch({
      slot: { id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, codexHome: "/Users/bot1/.swarm/codex-profiles/acc2", workspaceRoot: "/Users/bot1/Dev/EdenMind-acc2" },
      password: "bot-password",
      codexBin: "/opt/homebrew/bin/codex",
    });

    await waitForSpawn(spawn);
    const command = ((spawn.mock.calls[0] as unknown as [string, string[]])[1][3]) as string;
    expect(spawn).toHaveBeenCalledWith("/usr/bin/su", ["-", "bot1", "-c", expect.any(String)], expect.any(Object));
    expect(command).toContain("swarm-bot1-acc2");
    expect(command).toContain("/usr/bin/env CODEX_HOME='/Users/bot1/.swarm/codex-profiles/acc2'");
    expect(command).not.toContain("bot-password");
    child.emit("data", "Password:");
    await (await launching).stop();
  });

  it("runs only an allowlisted account in a real PTY and a named tmux session, writing its password only after a prompt", async () => {
    const { launcher, child, spawn, waitForReady, verifyCodexBinary } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });

    await waitForSpawn(spawn);

    expect(spawn).toHaveBeenCalledWith(
      "/usr/bin/su",
      ["-", "bot1", "-c", expect.stringContaining("kill-session -t swarm-bot1")],
      expect.objectContaining({ name: "xterm-256color" }),
    );
    expect(child.writes).toEqual([]);
    child.emit("data", "Password:");
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

  it("launches claudiothe directly without reading or writing a bot password", async () => {
    const { launcher, child, spawn, waitForReady } = launcherFixture();
    const handle = await launcher.launch({ account: "claudiothe", codexBin: "/opt/homebrew/bin/codex" });

    try {
      expect(spawn).toHaveBeenCalledWith(
        "/bin/zsh",
        ["-lc", expect.stringContaining("kill-session -t swarm-claudiothe")],
        expect.objectContaining({ name: "xterm-256color" }),
      );
      expect(child.writes).toEqual([]);
      expect(waitForReady).toHaveBeenCalledWith(handle.endpoint, handle.capabilityToken);
    } finally {
      await handle.stop();
    }
  });

  it("uses an OS-allocated loopback port and puts only a SHA-256 capability digest on the su command line", async () => {
    const { launcher, child, spawn, release } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);

    // A held reservation prevents Codex from binding its app-server listener.
    expect(release).toHaveBeenCalledOnce();
    child.emit("data", "Password:");
    const handle = await launching;
    const command = ((spawn.mock.calls[0] as unknown as [string, string[]])[1][3]) as string;

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

    child.emit("data", "app output: password: is documentation\n");
    expect(child.writes).toEqual([]);
    child.emit("data", "Pass");
    child.emit("data", "word:");
    const handle = await launching;

    expect(child.writes).toEqual(["bot-password\n"]);
    await handle.stop();
  });

  it("retries readiness while Codex is still binding the released loopback port", async () => {
    const { launcher, child, spawn, waitForReady } = launcherFixture();
    waitForReady.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:45123"));

    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);
    child.emit("data", "Password:");
    const handle = await launching;

    expect(waitForReady).toHaveBeenCalledTimes(2);
    await handle.stop();
  });

  it("rejects account IDs outside the standard Swarm set and launcher failures as account-auth-required without exposing credentials", async () => {
    const { launcher, child, kill, spawn } = launcherFixture();
    await expect(launcher.launch({ account: "bot9" as never, password: "bot-password", codexBin: "/opt/homebrew/bin/codex" })).rejects.toThrow(/allowlisted/i);
    expect(spawn).not.toHaveBeenCalled();

    const failed = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);
    child.emit("exit", 1);
    await expect(failed).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(child.writes).toEqual([]);
    expect(kill).not.toHaveBeenCalled();
    expect(child.dispose).toHaveBeenCalledOnce();
  });

  it("terminates the detached process group when startup readiness fails", async () => {
    const { child, kill, launcher, release, spawn, waitForReady } = launcherFixture();
    waitForReady.mockRejectedValue(new Error("handshake failed"));

    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);
    child.emit("data", "Password:");

    await expect(launching).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(kill).toHaveBeenCalledWith(-4201, "SIGTERM");
    expect(child.kill).toHaveBeenCalledOnce();
    expect(child.dispose).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("terminates and disposes the complete detached process group on handle stop", async () => {
    const { launcher, child, kill } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await vi.waitFor(() => expect(child.listenerCount("data")).toBe(1));
    child.emit("data", "Password:");
    const handle = await launching;

    await handle.stop();
    expect(kill).toHaveBeenCalledWith(-4201, "SIGTERM");
    expect(child.kill).toHaveBeenCalledOnce();
    expect(child.dispose).toHaveBeenCalledOnce();
    expect(child.writes).toEqual(["bot-password\n"]);
  });

  it("terminates and disposes the complete detached process group on launcher shutdown", async () => {
    const { launcher, child, kill } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await vi.waitFor(() => expect(child.listenerCount("data")).toBe(1));
    child.emit("data", "Password:");
    await launching;

    await launcher.shutdown();
    expect(kill).toHaveBeenCalledWith(-4201, "SIGTERM");
    expect(child.kill).toHaveBeenCalledOnce();
    expect(child.dispose).toHaveBeenCalledOnce();
  });

  it("does not write a password to a PTY that was stopped during startup", async () => {
    const { launcher, child, kill, spawn } = launcherFixture();
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);

    await launcher.shutdown();
    child.emit("data", "Password:");

    await expect(launching).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(child.writes).toEqual([]);
    expect(kill).toHaveBeenCalledWith(-4201, "SIGTERM");
    expect(child.dispose).toHaveBeenCalledOnce();
  });

  it("disposes every native PTY exactly once across repeated launches", async () => {
    const children: FakeChild[] = [];
    const spawn = vi.fn(() => {
      const child = new FakeChild();
      children.push(child);
      return child;
    });
    const launcher = new SuLauncher({
      spawnPty: spawn,
      allocatePort: async () => ({ port: 45123, release: async () => undefined }),
      pathExists: async (path) => path === "/Users/claudiothe/.codex",
      verifyCodexBinary: async (path) => path === "/opt/homebrew/bin/codex",
      waitForReady: async () => undefined,
      killProcessGroup: () => undefined,
      openTerminal: async () => undefined,
      log: () => undefined,
      startupTimeoutMs: 250,
    });

    for (let attempt = 0; attempt < 20; attempt++) {
      const handle = await launcher.launch({ account: "claudiothe", codexBin: "/opt/homebrew/bin/codex" });
      await handle.stop();
    }

    expect(children).toHaveLength(20);
    expect(children.every((child) => child.dispose.mock.calls.length === 1)).toBe(true);
  });

  it("opens a guarded local tmux console only while its account is live", async () => {
    const { launcher, child, openTerminal, spawn } = launcherFixture();

    await expect((launcher as unknown as { openTerminal(account: "bot1"): Promise<void> }).openTerminal("bot1")).rejects.toThrow("ACCOUNT_OFFLINE");
    const launching = launcher.launch({ account: "bot1", password: "bot-password", codexBin: "/opt/homebrew/bin/codex" });
    await waitForSpawn(spawn);
    child.emit("data", "Password:");
    const handle = await launching;
    try {
      await (launcher as unknown as { openTerminal(account: "bot1"): Promise<void> }).openTerminal("bot1");
      expect(openTerminal).toHaveBeenCalledWith(expect.stringContaining("/usr/bin/su - bot1 -c"));
      expect(openTerminal).toHaveBeenCalledWith(expect.stringContaining("attach-session -t swarm-bot1"));
    } finally {
      await handle.stop();
    }
  });
});
