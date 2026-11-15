import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { TaskManifest } from "../../shared/contracts.js";
import { applyCompletionManifest, completionReceiptPath, loadCompletionManifest, type CompletionManifestSource } from "./completionManifest.js";
import { loadManifest } from "./manifestLoader.js";

function remoteSource(files: Record<string, unknown>, revision = "remote-main", ancestorResult = true): CompletionManifestSource {
  return {
    fetch: async () => undefined,
    resolveRevision: async () => revision,
    readFile: async (_root, requestedRevision, path) => {
      expect(requestedRevision).toBe(revision);
      const value = files[path];
      return value === undefined ? undefined : typeof value === "string" ? value : JSON.stringify(value);
    },
    isAncestor: async () => ancestorResult,
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

describe("repository completion manifest", () => {
  it("loads collision-safe per-worker receipts and makes them authoritative for readiness", async () => {
    const source = remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/completion-manifest/c3.json": { schemaVersion: 1, taskId: "C3", passes: { planning: { state: "complete", completedBy: "bot8", completedAt: "2026-08-31T13:00:00.000Z" } } },
    });

    const completion = await loadCompletionManifest(manifest, "/tmp/working-copy", source);
    expect([...completion.completedTaskIds]).toEqual(["C3"]);
    expect(applyCompletionManifest(manifest, completion).map((task) => [task.taskId, task.state])).toEqual([["C3", "complete"], ["C4", "ready"]]);
  });

  it("rejects a receipt whose task id does not match its owned filename", async () => {
    const source = remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/completion-manifest/c3.json": { schemaVersion: 1, taskId: "C4", passes: { planning: { state: "complete", completedBy: "bot8", completedAt: "2026-08-31T13:00:00.000Z" } } },
    });

    await expect(loadCompletionManifest(manifest, "/tmp/working-copy", source)).rejects.toThrow("filename");
  });

  it("treats origin/main as the only completion source", async () => {
    const completion = await loadCompletionManifest(manifest, "/tmp/working-copy-with-local-c3", remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
    }));

    expect([...completion.completedTaskIds]).toEqual([]);
  });

  it("rejects coordinator-authored worker receipts", async () => {
    const source = remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/completion-manifest/c3.json": { schemaVersion: 1, taskId: "C3", passes: { planning: { state: "complete", completedBy: "coordinator", completedAt: "2026-08-31T13:00:00.000Z" } } },
    });

    await expect(loadCompletionManifest(manifest, "/tmp/working-copy", source)).rejects.toThrow("completion receipt");
  });

  it("rejects a repository without the worker completion manifest instead of falling back to status prose", async () => {
    await expect(loadCompletionManifest(manifest, "/tmp/working-copy", remoteSource({}))).rejects.toThrow("Completion manifest is missing");
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
    const repositoryRoot = resolve(process.cwd(), "edenmind");
    const loaded = await loadManifest(resolve(repositoryRoot, "workers-masterplan/swarm/manifests/mvp3.json"), repositoryRoot);
    const production = { ...loaded, lifecycle: { ...loaded.lifecycle!, activePass: "planning" as const } };
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
    const readiness = applyCompletionManifest(production, completion);

    expect([...completion.completedTaskIds].sort()).toEqual(["A1", "A2", "A3", "A4", "AD", "C1", "C2", "C3", "C4", "CD", "E1", "E2", "E3", "E4", "ED", "F0", "G1", "G2", "G3", "G4", "GD", "P1", "P2", "P3", "P4", "PD", "Q1", "Q2", "Q3", "Q4", "QD", "X0"]);
    expect(readiness.find((task) => task.taskId === "C3")?.state).toBe("complete");
    expect(readiness.find((task) => task.taskId === "C4")?.state).toBe("complete");
    expect(readiness.find((task) => task.taskId === "E2")?.state).toBe("complete");
  });

  it("does not project planning-only UI workers into the execution pass", async () => {
    const repositoryRoot = resolve(process.cwd(), "edenmind");
    const production = await loadManifest(resolve(repositoryRoot, "workers-masterplan/swarm/manifests/mvp3.json"), repositoryRoot);
    const execution = { ...production, lifecycle: { ...production.lifecycle!, activePass: "execution" as const } };
    const completion = { revision: "origin-main", receipts: new Map(), completedTaskIds: new Set<string>() };

    const readiness = applyCompletionManifest(execution, completion);

    expect(readiness.map((task) => task.taskId)).not.toEqual(expect.arrayContaining(["PD", "CD", "QD", "AD", "ED", "GD"]));
    expect(readiness.find((task) => task.taskId === "F0")?.state).toBe("blocked");
  });

  it("allows execution per worker only when parallel passes are explicitly enabled", async () => {
    const execution = { ...manifest, lifecycle: { ...manifest.lifecycle!, activePass: "execution" as const, parallelPasses: true } };
    const receipts = new Map([
      ["C3", { schemaVersion: 1 as const, taskId: "C3", passes: { planning: { state: "complete" as const, completedBy: "bot8" as const, completedAt: "2026-08-31T13:00:00.000Z" } } }],
    ]);
    const readiness = applyCompletionManifest(execution, { revision: "origin-main", receipts, completedTaskIds: new Set() });

    expect(readiness.map((task) => [task.taskId, task.state])).toEqual([["C3", "ready"], ["C4", "blocked"]]);
  });

  it("blocks execution until the global planning receipt passes when passes are serial", () => {
    const execution = { ...manifest, lifecycle: { ...manifest.lifecycle!, activePass: "execution" as const, parallelPasses: false } };
    const receipts = new Map([
      ["C3", { schemaVersion: 1 as const, taskId: "C3", passes: { planning: { state: "complete" as const, completedBy: "bot8" as const, completedAt: "2026-08-31T13:00:00.000Z" } } }],
    ]);

    const blocked = applyCompletionManifest(execution, { revision: "origin-main", receipts, completedTaskIds: new Set(), planningGatePassed: false });
    const authorized = applyCompletionManifest(execution, { revision: "origin-main", receipts, completedTaskIds: new Set(), planningGatePassed: true });

    expect(blocked[0]).toMatchObject({ state: "blocked", blockingCodes: ["PLANNING_GATE_NOT_PASSED"] });
    expect(authorized.map((task) => [task.taskId, task.state])).toEqual([["C3", "ready"], ["C4", "blocked"]]);
  });

  it("loads a strict passed global receipt from the same origin/main revision", async () => {
    const execution = { ...manifest, lifecycle: { ...manifest.lifecycle!, activePass: "execution" as const, parallelPasses: false } };
    const source = remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/gate.md": [
        "| Field | Value |",
        "| --- | --- |",
        "| Gate state | passed |",
        "| Authorized origin/main commit | `0123456789abcdef0123456789abcdef01234567` |",
        "| Unresolved material contradictions | none |",
      ].join("\n"),
    });

    const completion = await loadCompletionManifest(execution, "/tmp/working-copy", source);

    expect(completion.planningGatePassed).toBe(true);
  });

  it("rejects a passed receipt whose authorized commit is not in origin/main ancestry", async () => {
    const execution = { ...manifest, lifecycle: { ...manifest.lifecycle!, activePass: "execution" as const, parallelPasses: false } };
    const gate = [
      "| Gate state | passed |",
      "| Authorized origin/main commit | `0123456789abcdef0123456789abcdef01234567` |",
      "| Unresolved material contradictions | none |",
    ].join("\n");

    const completion = await loadCompletionManifest(execution, "/tmp/working-copy", remoteSource({
      "docs/workers/mvp3/completion-manifest/README.md": "authoritative",
      "docs/workers/mvp3/gate.md": gate,
    }, "origin-main", false));

    expect(completion.planningGatePassed).toBe(false);
  });
});

function requireReceipt(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), "edenmind", path), "utf8"));
}
