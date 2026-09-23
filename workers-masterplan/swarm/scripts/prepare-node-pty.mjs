import { chmod, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

if (process.platform === "darwin") {
  const packageRoot = join(process.cwd(), "node_modules", "node-pty");
  const source = join(packageRoot, "src", "unix", "pty.cc");
  const original = "for (; count > 0; count--) {\n    close(low_fds[count]);\n  }";
  const corrected = "for (size_t index = 0; index < 3 && index <= count; index++) {\n    close(low_fds[index]);\n  }";
  const contents = await readFile(source, "utf8");
  if (!contents.includes(original) && !contents.includes(corrected)) throw new Error("Unsupported node-pty macOS PTY source; check for the descriptor leak before installing");
  if (contents.includes(original)) await writeFile(source, contents.replace(original, corrected));
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  const nodeGyp = join(globalRoot, "npm", "node_modules", "node-gyp", "bin", "node-gyp.js");
  execFileSync(process.execPath, [nodeGyp, "rebuild"], { cwd: packageRoot, stdio: "inherit" });
  await chmod(join(packageRoot, "build", "Release", "spawn-helper"), 0o755);
}
