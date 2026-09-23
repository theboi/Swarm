import { fstatSync } from "node:fs";
import { spawn } from "node-pty";
import { describe, expect, it } from "vitest";

function openPtyMasters(): number {
  let count = 0;
  for (let fd = 3; fd < 256; fd += 1) {
    try {
      const entry = fstatSync(fd);
      if (entry.isCharacterDevice() && entry.rdev >>> 24 === 15) count += 1;
    } catch { /* closed descriptor */ }
  }
  return count;
}

describe.skipIf(process.platform !== "darwin")("node-pty resources", () => {
  it("releases every PTY master after short-lived workers exit", async () => {
    const baseline = openPtyMasters();
    for (let index = 0; index < 6; index += 1) {
      await new Promise<void>((resolve) => {
        const child = spawn("/usr/bin/true", [], { name: "xterm-256color", cols: 80, rows: 24, cwd: "/tmp", env: { PATH: "/usr/bin:/bin" } });
        child.onExit(() => { (child as unknown as { destroy(): void }).destroy(); resolve(); });
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(openPtyMasters()).toBe(baseline);
  });
});
