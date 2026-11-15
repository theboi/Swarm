import { fileURLToPath } from "node:url";

import { isBotProfileAccountId, type BotProfileAccountId, type CodexAccountSlot, type MacosBotId } from "../../shared/contracts.js";
import { runBotPtyJsonWorker } from "../git/commandRunner.js";
import type { ProfileWorkerInput } from "./profileProvisionerWorker.js";

type Registry = {
  nextId(bot: MacosBotId): BotProfileAccountId;
  resolve(id: BotProfileAccountId): CodexAccountSlot | undefined;
  publish(slot: CodexAccountSlot): Promise<void>;
};

export class ProfileProvisionerError extends Error {
  constructor(readonly code: "PROFILE_SETUP_FAILED" | "PROFILE_AUTH_ISOLATION_UNAVAILABLE", message: string = code) {
    super(message);
  }
}

function slotFor(id: BotProfileAccountId, bot: MacosBotId): CodexAccountSlot {
  const match = /^bot[1-8]\/acc([1-9][0-9]*)$/.exec(id);
  const accountNumber = match ? Number(match[1]) : NaN;
  if (!Number.isInteger(accountNumber) || accountNumber < 2 || !id.startsWith(`${bot}/`)) throw new ProfileProvisionerError("PROFILE_SETUP_FAILED", "Invalid new profile ID");
  return {
    id,
    macosUser: bot,
    accountNumber,
    codexHome: `/Users/${bot}/.swarm/codex-profiles/acc${accountNumber}`,
    workspaceRoot: `/Users/${bot}/Dev/EdenMind`,
  };
}

function workerInput(slot: CodexAccountSlot, repositoryUrl: string): ProfileWorkerInput {
  return { codexHome: slot.codexHome, workspaceRoot: slot.workspaceRoot, repositoryUrl };
}

function workerPath(): string {
  return fileURLToPath(new URL("./profileProvisionerWorker.js", import.meta.url));
}

export class ProfileProvisioner {
  private mutation = Promise.resolve();
  private readonly runWorker: (bot: MacosBotId, password: string, input: ProfileWorkerInput) => Promise<void>;
  private readonly cleanupEmptyOwned: (bot: MacosBotId, paths: string[]) => Promise<void>;

  constructor(private readonly options: {
    registry: Registry;
    repositoryUrl: string;
    passwordFor(bot: MacosBotId): string | undefined;
    runWorker?: (bot: MacosBotId, password: string, input: ProfileWorkerInput) => Promise<void>;
    cleanupEmptyOwned?: (bot: MacosBotId, paths: string[]) => Promise<void>;
  }) {
    this.runWorker = options.runWorker ?? ((bot, password, input) => runBotPtyJsonWorker(bot, password, workerPath(), input));
    this.cleanupEmptyOwned = options.cleanupEmptyOwned ?? (async () => undefined);
  }

  create(bot: MacosBotId): Promise<CodexAccountSlot> {
    return this.serialize(async () => {
      const slot = slotFor(this.options.registry.nextId(bot), bot);
      await this.setup(slot, true);
      return slot;
    });
  }

  repair(accountId: BotProfileAccountId): Promise<CodexAccountSlot> {
    return this.serialize(async () => {
      if (!isBotProfileAccountId(accountId)) throw new ProfileProvisionerError("PROFILE_SETUP_FAILED", "Invalid profile ID");
      const slot = this.options.registry.resolve(accountId);
      if (!slot) throw new ProfileProvisionerError("PROFILE_SETUP_FAILED", "Unknown profile slot");
      if (slot.accountNumber < 2 || slot.codexHome !== `/Users/${slot.macosUser}/.swarm/codex-profiles/acc${slot.accountNumber}` || slot.workspaceRoot !== `/Users/${slot.macosUser}/Dev/EdenMind`) {
        throw new ProfileProvisionerError("PROFILE_SETUP_FAILED", "Only managed secondary profile slots can be repaired");
      }
      await this.setup(slot, false);
      return { ...slot };
    });
  }

  private async setup(slot: CodexAccountSlot, publish: boolean): Promise<void> {
    const password = this.options.passwordFor(slot.macosUser);
    if (!password) throw new ProfileProvisionerError("PROFILE_SETUP_FAILED", "Bot password is unavailable");
    try {
      await this.runWorker(slot.macosUser, password, workerInput(slot, this.options.repositoryUrl));
      if (publish) await this.options.registry.publish(slot);
    } catch (error) {
      if (publish) await this.cleanupEmptyOwned(slot.macosUser, [slot.codexHome]).catch(() => undefined);
      if (error instanceof ProfileProvisionerError) throw error;
      if (error instanceof Error && error.message === "PROFILE_AUTH_ISOLATION_UNAVAILABLE") throw new ProfileProvisionerError("PROFILE_AUTH_ISOLATION_UNAVAILABLE");
      throw new ProfileProvisionerError("PROFILE_SETUP_FAILED");
    }
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.mutation.then(operation);
    this.mutation = next.then(() => undefined, () => undefined);
    return next;
  }
}
