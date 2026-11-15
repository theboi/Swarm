import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { QueuedTask } from "../../shared/queuedTasks.js";

export class QueuedTasks {
  private mutation = Promise.resolve();
  constructor(private readonly path: string) {}
  async list(): Promise<QueuedTask[]> { await this.mutation; return this.read(); }
  private async read(): Promise<QueuedTask[]> {
    let raw: string;
    try { raw = await readFile(this.path, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    const file = JSON.parse(raw);
    if (file.schemaVersion !== 1 || !Array.isArray(file.tasks) || file.tasks.some((task: QueuedTask) => !task || typeof task.id !== "string" || typeof task.title !== "string" || typeof task.prompt !== "string" || typeof task.completed !== "boolean")) throw new Error("Invalid queued tasks file");
    return file.tasks;
  }
  add(title: string, prompt: string): Promise<QueuedTask[]> {
    if (!title.trim() || title.length > 200 || !prompt.trim() || prompt.length > 32000) return Promise.reject(new Error("A title (up to 200 characters) and prompt (up to 32000 characters) are required"));
    return this.update(tasks => [...tasks, { id: randomUUID(), title: title.trim(), prompt: prompt.trim(), completed: false }]);
  }
  edit(id: string, title: string, prompt: string): Promise<QueuedTask[]> {
    if (!title.trim() || title.length > 200 || !prompt.trim() || prompt.length > 32000) return Promise.reject(new Error("A title (up to 200 characters) and prompt (up to 32000 characters) are required"));
    return this.update(tasks => {
      if (!tasks.some(task => task.id === id)) throw new Error("Queued task not found");
      return tasks.map(task => task.id === id ? { ...task, title: title.trim(), prompt: prompt.trim() } : task);
    });
  }
  remove(id: string): Promise<QueuedTask[]> {
    return this.update(tasks => {
      if (!tasks.some(task => task.id === id)) throw new Error("Queued task not found");
      return tasks.filter(task => task.id !== id);
    });
  }
  complete(id: string, completed: boolean): Promise<QueuedTask[]> {
    return this.update(tasks => {
      if (!tasks.some(task => task.id === id)) throw new Error("Queued task not found");
      return tasks.map(task => task.id === id ? { ...task, completed } : task);
    });
  }
  private update(change: (tasks: QueuedTask[]) => QueuedTask[]): Promise<QueuedTask[]> {
    const result = this.mutation.then(async () => {
      const tasks = change(await this.read());
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ schemaVersion: 1, tasks }, null, 2) + "\n", { mode: 0o600 });
      await rename(temporary, this.path);
      return tasks;
    });
    this.mutation = result.then(() => undefined, () => undefined);
    return result;
  }
}
