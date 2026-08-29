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
  it("keeps a completed handoff terminal when its cited integrated commit precedes the status commit", async () => {
    const laterHead = new Map(remote);
    laterHead.set("docs/workers/bp-1/P1.md", "| State | review |\n| Worker planning state | complete handoff integrated |\n| Latest integrated `origin/main` commit proved for this status | `abc123` |");
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "def456", readRemote: async (path) => laterHead.get(path), isAncestor: async (commit, head) => commit === "abc123" && head === "def456" });

    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "P1")?.state).toBe("complete");
  });

  it("keeps an amended integrated handoff terminal for every downstream dependency", async () => {
    const amendedManifest: TaskManifest = {
      ...manifest,
      tasks: [
        manifest.tasks[0]!,
        { id: "P2", title: "Downstream", kind: "planning", dependsOn: ["P1"], promptTemplate: "planning", statusPath: "docs/workers/bp-1/P2.md", specificationPath: "docs/p2-spec.md", implementationPlanPath: "docs/p2-plan.md" },
      ],
    };
    const records = new Map(remote);
    records.set("docs/workers/bp-1/P1.md", "| State | review |\n| Worker planning state | amended handoff integrated; coordinator receipt review pending |\n| Latest integrated `origin/main` commit proved for this status | `abc123` |");
    records.set("docs/workers/bp-1/P2.md", "| State | not started |\n| Latest integrated `origin/main` commit | `def456` |");
    records.set("docs/p2-spec.md", "# Spec\n");
    records.set("docs/p2-plan.md", "# Plan\n");
    const evidence = await loadBlueprintEvidence(amendedManifest, { fetch: async () => undefined, revParse: async () => "def456", readRemote: async (path) => records.get(path), isAncestor: async (commit, head) => commit === "abc123" && head === "def456" });
    const readiness = evaluateTaskReadiness(amendedManifest, evidence);

    expect(readiness.find((item) => item.taskId === "P1")?.state).toBe("complete");
    expect(readiness.find((item) => item.taskId === "P2")?.state).toBe("ready");
    expect(readiness.find((item) => item.taskId === "P2")?.blockingCodes).toEqual([]);
  });

  it("treats a worker-authored integrated planning handoff as complete for downstream planning", async () => {
    const planningManifest: TaskManifest = {
      ...manifest,
      tasks: [
        manifest.tasks[0]!,
        { id: "P2", title: "Downstream planning", kind: "planning", dependsOn: ["P1"], promptTemplate: "planning", statusPath: "docs/workers/bp-1/P2.md", specificationPath: "docs/p2-spec.md", implementationPlanPath: "docs/p2-plan.md" },
      ],
    };
    const records = new Map(remote);
    records.set("docs/workers/bp-1/P1.md", "| State | review; worker-authored planning handoff integrated, coordinator/product-owner approval pending |\n| Latest proven integration head before this status edit | `abc123` |");
    records.set("docs/workers/bp-1/P2.md", "| State | planning-blocked |\n| Latest integrated `origin/main` commit | `def456` |");
    const evidence = await loadBlueprintEvidence(planningManifest, { fetch: async () => undefined, revParse: async () => "def456", readRemote: async (path) => records.get(path), isAncestor: async (commit, head) => commit === "abc123" && head === "def456" });
    const readiness = evaluateTaskReadiness(planningManifest, evidence);

    expect(readiness.find((item) => item.taskId === "P1")?.state).toBe("complete");
    expect(readiness.find((item) => item.taskId === "P2")?.state).toBe("ready");
  });

  it("accepts a completed handoff whose remote proof is labelled as final-status reconciliation", async () => {
    const records = new Map(remote);
    records.set("docs/workers/bp-1/P1.md", "| State | review |\n| Worker planning state | complete handoff integrated; coordinator receipt review pending |\n| Latest `origin/main` reconciled during final status | `abc123` |");
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "def456", readRemote: async (path) => records.get(path), isAncestor: async (commit, head) => commit === "abc123" && head === "def456" });

    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "P1")?.state).toBe("complete");
  });

  it("keeps missing planning outputs visible without blocking a dependency-ready planning assignment", async () => {
    const planningManifest: TaskManifest = {
      ...manifest,
      tasks: [
        manifest.tasks[0]!,
        { id: "P2", title: "Next planning assignment", kind: "planning", dependsOn: ["P1"], promptTemplate: "planning", statusPath: "docs/workers/bp-1/P2.md", specificationPath: "docs/p2-spec.md", implementationPlanPath: "docs/p2-plan.md" },
      ],
    };
    const records = new Map(remote);
    records.set("docs/workers/bp-1/P2.md", "| State | planning-blocked |\n| Planning artifacts | absent |");
    const evidence = await loadBlueprintEvidence(planningManifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => records.get(path) });

    const readiness = evaluateTaskReadiness(planningManifest, evidence).find((item) => item.taskId === "P2");

    expect(readiness?.state).toBe("ready");
    expect(readiness?.evidence.find((item) => item.code === "PLANNING_ARTIFACTS")?.satisfied).toBe(false);
  });

  it("projects an unfinished planning review as attention-required instead of ready to relaunch", async () => {
    const reviewManifest: TaskManifest = {
      ...manifest,
      tasks: [{ ...manifest.tasks[0]!, dependsOn: [] }],
    };
    const records = new Map(remote);
    records.set("docs/workers/bp-1/P1.md", "| State | review |\n| Worker planning state | specification integrated; implementation plan pending |\n| Latest integrated `origin/main` commit | `abc123` |");
    records.delete("docs/plan.md");
    const evidence = await loadBlueprintEvidence(reviewManifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => records.get(path) });

    expect(evaluateTaskReadiness(reviewManifest, evidence).find((item) => item.taskId === "P1")?.state).toBe("attention_required");
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
