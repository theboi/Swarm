import { lstat, mkdir, realpath, rename, stat, symlink, unlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { BotProfileAccountId, CodexAccountSlot, MacosBotId } from "../../shared/contracts.js";
import { ProfileOperationError } from "./primaryProfileManager.js";

type Registry = {
  resolve(id: BotProfileAccountId): CodexAccountSlot | undefined;
  replace(slot: CodexAccountSlot): Promise<void>;
};

function contained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!path.startsWith("..") && !path.includes("../"));
}

async function isSymbolicLink(path: string): Promise<boolean> {
  return lstat(path).then((details) => details.isSymbolicLink()).catch(() => false);
}

export class LegacyProfileMigrator {
  constructor(private readonly options: {
    registry: Registry;
    homeDirectory?: (bot: MacosBotId) => string;
    desktopRunning: (bot: MacosBotId) => Promise<boolean>;
    appServersRunning: (bot: MacosBotId) => Promise<boolean>;
    allowAllBots?: boolean;
  }) {}

  async migrate(bot: MacosBotId, mode: "dry-run" | "apply"): Promise<{ accountId: BotProfileAccountId; migrated: boolean; source: string; destination: string }> {
    if (mode === "apply" && bot !== "bot1" && !this.options.allowAllBots) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Only bot1 may be migrated unless all bots are explicit");
    const accountId = `${bot}/acc1` as BotProfileAccountId;
    const home = this.options.homeDirectory?.(bot) ?? `/Users/${bot}`;
    const source = join(home, ".codex");
    const destination = join(home, ".swarm", "codex-profiles", "acc1");
    if (mode === "dry-run") return { accountId, migrated: false, source, destination };
    if (await this.options.desktopRunning(bot) || await this.options.appServersRunning(bot)) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Desktop or an app-server is still running");
    const slot = this.options.registry.resolve(accountId);
    if (!slot) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "bot1 acc1 is unavailable");
    if (slot.id !== accountId || slot.macosUser !== bot) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Profile slot owner does not match its ID");
    const managedRoot = dirname(destination);
    await mkdir(managedRoot, { recursive: true });
    const expectedRoot = join(await realpath(home), ".swarm", "codex-profiles");
    if (await realpath(managedRoot) !== expectedRoot) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Managed profile root must not be a symbolic link");
    const sourceInfo = await lstat(source).catch(() => { throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Legacy Codex home is unavailable"); });
    if (sourceInfo.isSymbolicLink()) {
      const target = await realpath(source).catch(() => "");
      if (target === await realpath(destination).catch(() => "")) return { accountId, migrated: false, source, destination };
      throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Legacy Codex home is an unmanaged link");
    }
    if (!sourceInfo.isDirectory()) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Legacy Codex home is not a directory");
    if (await lstat(destination).then(() => true).catch(() => false)) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Managed destination already exists");
    if ((await stat(source)).dev !== (await stat(managedRoot)).dev) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Migration would cross filesystems");
    await rename(source, destination);
    const temporary = `${source}.swarm-next-${process.pid}-${Date.now()}`;
    let installed = false;
    try {
      await symlink(destination, temporary);
      if (await realpath(temporary) !== await realpath(destination)) throw new Error("Migration temporary link verification failed");
      await rename(temporary, source);
      installed = true;
      if (await realpath(source) !== await realpath(destination)) throw new Error("Migration link verification failed");
      await this.options.registry.replace({ ...slot, codexHome: destination });
      return { accountId, migrated: true, source, destination };
    } catch (error) {
      try {
        if (installed && await isSymbolicLink(source)) await unlink(source);
        else if (!installed && await isSymbolicLink(temporary)) await unlink(temporary);
        if (contained(home, destination) && await lstat(destination).then(() => true).catch(() => false)) await rename(destination, source);
      } catch { /* safest remaining state is reported as a conflict */ }
      if (error instanceof ProfileOperationError) throw error;
      throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Migration transaction failed");
    }
  }
}
