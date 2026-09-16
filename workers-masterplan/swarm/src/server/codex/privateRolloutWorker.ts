import { userInfo } from "node:os";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline";

import { JSON_RESULT_PREFIX, JSON_RESULT_WORKER_READY } from "../git/jsonResultWorkerProtocol.js";
import { LocalRolloutTranscriptReader } from "./localRolloutReader.js";

interface PrivateRolloutInput {
  codexHome: string;
  threadId: string;
}

const THREAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROLLOUT_BYTES = 48 * 1024 * 1024;

export function validatePrivateRolloutInput(value: unknown, username: string): PrivateRolloutInput {
  if (!value || typeof value !== "object" || Array.isArray(value) || !/^bot[1-8]$/.test(username)) throw new Error("Invalid private rollout request");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || typeof input.codexHome !== "string" || typeof input.threadId !== "string" || !THREAD_ID.test(input.threadId)) {
    throw new Error("Invalid private rollout request");
  }
  const managedHome = new RegExp(`^/Users/${username}/\\.swarm/codex-profiles/acc[1-9][0-9]*$`);
  if (input.codexHome !== `/Users/${username}/.codex` && !managedHome.test(input.codexHome)) throw new Error("Invalid private rollout request");
  return { codexHome: input.codexHome, threadId: input.threadId };
}

async function readInput(): Promise<PrivateRolloutInput> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    for await (const line of lines) return validatePrivateRolloutInput(JSON.parse(line), userInfo().username);
    throw new Error("Invalid private rollout request");
  } finally {
    lines.close();
  }
}

async function run(): Promise<void> {
  const input = await readInput();
  const jsonl = await new LocalRolloutTranscriptReader(input.codexHome).readJsonl(input.threadId);
  if (Buffer.byteLength(jsonl, "utf8") > MAX_ROLLOUT_BYTES) throw new Error("Private rollout is too large");
  process.stdout.write(`${JSON_RESULT_PREFIX}${JSON.stringify({ jsonlBase64: Buffer.from(jsonl, "utf8").toString("base64") })}\n`);
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) {
  process.stdout.write(`${JSON_RESULT_WORKER_READY}\n`);
  run().catch(() => { process.exitCode = 1; });
}
