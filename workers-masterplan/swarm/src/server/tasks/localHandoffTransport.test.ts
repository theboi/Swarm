import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

import { LocalJsonlHandoffTransport } from "./localHandoffTransport.js";

type CopyAsTarget = (input: { sourcePath: string; targetPath: string }) => Promise<void>;
const run = promisify(execFile);

function handoffFilename(sourceAccountId: string, sourceThreadId: string): string {
  return `swarm-handoff-${sourceAccountId}-${createHash("sha256").update(`${sourceAccountId}\u0000${sourceThreadId}`).digest("hex").slice(0, 12)}.jsonl`;
}

async function fixture(copyAsTarget: CopyAsTarget = async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath)) {
  const root = await mkdtemp(join(tmpdir(), "swarm-local-handoff-"));
  const stagingRoot = join(root, "coordinator", ".data", "handoffs");
  const targetWorkspace = join(root, "bot1", "Dev", "EdenMind");
  await mkdir(targetWorkspace, { recursive: true });
  await run("/usr/bin/git", ["init", "-q", targetWorkspace]);
  await writeFile(join(targetWorkspace, ".gitignore"), "swarm-handoff-*.jsonl\n");
  const copy = vi.fn(copyAsTarget);
  const transport = new LocalJsonlHandoffTransport({
    stagingRoot,
    workspaceFor: () => targetWorkspace,
    passwords: { bot1: "target-password" },
    copyAsTarget: copy,
  });
  return { root, stagingRoot, targetWorkspace, copyAsTarget: copy, transport };
}

describe("LocalJsonlHandoffTransport", () => {
  it("grants target-only ACL traversal during the copy and revokes the staging-root grant during cleanup", async () => {
    let accessSnapshot = "";
    const { root, stagingRoot, targetWorkspace, transport } = await fixture(async ({ sourcePath, targetPath }) => {
      accessSnapshot = (await run("/bin/ls", ["-lde", stagingRoot, dirname(sourcePath), sourcePath])).stdout;
      await copyFile(sourcePath, targetPath);
    });

    try {
      await transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") });

      expect(accessSnapshot).toContain("user:bot1 allow search");
      expect(accessSnapshot).toContain("user:bot1 allow read");
      expect((await run("/bin/ls", ["-lde", stagingRoot])).stdout).not.toContain("user:bot1 allow search");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("revokes a partially granted staging-root ACL when the remaining target access grant fails", async () => {
    const { root, stagingRoot, targetWorkspace } = await fixture();
    let revoked = false;
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: () => targetWorkspace,
      passwords: { bot1: "target-password" },
      copyAsTarget: async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath),
      grantTargetAccess: async () => { throw new Error("directory ACL failed after root ACL grant"); },
      revokeTargetAccess: async () => { revoked = true; },
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_COPY_FAILED");
      expect(revoked).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("copies an over-16-MiB rollout byte-for-byte into the target workspace without staging residue", async () => {
    const { root, stagingRoot, targetWorkspace, copyAsTarget, transport } = await fixture();
    const rollout = Buffer.alloc(16 * 1024 * 1024 + 1, 0x5a);
    rollout[0] = 0x7b;
    rollout[rollout.length - 1] = 0x0a;

    try {
      const handoff = await transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: rollout });

      expect(createHash("sha256").update(await readFile(handoff.path)).digest("hex")).toBe(createHash("sha256").update(rollout).digest("hex"));
      expect(handoff.path).toMatch(new RegExp(`^${targetWorkspace}/swarm-handoff-bot7-[a-f0-9]{12}\\.jsonl$`));
      expect(copyAsTarget).toHaveBeenCalledWith(expect.objectContaining({ account: "bot1" }));
      expect(await readdir(stagingRoot)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("removes the staged rollout when the target-account copy fails", async () => {
    const { root, stagingRoot, targetWorkspace, transport } = await fixture(async () => { throw new Error("target install failed"); });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{\"type\":\"session_meta\"}\n") })).rejects.toThrow("LOCAL_HANDOFF_COPY_FAILED");
      expect(await readdir(stagingRoot)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("recovers from a first cleanup failure by restoring the staging-root mode", async () => {
    let stagingRoot = "";
    const { root, targetWorkspace, transport } = await fixture(async ({ sourcePath, targetPath }) => {
      await copyFile(sourcePath, targetPath);
      await chmod(stagingRoot, 0o500);
    });
    stagingRoot = join(root, "coordinator", ".data", "handoffs");

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).resolves.toEqual(expect.objectContaining({ path: expect.any(String) }));
      expect(await readdir(stagingRoot)).toEqual([]);
    } finally {
      await chmod(stagingRoot, 0o700).catch(() => undefined);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("surfaces a cleanup error when bounded recovery cannot remove staging", async () => {
    const { root, targetWorkspace, transport } = await fixture();
    (transport as unknown as { removeStageDirectory: () => Promise<void> }).removeStageDirectory = async () => { throw new Error("persistent cleanup failure"); };

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_CLEANUP_FAILED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes staging initialization failures as local handoff copy failures", async () => {
    const { root, targetWorkspace } = await fixture();
    const blockedParent = join(root, "blocked-parent");
    await writeFile(blockedParent, "not a directory");
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot: join(blockedParent, "handoffs"),
      workspaceFor: () => targetWorkspace,
      passwords: { bot1: "target-password" },
      copyAsTarget: async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath),
      grantTargetAccess: async () => undefined,
      revokeTargetAccess: async () => undefined,
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_COPY_FAILED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked staging root instead of writing rollout bytes outside the coordinator boundary", async () => {
    const { root, stagingRoot, targetWorkspace, transport } = await fixture();
    const outside = join(root, "outside");
    await mkdir(outside);
    await mkdir(dirname(stagingRoot), { recursive: true });
    await symlink(outside, stagingRoot);

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_INVALID");
      expect(await readdir(outside)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked target handoff before it can overwrite an outside file", async () => {
    const { root, targetWorkspace, transport } = await fixture();
    const outside = join(root, "outside.jsonl");
    const destination = join(targetWorkspace, handoffFilename("bot7", "source-thread"));
    await writeFile(outside, "outside\n");
    await symlink(outside, destination);

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_INVALID");
      await expect(readFile(outside, "utf8")).resolves.toBe("outside\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps staging and final handoff names excluded from Git", async () => {
    const repositoryRoot = resolve(process.cwd(), "../..");
    const result = await Promise.allSettled([
      run("/usr/bin/git", ["-C", repositoryRoot, "check-ignore", "-q", "workers-masterplan/swarm/.data/handoffs/handoff.jsonl"]),
      run("/usr/bin/git", ["-C", repositoryRoot, "check-ignore", "-q", "swarm-handoff-bot1-0123456789ab.jsonl"]),
    ]);

    expect(result.every((entry) => entry.status === "fulfilled")).toBe(true);
  });

  it("checks the target clone's handoff ignore rule before creating staged rollout bytes", async () => {
    const { root, stagingRoot, targetWorkspace, transport } = await fixture();
    await writeFile(join(targetWorkspace, ".gitignore"), "");

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_COPY_FAILED");
      await expect(readdir(stagingRoot)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects accounts and target paths outside Swarm's fixed workspace boundary before staging", async () => {
    const { root, stagingRoot, targetWorkspace, copyAsTarget, transport } = await fixture();

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot9" as never, sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_INVALID");
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace: join(root, "outside"), jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_INVALID");

      expect(copyAsTarget).not.toHaveBeenCalled();
      await expect(readdir(stagingRoot)).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
