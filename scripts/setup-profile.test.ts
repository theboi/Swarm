import { describe, expect, it, vi } from "vitest";

import { parseSetupArguments, runSetupCommand } from "./setup-profile.js";

describe("setup-profile CLI", () => {
  it("accepts one logical profile ID and has no login mode", () => {
    expect(parseSetupArguments(["--account", "bot1/acc2"])).toEqual({ accountId: "bot1/acc2" });
    expect(() => parseSetupArguments(["--account", "bot1/acc2", "--login"])).toThrow("Unsupported setup argument");
    expect(() => parseSetupArguments(["--account", "bot1"])).toThrow("logical profile ID");
  });

  it("repairs the requested slot and prints a profile-aware manual login command without launching login", async () => {
    const repair = vi.fn(async () => ({ id: "bot1/acc2" as const, macosUser: "bot1" as const, accountNumber: 2, codexHome: "/Users/bot1/.swarm/codex-profiles/acc2", workspaceRoot: "/Users/bot1/Dev/EdenMind" }));

    await expect(runSetupCommand({ accountId: "bot1/acc2" }, { repair, codexBin: "/opt/homebrew/bin/codex" })).resolves.toEqual(expect.objectContaining({
      accountId: "bot1/acc2",
      manualLoginCommand: expect.stringContaining("CODEX_HOME"),
    }));
    expect(repair).toHaveBeenCalledWith("bot1/acc2");
  });
});
