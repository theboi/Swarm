import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { QUEUED_TASK_STATUSES, type QueuedTask, type QueuedTaskList, type QueuedTaskStatus } from "../../shared/queuedTasks.js";

type QueueFile = { schemaVersion: 2; lists: QueuedTaskList[]; tasks: QueuedTask[] };
export class QueuedTaskError extends Error {
  constructor(readonly status: 400 | 404, message: string) { super(message); }
}
function text(value: string, limit: number, field: string) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new QueuedTaskError(400, `${field} is required (up to ${limit} characters)`);
}
function requireList(file: QueueFile, id: string) {
  if (!file.lists.some(list => list.id === id)) throw new QueuedTaskError(404, "List not found");
}
function requireTask(file: QueueFile, id: string) {
  const task = file.tasks.find(task => task.id === id);
  if (!task) throw new QueuedTaskError(404, "Todo not found");
  return task;
}
export class QueuedTasks {
  private mutation = Promise.resolve();
  constructor(private readonly path: string) {}
  async lists(): Promise<QueuedTaskList[]> { await this.mutation; return (await this.read()).lists; }
  async list(listId: string): Promise<QueuedTask[]> {
    await this.mutation;
    const file = await this.read();
    requireList(file, listId);
    return file.tasks.filter(task => task.listId === listId);
  }
  private async read(): Promise<QueueFile> {
    let raw: string;
    try { raw = await readFile(this.path, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 2, lists: [], tasks: [] };
      throw error;
    }
    const file = JSON.parse(raw) as QueueFile;
    const date = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
    if (file.schemaVersion !== 2 || !Array.isArray(file.lists) || !Array.isArray(file.tasks)
      || file.lists.some(list => !list || typeof list.id !== "string" || typeof list.name !== "string" || !list.name.trim() || !date(list.createdAt))
      || new Set(file.lists.map(list => list.id)).size !== file.lists.length
      || file.tasks.some(task => !task || typeof task.id !== "string" || typeof task.description !== "string" || !task.description.trim() || !date(task.createdAt) || !QUEUED_TASK_STATUSES.includes(task.status) || !file.lists.some(list => list.id === task.listId))
      || new Set(file.tasks.map(task => task.id)).size !== file.tasks.length) throw new Error("Invalid queued tasks file");
    return file;
  }
  createList(name: string): Promise<QueuedTaskList> {
    return this.update(file => {
      text(name, 200, "List name");
      const list = { id: randomUUID(), name: name.trim(), createdAt: new Date().toISOString() };
      file.lists.push(list);
      return list;
    });
  }
  add(listId: string, description: string): Promise<QueuedTask> {
    return this.update(file => {
      text(description, 32000, "Description"); requireList(file, listId);
      const task: QueuedTask = { id: randomUUID(), listId, description, createdAt: new Date().toISOString(), status: "todo" };
      file.tasks.push(task);
      return task;
    });
  }
  edit(id: string, description: string): Promise<QueuedTask> {
    return this.update(file => {
      text(description, 32000, "Description");
      const task = requireTask(file, id);
      task.description = description;
      return task;
    });
  }
  change(id: string, input: { status?: QueuedTaskStatus; listId?: string }): Promise<QueuedTask> {
    return this.update(file => {
      const task = requireTask(file, id);
      if (input.status !== undefined) {
        if (!QUEUED_TASK_STATUSES.includes(input.status)) throw new QueuedTaskError(400, "Invalid todo state");
        task.status = input.status;
      }
      if (input.listId !== undefined) { requireList(file, input.listId); task.listId = input.listId; }
      return task;
    });
  }
  remove(id: string): Promise<{ id: string }> {
    return this.update(file => {
      requireTask(file, id);
      file.tasks = file.tasks.filter(task => task.id !== id);
      return { id };
    });
  }
  private update<T>(change: (file: QueueFile) => T): Promise<T> {
    const result = this.mutation.then(async () => {
      const file = await this.read();
      const value = change(file);
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(file, null, 2) + "\n", { mode: 0o600 });
        await rename(temporary, this.path);
      } finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
      return value;
    });
    this.mutation = result.then(() => undefined, () => undefined);
    return result;
  }
}
