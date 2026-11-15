import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QueuedTasks } from "./queuedTasks.js";

describe("QueuedTasks", () => {
  it("persists concurrent additions and completion across reloads", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "swarm-queue-")), "tasks.json");
    const queue = new QueuedTasks(path);
    expect(await queue.list()).toEqual([]);
    await Promise.all([queue.add(" First ", "Prompt one"), queue.add("Second", "Prompt two")]);
    const tasks = await new QueuedTasks(path).list();
    expect(tasks.map(task => task.title)).toEqual(["First", "Second"]);
    await queue.complete(tasks[0].id, true);
    expect((await new QueuedTasks(path).list())[0].completed).toBe(true);
    expect(JSON.parse(await readFile(path, "utf8")).schemaVersion).toBe(1);
  });
  it("rejects empty titles and prompts without writing", async () => {
    const queue = new QueuedTasks(join(await mkdtemp(join(tmpdir(), "swarm-queue-")), "tasks.json"));
    await expect(queue.add(" ", "prompt")).rejects.toThrow();
    await expect(queue.add("Title", " ")).rejects.toThrow();
    expect(await queue.list()).toEqual([]);
  });
});

it("edits and deletes a todo durably without changing other todos", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "swarm-queue-")), "tasks.json");
  const queue = new QueuedTasks(path);
  await queue.add("First", "Original prompt");
  const tasks = await queue.add("Second", "Keep this prompt");
  await queue.edit(tasks[0].id, " Updated ", " Updated prompt ");
  expect((await new QueuedTasks(path).list())[0]).toEqual({ ...tasks[0], title: "Updated", prompt: "Updated prompt" });
  await queue.remove(tasks[0].id);
  expect(await new QueuedTasks(path).list()).toEqual([tasks[1]]);
  await expect(queue.edit(tasks[1].id, " ", "Prompt")).rejects.toThrow();
  await expect(queue.remove("missing")).rejects.toThrow();
});
