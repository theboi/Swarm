import { ACCOUNT_IDS, type PromptTemplate, type TaskKind, type TaskManifest, type TaskManifestTask } from "./contracts.js";

export type ManifestValidationError =
  | { code: "MANIFEST_INVALID"; field: string; reason: "required" | "type" | "value" | "duplicate" }
  | { code: "MANIFEST_DUPLICATE_TASK_ID"; taskId: string }
  | { code: "MANIFEST_UNKNOWN_DEPENDENCY"; taskId: string; dependencyId: string }
  | { code: "MANIFEST_CYCLE"; cycle: string[] };

export type ManifestValidationResult =
  | { ok: true; data: TaskManifest }
  | { ok: false; error: ManifestValidationError };

const taskKinds = new Set<TaskKind>(["planning", "execution", "ui", "gate"]);
const promptTemplates = new Set<PromptTemplate>(["planning", "execution", "ui"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): ManifestValidationError | null {
  if (typeof value !== "string") {
    return { code: "MANIFEST_INVALID", field, reason: "type" };
  }

  if (value.trim().length === 0) {
    return { code: "MANIFEST_INVALID", field, reason: "required" };
  }
  return value === value.trim()
    ? null
    : { code: "MANIFEST_INVALID", field, reason: "value" };
}

function validateTask(value: unknown, index: number): ManifestValidationError | null {
  const prefix = `tasks[${index}]`;
  if (!isRecord(value)) {
    return { code: "MANIFEST_INVALID", field: prefix, reason: "type" };
  }

  const idError = requiredString(value.id, `${prefix}.id`);
  if (idError) return idError;
  const titleError = requiredString(value.title, `${prefix}.title`);
  if (titleError) return titleError;

  if (typeof value.kind !== "string") {
    return { code: "MANIFEST_INVALID", field: `${prefix}.kind`, reason: "type" };
  }
  if (!taskKinds.has(value.kind as TaskKind)) {
    return { code: "MANIFEST_INVALID", field: `${prefix}.kind`, reason: "value" };
  }

  if (!Array.isArray(value.dependsOn) || value.dependsOn.some((dependency) => typeof dependency !== "string" || dependency.trim().length === 0)) {
    return { code: "MANIFEST_INVALID", field: `${prefix}.dependsOn`, reason: "type" };
  }
  if (new Set(value.dependsOn).size !== value.dependsOn.length) {
    return { code: "MANIFEST_INVALID", field: `${prefix}.dependsOn`, reason: "duplicate" };
  }

  if (value.passes !== undefined) {
    if (!Array.isArray(value.passes) || value.passes.some((pass) => pass !== "planning" && pass !== "execution")) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.passes`, reason: "type" };
    }
    if (value.passes.length === 0 || new Set(value.passes).size !== value.passes.length) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.passes`, reason: value.passes.length === 0 ? "required" : "duplicate" };
    }
  }
  if (value.executionDependsOn !== undefined) {
    if (!Array.isArray(value.executionDependsOn) || value.executionDependsOn.some((dependency) => typeof dependency !== "string" || dependency.trim().length === 0)) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.executionDependsOn`, reason: "type" };
    }
    if (new Set(value.executionDependsOn).size !== value.executionDependsOn.length) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.executionDependsOn`, reason: "duplicate" };
    }
  }

  if (value.pathId !== undefined || value.pathStep !== undefined) {
    if (value.pathId === undefined) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.pathId`, reason: "required" };
    }
    if (value.pathStep === undefined) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.pathStep`, reason: "required" };
    }
    const pathError = requiredString(value.pathId, `${prefix}.pathId`);
    if (pathError) return pathError;
    if (typeof value.pathStep !== "number") {
      return { code: "MANIFEST_INVALID", field: `${prefix}.pathStep`, reason: "type" };
    }
    if (!Number.isInteger(value.pathStep) || value.pathStep < 0) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.pathStep`, reason: "value" };
    }
  }

  if (typeof value.promptTemplate !== "string") {
    return { code: "MANIFEST_INVALID", field: `${prefix}.promptTemplate`, reason: "type" };
  }
  if (!promptTemplates.has(value.promptTemplate as PromptTemplate)) {
    return { code: "MANIFEST_INVALID", field: `${prefix}.promptTemplate`, reason: "value" };
  }

  for (const optionalField of ["statusPath", "specificationPath", "implementationPlanPath", "uiRequirementsPath", "uiHandoffPath"] as const) {
    if (value[optionalField] === undefined) continue;
    const error = requiredString(value[optionalField], `${prefix}.${optionalField}`);
    if (error) return error;
  }
  if (value.kind === "ui") {
    for (const field of ["uiRequirementsPath", "uiHandoffPath"] as const) {
      if (value[field] === undefined) {
        return { code: "MANIFEST_INVALID", field: `${prefix}.${field}`, reason: "required" };
      }
    }
    if (value.implementationPlanPath !== undefined) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.implementationPlanPath`, reason: "value" };
    }
  }
  if (value.preferredAccount !== undefined) {
    if (typeof value.preferredAccount !== "string") {
      return { code: "MANIFEST_INVALID", field: `${prefix}.preferredAccount`, reason: "type" };
    }
    if (!(ACCOUNT_IDS as readonly string[]).includes(value.preferredAccount)) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.preferredAccount`, reason: "value" };
    }
  }

  return null;
}

function findFirstCycle(tasks: TaskManifestTask[], dependenciesFor: (task: TaskManifestTask) => string[] = (task) => task.dependsOn): string[] | null {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  const visit = (taskId: string): string[] | null => {
    if (visiting.has(taskId)) {
      const start = path.indexOf(taskId);
      return [...path.slice(start), taskId];
    }
    if (visited.has(taskId)) return null;

    visiting.add(taskId);
    path.push(taskId);
    for (const dependencyId of dependenciesFor(taskById.get(taskId)!)) {
      const cycle = visit(dependencyId);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(taskId);
    visited.add(taskId);
    return null;
  };

  for (const task of tasks) {
    const cycle = visit(task.id);
    if (cycle) return cycle;
  }
  return null;
}

export function validateTaskManifest(value: unknown): ManifestValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: { code: "MANIFEST_INVALID", field: "manifest", reason: "type" } };
  }

  for (const field of ["blueprintId", "title", "masterplanPath", "coordinationRoot"] as const) {
    const error = requiredString(value[field], field);
    if (error) return { ok: false, error };
  }
  if (!Array.isArray(value.tasks)) {
    return { ok: false, error: { code: "MANIFEST_INVALID", field: "tasks", reason: "type" } };
  }
  if (value.lifecycle !== undefined) {
    if (!isRecord(value.lifecycle)) return { ok: false, error: { code: "MANIFEST_INVALID", field: "lifecycle", reason: "type" } };
    if (value.lifecycle.mode !== "two_pass") return { ok: false, error: { code: "MANIFEST_INVALID", field: "lifecycle.mode", reason: "value" } };
    if (value.lifecycle.activePass !== "planning" && value.lifecycle.activePass !== "execution") return { ok: false, error: { code: "MANIFEST_INVALID", field: "lifecycle.activePass", reason: "value" } };
    if (value.lifecycle.parallelPasses !== undefined && typeof value.lifecycle.parallelPasses !== "boolean") return { ok: false, error: { code: "MANIFEST_INVALID", field: "lifecycle.parallelPasses", reason: "type" } };
    const gateError = requiredString(value.lifecycle.planningGatePath, "lifecycle.planningGatePath");
    if (gateError) return { ok: false, error: gateError };
  }

  for (const [index, task] of value.tasks.entries()) {
    const error = validateTask(task, index);
    if (error) return { ok: false, error };
  }

  const manifest = value as unknown as TaskManifest;
  const taskIds = new Set<string>();
  const pathPositions = new Set<string>();
  for (const task of manifest.tasks) {
    if (taskIds.has(task.id)) {
      return { ok: false, error: { code: "MANIFEST_DUPLICATE_TASK_ID", taskId: task.id } };
    }
    taskIds.add(task.id);
    if (task.pathId !== undefined && task.pathStep !== undefined) {
      const position = `${task.pathId}\u0000${task.pathStep}`;
      if (pathPositions.has(position)) {
        const index = manifest.tasks.indexOf(task);
        return { ok: false, error: { code: "MANIFEST_INVALID", field: `tasks[${index}].pathStep`, reason: "duplicate" } };
      }
      pathPositions.add(position);
    }
  }

  for (const task of manifest.tasks) {
    for (const dependencyId of [...task.dependsOn, ...(task.executionDependsOn ?? [])]) {
      if (!taskIds.has(dependencyId)) {
        return {
          ok: false,
          error: { code: "MANIFEST_UNKNOWN_DEPENDENCY", taskId: task.id, dependencyId },
        };
      }
    }
    if (manifest.lifecycle?.mode === "two_pass") {
      const index = manifest.tasks.indexOf(task);
      const expectedPasses = task.kind === "ui" ? ["planning"] : ["planning", "execution"];
      if (task.passes?.join(",") !== expectedPasses.join(",")) {
        return { ok: false, error: { code: "MANIFEST_INVALID", field: `tasks[${index}].passes`, reason: "value" } };
      }
      if (task.kind !== "ui" && task.executionDependsOn === undefined) {
        return { ok: false, error: { code: "MANIFEST_INVALID", field: `tasks[${index}].executionDependsOn`, reason: "required" } };
      }
      if (task.kind === "ui" && task.executionDependsOn !== undefined) {
        return { ok: false, error: { code: "MANIFEST_INVALID", field: `tasks[${index}].executionDependsOn`, reason: "value" } };
      }
    }
  }

  const cycle = findFirstCycle(manifest.tasks);
  if (cycle) return { ok: false, error: { code: "MANIFEST_CYCLE", cycle } };
  if (manifest.lifecycle?.mode === "two_pass") {
    const executionCycle = findFirstCycle(manifest.tasks.filter((task) => task.passes?.includes("execution")), (task) => task.executionDependsOn ?? []);
    if (executionCycle) return { ok: false, error: { code: "MANIFEST_CYCLE", cycle: executionCycle } };
  }

  return { ok: true, data: manifest };
}
