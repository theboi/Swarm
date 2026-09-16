import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { ensureCredentialStore, ensureProfileCheckout, readProfileWorkerInput } from "./profileProvisionerWorker.js";

const execute = promisify(execFile);

describe("profile provisioner worker input", () => {
  it("accepts one JSON line without waiting for the PTY to close", async () => {
    const input = new PassThrough();
    const parsed = readProfileWorkerInput(input);

    input.write(`${JSON.stringify({
      codexHome: "/Users/bot3/.swarm/codex-profiles/acc2",
      workspaceRoot: "/Users/bot3/Dev/EdenMind-acc2",
      repositoryUrl: "https://example.test/EdenMind.git",
    })}\n`);

    await expect(parsed).resolves.toEqual({
      codexHome: "/Users/bot3/.swarm/codex-profiles/acc2",
      workspaceRoot: "/Users/bot3/Dev/EdenMind-acc2",
      repositoryUrl: "https://example.test/EdenMind.git",
    });
  });
});

describe("profile checkout provisioning", () => {
  it("seeds from the bot's local checkout and replaces its origin URL", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-profile-checkout-"));
    const source = join(root, "source");
    const target = join(root, "target");
    const repositoryUrl = "https://example.test/EdenMind.git";

    try {
      await execute("/usr/bin/git", ["init", "--initial-branch=main", source]);
      await execute("/usr/bin/git", ["-C", source, "config", "user.name", "Swarm Test"]);
      await execute("/usr/bin/git", ["-C", source, "config", "user.email", "swarm@example.test"]);
      await writeFile(join(source, "README.md"), "local seed\n");
      await execute("/usr/bin/git", ["-C", source, "add", "README.md"]);
      await execute("/usr/bin/git", ["-C", source, "commit", "-m", "seed"]);
      await execute("/usr/bin/git", ["-C", source, "remote", "add", "origin", "https://user:credential@example.test/EdenMind.git"]);

      await ensureProfileCheckout(target, repositoryUrl, source);

      await expect(readFile(join(target, "README.md"), "utf8")).resolves.toBe("local seed\n");
      const origin = (await execute("/usr/bin/git", ["-C", target, "remote", "get-url", "origin"])).stdout.trim();
      expect(origin).toBe(repositoryUrl);
      expect(origin).not.toContain("credential");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("profile credential-store configuration", () => {
  it("accepts an existing file-backed credential store declaration", async () => {
    const root = await mkdtemp(join(tmpdir(), "swarm-profile-config-"));
    const codexHome = join(root, "profile");

    try {
      await mkdir(codexHome);
      await writeFile(join(codexHome, "config.toml"), 'model = "gpt-test"\ncli_auth_credentials_store = "file"\n');

      await expect(ensureCredentialStore(codexHome)).resolves.toBeUndefined();
      await expect(readFile(join(codexHome, "config.toml"), "utf8")).resolves.toContain('cli_auth_credentials_store = "file"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
