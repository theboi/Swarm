import { describe, expect, it } from "vitest";

import { createFixtureState } from "./fixtureData.js";

describe("E2E fixture data", () => {
  it("defaults to a deterministic eight-account blocked MVP3 state", () => {
    const state = createFixtureState();

    expect(state.snapshot.activeTurnLimit).toBe(3);
    expect(state.snapshot.accounts.map((account) => account.id)).toEqual(["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"]);
    expect(state.snapshot.tasks).toEqual([]);
    expect(state.snapshot.accounts.find((account) => account.id === "bot1")).toMatchObject({
      connection: "action_required",
      authentication: "unauthenticated",
      terminalCommand: "/usr/bin/su - bot1 -c '/opt/homebrew/bin/codex login'",
    });
  });

  it("provides a separate ready graph and exact normalized command output for browser acceptance", () => {
    const state = createFixtureState({ manifest: "ready" });
    const command = state.transcripts.get("bot3:thread-1")?.find((item) => item.type === "commandExecution");

    expect(state.snapshot.tasks.find((task) => task.id === "U1")).toMatchObject({ readiness: { state: "ready", suggestedAccount: "bot5" } });
    expect(command?.payload).toMatchObject({ command: "git status --short", aggregatedOutput: " M workers-masterplan/swarm/src/client/App.tsx\n" });
    expect(state.markdownFiles.get("bot3:docs/runbook.md")).toMatchObject({ filename: "runbook.md" });
  });
});
