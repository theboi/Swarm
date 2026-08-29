import { chmod } from "node:fs/promises";
import { join } from "node:path";

if (process.platform === "darwin") {
  const helper = join(process.cwd(), "node_modules", "node-pty", "prebuilds", `darwin-${process.arch}`, "spawn-helper");
  await chmod(helper, 0o755);
}
