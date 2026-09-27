import { describe, expect, it } from "vitest";

import { isDesktopApplicationCommand } from "./desktopProcessDetector.js";

describe("isDesktopApplicationCommand", () => {
  it("ignores Swarm app-server processes from the ChatGPT application bundle", () => {
    expect(
      isDesktopApplicationCommand(
        "/Applications/ChatGPT.app/Contents/Resources/codex app-server --analytics-default-enabled true",
      ),
    ).toBe(false);
    expect(
      isDesktopApplicationCommand(
        "/bin/zsh -lc CODEX_HOME=/Users/bot1/.swarm/codex-profiles/acc2 exec /Applications/ChatGPT.app/Contents/Resources/codex app-server",
      ),
    ).toBe(false);
  });

  it("recognizes the actual ChatGPT and Codex desktop executables", () => {
    expect(
      isDesktopApplicationCommand(
        "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
      ),
    ).toBe(true);
    expect(
      isDesktopApplicationCommand(
        "/Applications/Codex.app/Contents/MacOS/Codex --some-flag",
      ),
    ).toBe(true);
  });
});
