import { mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MACOS_BOT_IDS, type CodexAccountSlot, type MacosBotId } from "../../shared/contracts.js";
import { ProfileRegistry } from "./profileRegistry.js";

function legacySlot(macosUser: MacosBotId): CodexAccountSlot {
  return {
    id: `${macosUser}/acc1`,
    macosUser,
    accountNumber: 1,
    codexHome: `/Users/${macosUser}/.codex`,
    workspaceRoot: `/Users/${macosUser}/Dev/EdenMind`,
  };
}

function managedSlot(macosUser: MacosBotId, accountNumber: number): CodexAccountSlot {
  return {
    id: `${macosUser}/acc${accountNumber}`,
    macosUser,
    accountNumber,
    codexHome: `/Users/${macosUser}/.swarm/codex-profiles/acc${accountNumber}`,
    workspaceRoot: `/Users/${macosUser}/Dev/EdenMind`,
  };
}

async function withRegistry(test: (path: string, directory: string) => Promise<void>): Promise<void> {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "swarm-profile-registry-")));
  try { await test(join(directory, "account-profiles.json"), directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

describe("ProfileRegistry", () => {
  it("synthesizes legacy acc1 profiles for every macOS bot when the registry is absent", async () => withRegistry(async (path) => {
    const registry = await ProfileRegistry.load(path);

    expect(registry.list()).toHaveLength(8);
    expect(registry.resolve("bot1/acc1")).toEqual(legacySlot("bot1"));
    expect(registry.nextId("bot1")).toBe("bot1/acc2");
    expect(registry.forBot("bot3")).toEqual([legacySlot("bot3")]);
  }));

  it("rejects malformed, secret-like, colliding, or incomplete registry records", async () => withRegistry(async (path) => {
    const valid = { schemaVersion: 1, profiles: MACOS_BOT_IDS.map(legacySlot) };
    const invalidFiles = [
      { ...valid, profiles: [...valid.profiles, legacySlot("bot1")] },
      { ...valid, profiles: valid.profiles.map((slot) => slot.macosUser === "bot1" ? { ...slot, codexHome: "/Users/bot1/.codex/../.codex" } : slot) },
      { ...valid, profiles: valid.profiles.filter((slot) => slot.macosUser !== "bot4") },
      { ...valid, profiles: valid.profiles.map((slot) => slot.macosUser === "bot2" ? { ...slot, id: "bot9/acc1", macosUser: "bot9" } : slot) },
      { ...valid, profiles: valid.profiles.map((slot) => slot.macosUser === "bot5" ? { ...slot, accountNumber: 2 } : slot) },
      { ...valid, profiles: valid.profiles.map((slot) => slot.macosUser === "bot6" ? { ...slot, workspaceRoot: "/Users/bot6/Dev/EdenMind-acc2" } : slot) },
      { ...valid, accessToken: "never-store-me" },
    ];

    for (const value of invalidFiles) {
      await writeFile(path, JSON.stringify(value));
      await expect(ProfileRegistry.load(path)).rejects.toThrow("PROFILE_REGISTRY_INVALID");
    }
  }));

  it("refuses to load a registry beneath a symbolic-link parent", async () => withRegistry(async (_path, directory) => {
    const linkedParent = join(directory, "linked-data");
    await symlink(directory, linkedParent);

    await expect(ProfileRegistry.load(join(linkedParent, "account-profiles.json"))).rejects.toThrow("PROFILE_REGISTRY_INVALID");
  }));

  it("serializes publish operations and atomically writes a private, non-secret registry", async () => withRegistry(async (path, directory) => {
    const registry = await ProfileRegistry.load(path);

    await Promise.all([
      registry.publish(managedSlot("bot1", 2)),
      registry.publish(managedSlot("bot1", 3)),
    ]);

    expect(registry.forBot("bot1")).toEqual([legacySlot("bot1"), managedSlot("bot1", 2), managedSlot("bot1", 3)]);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual({ schemaVersion: 1, profiles: registry.list() });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect((await readdir(directory)).some((entry) => entry.includes(".tmp"))).toBe(false);
  }));

  it("migrates old per-profile clone paths to the bot's shared checkout", async () => withRegistry(async (path) => {
    const oldSecondary = { ...managedSlot("bot1", 2), workspaceRoot: "/Users/bot1/Dev/EdenMind-acc2" };
    await writeFile(path, JSON.stringify({ schemaVersion: 1, profiles: [...MACOS_BOT_IDS.map(legacySlot), oldSecondary] }));

    const registry = await ProfileRegistry.load(path);

    expect(registry.resolve("bot1/acc2")?.workspaceRoot).toBe("/Users/bot1/Dev/EdenMind");
    expect(JSON.parse(await readFile(path, "utf8")).profiles.find((slot: CodexAccountSlot) => slot.id === "bot1/acc2").workspaceRoot).toBe("/Users/bot1/Dev/EdenMind");
  }));
});
