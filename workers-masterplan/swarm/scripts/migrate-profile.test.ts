import { describe, expect, it, vi } from "vitest";

import { parseMigrationArguments, runMigrationCommand } from "./migrate-profile.js";

describe("migrate-profile CLI", () => {
  it("requires exactly one bot and defaults to a non-mutating dry run", () => {
    expect(parseMigrationArguments(["--bot", "bot1"])).toEqual({ bot: "bot1", mode: "dry-run" });
    expect(() => parseMigrationArguments([])).toThrow("exactly one --bot");
    expect(() => parseMigrationArguments(["--bot", "bot1", "--bot", "bot2"])).toThrow("exactly one --bot");
    expect(() => parseMigrationArguments(["--bot", "all"])).toThrow("bot1 through bot8");
  });

  it("hard-rejects a non-bot1 live request before the migrator is called", async () => {
    const migrate = vi.fn();

    await expect(runMigrationCommand({ bot: "bot2", mode: "apply" }, { migrator: { migrate } })).rejects.toThrow(/only bot1/i);
    expect(migrate).not.toHaveBeenCalled();
  });
});
