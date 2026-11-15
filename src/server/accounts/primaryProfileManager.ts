import { lstat, readlink, readdir, realpath, rename, symlink, unlink } from "node:fs/promises";
import { join, relative } from "node:path";

import type { BotProfileAccountId, CodexAccountSlot, MacosBotId, PrimaryProfileState } from "../../shared/contracts.js";

export class ProfileOperationError extends Error {
  constructor(readonly code: "DESKTOP_APP_RUNNING" | "PRIMARY_PROFILE_CONFLICT" | "PRIMARY_SWITCH_FAILED", message: string = code) {
    super(message);
  }
}

type Registry = {
  forBot(bot: MacosBotId): CodexAccountSlot[];
  resolve(id: BotProfileAccountId): CodexAccountSlot | undefined;
};

function contained(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!path.startsWith("..") && !path.includes("../"));
}

export class PrimaryProfileManager {
  private queue = Promise.resolve();

  constructor(private readonly options: {
    registry: Registry;
    homeDirectory?: (bot: MacosBotId) => string;
    desktopRunning: (bot: MacosBotId) => Promise<boolean>;
  }) {}

  async inspect(bot: MacosBotId): Promise<PrimaryProfileState> {
    await this.reconcile(bot);
    const slots = this.options.registry.forBot(bot);
    const primary = slots.find((slot) => slot.accountNumber === 1);
    const link = join(this.home(bot), ".codex");
    try {
      const details = await lstat(link);
      if (!details.isSymbolicLink()) return details.isDirectory() && primary
        ? { macosUser: bot, primaryAccountId: primary.id, mode: "legacy_primary" }
        : { macosUser: bot, primaryAccountId: null, mode: "error" };
      const actual = await realpath(link);
      for (const slot of slots) if (await realpath(slot.codexHome).catch(() => "") === actual) return { macosUser: bot, primaryAccountId: slot.id, mode: "managed" };
    } catch { /* report a non-actionable primary state below */ }
    return { macosUser: bot, primaryAccountId: null, mode: "error" };
  }

  async makePrimary(accountId: BotProfileAccountId): Promise<PrimaryProfileState> {
    const operation = this.queue.then(() => this.switch(accountId));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async switch(accountId: BotProfileAccountId): Promise<PrimaryProfileState> {
    const slot = this.options.registry.resolve(accountId);
    if (!slot) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Unknown profile slot");
    if (!accountId.startsWith(`${slot.macosUser}/`)) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Profile slot owner does not match its ID");
    if (await this.options.desktopRunning(slot.macosUser)) throw new ProfileOperationError("DESKTOP_APP_RUNNING");
    const current = await this.inspect(slot.macosUser);
    if (current.mode !== "managed" || !current.primaryAccountId) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Primary path is not a managed symlink");
    const path = join(this.home(slot.macosUser), ".codex");
    const root = join(this.home(slot.macosUser), ".swarm", "codex-profiles");
    const target = await realpath(slot.codexHome).catch(() => { throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Profile home is unavailable"); });
    if (!contained(await realpath(root).catch(() => root), target)) throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT", "Profile is outside managed root");
    const previous = await readlink(path).catch(() => { throw new ProfileOperationError("PRIMARY_PROFILE_CONFLICT"); });
    const temporary = `${path}.swarm-next-${process.pid}-${Date.now()}`;
    let replaced = false;
    try {
      await symlink(slot.codexHome, temporary);
      if (await realpath(temporary) !== target) throw new Error("Temporary primary link verification failed");
      await rename(temporary, path);
      replaced = true;
      const state = await this.inspect(slot.macosUser);
      if (state.mode !== "managed" || state.primaryAccountId !== slot.id) throw new Error("Primary verification failed");
      return state;
    } catch {
      try {
        if (replaced) {
          await unlink(path);
          await symlink(previous, temporary);
          await rename(temporary, path);
        } else if ((await lstat(temporary)).isSymbolicLink()) {
          await unlink(temporary);
        }
      } catch { /* retain the original transaction failure below */ }
      throw new ProfileOperationError("PRIMARY_SWITCH_FAILED");
    }
  }

  private home(bot: MacosBotId): string {
    return this.options.homeDirectory?.(bot) ?? `/Users/${bot}`;
  }

  private async reconcile(bot: MacosBotId): Promise<void> {
    const home = this.home(bot);
    const root = join(home, ".swarm", "codex-profiles");
    const entries = await readdir(home).catch(() => [] as string[]);
    for (const entry of entries.filter((name) => name.startsWith(".codex.swarm-next-"))) {
      const path = join(home, entry);
      try {
        if (!(await lstat(path)).isSymbolicLink()) continue;
        const target = await realpath(path);
        if (contained(await realpath(root).catch(() => root), target)) await unlink(path);
      } catch { /* leave ambiguous artifacts untouched */ }
    }
  }
}
