import { userInfo } from "node:os";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { JSON_RESULT_PREFIX, JSON_RESULT_WORKER_READY } from "../git/jsonResultWorkerProtocol.js";
import { LocalRolloutTranscriptReader } from "./localRolloutReader.js";
import { validatePrivateRolloutInput } from "./privateRolloutWorker.js";

type Activity = Awaited<ReturnType<LocalRolloutTranscriptReader["readRecentActivity"]>>;

/** Reads only activity metadata under the bot's identity, never transcript content. */
export async function readPrivateActivities(
  value: unknown,
  username: string,
  read = async (home: string, threadId: string): Promise<Activity> => new LocalRolloutTranscriptReader(home).readRecentActivity(threadId),
): Promise<Record<string, NonNullable<Activity>>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid private activity request");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || !Array.isArray(input.threadIds) || input.threadIds.length > 20_000) throw new Error("Invalid private activity request");
  const requests = input.threadIds.map((threadId) => validatePrivateRolloutInput({ codexHome: input.codexHome, threadId }, username));
  const results: Record<string, NonNullable<Activity>> = {};
  for (const request of requests) {
    try {
      const activity = await read(request.codexHome, request.threadId);
      if (activity) results[request.threadId] = activity;
    } catch { /* A missing or rotating rollout must not hide other active threads. */ }
  }
  return results;
}

async function run(): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      const result = await readPrivateActivities(JSON.parse(line), userInfo().username);
      process.stdout.write(`${JSON_RESULT_PREFIX}${JSON.stringify(result)}\n`);
      return;
    }
    throw new Error("Missing private activity request");
  } finally { lines.close(); }
}

const executedPath = process.argv[1];
if (executedPath && import.meta.url === pathToFileURL(executedPath).href) {
  process.stdout.write(`${JSON_RESULT_WORKER_READY}\n`);
  run().catch(() => { process.exitCode = 1; });
}
