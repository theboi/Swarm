import type { PromptTemplate, TaskKind, TaskManifest, TaskManifestTask } from "./contracts.js";

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

  for (const optionalField of ["statusPath", "specificationPath", "implementationPlanPath"] as const) {
    if (value[optionalField] === undefined) continue;
    const error = requiredString(value[optionalField], `${prefix}.${optionalField}`);
    if (error) return error;
  }
  if (value.preferredAccount !== undefined) {
    if (typeof value.preferredAccount !== "string") {
      return { code: "MANIFEST_INVALID", field: `${prefix}.preferredAccount`, reason: "type" };
    }
    if (!/^bot[1-8]$/.test(value.preferredAccount)) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.preferredAccount`, reason: "value" };
    }
  }

  return null;
}

function findFirstCycle(tasks: TaskManifestTask[]): string[] | null {
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
    for (const dependencyId of taskById.get(taskId)?.dependsOn ?? []) {
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
    for (const dependencyId of task.dependsOn) {
      if (!taskIds.has(dependencyId)) {
        return {
          ok: false,
          error: { code: "MANIFEST_UNKNOWN_DEPENDENCY", taskId: task.id, dependencyId },
        };
      }
    }
  }

  const cycle = findFirstCycle(manifest.tasks);
  if (cycle) return { ok: false, error: { code: "MANIFEST_CYCLE", cycle } };

  return { ok: true, data: manifest };
}
