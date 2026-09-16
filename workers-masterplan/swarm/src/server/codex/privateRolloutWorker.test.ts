import { describe, expect, it } from "vitest";

import { validatePrivateRolloutInput } from "./privateRolloutWorker.js";

describe("private rollout worker", () => {
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
