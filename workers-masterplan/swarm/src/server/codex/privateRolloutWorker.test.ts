import { describe, expect, it } from "vitest";

import { encodePrivateRollout, validatePrivateRolloutInput } from "./privateRolloutWorker.js";
import { decodePrivateRollout } from "../tasks/threadHandoff.js";

describe("private rollout worker", () => {
  it("compresses a large rollout across the bot PTY and restores the exact JSONL", () => {
    const jsonl = '{"type":"event_msg","payload":{"text":"repeated text"}}\n'.repeat(100_000);
    const encoded = encodePrivateRollout(jsonl);
    expect(encoded.jsonlGzipBase64.length).toBeLessThan(jsonl.length / 10);
    expect(decodePrivateRollout(encoded)).toBe(jsonl);
  });
  it("accepts only the current bot's canonical profile and a UUID thread", () => {
    expect(validatePrivateRolloutInput({
      codexHome: "/Users/bot1/.swarm/codex-profiles/acc1",
      threadId: "01a07477-448b-7183-bc17-8629955fdba5",
    }, "bot1")).toEqual({
      codexHome: "/Users/bot1/.swarm/codex-profiles/acc1",
      threadId: "01a07477-448b-7183-bc17-8629955fdba5",
    });
  });

  it("rejects another bot's private profile", () => {
    expect(() => validatePrivateRolloutInput({
      codexHome: "/Users/bot2/.swarm/codex-profiles/acc1",
      threadId: "01a07477-448b-7183-bc17-8629955fdba5",
    }, "bot1")).toThrow("Invalid private rollout request");
  });
});
