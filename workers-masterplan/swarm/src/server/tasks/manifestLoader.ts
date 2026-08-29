import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { validateTaskManifest, type TaskManifest } from "../../shared/contracts.js";

function inside(root: string, candidate: string): boolean { const value = relative(root, candidate); return value === "" || (!value.startsWith("..") && !isAbsolute(value)); }

async function resolvedIfPresent(path: string): Promise<string | undefined> {
  try {
    return await realpath(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}

async function validateRepositoryPath(root: string, field: string, allowMissing: boolean): Promise<void> {
  const candidate = resolve(root, field);
  if (!inside(root, candidate)) throw new Error(`Manifest path is outside repository: ${field}`);
  const actual = await resolvedIfPresent(candidate);
  if (actual) {
    if (!inside(root, actual)) throw new Error(`Manifest path is outside repository: ${field}`);
    return;
  }
  if (!allowMissing) throw new Error(`Manifest path does not exist: ${field}`);

  let ancestor = dirname(candidate);
  while (inside(root, ancestor)) {
    const resolvedAncestor = await resolvedIfPresent(ancestor);
    if (resolvedAncestor) {
      if (!inside(root, resolvedAncestor)) throw new Error(`Manifest path is outside repository: ${field}`);
      return;
    }
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  throw new Error(`Manifest path is outside repository: ${field}`);
}

export async function loadManifest(path: string, repositoryRoot: string): Promise<TaskManifest> {
  const root = await realpath(repositoryRoot);
  const manifestPath = await realpath(resolve(path));
  if (!inside(root, manifestPath)) throw new Error("Manifest is outside repository");
  const result = validateTaskManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  if (!result.ok) throw new Error(`${result.error.code}: invalid manifest`);
  for (const field of [result.data.masterplanPath, result.data.coordinationRoot, ...result.data.tasks.map((task) => task.statusPath)]) {
    if (!field) continue;
    await validateRepositoryPath(root, field, false);
  }
  for (const task of result.data.tasks) {
    for (const field of [task.specificationPath, task.implementationPlanPath]) {
      if (!field) continue;
      await validateRepositoryPath(root, field, task.kind === "planning" || task.kind === "ui");
    }
  }
  return result.data;
}

export function manifestRepositoryRoot(path: string): string { return dirname(resolve(path)); }
