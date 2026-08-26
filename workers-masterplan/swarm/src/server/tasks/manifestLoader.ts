import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { validateTaskManifest, type TaskManifest } from "../../shared/contracts.js";

function inside(root: string, candidate: string): boolean { const value = relative(root, candidate); return value === "" || (!value.startsWith("..") && !isAbsolute(value)); }

export async function loadManifest(path: string, repositoryRoot: string): Promise<TaskManifest> {
  const root = await realpath(repositoryRoot);
  const manifestPath = await realpath(resolve(path));
  if (!inside(root, manifestPath)) throw new Error("Manifest is outside repository");
  const result = validateTaskManifest(JSON.parse(await readFile(manifestPath, "utf8")));
  if (!result.ok) throw new Error(`${result.error.code}: invalid manifest`);
  for (const field of [result.data.masterplanPath, result.data.coordinationRoot, ...result.data.tasks.flatMap((task) => [task.statusPath, task.specificationPath, task.implementationPlanPath])]) {
    if (!field) continue;
    const candidate = resolve(root, field);
    if (!inside(root, candidate)) throw new Error(`Manifest path is outside repository: ${field}`);
    let actual: string;
    try { actual = await realpath(candidate); } catch { throw new Error(`Manifest path does not exist: ${field}`); }
    if (!inside(root, actual)) throw new Error(`Manifest path is outside repository: ${field}`);
  }
  return result.data;
}

export function manifestRepositoryRoot(path: string): string { return dirname(resolve(path)); }
