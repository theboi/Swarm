import type { TaskNode } from "../../shared/contracts.js";

export function executionLaunchMetadata(task: TaskNode): { planningGatePath: string; planningGateCommit: string; hardPrerequisites: string } {
  const gate = task.readiness.evidence.find((evidence) => evidence.code === "PLANNING_GATE");
  if (!gate?.satisfied || !gate.path || !gate.commit || task.dependsOn.length === 0) throw new Error("PLANNING_GATE_METADATA_MISSING");
  return {
    planningGatePath: gate.path,
    planningGateCommit: gate.commit,
    hardPrerequisites: task.dependsOn.join(", "),
  };
}
