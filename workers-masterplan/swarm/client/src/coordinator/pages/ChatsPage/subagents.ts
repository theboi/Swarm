import type { AccountId, TranscriptItem } from "../../../shared/contracts.js";
import type { SubagentReference } from "./types.js";
function textField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function subagentReferences(items: TranscriptItem[], parentThreadId?: string | null): SubagentReference[] {
  const references = new Map<string, SubagentReference>();
  const add = (threadId: unknown, label?: unknown, active?: boolean) => {
    const id = textField(threadId);
    if (!id || id === parentThreadId) return;
    const prior = references.get(id);
    references.set(id, {
      threadId: id,
      label: textField(label) ?? prior?.label ?? `Subagent ${references.size + 1}`,
      active: active ?? prior?.active ?? false,
    });
  };

  for (const item of items) {
    if (item.type === "subAgentActivity") {
      const kind = textField(item.payload.kind)?.toLowerCase();
      add(item.payload.agentThreadId, item.payload.agentPath, kind === "started" || kind === "interacted" ? true : kind === "completed" || kind === "failed" ? false : undefined);
    }
    if (item.type !== "collabAgentToolCall") continue;
    const states = item.payload.agentsStates && typeof item.payload.agentsStates === "object" && !Array.isArray(item.payload.agentsStates)
      ? item.payload.agentsStates as Record<string, unknown>
      : {};
    const receivers = Array.isArray(item.payload.receiverThreadIds) ? item.payload.receiverThreadIds : [];
    for (const receiver of receivers) {
      const state = typeof receiver === "string" && states[receiver] && typeof states[receiver] === "object" && !Array.isArray(states[receiver])
        ? states[receiver] as Record<string, unknown>
        : {};
      const status = textField(state.status)?.toLowerCase();
      add(receiver, state.agentPath ?? state.path ?? state.name, status === "running" || status === "inprogress" || status === "pending" ? true : status === "completed" || status === "failed" ? false : undefined);
    }
  }
  return [...references.values()];
}

export function hasActiveDescendant(threadId: string, accountId: AccountId, graph: ReadonlyMap<string, SubagentReference[]>, activeTurnKeys: ReadonlySet<string>, activeThreadIds: ReadonlySet<string> = new Set(), visited: ReadonlySet<string> = new Set()): boolean {
  if (visited.has(threadId)) return false;
  const nextVisited = new Set([...visited, threadId]);
  return (graph.get(threadId) ?? []).some((child) => activeTurnKeys.has(`${accountId}\u0000${child.threadId}`)
    || activeThreadIds.has(child.threadId)
    || hasActiveDescendant(child.threadId, accountId, graph, activeTurnKeys, activeThreadIds, nextVisited));
}
