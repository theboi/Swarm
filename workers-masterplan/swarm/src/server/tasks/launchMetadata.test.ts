import { describe, expect, it } from "vitest";
import type { TaskNode } from "../../shared/contracts.js";

import { executionLaunchMetadata, taskArtifactLaunchMetadata } from "./launchMetadata.js";

describe("execution launch metadata", () => {
  it("uses the planning-gate receipt and pinned commit rather than blank placeholders", () => {
    const gate = {
      id: "G0",
      title: "Planning gate",
      kind: "gate" as const,
      dependsOn: [],
      promptTemplate: "planning" as const,
      readiness: { taskId: "G0", state: "complete" as const, phase: "gate" as const, evidence: [], blockingCodes: [] },
    };
    const implementation = {
      id: "U1",
      title: "Runtime prerequisite",
      kind: "execution" as const,
      dependsOn: [],
      promptTemplate: "execution" as const,
      readiness: { taskId: "U1", state: "complete" as const, phase: "execution" as const, evidence: [], blockingCodes: [] },
    };
    const task: TaskNode = {
      id: "I0",
      title: "Integrate",
      kind: "execution",
      dependsOn: ["G0", "U1"],
      promptTemplate: "execution",
      readiness: {
        taskId: "I0",
        state: "ready",
        phase: "execution",
        evidence: [{ code: "PLANNING_GATE", satisfied: true, path: "docs/workers/G0.md", commit: "abc123" }],
        blockingCodes: [],
      },
    };
    expect(executionLaunchMetadata(task, [gate, implementation, task])).toEqual({ planningGatePath: "docs/workers/G0.md", planningGateCommit: "abc123", hardPrerequisites: "U1" });
  });

  it("derives UI destinations for a design worker and UI inputs for its live-wiring planner", () => {
    const p2 = {
      id: "P2",
      title: "People planning",
      kind: "planning" as const,
      dependsOn: [],
      promptTemplate: "planning" as const,
      specificationPath: "docs/p2-spec.md",
      implementationPlanPath: "docs/p2-plan.md",
      readiness: { taskId: "P2", state: "complete" as const, phase: "planning" as const, evidence: [], blockingCodes: [] },
    };
    const pd = {
      id: "PD",
      title: "Platform design",
      kind: "ui" as const,
      dependsOn: ["P2"],
      promptTemplate: "ui" as const,
      specificationPath: "docs/p2-spec.md",
      uiRequirementsPath: "docs/design/requirements/pd.md",
      uiHandoffPath: "docs/design/handoffs/pd.md",
      readiness: { taskId: "PD", state: "ready" as const, phase: "ui" as const, evidence: [], blockingCodes: [] },
    };
    const p3 = {
      id: "P3",
      title: "Platform live wiring",
      kind: "planning" as const,
      dependsOn: ["P2", "PD"],
      promptTemplate: "planning" as const,
      readiness: { taskId: "P3", state: "ready" as const, phase: "planning" as const, evidence: [], blockingCodes: [] },
    };
    const pg = {
      id: "PG",
      title: "Planning gate",
      kind: "gate" as const,
      dependsOn: ["P3"],
      promptTemplate: "planning" as const,
      readiness: { taskId: "PG", state: "complete" as const, phase: "gate" as const, evidence: [], blockingCodes: [] },
    };
    const p2x = {
      id: "P2X",
      title: "People implementation",
      kind: "execution" as const,
      dependsOn: [],
      promptTemplate: "execution" as const,
      readiness: { taskId: "P2X", state: "complete" as const, phase: "execution" as const, evidence: [], blockingCodes: [] },
    };
    const p3x = {
      id: "P3X",
      title: "Platform live wiring",
      kind: "execution" as const,
      dependsOn: ["PG", "P2X"],
      promptTemplate: "execution" as const,
      readiness: { taskId: "P3X", state: "ready" as const, phase: "execution" as const, evidence: [], blockingCodes: [] },
    };
    const tasks = [p2, pd, p3, pg, p2x, p3x];

    expect(taskArtifactLaunchMetadata(pd, tasks)).toMatchObject({
      uiRequirementsPath: "docs/design/requirements/pd.md",
      uiHandoffPath: "docs/design/handoffs/pd.md",
    });
    expect(taskArtifactLaunchMetadata(p3, tasks)).toMatchObject({
      uiRequirementsPath: "docs/design/requirements/pd.md",
      uiHandoffPath: "docs/design/handoffs/pd.md",
    });
    expect(taskArtifactLaunchMetadata(p3, tasks).plannedPrerequisites).toContain("P2");
    expect(taskArtifactLaunchMetadata(p3, tasks).plannedPrerequisites).toContain("PD");
    expect(taskArtifactLaunchMetadata(p3x, tasks)).toMatchObject({
      uiRequirementsPath: "docs/design/requirements/pd.md",
      uiHandoffPath: "docs/design/handoffs/pd.md",
    });
  });
});
