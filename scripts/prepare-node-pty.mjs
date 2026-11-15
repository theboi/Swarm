import { chmod, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

if (process.platform === "darwin") {
  const packageRoot = join(process.cwd(), "node_modules", "node-pty");
  const source = join(packageRoot, "src", "unix", "pty.cc");
  const original = "for (; count > 0; count--) {\n    close(low_fds[count]);\n  }";
  const corrected = "for (size_t index = 0; index < 3 && index <= count; index++) {\n    close(low_fds[index]);\n  }";
  let contents = await readFile(source, "utf8");
  if (!contents.includes(original) && !contents.includes(corrected) && !contents.includes("struct SwarmPtyDescriptors")) throw new Error("Unsupported node-pty macOS PTY source; check for the descriptor leak before installing");
  contents = contents.replace(original, corrected);
  // The parent must close the slave too, including failures before spawn.
  // Revoked slaves still occupy descriptors and can exhaust macOS PTYs.
  if (!contents.includes("struct SwarmPtyDescriptors")) {
    const declarations = "  int low_fds[3];\n  size_t count = 0;";
    const slaveDeclaration = "  int slave;\n  char slave_pty_name[128];";
    if (!contents.includes(declarations) || !contents.includes(slaveDeclaration)) throw new Error("Unsupported node-pty descriptor ownership; review the macOS spawn implementation");
    contents = contents.replace(declarations, `  int low_fds[3] = {-1, -1, -1};
  int slave = -1;
  *master = -1;
  struct SwarmPtyDescriptors {
    int* low_fds;
    int& slave;
    int* master;
    int* error;
    ~SwarmPtyDescriptors() {
      for (size_t index = 0; index < 3; index++) {
        if (low_fds[index] >= 0) close(low_fds[index]);
      }
      if (slave >= 0) close(slave);
      if (*error != 0 && *master >= 0) {
        close(*master);
        *master = -1;
      }
    }
  } descriptors{low_fds, slave, master, err};
  size_t count = 0;`);
    contents = contents.replace(slaveDeclaration, "  char slave_pty_name[128];");
    contents = contents.replace(corrected, "// SwarmPtyDescriptors releases temporary descriptors on every return.");
  }
  // Exit monitoring also owns a kqueue per spawn; release it after waiting.
  const queueEnd = "\n#else\n    while (true) {\n      errno = 0;";
  if (!contents.includes("close(kq);")) {
    if (!contents.includes(queueEnd)) throw new Error("Unsupported node-pty exit monitoring; review kqueue ownership");
    contents = contents.replace(queueEnd, "\n    close(kq);" + queueEnd);
  }
  await writeFile(source, contents);
  const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  const nodeGyp = join(globalRoot, "npm", "node_modules", "node-gyp", "bin", "node-gyp.js");
  execFileSync(process.execPath, [nodeGyp, "rebuild"], { cwd: packageRoot, stdio: "inherit" });
  await chmod(join(packageRoot, "build", "Release", "spawn-helper"), 0o755);
}
