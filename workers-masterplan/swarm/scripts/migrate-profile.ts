import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

import { isMacosBotId, type BotProfileAccountId, type MacosBotId } from "../src/shared/contracts.js";
import { LegacyProfileMigrator } from "../src/server/accounts/legacyProfileMigrator.js";
import { ProfileRegistry } from "../src/server/accounts/profileRegistry.js";

const execFile = promisify(execFileCallback);

export interface MigrationArguments {
  bot: MacosBotId;
  mode: "dry-run" | "apply";
}

type MigrationResult = {
  accountId: BotProfileAccountId;
  migrated: boolean;
  source: string;
  destination: string;
};

export interface MigrationCommandDependencies {
  migrator: { migrate(bot: MacosBotId, mode: "dry-run" | "apply"): Promise<MigrationResult> };
}

export function parseMigrationArguments(argv: readonly string[]): MigrationArguments {
  const bots: string[] = [];
  let mode: MigrationArguments["mode"] = "dry-run";
  let explicitMode = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--bot") {
      const bot = argv[index + 1];
      if (!bot || bot.startsWith("--")) throw new Error("--bot requires bot1 through bot8");
      bots.push(bot);
      index += 1;
    } else if (argument === "--dry-run" || argument === "--apply") {
      if (explicitMode) throw new Error("Specify at most one of --dry-run or --apply");
      mode = argument.slice(2) as MigrationArguments["mode"];
      explicitMode = true;
    } else {
      throw new Error(`Unsupported migration argument: ${argument}`);
    }
  }

  if (bots.length !== 1) throw new Error("Specify exactly one --bot bot1 through bot8");
  if (!isMacosBotId(bots[0])) throw new Error("--bot must be bot1 through bot8");
  return { bot: bots[0], mode };
}

/** This guard intentionally runs before a migrator can receive a live request. */
export async function runMigrationCommand(command: MigrationArguments, dependencies: MigrationCommandDependencies): Promise<MigrationResult> {
  if (command.mode === "apply" && command.bot !== "bot1") throw new Error("Only bot1 may receive a live migration during this release");
  return dependencies.migrator.migrate(command.bot, command.mode);
}

async function matchingProcess(arguments_: string[]): Promise<boolean> {
  try {
    await execFile("/usr/bin/pgrep", arguments_);
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === 1) return false;
    // Process detection uncertainty must block a destructive filesystem operation.
    return true;
  }
}

async function main(): Promise<void> {
  const command = parseMigrationArguments(process.argv.slice(2));
  const registry = await ProfileRegistry.load(resolve(process.cwd(), ".data", "account-profiles.json"));
  const migrator = new LegacyProfileMigrator({
    registry,
    desktopRunning: async () => matchingProcess(["-f", "ChatGPT.app"]),
    appServersRunning: async (bot) => matchingProcess(["-u", bot, "-f", "codex.*app-server"]),
  });
  const result = await runMigrationCommand(command, { migrator });
  process.stdout.write(`${JSON.stringify({ bot: command.bot, mode: command.mode, ...result })}\n`);
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === new URL(`file://${executedPath}`).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown migration error";
    process.stderr.write(`Migration refused: ${message}\n`);
    process.exitCode = 1;
  });
}
