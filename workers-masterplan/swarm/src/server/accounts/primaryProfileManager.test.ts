import { mkdir, mkdtemp, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { CodexAccountSlot } from "../../shared/contracts.js";
import { PrimaryProfileManager } from "./primaryProfileManager.js";

let directory: string | undefined;

afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

async function fixture() {
  directory = await mkdtemp(join(tmpdir(), "swarm-primary-"));
  const home = join(directory, "bot1");
  const profiles = join(home, ".swarm", "codex-profiles");
  const acc1 = join(profiles, "acc1");
  const acc2 = join(profiles, "acc2");
  await mkdir(acc1, { recursive: true });
  await mkdir(acc2, { recursive: true });
  const slots: CodexAccountSlot[] = [
    { id: "bot1/acc1", macosUser: "bot1", accountNumber: 1, codexHome: acc1, workspaceRoot: join(home, "Dev-EdenMind") },
    { id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, codexHome: acc2, workspaceRoot: join(home, "Dev-EdenMind-acc2") },
  ];
  const registry = { forBot: (bot: string) => bot === "bot1" ? slots : [], resolve: (id: string) => slots.find((slot) => slot.id === id) };
  return { home, acc1, acc2, slots, registry };
}

describe("PrimaryProfileManager", () => {
  it("reports an unmigrated acc1 as the legacy primary without changing the filesystem", async () => {
    const { home, registry } = await fixture();
    await mkdir(join(home, ".codex"));
    const manager = new PrimaryProfileManager({ registry, homeDirectory: () => home, desktopRunning: async () => false });

    await expect(manager.inspect("bot1")).resolves.toEqual({ macosUser: "bot1", primaryAccountId: "bot1/acc1", mode: "legacy_primary" });
  });

  it("switches only a managed primary symlink and serializes the resulting state", async () => {
    const { home, acc1, acc2, registry } = await fixture();
    await symlink(acc1, join(home, ".codex"));
    const manager = new PrimaryProfileManager({ registry, homeDirectory: () => home, desktopRunning: async () => false });

    await expect(manager.makePrimary("bot1/acc2")).resolves.toEqual({ macosUser: "bot1", primaryAccountId: "bot1/acc2", mode: "managed" });
    expect(await readlink(join(home, ".codex"))).toBe(acc2);
  });

  it("refuses Desktop-running and unmanaged primary paths without replacing them", async () => {
    const { home, acc1, registry } = await fixture();
    await symlink(acc1, join(home, ".codex"));
    const running = new PrimaryProfileManager({ registry, homeDirectory: () => home, desktopRunning: async () => true });
    await expect(running.makePrimary("bot1/acc2")).rejects.toMatchObject({ code: "DESKTOP_APP_RUNNING" });

    await rm(join(home, ".codex"));
    await writeFile(join(home, ".codex"), "unmanaged");
    const stopped = new PrimaryProfileManager({ registry, homeDirectory: () => home, desktopRunning: async () => false });
    await expect(stopped.makePrimary("bot1/acc2")).rejects.toMatchObject({ code: "PRIMARY_PROFILE_CONFLICT" });
  });

  it("reconciles only an owned interrupted temporary link", async () => {
    const { home, acc1, acc2, registry } = await fixture();
    await symlink(acc1, join(home, ".codex"));
    const interrupted = join(home, ".codex.swarm-next-interrupted");
    await symlink(acc2, interrupted);
    const manager = new PrimaryProfileManager({ registry, homeDirectory: () => home, desktopRunning: async () => false });

    await expect(manager.inspect("bot1")).resolves.toMatchObject({ mode: "managed", primaryAccountId: "bot1/acc1" });
    await expect(readlink(interrupted)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
