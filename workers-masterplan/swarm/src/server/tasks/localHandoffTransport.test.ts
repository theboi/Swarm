import { copyFile, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { LocalJsonlHandoffTransport } from "./localHandoffTransport.js";

type CopyAsTarget = (input: { sourcePath: string; targetPath: string }) => Promise<void>;

async function fixture(copyAsTarget: CopyAsTarget = async ({ sourcePath, targetPath }) => copyFile(sourcePath, targetPath)) {
  const root = await mkdtemp(join(tmpdir(), "swarm-local-handoff-"));
  const stagingRoot = join(root, "coordinator", ".data", "handoffs");
  const targetWorkspace = join(root, "bot1", "Dev", "EdenMind");
  await mkdir(targetWorkspace, { recursive: true });
  const copy = vi.fn(copyAsTarget);
  const transport = new LocalJsonlHandoffTransport({
    stagingRoot,
    workspaceFor: () => targetWorkspace,
    passwords: { bot1: "target-password" },
    copyAsTarget: copy,
    grantTargetRead: async () => undefined,
  });
  return { root, stagingRoot, targetWorkspace, copyAsTarget: copy, transport };
}

describe("LocalJsonlHandoffTransport", () => {
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
