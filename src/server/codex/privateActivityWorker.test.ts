import { describe, expect, it, vi } from "vitest";
import { readPrivateActivities } from "./privateActivityWorker.js";

const threadId = "01a07477-448b-7183-bc17-8629955fdba5";
const input = { codexHome: "/Users/bot3/.swarm/codex-profiles/acc1", threadIds: [threadId] };

describe("private activity worker", () => {
  it("reads activity as the owning bot and preserves the active turn identifier", async () => {
    const read = vi.fn(async () => ({ activity: "active" as const, turnId: "turn-live" }));
    await expect(readPrivateActivities(input, "bot3", read)).resolves.toEqual({ [threadId]: { activity: "active", turnId: "turn-live" } });
    expect(read).toHaveBeenCalledWith(input.codexHome, threadId);
  });
  it("rejects another bot's home before reading", async () => {
    const read = vi.fn();
    await expect(readPrivateActivities(input, "bot1", read)).rejects.toThrow("Invalid private rollout request");
    expect(read).not.toHaveBeenCalled();
  });
  it("keeps other activity results when a rollout is missing", async () => {
    await expect(readPrivateActivities(input, "bot3", async () => { throw new Error("missing"); })).resolves.toEqual({});
  });
});
