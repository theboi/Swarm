import { Router, type Request, type RequestHandler } from "express";
import { QUEUED_TASK_STATUSES, type QueuedTaskStatus } from "../../shared/queuedTasks.js";
import { QueuedTaskError, type QueuedTasks } from "../tasks/queuedTasks.js";
import { apiError } from "./authMiddleware.js";

function body(request: Request, keys: string[]): Record<string, unknown> {
  const value: unknown = request.body;
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new QueuedTaskError(400, "Invalid request fields");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value) throw new QueuedTaskError(400, "Required text is missing");
  return value;
}
export function createQueuedTaskRouter(queue: QueuedTasks, read: readonly RequestHandler[], write: readonly RequestHandler[]) {
  const router = Router();
  const handle = (operation: (request: Request) => Promise<unknown>): RequestHandler => (request, response) => {
    void Promise.resolve().then(() => operation(request)).then(data => response.json({ data })).catch(error => {
      if (error instanceof QueuedTaskError) apiError(response, error.status, error.status === 404 ? "NOT_FOUND" : "INVALID_REQUEST", error.message);
      else apiError(response, 500, "OPERATION_FAILED", "Unable to access queued tasks. Try again.");
    });
  };
  router.get("/queued-task-lists", ...read, handle(() => queue.lists()));
  router.post("/queued-task-lists", ...write, handle(request => queue.createList(string(body(request, ["name"]).name))));
  router.get("/queued-tasks", ...read, handle(request => queue.list(string(request.query.listId))));
  router.post("/queued-tasks", ...write, handle(request => {
    const input = body(request, ["listId", "description"]);
    return queue.add(string(input.listId), string(input.description));
  }));
  router.put("/queued-tasks/:id", ...write, handle(request => queue.edit(string(request.params.id), string(body(request, ["description"]).description))));
  router.delete("/queued-tasks/:id", ...write, handle(request => {
    body(request, []);
    return queue.remove(string(request.params.id));
  }));
  router.patch("/queued-tasks/:id", ...write, handle(request => {
    const input = body(request, ["status", "listId"]);
    if (Object.keys(input).length !== 1) throw new QueuedTaskError(400, "Choose a state or destination list");
    if (input.status !== undefined) {
      if (!QUEUED_TASK_STATUSES.includes(input.status as QueuedTaskStatus)) throw new QueuedTaskError(400, "Invalid todo state");
      return queue.change(string(request.params.id), { status: input.status as QueuedTaskStatus });
    }
    return queue.change(string(request.params.id), { listId: string(input.listId) });
  }));
  return router;
}
