import type { TaskNode } from "../../shared/contracts.js";

export function executionLaunchMetadata(task: TaskNode, tasks: TaskNode[]): { planningGatePath: string; planningGateCommit: string; hardPrerequisites: string } {
  const gate = task.readiness.evidence.find((evidence) => evidence.code === "PLANNING_GATE");
  if (!gate?.satisfied || !gate.path || !gate.commit || task.dependsOn.length === 0) throw new Error("PLANNING_GATE_METADATA_MISSING");
  return {
    planningGatePath: gate.path,
    planningGateCommit: gate.commit,
    hardPrerequisites: task.dependsOn.filter((id) => tasks.find((candidate) => candidate.id === id)?.kind !== "gate").join(", "),
  };
}

export function taskArtifactLaunchMetadata(
  task: TaskNode,
  tasks: TaskNode[],
): { plannedPrerequisites: string; uiRequirementsPath: string; uiHandoffPath: string } {
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const dependencies = task.dependsOn.flatMap((id) => {
    const dependency = byId.get(id);
    return dependency ? [dependency] : [];
  });
  const planningCounterpart = task.kind === "execution"
    ? byId.get(task.id.endsWith("X") ? task.id.slice(0, -1) : task.id)
    : undefined;
  const pathUi = task.pathId === undefined ? undefined : tasks.find((candidate) => candidate.kind === "ui" && candidate.pathId === task.pathId);
  const ui = task.kind === "ui"
    ? task
    : dependencies.find((dependency) => dependency.kind === "ui")
      ?? planningCounterpart?.dependsOn.map((id) => byId.get(id)).find((dependency) => dependency?.kind === "ui")
      ?? pathUi;
  const plannedPrerequisites = dependencies.length
    ? dependencies.map((dependency) => [
      `${dependency.id}:`,
      dependency.specificationPath && `specification ${dependency.specificationPath}`,
      dependency.implementationPlanPath && `implementation plan ${dependency.implementationPlanPath}`,
      dependency.uiRequirementsPath && `UI requirements ${dependency.uiRequirementsPath}`,
      dependency.uiHandoffPath && `presentation handoff ${dependency.uiHandoffPath}`,
    ].filter(Boolean).join(" ")).join("\n")
    : "none";
  return {
    plannedPrerequisites,
    uiRequirementsPath: ui?.uiRequirementsPath ?? "not applicable",
    uiHandoffPath: ui?.uiHandoffPath ?? "not applicable",
  };
}
