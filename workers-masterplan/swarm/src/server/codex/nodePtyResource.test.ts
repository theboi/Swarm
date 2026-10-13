import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { spawn } from "node-pty";
import { describe, expect, it } from "vitest";

function resourceListing(): string[] {
  return execFileSync("/usr/sbin/lsof", ["-nP", "-p", String(process.pid)], { encoding: "utf8" }).split("\n");
}

function openPtyDescriptors(): number {
  // fstat returns EBADF for revoked slaves although the descriptors are
  // still open. lsof sees those leaks as well as live masters and slaves.
  return resourceListing().filter((line) => /\/dev\/(?:ptmx|ttys\w+)$|\(revoked\)$/.test(line)).length;
}

describe.skipIf(process.platform !== "darwin")("node-pty resources", () => {
  it("releases both PTY ends after short-lived workers exit", async () => {
    const baseline = openPtyDescriptors();
    for (let index = 0; index < 6; index += 1) {
      await new Promise<void>((resolve) => {
        const child = spawn("/usr/bin/true", [], { name: "xterm-256color", cols: 80, rows: 24, cwd: "/tmp", env: { PATH: "/usr/bin:/bin" } });
        child.onExit(() => { (child as unknown as { destroy(): void }).destroy(); resolve(); });
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(openPtyDescriptors()).toBe(baseline);
  });

  it("releases exit-monitor queues after workers exit", async () => {
    const baseline = resourceListing().filter((line) => line.includes(" KQUEUE ")).length;
    for (let index = 0; index < 6; index += 1) {
      await new Promise<void>((resolve) => {
        const child = spawn("/usr/bin/true", [], { cwd: "/tmp", env: { PATH: "/usr/bin:/bin" } });
        child.onExit(() => { (child as unknown as { destroy(): void }).destroy(); resolve(); });
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(resourceListing().filter((line) => line.includes(" KQUEUE ")).length).toBe(baseline);
  });

  it("releases descriptors when the native spawn helper cannot start", () => {
    const require = createRequire(import.meta.url);
    const native = require("node-pty/lib/utils.js").loadNativeModule("pty").module;
    const baseline = openPtyDescriptors();
    for (let index = 0; index < 6; index += 1) {
      expect(() => native.fork("/usr/bin/true", [], ["PATH=/usr/bin:/bin"], "/tmp", 80, 24, -1, -1, true,
        "/nonexistent/swarm-spawn-helper", () => undefined)).toThrow();
    }
    expect(openPtyDescriptors()).toBe(baseline);
  });
});
