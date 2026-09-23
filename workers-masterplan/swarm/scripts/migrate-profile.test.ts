import { describe, expect, it, vi } from "vitest";

import { createProcessDetectors, parseMigrationArguments, runMigrationCommand } from "./migrate-profile.js";

describe("migrate-profile CLI", () => {
  it("requires exactly one bot and defaults to a non-mutating dry run", () => {
    expect(parseMigrationArguments(["--bot", "bot1"])).toEqual({ bot: "bot1", mode: "dry-run", allBots: false });
    expect(parseMigrationArguments(["--bot", "bot2", "--all", "--apply"])).toEqual({ bot: "bot2", mode: "apply", allBots: true });
    expect(() => parseMigrationArguments([])).toThrow("exactly one --bot");
    expect(() => parseMigrationArguments(["--bot", "bot1", "--bot", "bot2"])).toThrow("exactly one --bot");
    expect(() => parseMigrationArguments(["--bot", "all"])).toThrow("bot1 through bot8");
  });

  it("requires an explicit all-bot override for a non-bot1 live request", async () => {
    const migrate = vi.fn();

    await expect(runMigrationCommand({ bot: "bot2", mode: "apply", allBots: false }, { migrator: { migrate } })).rejects.toThrow(/only bot1/i);
    expect(migrate).not.toHaveBeenCalled();
    migrate.mockResolvedValueOnce({ accountId: "bot2/acc1", migrated: true, source: "/Users/bot2/.codex", destination: "/Users/bot2/.swarm/codex-profiles/acc1" });
    await expect(runMigrationCommand({ bot: "bot2", mode: "apply", allBots: true }, { migrator: { migrate } })).resolves.toMatchObject({ accountId: "bot2/acc1", migrated: true });
  });

  it("scopes the Desktop running check to the migration bot", async () => {
    const checks: string[][] = [];
    const detectors = createProcessDetectors(async (arguments_) => { checks.push(arguments_); return true; });

    await expect(detectors.desktopRunning("bot1")).resolves.toBe(true);
    expect(checks).toEqual([["-u", "bot1", "-f", "ChatGPT.app"]]);
  });
});
