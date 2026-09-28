import type { ThreadSummary } from "../../shared/contracts.js";

interface RolloutActivityReader {
  readRecentActivity(threadId: string): Promise<{ activity: "active" | "idle"; turnId?: string; terminal?: boolean } | undefined>;
}

export async function recoverThreadActivity(thread: ThreadSummary, reader: RolloutActivityReader): Promise<ThreadSummary> {
  try {
    const recovered = await reader.readRecentActivity(thread.id);
    if (recovered?.activity === "active") return { ...thread, activity: "active", ...(recovered.turnId ? { activeTurnId: recovered.turnId } : {}) };
    if (recovered?.terminal) {
      const { activeTurnId: _activeTurnId, ...idle } = thread;
      return { ...idle, activity: "idle" };
    }
    return thread;
  } catch {
    return thread;
  }
}
