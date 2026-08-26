import { describe, expect, it } from "vitest";

import { executionLaunchMetadata } from "./launchMetadata.js";

describe("execution launch metadata", () => {
  it("uses the planning-gate receipt and pinned commit rather than blank placeholders", () => {
    expect(executionLaunchMetadata({
      id: "I0",
      title: "Integrate",
      kind: "execution",
      dependsOn: ["G0", "U1"],
      promptTemplate: "execution",
      readiness: {
        taskId: "I0",
        state: "ready",
        phase: "execution",
        evidence: [{ code: "PLANNING_GATE", satisfied: true, path: "docs/workers/G0.md", commit: "abc123" }],
        blockingCodes: [],
      },
    })).toEqual({ planningGatePath: "docs/workers/G0.md", planningGateCommit: "abc123", hardPrerequisites: "G0, U1" });
  });
});
