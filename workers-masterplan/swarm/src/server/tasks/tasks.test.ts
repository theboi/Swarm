import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    const prompt = await renderWorkerPrompt("planning", { workerId: "T0", accountId: "bot3", taskId: "T0", taskTitle: "Plan", phase: "planning", blueprintPath: "docs/blueprint.md", masterplanPath: "docs/blueprint.md", coordinationRoot: "docs/workers/mvp3", statusPath: "docs/workers/mvp3/T0.md", specificationPath: "docs/spec.md", implementationPlanPath: "docs/plan.md", edenmindClonePath: "/Users/bot3/Dev/EdenMind", ownedSurfaces: "src/a", excludedSurfaces: "src/b" });
    expect(prompt).toContain("worker `T0`");
    expect(prompt).toContain("macOS account\n`bot3`");
    expect(prompt).not.toContain("{{WORKER_ID}}");
  });
});
