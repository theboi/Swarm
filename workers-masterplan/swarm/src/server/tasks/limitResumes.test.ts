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
});
