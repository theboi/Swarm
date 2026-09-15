import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";

import type { AccountId } from "../../shared/contracts.js";
import { LocalJsonlHandoffTransport, type TargetOwnedCopyInput } from "./localHandoffTransport.js";

type CopyAsTarget = (input: { sourcePath: string; targetPath: string }) => Promise<void>;
const run = promisify(execFile);

async function fixture(copyAsTarget: CopyAsTarget = async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath)) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "swarm-local-handoff-")));
  const localWorkspace = join(root, "coordinator");
  const stagingRoot = join(localWorkspace, ".data", "handoffs");
  const targetWorkspace = join(root, "bot1", "Dev", "EdenMind");
  await mkdir(localWorkspace, { recursive: true });
  await mkdir(targetWorkspace, { recursive: true });
  await run("/usr/bin/git", ["init", "-q", localWorkspace]);
  await writeFile(join(localWorkspace, ".gitignore"), "swarm-handoff-*.jsonl\n");
  await run("/usr/bin/git", ["init", "-q", targetWorkspace]);
  await writeFile(join(targetWorkspace, ".gitignore"), "swarm-handoff-*.jsonl\n");
  const copy = vi.fn(copyAsTarget);
  const transport = new LocalJsonlHandoffTransport({
    stagingRoot,
    workspaceFor: (account) => account === "claudiothe" ? localWorkspace : targetWorkspace,
    passwords: { bot1: "target-password" },
    copyAsTarget: copy,
  });
  return { root, localWorkspace, stagingRoot, targetWorkspace, copyAsTarget: copy, transport };
}

describe("LocalJsonlHandoffTransport", () => {
  it("grants target-only ACL traversal through an auto-created .data ancestor and revokes it during cleanup", async () => {
    let accessSnapshot = "";
    const { root, localWorkspace, stagingRoot, targetWorkspace, transport } = await fixture(async ({ sourcePath, targetPath }) => {
      accessSnapshot = (await run("/bin/ls", ["-lde", join(localWorkspace, ".data"), stagingRoot, dirname(sourcePath), sourcePath])).stdout;
      await copyFile(sourcePath, targetPath);
    });

    try {
      await transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") });

      expect(accessSnapshot).toContain("user:bot1 allow search");
      expect(accessSnapshot).toContain("user:bot1 allow read");
      expect((accessSnapshot.match(/user:bot1 allow search/g) ?? [])).toHaveLength(3);
      expect((await run("/bin/ls", ["-lde", join(localWorkspace, ".data"), stagingRoot])).stdout).not.toContain("user:bot1 allow search");
      expect((await run("/bin/ls", ["-lde", stagingRoot])).stdout).not.toContain("user:bot1 allow search");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("revokes the first shared ACL when the second shared ACL grant fails", async () => {
    const { root, localWorkspace, stagingRoot, targetWorkspace } = await fixture();
    const installedAcls = new Set<string>();
    const revocationAttempts: string[] = [];
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: (account: AccountId) => account === "claudiothe" ? localWorkspace : targetWorkspace,
      passwords: { bot1: "target-password" },
      copyAsTarget: async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath),
      grantTargetAccess: async (_account, paths, onSharedDirectoryGranted) => {
        const [firstDirectory] = paths.sharedDirectories;
        installedAcls.add(firstDirectory);
        onSharedDirectoryGranted?.(firstDirectory);
        throw new Error("second shared-directory ACL grant failed");
      },
      revokeTargetAccess: async (_account, paths) => {
        for (const directory of [...paths.sharedDirectories].reverse()) {
          revocationAttempts.push(directory);
          if (!installedAcls.delete(directory)) throw new Error("ACL was never granted");
        }
      },
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_COPY_FAILED");
      expect(revocationAttempts).toEqual([dirname(stagingRoot)]);
      expect(installedAcls).toEqual(new Set());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("normalizes a persistent shared ACL rollback failure after a grant failure", async () => {
    const { root, localWorkspace, stagingRoot, targetWorkspace } = await fixture();
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: (account: AccountId) => account === "claudiothe" ? localWorkspace : targetWorkspace,
      passwords: { bot1: "target-password" },
      copyAsTarget: async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath),
      grantTargetAccess: async (_account, paths, onSharedDirectoryGranted) => {
        onSharedDirectoryGranted?.(paths.sharedDirectories[0]);
        throw new Error("second shared-directory ACL grant failed");
      },
      revokeTargetAccess: async () => { throw new Error("persistent shared ACL rollback failure"); },
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_CLEANUP_FAILED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("defers target Git-ignore validation to the authenticated target command", async () => {
    const { root, localWorkspace, stagingRoot, targetWorkspace } = await fixture();
    await rm(join(targetWorkspace, ".git"), { recursive: true, force: true });
    const commands: string[] = [];
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: (account: AccountId) => account === "claudiothe" ? localWorkspace : targetWorkspace,
      passwords: { bot1: "target-password" },
      grantTargetAccess: async (_account, paths, onSharedDirectoryGranted) => { paths.sharedDirectories.forEach(onSharedDirectoryGranted); },
      revokeTargetAccess: async () => undefined,
    }, async (_account, _password, command) => {
      commands.push(command);
      return 0;
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).resolves.toEqual(expect.objectContaining({ path: expect.any(String) }));
      expect(commands).toHaveLength(1);
      expect(commands[0]).toContain("check-ignore -q --");
      expect(commands[0]).toContain(targetWorkspace);
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
      expect(handoff.path).toMatch(new RegExp(`^${targetWorkspace}/swarm-handoff-bot7-[a-f0-9]{12}-[a-f0-9-]{36}\\.jsonl$`));
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
    const { root, localWorkspace, targetWorkspace } = await fixture();
    const blockedParent = join(localWorkspace, "blocked-parent");
    await writeFile(blockedParent, "not a directory");
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot: join(blockedParent, "handoffs"),
      workspaceFor: (account: AccountId) => account === "claudiothe" ? localWorkspace : targetWorkspace,
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

  it("accepts a concurrent first-use staging directory creator after EEXIST", async () => {
    const { root, localWorkspace, stagingRoot, targetWorkspace } = await fixture();
    let raced = false;
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: (account: AccountId) => account === "claudiothe" ? localWorkspace : targetWorkspace,
      passwords: { bot1: "target-password" },
      copyAsTarget: async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath),
      createStagingDirectory: async (path) => {
        if (!raced && path === stagingRoot) {
          raced = true;
          await mkdir(path, { mode: 0o700 });
          throw Object.assign(new Error("already created by concurrent handoff"), { code: "EEXIST" });
        }
        await mkdir(path, { mode: 0o700 });
      },
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).resolves.toEqual(expect.objectContaining({ path: expect.any(String) }));
      expect(raced).toBe(true);
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

  it("rejects a staging root whose .data ancestor resolves outside the coordinator workspace", async () => {
    const { root, localWorkspace, stagingRoot, targetWorkspace, transport } = await fixture();
    const outside = join(root, "outside");
    await mkdir(join(outside, "handoffs"), { recursive: true });
    await symlink(outside, join(localWorkspace, ".data"));

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_INVALID");
      expect(await readdir(join(outside, "handoffs"))).toEqual([]);
      expect(resolve(stagingRoot)).toContain(`${localWorkspace}/.data/handoffs`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a target workspace whose Dev ancestor redirects outside its account boundary", async () => {
    const { root, targetWorkspace, transport } = await fixture();
    const targetHome = dirname(dirname(targetWorkspace));
    const outside = join(root, "outside");
    await mkdir(join(outside, "EdenMind"), { recursive: true });
    await rm(join(targetHome, "Dev"), { recursive: true, force: true });
    await symlink(outside, join(targetHome, "Dev"));

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_INVALID");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses a destination symlink introduced after validation without writing outside the target workspace", async () => {
    const { root, localWorkspace, targetWorkspace } = await fixture();
    const outside = join(root, "outside.jsonl");
    await writeFile(outside, "outside\n");
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot: join(localWorkspace, ".data", "handoffs"),
      workspaceFor: (account) => account === "claudiothe" ? localWorkspace : targetWorkspace,
      passwords: {},
      beforeDestinationCreate: async (destination: string) => { await symlink(outside, destination); },
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "claudiothe", targetWorkspace: localWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_COPY_FAILED");
      await expect(readFile(outside, "utf8")).resolves.toBe("outside\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("creates distinct ignored destinations for repeated transfers of the same source rollout", async () => {
    const { root, targetWorkspace, transport } = await fixture();

    try {
      const first = await transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{\"attempt\":1}\n") });
      const second = await transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{\"attempt\":2}\n") });

      expect(first.path).not.toBe(second.path);
      await expect(readFile(first.path, "utf8")).resolves.toBe("{\"attempt\":1}\n");
      await expect(readFile(second.path, "utf8")).resolves.toBe("{\"attempt\":2}\n");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps parent traversal ACLs until overlapping target copies have both released their leases", async () => {
    let releaseFirstGrant: (() => void) | undefined;
    const firstGrantAllowed = new Promise<void>((resolveGrant) => { releaseFirstGrant = resolveGrant; });
    let firstGrantEntered: (() => void) | undefined;
    const firstGrantStarted = new Promise<void>((resolveGrant) => { firstGrantEntered = resolveGrant; });
    let releaseSecondCopy: (() => void) | undefined;
    const secondCopyHeld = new Promise<void>((resolveCopy) => { releaseSecondCopy = resolveCopy; });
    let secondCopyStarted: (() => void) | undefined;
    const secondCopyReady = new Promise<void>((resolveCopy) => { secondCopyStarted = resolveCopy; });
    let grants = 0;
    let revokes = 0;
    const { root, stagingRoot, targetWorkspace } = await fixture();
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: (account: AccountId) => account === "claudiothe" ? join(root, "coordinator") : targetWorkspace,
      passwords: { bot1: "target-password" },
      grantTargetAccess: async () => {
        grants += 1;
        if (grants === 1) {
          firstGrantEntered?.();
          await firstGrantAllowed;
        }
      },
      grantTargetStageAccess: async () => undefined,
      revokeTargetAccess: async () => { revokes += 1; },
      copyAsTarget: async ({ sourcePath, targetPath }: TargetOwnedCopyInput) => {
        await copyFile(sourcePath, targetPath);
        if ((await readFile(sourcePath, "utf8")).includes("\"attempt\":1")) await secondCopyReady;
        else {
          secondCopyStarted?.();
          await secondCopyHeld;
        }
      },
    });

    try {
      const first = transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{\"attempt\":1}\n") });
      await firstGrantStarted;
      const second = transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "other-source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{\"attempt\":2}\n") });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
      expect(grants).toBe(1);
      releaseFirstGrant?.();
      await secondCopyReady;
      await first;

      expect(revokes).toBe(0);
      releaseSecondCopy?.();
      await second;
      expect(grants).toBe(1);
      expect(revokes).toBe(1);
    } finally {
      releaseFirstGrant?.();
      releaseSecondCopy?.();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serializes shared ACL changes across target accounts without retaining either account's access", async () => {
    let releaseFirstGrant: (() => void) | undefined;
    const firstGrantAllowed = new Promise<void>((resolveGrant) => { releaseFirstGrant = resolveGrant; });
    let firstGrantEntered: (() => void) | undefined;
    const firstGrantStarted = new Promise<void>((resolveGrant) => { firstGrantEntered = resolveGrant; });
    let releaseFirstCopy: (() => void) | undefined;
    const firstCopyHeld = new Promise<void>((resolveCopy) => { releaseFirstCopy = resolveCopy; });
    let releaseSecondCopy: (() => void) | undefined;
    const secondCopyHeld = new Promise<void>((resolveCopy) => { releaseSecondCopy = resolveCopy; });
    let secondCopyStarted: (() => void) | undefined;
    const secondCopyReady = new Promise<void>((resolveCopy) => { secondCopyStarted = resolveCopy; });
    let secondGrantStarted: (() => void) | undefined;
    const secondGrantReached = new Promise<void>((resolveGrant) => { secondGrantStarted = resolveGrant; });
    const grants: string[] = [];
    const activeAccounts = new Set<string>();
    const { root, stagingRoot, targetWorkspace } = await fixture();
    const targetWorkspace2 = join(root, "bot2", "Dev", "EdenMind");
    await mkdir(targetWorkspace2, { recursive: true });
    await run("/usr/bin/git", ["init", "-q", targetWorkspace2]);
    await writeFile(join(targetWorkspace2, ".gitignore"), "swarm-handoff-*.jsonl\n");
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: (account: AccountId) => account === "claudiothe" ? join(root, "coordinator") : account === "bot1" ? targetWorkspace : targetWorkspace2,
      passwords: { bot1: "target-password", bot2: "target-password" },
      grantTargetAccess: async (account, paths, onSharedDirectoryGranted) => {
        grants.push(account);
        if (account === "bot1") {
          firstGrantEntered?.();
          await firstGrantAllowed;
        } else secondGrantStarted?.();
        activeAccounts.add(account);
        paths.sharedDirectories.forEach(onSharedDirectoryGranted);
      },
      revokeTargetAccess: async (account) => { activeAccounts.delete(account); },
      copyAsTarget: async ({ account, sourcePath, targetPath }: TargetOwnedCopyInput) => {
        await copyFile(sourcePath, targetPath);
        if (account === "bot1") await firstCopyHeld;
        else {
          secondCopyStarted?.();
          await secondCopyHeld;
        }
      },
    });

    try {
      const first = transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{\"attempt\":1}\n") });
      await firstGrantStarted;
      const second = transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "other-source-thread", targetAccountId: "bot2", targetWorkspace: targetWorkspace2, jsonl: Buffer.from("{\"attempt\":2}\n") });
      const secondGrantBeforeFirstFinishes = await Promise.race([
        secondGrantReached.then(() => true),
        new Promise<false>((resolveDelay) => setTimeout(() => resolveDelay(false), 100)),
      ]);
      expect(secondGrantBeforeFirstFinishes).toBe(false);
      expect(grants).toEqual(["bot1"]);

      releaseFirstGrant?.();
      await secondCopyReady;
      expect(activeAccounts).toEqual(new Set(["bot1", "bot2"]));

      releaseFirstCopy?.();
      await first;
      expect(activeAccounts).toEqual(new Set(["bot2"]));

      releaseSecondCopy?.();
      await second;
      expect(activeAccounts).toEqual(new Set());
    } finally {
      releaseFirstGrant?.();
      releaseFirstCopy?.();
      releaseSecondCopy?.();
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

  it("removes staged bytes when the target-account ignore check rejects the handoff", async () => {
    const { root, localWorkspace, stagingRoot, targetWorkspace } = await fixture();
    await writeFile(join(targetWorkspace, ".gitignore"), "");
    const transport = new LocalJsonlHandoffTransport({
      stagingRoot,
      workspaceFor: (account: AccountId) => account === "claudiothe" ? localWorkspace : targetWorkspace,
      passwords: { bot1: "target-password" },
      copyAsTarget: async () => { throw new Error("target ignore check rejected the handoff"); },
      grantTargetAccess: async (_account, paths, onSharedDirectoryGranted) => { paths.sharedDirectories.forEach(onSharedDirectoryGranted); },
      revokeTargetAccess: async () => undefined,
    });

    try {
      await expect(transport.copyJsonl({ sourceAccountId: "bot7", sourceThreadId: "source-thread", targetAccountId: "bot1", targetWorkspace, jsonl: Buffer.from("{}\n") })).rejects.toThrow("LOCAL_HANDOFF_COPY_FAILED");
      await expect(readdir(stagingRoot)).resolves.toEqual([]);
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
