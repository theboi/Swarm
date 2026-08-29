import type { DispatchRecord, TaskNode, ThreadSummary, WorkerAssignmentRecord } from "../../shared/contracts.js";

const ACTIVE_DISPATCH_STATES = new Set<DispatchRecord["state"]>(["queued", "submitting", "accepted", "waiting_for_limit"]);

function taskNamePattern(taskId: string): RegExp {
  const escaped = taskId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}(?:$|\\s*[·:—-]\\s*)`, "i");
}

/** Selects the newest unarchived project chat for a task, regardless of whether its latest turn is active. */
export function latestUnarchivedTaskThread(threads: ThreadSummary[], taskId: string): ThreadSummary | undefined {
  return threads
    .filter((thread) => !thread.archived && thread.isEdenMindProject === true && Boolean(thread.name) && taskNamePattern(taskId).test(thread.name!))
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

/** Overlay durable launches and live named project chats without hiding a completed task. */
export function projectDispatchState(nodes: TaskNode[], dispatches: DispatchRecord[], threads: ThreadSummary[] = [], assignments: WorkerAssignmentRecord[] = [], completedTaskIds: ReadonlySet<string> = new Set()): TaskNode[] {
  const runningTaskIds = new Set(dispatches.filter((dispatch) => ACTIVE_DISPATCH_STATES.has(dispatch.state)).map((dispatch) => dispatch.taskId));
  // Completion is owned by repository evidence. Durable dispatch and assignment
  // records describe orchestration state and must never promote an unfinished phase.
  void completedTaskIds;
  for (const node of nodes) {
    if (latestUnarchivedTaskThread(threads, node.id)) runningTaskIds.add(node.id);
  }
  return nodes.map((node) => {
    const assignment = assignments.find((candidate) => candidate.taskId === node.id);
    if (assignment?.state === "attention_required" && node.readiness.state !== "complete") return { ...node, readiness: { ...node.readiness, state: "attention_required" } };
    if (node.readiness.state !== "complete" && (assignment?.state === "assigned" || assignment?.state === "waiting_for_limit" || assignment?.state === "resuming" || assignment?.state === "transferring" || runningTaskIds.has(node.id))) {
      return { ...node, readiness: { ...node.readiness, state: "running", blockingCodes: [] } };
    }
    return node;
  });
}
