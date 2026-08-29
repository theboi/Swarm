import { describe, expect, it } from "vitest";

import { WorkerAssignmentManifest } from "./workerAssignments.js";

describe("WorkerAssignmentManifest", () => {
  it("persists assignment, transfer, limit wait, and completion without losing history", async () => {
    const writes: unknown[] = [];
    const manifest = new WorkerAssignmentManifest([], async (records) => { writes.push(records); });

    await manifest.assign("A1", "bot6", "old-thread", 10);
    await manifest.markWaitingForLimit("bot6", "old-thread", 20);
    await manifest.transfer("bot6", "old-thread", "bot8", "new-thread", 30);
    await manifest.complete("bot8", "new-thread", 40);

    expect(manifest.forTask("A1")).toEqual({
      taskId: "A1", accountId: "bot8", threadId: "new-thread", state: "completed",
      assignedAt: 10, updatedAt: 40,
      transferHistory: [{ fromAccountId: "bot6", fromThreadId: "old-thread", toAccountId: "bot8", toThreadId: "new-thread", transferredAt: 30 }],
    });
    expect(writes).toHaveLength(4);
  });

  it("only marks the current assigned thread as waiting or complete", async () => {
    const manifest = new WorkerAssignmentManifest([]);
    await manifest.assign("F0", "bot3", "thread-1", 10);

    await expect(manifest.markWaitingForLimit("bot4", "thread-1", 20)).resolves.toBeUndefined();
    await expect(manifest.complete("bot3", "other-thread", 20)).resolves.toBeUndefined();
    expect(manifest.forTask("F0")?.state).toBe("assigned");
  });

  it("recovers only the selected account's durable limit-wait assignments", async () => {
    const manifest = new WorkerAssignmentManifest([]);
    await manifest.assign("CD", "bot8", "cd-thread", 10);
    await manifest.markWaitingForLimit("bot8", "cd-thread", 20);
    await manifest.assign("QD", "bot7", "qd-thread", 30);
    await manifest.markWaitingForLimit("bot7", "qd-thread", 40);

    expect(manifest.waitingForAccount("bot8")).toEqual([expect.objectContaining({ taskId: "CD", threadId: "cd-thread" })]);
  });

  it("moves a finished but unproven worker to attention instead of completion", async () => {
    const manifest = new WorkerAssignmentManifest([]);
    await manifest.assign("QD", "bot7", "qd-thread", 10);

    await manifest.markAttentionRequired("bot7", "qd-thread", 20);

    expect(manifest.forTask("QD")?.state).toBe("attention_required");
  });

  it("allows only one durable resume claim for a waiting thread", async () => {
    const manifest = new WorkerAssignmentManifest([]);
    await manifest.assign("CD", "bot8", "cd-thread", 10);
    await manifest.markWaitingForLimit("bot8", "cd-thread", 20);

    const [first, second] = await Promise.all([
      manifest.claimResume("bot8", "cd-thread", "resume-1", 30),
      manifest.claimResume("bot8", "cd-thread", "resume-2", 30),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(manifest.forTask("CD")).toMatchObject({ state: "resuming", resumeClientUserMessageId: expect.stringMatching(/^resume-/) });
  });

  it("blocks resume while a waiting worker is durably claimed for transfer", async () => {
    const manifest = new WorkerAssignmentManifest([]);
    await manifest.assign("CD", "bot8", "cd-thread", 10);
    await manifest.markWaitingForLimit("bot8", "cd-thread", 20);

    const prior = await manifest.claimTransfer("bot8", "cd-thread", 30);

    expect(prior).toBe("waiting_for_limit");
    expect(await manifest.claimResume("bot8", "cd-thread", "resume", 40)).toBeUndefined();
    await manifest.restoreTransfer("bot8", "cd-thread", prior!, 50);
    expect(manifest.forTask("CD")?.state).toBe("waiting_for_limit");
  });
});
