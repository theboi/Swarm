import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { TaskManifest } from "../../shared/contracts.js";
import { loadManifest } from "./manifestLoader.js";
import { evaluateTaskReadiness, loadBlueprintEvidence } from "./blueprintEvidence.js";
import { launchGitMetadata } from "./launchGitMetadata.js";
import { renderWorkerPrompt } from "./promptTemplates.js";

const manifest: TaskManifest = { blueprintId: "mvp3", title: "MVP3", masterplanPath: "docs/blueprint.md", coordinationRoot: "docs/workers/mvp3", tasks: [
  { id: "T0", title: "Plan", kind: "planning", dependsOn: [], promptTemplate: "planning", statusPath: "docs/workers/mvp3/T0.md", specificationPath: "docs/spec.md", implementationPlanPath: "docs/plan.md" },
  { id: "G0", title: "Gate", kind: "gate", dependsOn: ["T0"], promptTemplate: "planning", statusPath: "docs/workers/mvp3/G0.md" },
  { id: "I0", title: "Implement", kind: "execution", dependsOn: ["G0"], promptTemplate: "execution", statusPath: "docs/workers/mvp3/I0.md" },
] };

describe("task authority", () => {
  it("loads every ordinary and UI-design worker from the production MVP3 topology", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const production = await loadManifest(resolve(process.cwd(), "manifests/mvp3.json"), repositoryRoot);
    const domainPaths = ["P", "C", "Q", "A", "E", "G"];

    expect(production.blueprintId).toBe("2026-08-14-mvp3");
    expect(production.lifecycle).toEqual({
      mode: "two_pass",
      activePass: "planning",
      planningGatePath: "docs/workers/2026-08-14-mvp3/PLANNING_GATE.md",
    });
    expect(production.tasks).toHaveLength(32);
    expect(production.tasks.filter((task) => task.kind === "planning")).toHaveLength(26);
    expect(production.tasks.filter((task) => task.kind === "ui").map((task) => task.id)).toEqual(["PD", "CD", "QD", "AD", "ED", "GD"]);
    expect(Object.fromEntries(production.tasks.filter((task) => task.kind === "ui").map((task) => [task.id, [task.uiRequirementsPath, task.uiHandoffPath]]))).toEqual({
      PD: ["docs/design/requirements/2026-08-26-pd-platform-admin.md", "docs/design/handoffs/2026-08-26-pd-platform-admin.md"],
      CD: ["docs/design/requirements/2026-08-26-cd-curriculum.md", "docs/design/handoffs/2026-08-26-cd-curriculum.md"],
      QD: ["docs/design/requirements/2026-08-26-qd-content.md", "docs/design/handoffs/2026-08-26-qd-content.md"],
      AD: ["docs/design/requirements/2026-08-26-ad-analysis-intake.md", "docs/design/handoffs/2026-08-26-ad-analysis-intake.md"],
      ED: ["docs/design/requirements/2026-08-26-ed-evidence.md", "docs/design/handoffs/2026-08-26-ed-evidence.md"],
      GD: ["docs/design/requirements/2026-08-26-gd-practice.md", "docs/design/handoffs/2026-08-26-gd-practice.md"],
    });
    expect(production.tasks.some((task) => task.id === "PG0")).toBe(false);
    expect(domainPaths.map((pathId) => production.tasks.filter((task) => task.pathId === pathId).length)).toEqual([4, 4, 4, 4, 4, 4]);
    expect(production.tasks.filter((task) => task.pathId === "shared").map((task) => task.id)).toEqual(["F0", "X0"]);
    expect(production.tasks.filter((task) => task.kind !== "ui").every((task) => task.passes?.join(",") === "planning,execution")).toBe(true);
    expect(production.tasks.filter((task) => task.kind === "ui").every((task) => task.passes?.join(",") === "planning")).toBe(true);
    expect(production.tasks.find((task) => task.id === "P3")?.executionDependsOn).toEqual(["P2", "Q2"]);
    expect(production.tasks.find((task) => task.id === "C3")?.executionDependsOn).toEqual(["C2"]);
    expect(production.tasks.find((task) => task.id === "X0")?.executionDependsOn).toEqual(["P4", "C4", "Q4", "A4", "E4", "G4"]);
    expect(production.tasks.filter((task) => task.dependsOn.length === 0).map((task) => task.id)).toEqual(["F0"]);
    for (const [designId, layerTwoId, layerThreeId] of [["PD", "P2", "P3"], ["CD", "C2", "C3"], ["QD", "Q2", "Q3"], ["AD", "A2", "A3"], ["ED", "E2", "E3"], ["GD", "G2", "G3"]]) {
      expect(production.tasks.find((task) => task.id === designId)?.dependsOn).toEqual([layerTwoId]);
      expect(production.tasks.find((task) => task.id === layerThreeId)?.dependsOn).toEqual([layerTwoId, designId]);
    }
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

  it("allows contained future UI artifacts and rejects escaped UI artifact paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-future-ui-"));
    const path = join(root, "manifest.json");
    const uiManifest = {
      blueprintId: "mvp3",
      title: "MVP3 UI planning",
      masterplanPath: "docs/blueprint.md",
      coordinationRoot: "docs/workers/mvp3",
      tasks: [{
        id: "PD",
        title: "Platform design",
        kind: "ui",
        dependsOn: [],
        promptTemplate: "ui",
        statusPath: "docs/workers/mvp3/status/pd.md",
        specificationPath: "docs/specs/p2.md",
        uiRequirementsPath: "docs/design/requirements/pd.md",
        uiHandoffPath: "docs/design/handoffs/pd.md",
      }],
    } as TaskManifest;
    await mkdir(join(root, "docs", "workers", "mvp3", "status"), { recursive: true });
    await Promise.all([
      writeFile(join(root, "docs", "blueprint.md"), "# Blueprint"),
      writeFile(join(root, "docs", "workers", "mvp3", "status", "pd.md"), "# PD"),
    ]);
    await writeFile(path, JSON.stringify(uiManifest));

    await expect(loadManifest(path, root)).resolves.toMatchObject({ blueprintId: "mvp3" });

    await writeFile(path, JSON.stringify({
      ...uiManifest,
      tasks: [{ ...uiManifest.tasks[0], uiRequirementsPath: "../outside.md" }],
    }));
    await expect(loadManifest(path, root)).rejects.toThrow("outside repository");

    const outside = await mkdtemp(join(tmpdir(), "swarm-ui-outside-"));
    await symlink(outside, join(root, "docs", "linked"));
    await writeFile(path, JSON.stringify({
      ...uiManifest,
      tasks: [{ ...uiManifest.tasks[0], uiHandoffPath: "docs/linked/handoff.md" }],
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
      ["docs/workers/mvp3/G0.md", "| Field | Value |\n| --- | --- |\n| Gate state | passed |\n| Authorized `origin/main` commit | `abc123` |\n\n| Worker | Manifest specification path | Manifest implementation plan path | Approval | Authority sync / no-impact | Cross-plan reconciliation | Remote commit |\n| --- | --- | --- | --- | --- | --- | --- |\n| T0 | `docs/spec.md` | `docs/plan.md` | approved | authority-sync complete | reconciled | `abc123` |\n\n## Unresolved contradictions\n\n| Contradiction | Owner | Unblock criterion |\n| --- | --- | --- |\n"],
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
      ["docs/workers/mvp3/G0.md", "| Field | Value |\n| --- | --- |\n| Gate state | passed |\n| Authorized `origin/main` commit | `abc123` |\n\n| Worker | Manifest specification path | Manifest implementation plan path | Approval | Authority sync / no-impact | Cross-plan reconciliation | Remote commit |\n| --- | --- | --- | --- | --- | --- | --- |\n| T0 | `docs/spec.md` | `docs/plan.md` | approved | authority-sync complete | reconciled | `abc123` |\n\n## Unresolved contradictions\n\n| Contradiction | Owner | Unblock criterion |\n| --- | --- | --- |\n"],
    ]);
    const result = await loadBlueprintEvidence(authoritative, { fetch: async () => "abc123", readRemote: async (path) => remote.get(path) });
    expect(evaluateTaskReadiness(authoritative, result).find((item) => item.taskId === "I0")?.state).toBe("ready");
  });

  it("renders the canonical template with exact worker values", async () => {
    const prompt = await renderWorkerPrompt("planning", { workerId: "T0", accountId: "bot3", taskId: "T0", taskTitle: "Plan", phase: "planning", phaseTerminalCondition: "Stop after the approved planning handoff.", blueprintPath: "docs/blueprint.md", masterplanPath: "docs/blueprint.md", coordinationRoot: "docs/workers/mvp3", statusPath: "docs/workers/mvp3/T0.md", specificationPath: "docs/spec.md", implementationPlanPath: "docs/plan.md", plannedPrerequisites: "none", uiRequirementsPath: "not applicable", uiHandoffPath: "not applicable", checkoutMode: "coordinator_managed_same_mac_clones", mainMutationLock: "swarm-main-mutation-lock", mainPushQueue: "swarm-main-push-queue", edenmindClonePath: "/Users/bot3/Dev/EdenMind", ownedSurfaces: "src/a", excludedSurfaces: "src/b" });
    expect(prompt).toContain("You are WORKER T0.");
    expect(prompt).toContain("finished WRITING SPEC AND IMPLEMENTATION PLANS");
    expect(prompt).toContain("Terra High/Xhigh");
    expect(prompt).toContain("UI requirements contract: `not applicable`");
    expect(prompt).not.toContain("{{WORKER_ID}}");
  });

  it("renders per-worker repository authorities and phase boundaries for every launch type", async () => {
    const common = {
      workerId: "C3",
      accountId: "bot8" as const,
      taskId: "C3",
      taskTitle: "Curriculum UI",
      blueprintPath: "docs/plans/EdenMind_MVP3_Implementation_Masterplan.md",
      masterplanPath: "docs/plans/EdenMind_MVP3_Implementation_Masterplan.md",
      coordinationRoot: "docs/workers/2026-08-14-mvp3",
      statusPath: "docs/workers/2026-08-14-mvp3/status/c3.md",
      specificationPath: "docs/superpowers/specs/2026-08-14-mvp3/2026-08-26-c3-curriculum-ui-design.md",
      implementationPlanPath: "docs/superpowers/plans/2026-08-14-mvp3/2026-08-26-c3-curriculum-ui.md",
      checkoutMode: "independent_main_clone" as const,
      mainMutationLock: "not-applicable-for-independent-clones",
      mainPushQueue: "swarm-main-push-queue",
      edenmindClonePath: "/Users/bot8/Dev/EdenMind",
      ownedSurfaces: "Assigned task surfaces only",
      excludedSurfaces: "Other workers' owned surfaces",
    };
    const [planning, execution, ui] = await Promise.all([
      renderWorkerPrompt("planning", { ...common, phase: "planning", phaseTerminalCondition: "Stop after the approved planning handoff is integrated on origin/main; do not begin implementation." }),
      renderWorkerPrompt("execution", { ...common, phase: "execution", phaseTerminalCondition: "Stop after fresh acceptance evidence, closed review, and the final handoff are integrated on origin/main.", planningGatePath: "docs/workers/2026-08-14-mvp3/status/g0.md", planningGateCommit: "abc123", hardPrerequisites: "C3" }),
      renderWorkerPrompt("ui", { ...common, phase: "ui", phaseTerminalCondition: "Stop at the user's review boundary after the accepted presentation handoff is integrated on origin/main." }),
    ]);

    for (const prompt of [planning, execution, ui]) {
      expect(prompt).toContain("Read these repository authorities from the account's EdenMind clone before acting:");
      expect(prompt).toContain("`docs/workers/2026-08-14-mvp3/status/c3.md`");
      expect(prompt).toContain("Your task is `C3` — `Curriculum UI`.");
      expect(prompt).not.toMatch(/{{[A-Z_]+}}/);
    }
    expect(planning).toContain("this is a planning-only launch");
    expect(planning).toContain("Do not implement product code, UI, migrations, or runtime behavior in this phase.");
    expect(execution).toContain("this is an execution-only launch");
    expect(execution).toContain("Stop after fresh acceptance evidence, closed review, and the final handoff are integrated on origin/main.");
    expect(ui).toContain("this is a UI-only launch");
    expect(ui).toContain("Stop at the user's review boundary after the accepted presentation handoff is integrated on origin/main.");
  });

  it("renders UI destinations and Layer 3 UI inputs without unresolved placeholders", async () => {
    const common = {
      workerId: "P3",
      accountId: "bot3" as const,
      taskId: "P3",
      taskTitle: "Platform live wiring",
      phase: "planning",
      phaseTerminalCondition: "Stop after the approved planning handoff is integrated on origin/main; do not begin implementation.",
      blueprintPath: "docs/blueprint.md",
      masterplanPath: "docs/blueprint.md",
      coordinationRoot: "docs/workers/mvp3",
      statusPath: "docs/workers/mvp3/p3.md",
      specificationPath: "docs/p3-spec.md",
      implementationPlanPath: "docs/p3-plan.md",
      plannedPrerequisites: "P2: specification docs/p2-spec.md implementation plan docs/p2-plan.md\nPD: UI requirements docs/design/requirements/pd.md presentation handoff docs/design/handoffs/pd.md",
      uiRequirementsPath: "docs/design/requirements/pd.md",
      uiHandoffPath: "docs/design/handoffs/pd.md",
      checkoutMode: "independent_main_clone" as const,
      mainMutationLock: "not-applicable-for-independent-clones",
      mainPushQueue: "swarm-main-push-queue",
      edenmindClonePath: "/Users/bot3/Dev/EdenMind",
      ownedSurfaces: "src/p3",
      excludedSurfaces: "src/other",
    };
    const [planning, execution, ui] = await Promise.all([
      renderWorkerPrompt("planning", common),
      renderWorkerPrompt("execution", { ...common, phase: "execution", phaseTerminalCondition: "Stop after fresh acceptance evidence, closed review, and the final handoff are integrated on origin/main.", planningGatePath: "docs/workers/mvp3/g0.md", planningGateCommit: "abc123", hardPrerequisites: "P2X" }),
      renderWorkerPrompt("ui", { ...common, workerId: "PD", taskId: "PD", taskTitle: "Platform design", phase: "ui", phaseTerminalCondition: "Stop at the user's review boundary after the accepted presentation handoff is integrated on origin/main." }),
    ]);

    for (const packet of [planning, execution, ui]) {
      expect(packet).toContain("docs/design/requirements/pd.md");
      expect(packet).toContain("docs/design/handoffs/pd.md");
      expect(packet).not.toMatch(/{{[A-Z_]+}}/);
    }
  });

  it("uses the independent-clone queue for separate macOS-account workspaces", () => {
    expect(launchGitMetadata("bot3")).toEqual({
      checkoutMode: "independent_main_clone",
      mainMutationLock: "not-applicable-for-independent-clones",
      mainPushQueue: "swarm-main-push-queue",
      edenmindClonePath: "/Users/bot3/Dev/EdenMind",
    });
  });
});
