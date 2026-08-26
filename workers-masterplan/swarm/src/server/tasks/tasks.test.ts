import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TaskManifest } from "../../shared/contracts.js";
import { loadManifest } from "./manifestLoader.js";
import { evaluateTaskReadiness, loadBlueprintEvidence } from "./blueprintEvidence.js";
import { renderWorkerPrompt } from "./promptTemplates.js";

const manifest: TaskManifest = { blueprintId: "mvp3", title: "MVP3", masterplanPath: "docs/blueprint.md", coordinationRoot: "docs/workers/mvp3", tasks: [
  { id: "T0", title: "Plan", kind: "planning", dependsOn: [], promptTemplate: "planning", statusPath: "docs/workers/mvp3/T0.md", specificationPath: "docs/spec.md", implementationPlanPath: "docs/plan.md" },
  { id: "G0", title: "Gate", kind: "gate", dependsOn: ["T0"], promptTemplate: "planning", statusPath: "docs/workers/mvp3/G0.md" },
  { id: "I0", title: "Implement", kind: "execution", dependsOn: ["G0"], promptTemplate: "execution", statusPath: "docs/workers/mvp3/I0.md" },
] };

describe("task authority", () => {
  it("loads the production MVP3 planning topology with six four-step paths", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const production = await loadManifest(resolve(process.cwd(), "manifests/mvp3.json"), repositoryRoot);
    const domainPaths = ["P", "C", "Q", "A", "E", "G"];

    expect(production.blueprintId).toBe("2026-08-14-mvp3");
    expect(production.tasks).toHaveLength(26);
    expect(production.tasks.every((task) => task.kind === "planning")).toBe(true);
    expect(domainPaths.map((pathId) => production.tasks.filter((task) => task.pathId === pathId).length)).toEqual([4, 4, 4, 4, 4, 4]);
    expect(production.tasks.filter((task) => task.pathId === "shared").map((task) => task.id)).toEqual(["F0", "X0"]);
    expect(production.tasks.filter((task) => task.dependsOn.length === 0).map((task) => task.id)).toEqual(["F0"]);
  });

  it("loads manifests only when every path stays under the repository root", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-manifest-"));
    const path = join(root, "manifest.json");
    await mkdir(join(root, "docs", "workers", "mvp3"), { recursive: true });
    await Promise.all([
      writeFile(join(root, "docs", "blueprint.md"), "# Blueprint"),
      writeFile(join(root, "docs", "spec.md"), "# Spec"),
      writeFile(join(root, "docs", "plan.md"), "# Plan"),
      writeFile(join(root, "docs", "workers", "mvp3", "T0.md"), "# Status"),
      writeFile(join(root, "docs", "workers", "mvp3", "G0.md"), "# Gate"),
      writeFile(join(root, "docs", "workers", "mvp3", "I0.md"), "# Status"),
    ]);
    await writeFile(path, JSON.stringify(manifest));
    await expect(loadManifest(path, root)).resolves.toMatchObject({ blueprintId: "mvp3" });
    await writeFile(path, JSON.stringify({ ...manifest, masterplanPath: "../outside.md" }));
    await expect(loadManifest(path, root)).rejects.toThrow("outside repository");
    await rm(root, { recursive: true, force: true });
  });

  it("rejects missing and symlink-escaped authoritative paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-manifest-"));
    const outside = await mkdtemp(join(tmpdir(), "swarm-outside-"));
    await mkdir(join(root, "docs"));
    await writeFile(join(root, "manifest.json"), JSON.stringify({ ...manifest, masterplanPath: "docs/missing.md" }));
    await expect(loadManifest(join(root, "manifest.json"), root)).rejects.toThrow("does not exist");
    await writeFile(join(outside, "blueprint.md"), "outside");
    await symlink(outside, join(root, "docs", "linked"));
    await writeFile(join(root, "manifest.json"), JSON.stringify({ ...manifest, masterplanPath: "docs/linked/blueprint.md" }));
    await expect(loadManifest(join(root, "manifest.json"), root)).rejects.toThrow("outside repository");
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  });

  it("allows contained future planning outputs while keeping authorities existence-required", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-future-planning-"));
    const path = join(root, "manifest.json");
    const planningManifest: TaskManifest = {
      blueprintId: "mvp3",
      title: "MVP3 planning",
      masterplanPath: "docs/blueprint.md",
      coordinationRoot: "docs/workers/mvp3",
      tasks: [{
        id: "F0",
        title: "Foundation planning",
        kind: "planning",
        dependsOn: [],
        promptTemplate: "planning",
        statusPath: "docs/workers/mvp3/status/f0.md",
        specificationPath: "docs/specs/f0.md",
        implementationPlanPath: "docs/plans/f0.md",
      }],
    };
    await mkdir(join(root, "docs", "workers", "mvp3", "status"), { recursive: true });
    await Promise.all([
      writeFile(join(root, "docs", "blueprint.md"), "# Blueprint"),
      writeFile(join(root, "docs", "workers", "mvp3", "status", "f0.md"), "# F0"),
    ]);
    await writeFile(path, JSON.stringify(planningManifest));

    await expect(loadManifest(path, root)).resolves.toMatchObject({ blueprintId: "mvp3" });

    await writeFile(path, JSON.stringify({
      ...planningManifest,
      tasks: [{ ...planningManifest.tasks[0], specificationPath: "../outside.md" }],
    }));
    await expect(loadManifest(path, root)).rejects.toThrow("outside repository");

    const outside = await mkdtemp(join(tmpdir(), "swarm-future-outside-"));
    await symlink(outside, join(root, "docs", "linked"));
    await writeFile(path, JSON.stringify({
      ...planningManifest,
      tasks: [{ ...planningManifest.tasks[0], specificationPath: "docs/linked/future.md" }],
    }));
    await expect(loadManifest(path, root)).rejects.toThrow("outside repository");
    await rm(outside, { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  });

  it("uses remote authoritative evidence and blocks the unfrozen MVP3 seed", async () => {
    const remote = new Map<string, string>([
      ["docs/blueprint.md", "# Blueprint: mvp3\nIntegration authority: origin/main\n"],
      ["docs/workers/mvp3/T0.md", "status: complete\nremoteCommit: abc123\n"],
      ["docs/spec.md", "# spec\n"], ["docs/plan.md", "# plan\n"],
      ["docs/workers/mvp3/G0.md", "status: passed\nremoteCommit: abc123\nT0 authority-sync abc123 docs/spec.md docs/plan.md\n"],
    ]);
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => "abc123", readRemote: async (path) => remote.get(path) });
    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "I0")?.state).toBe("ready");
    const blocked = await loadBlueprintEvidence({ ...manifest, blueprintId: "mvp3", masterplanPath: "" }, { fetch: async () => "abc123", readRemote: async () => undefined });
    expect(blocked.code).toBe("MASTERPLAN_NOT_READY");
  });

  it("accepts the authoritative Blueprint and planning-gate table formats only from origin/main", async () => {
    const authoritative = { ...manifest, masterplanPath: "docs/blueprint.md" };
    const remote = new Map<string, string>([
      ["docs/blueprint.md", "| Blueprint ID | `mvp3` |\n| Integration authority | `origin/main` |"],
      ["docs/workers/mvp3/T0.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |"],
      ["docs/spec.md", "# Approved specification\n"],
      ["docs/plan.md", "# Approved plan\n"],
      ["docs/workers/mvp3/G0.md", "| Gate state | passed |\n| Authorized `origin/main` commit | `abc123` |\n| T0 authority-sync | abc123 docs/spec.md docs/plan.md |"],
    ]);
    const result = await loadBlueprintEvidence(authoritative, { fetch: async () => "abc123", readRemote: async (path) => remote.get(path) });
    expect(evaluateTaskReadiness(authoritative, result).find((item) => item.taskId === "I0")?.state).toBe("ready");
  });

  it("renders the canonical template with exact worker values", async () => {
    const prompt = await renderWorkerPrompt("planning", { workerId: "T0", accountId: "bot3", taskId: "T0", taskTitle: "Plan", phase: "planning", phaseTerminalCondition: "Stop after the approved planning handoff.", blueprintPath: "docs/blueprint.md", masterplanPath: "docs/blueprint.md", coordinationRoot: "docs/workers/mvp3", statusPath: "docs/workers/mvp3/T0.md", specificationPath: "docs/spec.md", implementationPlanPath: "docs/plan.md", checkoutMode: "coordinator_managed_same_mac_clones", mainMutationLock: "swarm-main-mutation-lock", mainPushQueue: "swarm-main-push-queue", edenmindClonePath: "/Users/bot3/Dev/EdenMind", ownedSurfaces: "src/a", excludedSurfaces: "src/b" });
    expect(prompt).toContain("worker `T0`");
    expect(prompt).toContain("macOS account\n`bot3`");
    expect(prompt).toContain("Stop after the approved planning handoff.");
    expect(prompt).toContain("swarm-main-mutation-lock");
    expect(prompt).not.toContain("{{WORKER_ID}}");
  });
});
