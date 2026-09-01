import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { TaskManifest, TaskReadiness } from "../../shared/contracts.js";
import { applyCompletionManifest, completionReceiptPath, loadCompletionManifest } from "./completionManifest.js";
import { loadManifest } from "./manifestLoader.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const manifest: TaskManifest = {
  blueprintId: "mvp3",
  title: "MVP3",
  masterplanPath: "docs/masterplan.md",
  coordinationRoot: "docs/workers/mvp3",
  lifecycle: { mode: "two_pass", activePass: "planning", planningGatePath: "docs/workers/mvp3/gate.md" },
  tasks: [
    { id: "C3", title: "Curriculum UI", kind: "planning", dependsOn: [], promptTemplate: "planning", passes: ["planning", "execution"] },
    { id: "C4", title: "Curriculum qualification", kind: "planning", dependsOn: ["C3"], promptTemplate: "planning", passes: ["planning", "execution"] },
  ],
};

const base: TaskReadiness[] = manifest.tasks.map((task) => ({ taskId: task.id, phase: "planning", state: "attention_required", evidence: [], blockingCodes: ["STATUS_NEEDS_ATTENTION"] }));

describe("repository completion manifest", () => {
  it("loads collision-safe per-worker receipts and makes them authoritative for readiness", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-completions-"));
    roots.push(root);
    const directory = join(root, "docs", "workers", "mvp3", "completion-manifest");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "c3.json"), JSON.stringify({ schemaVersion: 1, taskId: "C3", passes: { planning: { state: "complete", completedBy: "bot8", completedAt: "2026-08-31T13:00:00.000Z" } } }));

    const completion = await loadCompletionManifest(manifest, root);
    expect(completion.authoritative).toBe(true);
    expect([...completion.completedTaskIds]).toEqual(["C3"]);
    expect(applyCompletionManifest(manifest, base, completion).map((task) => [task.taskId, task.state])).toEqual([["C3", "complete"], ["C4", "ready"]]);
  });

  it("rejects a receipt whose task id does not match its owned filename", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-completions-"));
    roots.push(root);
    const directory = join(root, "docs", "workers", "mvp3", "completion-manifest");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, "c3.json"), JSON.stringify({ schemaVersion: 1, taskId: "C4", passes: { planning: { state: "complete", completedBy: "bot8", completedAt: "2026-08-31T13:00:00.000Z" } } }));

    await expect(loadCompletionManifest(manifest, root)).rejects.toThrow("filename");
  });

  it("provides each worker its own receipt path", () => {
    expect(completionReceiptPath(manifest, "C3")).toBe("docs/workers/mvp3/completion-manifest/c3.json");
  });

  it("projects the checked-in MVP3 receipts without reading completion phrases", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const production = await loadManifest(resolve(process.cwd(), "manifests/mvp3.json"), repositoryRoot);
    const completion = await loadCompletionManifest(production, repositoryRoot);
    const readiness = applyCompletionManifest(production, [], completion);

    expect([...completion.completedTaskIds]).toEqual(["A1", "A2", "A3", "A4", "AD", "C1", "C2", "C3", "C4", "CD", "E1", "F0", "P1", "P2", "PD", "Q1", "Q2"]);
    expect(readiness.find((task) => task.taskId === "C3")?.state).toBe("complete");
    expect(readiness.find((task) => task.taskId === "C4")?.state).toBe("complete");
    expect(readiness.find((task) => task.taskId === "E2")?.state).toBe("ready");
  });
});
