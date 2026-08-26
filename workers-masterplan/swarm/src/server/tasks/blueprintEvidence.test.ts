import { describe, expect, it } from "vitest";
import type { TaskManifest } from "../../shared/contracts.js";
import { evaluateTaskReadiness, loadBlueprintEvidence } from "./blueprintEvidence.js";

const manifest: TaskManifest = { blueprintId: "bp-1", title: "Blueprint", masterplanPath: "docs/blueprint.md", coordinationRoot: "docs/workers/bp-1", tasks: [
  { id: "P1", title: "Planning", kind: "planning", dependsOn: [], promptTemplate: "planning", statusPath: "docs/workers/bp-1/P1.md", specificationPath: "docs/spec.md", implementationPlanPath: "docs/plan.md" },
  { id: "G1", title: "Gate", kind: "gate", dependsOn: ["P1"], promptTemplate: "planning", statusPath: "docs/workers/bp-1/G1.md" },
  { id: "E1", title: "Execution", kind: "execution", dependsOn: ["G1"], promptTemplate: "execution", statusPath: "docs/workers/bp-1/E1.md" },
] };
const remote = new Map<string, string>([
  ["docs/blueprint.md", "| Blueprint ID | `bp-1` |\n| Integration authority | `origin/main` |"],
  ["docs/workers/bp-1/P1.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |"],
  ["docs/spec.md", "# Approved specification\n"], ["docs/plan.md", "# Approved plan\n"],
  ["docs/workers/bp-1/G1.md", "| Gate state | passed |\n| Authorized `origin/main` commit | `abc123` |\n| P1 | docs/spec.md abc123 | docs/plan.md abc123 | approved | authority-sync abc123 | reconciled |"],
]);

describe("blueprint evidence", () => {
  it("fetches then pins the actual origin/main SHA and requires all planning evidence", async () => {
    const calls: string[] = [];
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => { calls.push("fetch"); }, revParse: async () => "abc123", readRemote: async (path, sha) => { expect(sha).toBe("abc123"); return remote.get(path); } });
    expect(calls).toEqual(["fetch"]);
    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "E1")?.state).toBe("ready");
  });
  it("blocks when a status or gate cites a non-pinned SHA, or planning artifacts are missing", async () => {
    const stale = new Map(remote); stale.set("docs/workers/bp-1/G1.md", "| Gate state | passed |\n| Authorized `origin/main` commit | `deadbeef` |");
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => stale.get(path) });
    const readiness = evaluateTaskReadiness(manifest, evidence);
    expect(readiness.find((item) => item.taskId === "E1")?.blockingCodes).toContain("REMOTE_EVIDENCE_MISMATCH");
    const incomplete = new Map(remote); incomplete.delete("docs/plan.md");
    const second = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => incomplete.get(path) });
    expect(evaluateTaskReadiness(manifest, second).find((item) => item.taskId === "G1")?.state).toBe("blocked");
  });

  it("requires the gate receipt to cover every planning worker, not only direct gate dependencies", async () => {
    const expanded: TaskManifest = {
      ...manifest,
      tasks: [
        ...manifest.tasks,
        { id: "P2", title: "Unlisted planning", kind: "planning", dependsOn: [], promptTemplate: "planning", statusPath: "docs/workers/bp-1/P2.md", specificationPath: "docs/p2-spec.md", implementationPlanPath: "docs/p2-plan.md" },
      ],
    };
    const evidence = await loadBlueprintEvidence(expanded, {
      fetch: async () => undefined,
      revParse: async () => "abc123",
      readRemote: async (path) => remote.get(path),
    });
    expect(evaluateTaskReadiness(expanded, evidence).find((item) => item.taskId === "E1")?.state).toBe("blocked");
  });

  it("requires authority-sync or a no-impact record for each completed planning worker", async () => {
    const receiptWithoutPerWorkerAuthority = new Map(remote);
    receiptWithoutPerWorkerAuthority.set("docs/workers/bp-1/G1.md", "| Gate state | passed |\n| Authorized `origin/main` commit | `abc123` |\n| P1 | docs/spec.md abc123 | docs/plan.md abc123 | approved |\n| unrelated | authority-sync abc123 |");
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => receiptWithoutPerWorkerAuthority.get(path) });
    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "E1")?.state).toBe("blocked");
  });

  it("matches an authority receipt row to the exact planning worker ID", async () => {
    const similarlyNamedWorker = new Map(remote);
    similarlyNamedWorker.set("docs/workers/bp-1/G1.md", "| Gate state | passed |\n| Authorized `origin/main` commit | `abc123` |\n| P10 | docs/spec.md abc123 | docs/plan.md abc123 | authority-sync abc123 |");
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => similarlyNamedWorker.get(path) });
    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "E1")?.state).toBe("blocked");
  });
});
