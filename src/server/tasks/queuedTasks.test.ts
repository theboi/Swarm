import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { QueuedTasks } from "./queuedTasks.js";

async function fixture() {
  const path = join(await mkdtemp(join(tmpdir(), "swarm-queue-")), "tasks.json");
  return { path, queue: new QueuedTasks(path) };
}
it("persists lists and concurrent description-only todos with stable creation dates", async () => {
  const { path, queue } = await fixture();
  expect(await queue.lists()).toEqual([]);
  const list = await queue.createList(" Work ");
  const other = await queue.createList("Personal");
  const [first, second] = await Promise.all([queue.add(list.id, "  Exact\n description.\n"), queue.add(list.id, "Second")]);
  const reloaded = new QueuedTasks(path);
  expect(await reloaded.lists()).toEqual([{ ...list, name: "Work" }, other]);
  expect(await reloaded.list(list.id)).toEqual([first, second]);
  expect(first).toEqual({ id: expect.any(String), listId: list.id, description: "  Exact\n description.\n", createdAt: expect.any(String), status: "todo" });
  expect(Number.isFinite(Date.parse(first.createdAt))).toBe(true);
  expect(await reloaded.list(other.id)).toEqual([]);
  expect(JSON.parse(await readFile(path, "utf8")).schemaVersion).toBe(2);
});
it("edits, changes state, moves and deletes without changing creation time or other todos", async () => {
  const { path, queue } = await fixture();
  const source = await queue.createList("Source");
  const target = await queue.createList("Target");
  const task = await queue.add(source.id, "Original");
  const untouched = await queue.add(source.id, "Untouched");
  await queue.edit(task.id, " Edited\n");
  for (const status of ["priority", "in-progress", "complete", "todo"] as const) {
    expect((await queue.change(task.id, { status })).status).toBe(status);
  }
  await queue.change(task.id, { listId: target.id });
  expect(await queue.list(source.id)).toEqual([untouched]);
  expect(await new QueuedTasks(path).list(target.id)).toEqual([{ ...task, description: " Edited\n", listId: target.id }]);
  await queue.remove(task.id);
  expect(await new QueuedTasks(path).list(target.id)).toEqual([]);
});
it("rejects invalid commands without poisoning subsequent mutations", async () => {
  const { queue } = await fixture();
  await expect(queue.createList(" ")).rejects.toThrow();
  const list = await queue.createList("Work");
  await expect(queue.add(list.id, " ")).rejects.toThrow();
  await expect(queue.add(list.id, "a".repeat(32001))).rejects.toThrow();
  await expect(queue.add("missing", "Text")).rejects.toThrow("List not found");
  const task = await queue.add(list.id, "Text");
  await expect(queue.change(task.id, { listId: "missing" })).rejects.toThrow("List not found");
  await expect(queue.change(task.id, { status: "invalid" as "todo" })).rejects.toThrow();
  await expect(queue.edit(task.id, " ")).rejects.toThrow();
  await expect(queue.remove("missing")).rejects.toThrow("Todo not found");
  await expect(queue.list("missing")).rejects.toThrow("List not found");
  expect(await queue.list(list.id)).toEqual([task]);
  await queue.remove(task.id);
  expect(await queue.list(list.id)).toEqual([]);
});
