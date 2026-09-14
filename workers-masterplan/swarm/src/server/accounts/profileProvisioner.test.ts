import { describe, expect, it, vi } from "vitest";

import type { BotProfileAccountId, CodexAccountSlot, MacosBotId } from "../../shared/contracts.js";
import { ProfileProvisioner } from "./profileProvisioner.js";

function fixture() {
  const slots: CodexAccountSlot[] = [{
    id: "bot1/acc1", macosUser: "bot1", accountNumber: 1,
    codexHome: "/Users/bot1/.codex", workspaceRoot: "/Users/bot1/Dev/EdenMind",
  }];
  const registry = {
    nextId: (bot: MacosBotId) => {
      const used = new Set(slots.filter((slot) => slot.macosUser === bot).map((slot) => slot.accountNumber));
      let number = 2;
      while (used.has(number)) number += 1;
      return `${bot}/acc${number}` as BotProfileAccountId;
    },
    resolve: (id: BotProfileAccountId) => slots.find((slot) => slot.id === id),
    publish: vi.fn(async (slot: CodexAccountSlot) => { slots.push(slot); }),
  };
  const runWorker = vi.fn(async () => undefined);
  const cleanupEmptyOwned = vi.fn(async () => undefined);
  const provisioner = new ProfileProvisioner({ registry, repositoryUrl: "https://example.test/EdenMind.git", passwordFor: () => "password", runWorker, cleanupEmptyOwned });
  return { slots, registry, runWorker, cleanupEmptyOwned, provisioner };
}

describe("ProfileProvisioner", () => {
  it("serializes concurrent creates and publishes isolated slots only after worker setup", async () => {
    const { provisioner, registry, runWorker } = fixture();

    const [first, second] = await Promise.all([provisioner.create("bot1"), provisioner.create("bot1")]);

    expect([first.id, second.id]).toEqual(["bot1/acc2", "bot1/acc3"]);
    expect(registry.publish).toHaveBeenCalledTimes(2);
    expect(runWorker).toHaveBeenNthCalledWith(1, "bot1", "password", {
      codexHome: "/Users/bot1/.swarm/codex-profiles/acc2",
      workspaceRoot: "/Users/bot1/Dev/EdenMind-acc2",
      repositoryUrl: "https://example.test/EdenMind.git",
    });
  });

  it("does not publish a failed setup, cleans only its owned paths, and repairs an existing slot", async () => {
    const { provisioner, registry, runWorker, cleanupEmptyOwned } = fixture();
    runWorker.mockRejectedValueOnce(new Error("setup failed"));

    await expect(provisioner.create("bot1")).rejects.toMatchObject({ code: "PROFILE_SETUP_FAILED" });
    expect(registry.publish).not.toHaveBeenCalled();
    expect(cleanupEmptyOwned).toHaveBeenCalledWith("bot1", ["/Users/bot1/.swarm/codex-profiles/acc2", "/Users/bot1/Dev/EdenMind-acc2"]);

    const managedSlot: CodexAccountSlot = { id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, codexHome: "/Users/bot1/.swarm/codex-profiles/acc2", workspaceRoot: "/Users/bot1/Dev/EdenMind-acc2" };
    registry.resolve = (id: BotProfileAccountId) => id === managedSlot.id ? managedSlot : undefined;
    const repaired = await provisioner.repair("bot1/acc2");
    expect(repaired.id).toBe("bot1/acc2");
    expect(registry.publish).not.toHaveBeenCalled();
  });
});
