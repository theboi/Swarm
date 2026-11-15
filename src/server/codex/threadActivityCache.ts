import type { ThreadSummary } from "../../shared/contracts.js";
import type { NormalizedAppServerEvent } from "./appServerClient.js";

const TERMINAL_TURN_STATES = new Set(["completed", "failed", "interrupted", "limit_exhausted"]);

export function applyThreadActivityEvent(threads: ThreadSummary[], event: NormalizedAppServerEvent): ThreadSummary[] {
  if (event.type !== "turn" || !event.threadId) return threads;
  return threads.map((thread) => {
    if (thread.accountId !== event.accountId || thread.id !== event.threadId) return thread;
    if (event.state === "started") {
      return { ...thread, activity: "active", ...(event.turnId ? { activeTurnId: event.turnId } : {}) };
    }
    if (!event.state || !TERMINAL_TURN_STATES.has(event.state)) return thread;
    if (thread.activeTurnId && event.turnId !== thread.activeTurnId) return thread;
    const { activeTurnId: _activeTurnId, ...idle } = thread;
    return { ...idle, activity: "idle" };
  });
}
