import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import { readProfileWorkerInput } from "./profileProvisionerWorker.js";

describe("profile provisioner worker input", () => {
  it("accepts one JSON line without waiting for the PTY to close", async () => {
    const input = new PassThrough();
    const parsed = readProfileWorkerInput(input);

    input.write(`${JSON.stringify({
      codexHome: "/Users/bot3/.swarm/codex-profiles/acc2",
      workspaceRoot: "/Users/bot3/Dev/EdenMind-acc2",
      repositoryUrl: "https://example.test/EdenMind.git",
    })}\n`);

    await expect(parsed).resolves.toEqual({
      codexHome: "/Users/bot3/.swarm/codex-profiles/acc2",
      workspaceRoot: "/Users/bot3/Dev/EdenMind-acc2",
      repositoryUrl: "https://example.test/EdenMind.git",
    });
  });
});
