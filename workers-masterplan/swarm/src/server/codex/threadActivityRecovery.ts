import type { ThreadSummary } from "../../shared/contracts.js";

interface RolloutActivityReader {
  readRecentActivity(threadId: string): Promise<{ activity: "active" | "idle"; turnId?: string } | undefined>;
}

export async function recoverThreadActivity(thread: ThreadSummary, reader: RolloutActivityReader): Promise<ThreadSummary> {
  try {
    const recovered = await reader.readRecentActivity(thread.id);
    if (recovered?.activity !== "active") return thread;
    return { ...thread, activity: "active", ...(recovered.turnId ? { activeTurnId: recovered.turnId } : {}) };
  } catch {
    return thread;
  }
}
