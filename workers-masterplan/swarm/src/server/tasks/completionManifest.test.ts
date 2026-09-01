import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { TaskManifest, TaskReadiness } from "../../shared/contracts.js";
import { applyCompletionManifest, completionReceiptPath, loadCompletionManifest, type CompletionManifestSource } from "./completionManifest.js";
import { loadManifest } from "./manifestLoader.js";

function remoteSource(files: Record<string, unknown>, revision = "remote-main"): CompletionManifestSource {
  return {
    fetch: async () => undefined,
    resolveRevision: async () => revision,
    readFile: async (_root, requestedRevision, path) => {
      expect(requestedRevision).toBe(revision);
      const value = files[path];
      return value === undefined ? undefined : typeof value === "string" ? value : JSON.stringify(value);
    },
  };
}

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
    const source = remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/completion-manifest/c3.json": { schemaVersion: 1, taskId: "C3", passes: { planning: { state: "complete", completedBy: "bot8", completedAt: "2026-08-31T13:00:00.000Z" } } },
    });

    const completion = await loadCompletionManifest(manifest, "/tmp/working-copy", source);
    expect(completion.authoritative).toBe(true);
    expect([...completion.completedTaskIds]).toEqual(["C3"]);
    expect(applyCompletionManifest(manifest, base, completion).map((task) => [task.taskId, task.state])).toEqual([["C3", "complete"], ["C4", "ready"]]);
  });

  it("rejects a receipt whose task id does not match its owned filename", async () => {
    const source = remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/completion-manifest/c3.json": { schemaVersion: 1, taskId: "C4", passes: { planning: { state: "complete", completedBy: "bot8", completedAt: "2026-08-31T13:00:00.000Z" } } },
    });

    await expect(loadCompletionManifest(manifest, "/tmp/working-copy", source)).rejects.toThrow("filename");
  });

  it("ignores an uncommitted local receipt that is absent from origin/main", async () => {
    const completion = await loadCompletionManifest(manifest, "/tmp/working-copy-with-local-c3", remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
    }));

    expect(completion.authoritative).toBe(true);
    expect([...completion.completedTaskIds]).toEqual([]);
  });

  it("loads a remote-only receipt even when the local working copy has no file", async () => {
    const completion = await loadCompletionManifest(manifest, "/tmp/empty-working-copy", remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/completion-manifest/c3.json": { schemaVersion: 1, taskId: "C3", passes: { planning: { state: "complete", completedBy: "bot8", completedAt: "2026-08-31T13:00:00.000Z" } } },
    }, "origin-main-sha"));

    expect([...completion.completedTaskIds]).toEqual(["C3"]);
    expect(completion.revision).toBe("origin-main-sha");
  });

  it("provides each worker its own receipt path", () => {
    expect(completionReceiptPath(manifest, "C3")).toBe("docs/workers/mvp3/completion-manifest/c3.json");
  });

  it("projects the checked-in MVP3 receipts without reading completion phrases", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const production = await loadManifest(resolve(process.cwd(), "manifests/mvp3.json"), repositoryRoot);
    const files = Object.fromEntries(production.tasks.flatMap((task) => {
      try {
        return [[completionReceiptPath(production, task.id), requireReceipt(completionReceiptPath(production, task.id))]];
      } catch {
        return [];
      }
    }));
    const completion = await loadCompletionManifest(production, repositoryRoot, remoteSource({
      [`${production.coordinationRoot}/completion-manifest/README.md`]: "authoritative",
      ...files,
    }));
    const readiness = applyCompletionManifest(production, [], completion);

    expect([...completion.completedTaskIds].sort()).toEqual(["A1", "A2", "A3", "A4", "AD", "C1", "C2", "C3", "C4", "CD", "E1", "E2", "F0", "G1", "G2", "P1", "P2", "P4", "PD", "Q1", "Q2"]);
    expect(readiness.find((task) => task.taskId === "C3")?.state).toBe("complete");
    expect(readiness.find((task) => task.taskId === "C4")?.state).toBe("complete");
    expect(readiness.find((task) => task.taskId === "E2")?.state).toBe("complete");
  });

  it("does not project planning-only UI workers into the execution pass", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const production = await loadManifest(resolve(process.cwd(), "manifests/mvp3.json"), repositoryRoot);
    const execution = { ...production, lifecycle: { ...production.lifecycle!, activePass: "execution" as const } };
    const completion = { authoritative: true, revision: "origin-main", receipts: new Map(), completedTaskIds: new Set<string>() };

    const readiness = applyCompletionManifest(execution, [], completion);

    expect(readiness.map((task) => task.taskId)).not.toEqual(expect.arrayContaining(["PD", "CD", "QD", "AD", "ED", "GD"]));
    expect(readiness.find((task) => task.taskId === "F0")?.state).toBe("ready");
  });
});

function requireReceipt(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), "../..", path), "utf8"));
}
