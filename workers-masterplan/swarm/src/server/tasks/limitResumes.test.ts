import { describe, expect, it } from "vitest";

import { LimitResumeManifest } from "./limitResumes.js";

describe("LimitResumeManifest", () => {
  it("durably marks and claims an unassigned chat for one automatic resume", async () => {
    const manifest = new LimitResumeManifest([]);

    await manifest.markWaiting("bot6", "unnamed-thread", 10);
    const first = await manifest.claimResume("bot6", "unnamed-thread", "resume-1", 20);
    const second = await manifest.claimResume("bot6", "unnamed-thread", "resume-2", 20);

    expect(first).toMatchObject({ accountId: "bot6", threadId: "unnamed-thread", state: "resuming", resumeClientUserMessageId: "resume-1" });
    expect(second).toBeUndefined();
  });

  it("tombstones the source wait when a chat is transferred so stale history cannot recreate it", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "old-thread", 10);

    expect(await manifest.claimTransfer("bot6", "old-thread", 20)).toBe("waiting_for_limit");
    await manifest.completeTransfer("bot6", "old-thread");

    expect(manifest.forThread("bot6", "old-thread")?.state).toBe("transferred");
    expect(manifest.waitingForAccount("bot6")).toEqual([]);

    await manifest.markWaiting("bot6", "old-thread", 30);
    expect(manifest.forThread("bot6", "old-thread")?.state).toBe("transferred");
  });

  it("does not let a repeated exhausted event steal an in-flight resume claim", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "thread-1", 10);
    await manifest.claimResume("bot6", "thread-1", "resume-1", 20);

    await manifest.markWaiting("bot6", "thread-1", 30);

    expect(manifest.forThread("bot6", "thread-1")).toMatchObject({ state: "resuming", resumeClientUserMessageId: "resume-1" });
  });

  it("tombstones a successful transfer even when the durable wait arrived late", async () => {
    const manifest = new LimitResumeManifest([]);

    await manifest.markTransferred("bot6", "late-thread", 20);
    await manifest.markWaiting("bot6", "late-thread", 30);

    expect(manifest.forThread("bot6", "late-thread")?.state).toBe("transferred");
    expect(manifest.waitingForAccount("bot6")).toEqual([]);
  });

  it("restores a failed resume or transfer to the durable waiting state", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "thread-1", 10);
    await manifest.claimResume("bot6", "thread-1", "resume-1", 20);
    await manifest.restoreWaitingFromResume("bot6", "thread-1", "resume-1", 30);
    const prior = await manifest.claimTransfer("bot6", "thread-1", 40);
    await manifest.restoreTransfer("bot6", "thread-1", prior!, 50);

    expect(manifest.forThread("bot6", "thread-1")?.state).toBe("waiting_for_limit");
  });

  it("queues user messages during a limit wait and preserves them across repeated exhausted events", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "thread-1", 10);

    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-1", text: "Check the failed migration first.", queuedAt: 20, settings: { model: "gpt-5.6-terra", effort: "xhigh", permissionMode: "full_access" } });
    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-2", text: "Then run the integration suite.", queuedAt: 30 });
    await manifest.markWaiting("bot6", "thread-1", 40);

    expect(manifest.forThread("bot6", "thread-1")?.pendingMessages).toEqual([
      { id: "queued-1", text: "Check the failed migration first.", queuedAt: 20, settings: { model: "gpt-5.6-terra", effort: "xhigh", permissionMode: "full_access" } },
      { id: "queued-2", text: "Then run the integration suite.", queuedAt: 30 },
    ]);
    expect(manifest.publicList()).toEqual([{ accountId: "bot6", threadId: "thread-1", state: "waiting_for_limit", updatedAt: 40, queuedMessageCount: 2 }]);
  });

  it("builds one ordered resume message from everything the user queued", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "thread-1", 10);
    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-1", text: "First queued instruction.", queuedAt: 20 });
    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-2", text: "Latest queued instruction.", queuedAt: 30, settings: { serviceTier: "priority" } });

    const claimed = await manifest.claimResume("bot6", "thread-1", "resume-1", 40);

    expect(manifest.resumeTurnInput(claimed!)).toEqual({
      text: "Continue from where you stopped after the usage limit reset.\n\nMessages sent by the user while this chat was waiting:\n\n1. First queued instruction.\n\n2. Latest queued instruction.",
      settings: { serviceTier: "priority" },
    });
  });

  it("keeps messages that arrive while a resume is being accepted for a later retry", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "thread-1", 10);
    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-1", text: "First batch.", queuedAt: 20 });
    const claimed = await manifest.claimResume("bot6", "thread-1", "resume-1", 30);

    expect(await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-2", text: "Arrived during resume.", queuedAt: 40 })).toBe(true);
    expect(manifest.resumeTurnInput(claimed!).text).toContain("First batch.");
    expect(manifest.resumeTurnInput(claimed!).text).not.toContain("Arrived during resume.");

    expect(await manifest.completeAcceptedResume("bot6", "thread-1", "resume-1", 50)).toBe(true);
    expect(manifest.forThread("bot6", "thread-1")).toMatchObject({
      state: "waiting_for_limit",
      pendingMessages: [{ id: "queued-2", text: "Arrived during resume.", queuedAt: 40 }],
    });
  });

  it("restores an unaccepted in-flight batch ahead of newer pending messages", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "thread-1", 10);
    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-1", text: "First batch.", queuedAt: 20 });
    await manifest.claimResume("bot6", "thread-1", "resume-1", 30);
    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-2", text: "Second batch.", queuedAt: 40 });

    await manifest.restoreWaitingFromResume("bot6", "thread-1", "resume-1", 50);

    expect(manifest.forThread("bot6", "thread-1")?.pendingMessages?.map((message) => message.id)).toEqual(["queued-1", "queued-2"]);
  });

  it("recovers an orphaned persisted resume without losing either message batch", async () => {
    const manifest = new LimitResumeManifest([{
      accountId: "bot6", threadId: "thread-1", state: "resuming", updatedAt: 30,
      inFlightMessages: [{ id: "queued-1", text: "Accepted batch was never identified.", queuedAt: 20 }],
      pendingMessages: [{ id: "queued-2", text: "Newer pending message.", queuedAt: 25 }],
    }]);

    await manifest.recoverOrphanedResume("bot6", "thread-1", 40);

    expect(manifest.forThread("bot6", "thread-1")).toMatchObject({ state: "waiting_for_limit" });
    expect(manifest.forThread("bot6", "thread-1")?.pendingMessages?.map((message) => message.id)).toEqual(["queued-1", "queued-2"]);
  });

  it("keeps queued text available to a transfer and rejects new queue writes while transfer is in flight", async () => {
    const manifest = new LimitResumeManifest([]);
    await manifest.markWaiting("bot6", "thread-1", 10);
    await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-1", text: "Use the corrected schema.", queuedAt: 20 });
    const source = manifest.forThread("bot6", "thread-1")!;

    await manifest.claimTransfer("bot6", "thread-1", 30);

    expect(manifest.queuedMessagesText(source)).toContain("Use the corrected schema.");
    expect(await manifest.enqueueMessage("bot6", "thread-1", { id: "queued-2", text: "Too late.", queuedAt: 40 })).toBe(false);
  });
});
