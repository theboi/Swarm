import type { ThreadSummary } from "../../shared/contracts.js";

interface RolloutActivityReader {
  readRecentActivity(threadId: string): Promise<"active" | "idle" | undefined>;
}

export async function recoverThreadActivity(thread: ThreadSummary, reader: RolloutActivityReader): Promise<ThreadSummary> {
  if (thread.activity === "active") return thread;
  try {
    return await reader.readRecentActivity(thread.id) === "active" ? { ...thread, activity: "active" } : thread;
  } catch {
    return thread;
  }
}
