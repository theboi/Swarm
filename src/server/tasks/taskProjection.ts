import type { DispatchRecord, ManifestPass, TaskNode, TaskReadiness, ThreadSummary, WorkerAssignmentRecord } from "../../shared/contracts.js";

interface AssignmentReconciler {
  forTask(taskId: string, pass?: ManifestPass): WorkerAssignmentRecord | undefined;
  assign(taskId: string, accountId: WorkerAssignmentRecord["accountId"], threadId: string, now?: number, pass?: ManifestPass): Promise<void>;
  completeTask(taskId: string, pass: ManifestPass, now?: number): Promise<void>;
}

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

/** Completion is monotonic: a later incomplete refresh must not reopen finished work. */
export function retainCompletedTaskIds(previous: ReadonlySet<string>, readiness: readonly TaskReadiness[]): Set<string> {
  return new Set([...previous, ...readiness.filter((task) => task.state === "complete").map((task) => task.taskId)]);
}

export async function reconcileTaskAssignments(nodes: TaskNode[], pass: ManifestPass, threads: ThreadSummary[], assignments: AssignmentReconciler, completedTaskIds: ReadonlySet<string> = new Set()): Promise<void> {
  for (const node of nodes) {
    const existing = assignments.forTask(node.id, pass);
    if (existing) {
      if ((completedTaskIds.has(node.id) || node.readiness.state === "complete") && existing.state !== "completed") await assignments.completeTask(node.id, pass);
      continue;
    }
    const thread = latestUnarchivedTaskThread(threads, node.id);
    if (!thread) continue;
    await assignments.assign(node.id, thread.accountId, thread.id, thread.updatedAt, pass);
    if (completedTaskIds.has(node.id) || node.readiness.state === "complete") await assignments.completeTask(node.id, pass, thread.updatedAt);
  }
}

/** Overlay durable launches and live named project chats without hiding a completed task. */
export function projectDispatchState(nodes: TaskNode[], dispatches: DispatchRecord[], threads: ThreadSummary[] = [], assignments: WorkerAssignmentRecord[] = [], completedTaskIds: ReadonlySet<string> = new Set()): TaskNode[] {
  const runningTaskIds = new Set(dispatches.filter((dispatch) => ACTIVE_DISPATCH_STATES.has(dispatch.state)).map((dispatch) => dispatch.taskId));
  for (const node of nodes) {
    if (latestUnarchivedTaskThread(threads, node.id)) runningTaskIds.add(node.id);
  }
  return nodes.map((node) => {
    if (completedTaskIds.has(node.id)) return { ...node, readiness: { ...node.readiness, state: "complete", blockingCodes: [] } };
    const assignment = assignments.find((candidate) => candidate.taskId === node.id);
    if (assignment?.state === "attention_required" && node.readiness.state !== "complete") return { ...node, readiness: { ...node.readiness, state: "attention_required" } };
    if (node.readiness.state !== "complete" && (assignment?.state === "assigned" || assignment?.state === "waiting_for_limit" || assignment?.state === "resuming" || assignment?.state === "transferring" || runningTaskIds.has(node.id))) {
      return { ...node, readiness: { ...node.readiness, state: "running", blockingCodes: [] } };
    }
    return node;
  });
}
