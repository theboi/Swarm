import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Locates the compiled client independently of the coordinator's working directory. */
export function staticAssetDirectory(serverModuleUrl: string): string {
  return resolve(fileURLToPath(new URL("../../dist", serverModuleUrl)));
}
