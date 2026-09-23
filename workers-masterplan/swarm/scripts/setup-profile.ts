import { resolve } from "node:path";

import { isBotProfileAccountId, type BotProfileAccountId, type CodexAccountSlot } from "../src/shared/contracts.js";
import { ProfileProvisioner } from "../src/server/accounts/profileProvisioner.js";
import { ProfileRegistry } from "../src/server/accounts/profileRegistry.js";
import { loadConfig } from "../src/server/config/config.js";
import { codexLoginCommand } from "../src/server/codex/terminalConsole.js";

export interface SetupArguments { accountId: BotProfileAccountId; }

export function parseSetupArguments(argv: readonly string[]): SetupArguments {
  if (argv.some((argument) => argument !== "--account" && argument.startsWith("--"))) throw new Error("Unsupported setup argument");
  if (argv.length !== 2 || argv[0] !== "--account") throw new Error("Specify exactly one --account logical profile ID");
  if (!isBotProfileAccountId(argv[1])) throw new Error("--account must be a logical profile ID");
  if (/\/acc1$/.test(argv[1])) throw new Error("--account must be a managed secondary profile ID");
  return { accountId: argv[1] };
}

export async function runSetupCommand(command: SetupArguments, dependencies: {
  repair(accountId: BotProfileAccountId): Promise<CodexAccountSlot>;
  codexBin: string;
}): Promise<{ accountId: BotProfileAccountId; manualLoginCommand: string }> {
  const slot = await dependencies.repair(command.accountId);
  return { accountId: slot.id, manualLoginCommand: codexLoginCommand(slot, dependencies.codexBin) };
}

async function main(): Promise<void> {
  const command = parseSetupArguments(process.argv.slice(2));
  const config = await loadConfig();
  const registry = await ProfileRegistry.load(resolve(process.cwd(), ".data", "account-profiles.json"));
  const provisioner = new ProfileProvisioner({
    registry,
    repositoryUrl: config.repositoryUrl,
    passwordFor: (bot) => config.accountPasswords[bot],
  });
  const result = await runSetupCommand(command, { repair: (accountId) => provisioner.repair(accountId), codexBin: config.codexBin });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === new URL(`file://${executedPath}`).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`Profile setup refused: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
