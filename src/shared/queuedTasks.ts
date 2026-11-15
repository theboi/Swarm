export const QUEUED_TASK_STATUSES = ["todo", "priority", "in-progress", "complete"] as const;
export type QueuedTaskStatus = typeof QUEUED_TASK_STATUSES[number];
export type QueuedTaskList = { id: string; name: string; createdAt: string };
export type QueuedTask = { id: string; listId: string; description: string; createdAt: string; status: QueuedTaskStatus };
