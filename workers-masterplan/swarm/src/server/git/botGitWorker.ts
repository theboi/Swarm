import { readFile } from "node:fs/promises";

import { BOT_ACCOUNT_IDS, type BotAccountId } from "../../shared/contracts.js";
import { runBotPtyCommand } from "./commandRunner.js";

interface WorkerInput {
  account: BotAccountId;
  password: string;
  command: string;
}

function workerInput(value: unknown): WorkerInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Git worker input");
  const candidate = value as Partial<WorkerInput>;
  if (!BOT_ACCOUNT_IDS.includes(candidate.account as BotAccountId) || typeof candidate.password !== "string" || !candidate.password || typeof candidate.command !== "string" || !candidate.command) throw new Error("Invalid Git worker input");
  return { account: candidate.account as BotAccountId, password: candidate.password, command: candidate.command };
}

try {
  const input = workerInput(JSON.parse(await readFile("/dev/stdin", "utf8")));
  process.exit(await runBotPtyCommand(input.account, input.password, input.command));
} catch {
  process.exit(1);
}
