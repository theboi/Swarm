import { mkdir, mkdtemp, lstat, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CodexAccountSlot } from "../../shared/contracts.js";
import { LegacyProfileMigrator } from "./legacyProfileMigrator.js";

let directory: string | undefined;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

async function fixture() {
  directory = await mkdtemp(join(tmpdir(), "swarm-migration-"));
  const home = join(directory, "bot1");
  const codexHome = join(home, ".codex");
  await mkdir(codexHome, { recursive: true });
  await writeFile(join(codexHome, "history.jsonl"), "history");
  const slot: CodexAccountSlot = { id: "bot1/acc1", macosUser: "bot1", accountNumber: 1, codexHome, workspaceRoot: join(home, "Dev-EdenMind") };
  const replace = vi.fn(async (next: CodexAccountSlot) => { slot.codexHome = next.codexHome; });
  return { home, codexHome, slot, replace, registry: { resolve: () => slot, replace } };
}

describe("LegacyProfileMigrator", () => {
  it("rejects all live migrations except bot1 before touching any path", async () => {
    const { home, codexHome, registry } = await fixture();
    const migrator = new LegacyProfileMigrator({ registry, homeDirectory: () => home, desktopRunning: async () => false, appServersRunning: async () => false });

    await expect(migrator.migrate("bot2", "apply")).rejects.toMatchObject({ code: "PRIMARY_PROFILE_CONFLICT" });
    expect((await lstat(codexHome)).isDirectory()).toBe(true);
  });

  it("atomically migrates bot1 acc1 to a managed profile and is idempotent", async () => {
    const { home, codexHome, registry } = await fixture();
    const migrator = new LegacyProfileMigrator({ registry, homeDirectory: () => home, desktopRunning: async () => false, appServersRunning: async () => false });

    await expect(migrator.migrate("bot1", "apply")).resolves.toMatchObject({ migrated: true, accountId: "bot1/acc1" });
    const managed = join(home, ".swarm", "codex-profiles", "acc1");
    expect(await readlink(codexHome)).toBe(managed);
    await expect(migrator.migrate("bot1", "apply")).resolves.toMatchObject({ migrated: false, accountId: "bot1/acc1" });
  });

  it("does not move a live app-server profile and labels a non-canary dry run accurately", async () => {
    const { home, codexHome, registry } = await fixture();
    const migrator = new LegacyProfileMigrator({ registry, homeDirectory: () => home, desktopRunning: async () => false, appServersRunning: async () => true });

    await expect(migrator.migrate("bot1", "apply")).rejects.toMatchObject({ code: "PRIMARY_PROFILE_CONFLICT" });
    expect((await lstat(codexHome)).isDirectory()).toBe(true);
    await expect(migrator.migrate("bot2", "dry-run")).resolves.toMatchObject({ accountId: "bot2/acc1", migrated: false });
  });

  it("restores the original directory when registry publication fails", async () => {
    const { home, codexHome, registry } = await fixture();
    registry.replace = vi.fn(async () => { throw new Error("registry unavailable"); });
    const migrator = new LegacyProfileMigrator({ registry, homeDirectory: () => home, desktopRunning: async () => false, appServersRunning: async () => false });

    await expect(migrator.migrate("bot1", "apply")).rejects.toMatchObject({ code: "PRIMARY_PROFILE_CONFLICT" });
    expect((await lstat(codexHome)).isDirectory()).toBe(true);
    await expect(readFile(join(codexHome, "history.jsonl"), "utf8")).resolves.toBe("history");
  });
});
