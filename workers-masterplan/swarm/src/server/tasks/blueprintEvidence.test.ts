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
  ["docs/workers/bp-1/G1.md", [
    "| Field | Value |",
    "| --- | --- |",
    "| Gate state | passed |",
    "| Authorized `origin/main` commit | `abc123` |",
    "",
    "| Worker | Manifest specification path | Manifest implementation plan path | Approval | Authority sync / no-impact | Cross-plan reconciliation | Remote commit |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| P1 | `docs/spec.md` | `docs/plan.md` | approved | authority-sync complete | reconciled | `abc123` |",
    "",
    "## Unresolved contradictions",
    "",
    "| Contradiction | Owner | Unblock criterion |",
    "| --- | --- | --- |",
  ].join("\n")],
]);

const twoPassManifest: TaskManifest = {
  blueprintId: "two-pass",
  title: "Two-pass UI planning",
  masterplanPath: "docs/two-pass-blueprint.md",
  coordinationRoot: "docs/workers/two-pass",
  tasks: [
    { id: "P2", title: "Layer 2 planning", kind: "planning", dependsOn: [], promptTemplate: "planning", statusPath: "docs/workers/two-pass/status/p2.md", specificationPath: "docs/p2-spec.md", implementationPlanPath: "docs/p2-plan.md" },
    { id: "PD", title: "Platform design", kind: "ui", dependsOn: ["P2"], promptTemplate: "ui", statusPath: "docs/workers/two-pass/status/pd.md", specificationPath: "docs/p2-spec.md", uiRequirementsPath: "docs/design/requirements/pd.md", uiHandoffPath: "docs/design/handoffs/pd.md" },
    { id: "P3", title: "Layer 3 live-wiring planning", kind: "planning", dependsOn: ["P2", "PD"], promptTemplate: "planning", statusPath: "docs/workers/two-pass/status/p3.md", specificationPath: "docs/p3-spec.md", implementationPlanPath: "docs/p3-plan.md" },
    { id: "PG", title: "Planning gate", kind: "gate", dependsOn: ["P3"], promptTemplate: "planning", statusPath: "docs/workers/two-pass/PLANNING_GATE.md" },
    { id: "P2X", title: "Layer 2 implementation", kind: "execution", dependsOn: [], promptTemplate: "execution", statusPath: "docs/workers/two-pass/status/p2x.md" },
    { id: "P3X", title: "Layer 3 live wiring", kind: "execution", dependsOn: ["PG", "P2X"], promptTemplate: "execution", statusPath: "docs/workers/two-pass/status/p3x.md" },
  ],
};

const planningOnlyManifest: TaskManifest = {
  ...twoPassManifest,
  tasks: twoPassManifest.tasks.filter((task) => task.id === "P2" || task.id === "PD"),
};

const acceptedPdHandoff = [
  "| Accepted app-state commit | `abc123` |",
  "| Product-owner approval | accepted |",
  "| Live review | complete |",
  "| Mutable ownership transfer | PD -> P3 |",
].join("\n");

function twoPassRecords(): Map<string, string> {
  return new Map([
    ["docs/two-pass-blueprint.md", "| Blueprint ID | `two-pass` |\n| Integration authority | `origin/main` |"],
    ["docs/workers/two-pass/status/p2.md", [
      "| Field | Value |",
      "| --- | --- |",
      "| State | planning-complete / execution-blocked |",
      "| Worker planning state | approved specification and implementation plan complete |",
      "| Authority synchronization | no-impact finding complete |",
      "| Latest integrated `origin/main` commit | `abc123` |",
    ].join("\n")],
    ["docs/p2-spec.md", "# P2 specification"],
    ["docs/p2-plan.md", "# P2 implementation plan"],
    ["docs/workers/two-pass/status/pd.md", "| State | planning in progress |\n| Latest integrated `origin/main` commit | `abc123` |"],
    ["docs/workers/two-pass/status/p3.md", "| State | planning blocked |\n| Latest integrated `origin/main` commit | `abc123` |"],
    ["docs/p3-spec.md", "# P3 specification"],
    ["docs/p3-plan.md", "# P3 implementation plan"],
    ["docs/workers/two-pass/status/p2x.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |"],
    ["docs/workers/two-pass/status/p3x.md", "| State | not ready |\n| Latest integrated `origin/main` commit | `abc123` |"],
    ["docs/workers/two-pass/PLANNING_GATE.md", [
      "| Field | Value |",
      "| --- | --- |",
      "| Gate state | passed |",
      "| Authorized `origin/main` commit | `abc123` |",
      "",
      "| Worker | Manifest specification path | Manifest implementation plan path | Approval | Authority sync / no-impact | Cross-plan reconciliation | Remote commit |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      "| P2 | `docs/p2-spec.md` | `docs/p2-plan.md` | approved | authority-sync complete | reconciled | `abc123` |",
      "| P3 | `docs/p3-spec.md` | `docs/p3-plan.md` | approved | no-impact complete | reconciled | `abc123` |",
    ].join("\n")],
  ]);
}

function planningOnlyRecords(): Map<string, string> {
  return new Map([
    ["docs/two-pass-blueprint.md", "| Blueprint ID | `two-pass` |\n| Integration authority | `origin/main` |"],
    ["docs/workers/two-pass/status/p2.md", [
      "| Field | Value |",
      "| --- | --- |",
      "| State | planning-complete / execution-blocked |",
      "| Worker planning state | approved specification and implementation plan complete |",
      "| Authority synchronization | no-impact finding complete |",
      "| Latest integrated `origin/main` commit | `abc123` |",
    ].join("\n")],
    ["docs/p2-spec.md", "# P2 specification"],
    ["docs/p2-plan.md", "# P2 implementation plan"],
    ["docs/workers/two-pass/status/pd.md", "| State | planning in progress |\n| Latest integrated `origin/main` commit | `abc123` |"],
  ]);
}

function completeGateReceipt(options: {
  gateState?: string;
  authorizedCommit?: string;
  p2Specification?: string;
  p2Plan?: string;
  p2Approval?: string;
  p2Authority?: string;
  p2Reconciliation?: string;
  p2RemoteCommit?: string;
  acceptedAppCommit?: string;
  uiApproval?: string;
  liveReview?: string;
  uiReconciliation?: string;
  transfer?: string;
  uiRemoteCommit?: string;
  extraRows?: string[];
} = {}): string {
  const {
    gateState = "passed",
    authorizedCommit = "abc123",
    p2Specification = "`docs/p2-spec.md`",
    p2Plan = "`docs/p2-plan.md`",
    p2Approval = "approved",
    p2Authority = "authority-sync complete",
    p2Reconciliation = "reconciled",
    p2RemoteCommit = "`abc123`",
    acceptedAppCommit = "`abc123`",
    uiApproval = "accepted by product owner",
    liveReview = "complete",
    uiReconciliation = "reconciled with P3",
    transfer = "PD -> P3",
    uiRemoteCommit = "`abc123`",
    extraRows = [],
  } = options;
  return [
    "| Field | Value |",
    "| --- | --- |",
    `| Gate state | ${gateState} |`,
    `| Authorized \`origin/main\` commit | ${authorizedCommit} |`,
    "",
    "| Worker | Manifest specification path | Manifest implementation plan path | Approval | Authority sync / no-impact | Cross-plan reconciliation | Remote commit |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    `| P2 | ${p2Specification} | ${p2Plan} | ${p2Approval} | ${p2Authority} | ${p2Reconciliation} | ${p2RemoteCommit} |`,
    "| P3 | `docs/p3-spec.md` | `docs/p3-plan.md` | approved | no-impact complete | reconciled | `abc123` |",
    "",
    "| Worker | Requirements path | Presentation handoff path | Accepted app commit | Approval | Live review | Requirements-to-plan reconciliation | Transfer target | Remote commit |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    `| PD | \`docs/design/requirements/pd.md\` | \`docs/design/handoffs/pd.md\` | ${acceptedAppCommit} | ${uiApproval} | ${liveReview} | ${uiReconciliation} | ${transfer} | ${uiRemoteCommit} |`,
    ...extraRows,
    "",
    "## Unresolved contradictions",
    "",
    "| Contradiction | Owner | Unblock criterion |",
    "| --- | --- | --- |",
  ].join("\n");
}

function completePass2Records(): Map<string, string> {
  const records = twoPassRecords();
  records.set("docs/workers/two-pass/status/pd.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
  records.set("docs/workers/two-pass/status/p3.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
  records.set("docs/design/handoffs/pd.md", acceptedPdHandoff);
  records.set("docs/design/requirements/pd.md", "# PD UI requirements");
  records.set("docs/workers/two-pass/PLANNING_GATE.md", completeGateReceipt());
  return records;
}

async function twoPassReadiness(records: Map<string, string>, remoteHead = "abc123") {
  const loaded = await loadBlueprintEvidence(twoPassManifest, {
    fetch: async () => undefined,
    revParse: async () => remoteHead,
    readRemote: async (path) => records.get(path),
    isAncestor: async (commit, head) => commit === "abc123" && head === remoteHead,
  });
  return evaluateTaskReadiness(twoPassManifest, loaded);
}

async function planningOnlyReadiness(records: Map<string, string>) {
  const loaded = await loadBlueprintEvidence(planningOnlyManifest, {
    fetch: async () => undefined,
    revParse: async () => "abc123",
    readRemote: async (path) => records.get(path),
    isAncestor: async (commit, head) => commit === "abc123" && head === "abc123",
  });
  return evaluateTaskReadiness(planningOnlyManifest, loaded);
}

describe("blueprint evidence", () => {
  it("starts UI planning from completed Layer 2 planning, without a Layer 2 implementation", async () => {
    const readiness = await planningOnlyReadiness(planningOnlyRecords());

    expect(readiness.find((item) => item.taskId === "PD")?.state).toBe("ready");
  });

  it("blocks a Layer 3 planner until its UI-design worker completes both UI artifacts", async () => {
    const readiness = await twoPassReadiness(twoPassRecords());

    expect(readiness.find((item) => item.taskId === "P3")?.state).toBe("blocked");
  });

  it("does not complete a UI worker when its separate UI requirements contract is absent", async () => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/pd.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
    records.set("docs/design/handoffs/pd.md", acceptedPdHandoff);
    const readiness = await twoPassReadiness(records);
    const pd = readiness.find((item) => item.taskId === "PD");

    expect(pd?.state).not.toBe("complete");
    expect(pd?.evidence.find((item) => item.code === "UI_ARTIFACTS")?.satisfied).toBe(false);
  });

  it("unblocks a Layer 3 planner after accepted UI requirements and handoff evidence", async () => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/pd.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
    records.set("docs/design/handoffs/pd.md", acceptedPdHandoff);
    records.set("docs/design/requirements/pd.md", "# PD UI requirements");
    const readiness = await twoPassReadiness(records);

    expect(readiness.find((item) => item.taskId === "P3")?.state).toBe("ready");
  });

  it("blocks Pass 2 live wiring when a passed receipt omits the UI row", async () => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/pd.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
    records.set("docs/workers/two-pass/status/p3.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
    records.set("docs/design/handoffs/pd.md", acceptedPdHandoff);
    records.set("docs/design/requirements/pd.md", "# PD UI requirements");
    const readiness = await twoPassReadiness(records);

    expect(readiness.find((item) => item.taskId === "P3X")?.state).toBe("blocked");
  });

  it("permits Pass 2 live wiring only after the full UI receipt row and runtime predecessor exist", async () => {
    const records = completePass2Records();
    const readiness = await twoPassReadiness(records);

    expect(readiness.find((item) => item.taskId === "P3X")?.state).toBe("ready");
  });

  it("blocks Pass 2 while the receipt records an unresolved contradiction", async () => {
    const records = completePass2Records();
    records.set("docs/workers/two-pass/PLANNING_GATE.md", `${completeGateReceipt()}\n| API payload remains undecided | P3 | pending |`);

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "P3X")?.state).toBe("blocked");
  });

  it("pins execution evidence to the gate's authorized commit rather than the later remote head", async () => {
    const readiness = await twoPassReadiness(completePass2Records(), "def456");
    const gateEvidence = readiness.find((item) => item.taskId === "P3X")?.evidence.find((item) => item.code === "PLANNING_GATE");

    expect(gateEvidence).toMatchObject({ satisfied: true, path: "docs/workers/two-pass/PLANNING_GATE.md", commit: "abc123" });
  });

  it("accepts the reusable gate-template header aliases", async () => {
    const records = completePass2Records();
    records.set("docs/workers/two-pass/PLANNING_GATE.md", [
      "| Field | Value |",
      "| --- | --- |",
      "| Gate state | passed |",
      "| Authorized `origin/main` commit | `abc123` |",
      "",
      "| Worker | Specification and commit | Implementation plan and commit | Approval | Living-authority synchronization | Cross-plan reconciliation |",
      "| --- | --- | --- | --- | --- | --- |",
      "| P2 | `docs/p2-spec.md` `abc123` | `docs/p2-plan.md` `abc123` | approved | no-impact complete | reconciled |",
      "| P3 | `docs/p3-spec.md` `abc123` | `docs/p3-plan.md` `abc123` | approved | authority-sync complete | reconciled |",
      "",
      "| UI worker | Accepted app commit | Approval evidence | Presentation handoff | UI requirements | Live review | Requirements-to-plan reconciliation | Mutable owner transfer | Remote commit |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| PD | `abc123` | approved by product owner | `docs/design/handoffs/pd.md` | `docs/design/requirements/pd.md` | fixture/mock complete | reconciled with P3 | PD -> P3 | `abc123` |",
      "",
      "## Unresolved contradictions",
      "",
      "| Contradiction | Owner | Unblock criterion |",
      "| --- | --- | --- |",
    ].join("\n"));

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "P3X")?.state).toBe("ready");
  });

  it("rejects a canonical UI receipt row while any required cell is pending", async () => {
    const records = completePass2Records();
    records.set("docs/workers/two-pass/PLANNING_GATE.md", completeGateReceipt({
      acceptedAppCommit: "pending",
      uiApproval: "pending",
      liveReview: "pending",
      uiReconciliation: "pending",
      transfer: "pending",
      uiRemoteCommit: "pending",
    }));

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "P3X")?.state).toBe("blocked");
  });

  it("requires each ordinary worker's specification and plan in that worker's own cells", async () => {
    const records = new Map(remote);
    records.set("docs/workers/bp-1/G1.md", [
      records.get("docs/workers/bp-1/G1.md")!.replace("| P1 | `docs/spec.md` | `docs/plan.md`", "| P1 | missing | missing"),
      "",
      "The P1 files exist elsewhere: `docs/spec.md` and `docs/plan.md`.",
    ].join("\n"));
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => records.get(path) });

    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "E1")?.state).toBe("blocked");
  });

  it.each([
    ["pending approval", "| approved |", "| pending |"],
    ["pending authority synchronization", "| authority-sync complete |", "| authority-sync pending |"],
    ["in-progress authority synchronization", "| authority-sync complete |", "| authority-sync in progress |"],
    ["negative reconciliation", "| reconciled |", "| not reconciled |"],
  ])("rejects an ordinary receipt row with %s", async (_name, before, after) => {
    const records = new Map(remote);
    records.set("docs/workers/bp-1/G1.md", records.get("docs/workers/bp-1/G1.md")!.replace(before, after));
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => records.get(path) });

    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "E1")?.state).toBe("blocked");
  });

  it.each([
    ["negative approval", { uiApproval: "product-owner approval: unapproved" }],
    ["false approval", { uiApproval: "product-owner approval: approved: false" }],
    ["incomplete live review", { liveReview: "live review incomplete" }],
    ["negative reconciliation", { uiReconciliation: "unreconciled" }],
    ["pending transfer", { transfer: "transfer pending" }],
    ["unexpected transfer target", { transfer: "BANANA" }],
    ["reconciliation for a different live-wiring planner", { uiReconciliation: "reconciled with P4" }],
    ["ambiguous ownership transfer", { transfer: "PD -> P3 and P4" }],
  ])("rejects a UI receipt row with %s", async (_name, mutation) => {
    const records = completePass2Records();
    records.set("docs/workers/two-pass/PLANNING_GATE.md", completeGateReceipt(mutation));

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "P3X")?.state).toBe("blocked");
  });

  it("rejects UI evidence placed in the wrong semantic cells", async () => {
    const records = completePass2Records();
    records.set("docs/workers/two-pass/PLANNING_GATE.md", completeGateReceipt({
      uiApproval: "approved; live review complete; reconciled; transfer P3",
      liveReview: "pending",
      uiReconciliation: "pending",
      transfer: "pending",
    }));

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "P3X")?.state).toBe("blocked");
  });

  it("rejects duplicate receipt rows for the same worker", async () => {
    const records = completePass2Records();
    records.set("docs/workers/two-pass/PLANNING_GATE.md", completeGateReceipt({
      extraRows: ["| PD | `docs/design/requirements/pd.md` | `docs/design/handoffs/pd.md` | pending | pending | pending | pending | pending | pending |"],
    }));

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "P3X")?.state).toBe("blocked");
  });

  it("requires the gate's accepted app commit to match the accepted handoff commit", async () => {
    const records = completePass2Records();
    records.set("docs/workers/two-pass/PLANNING_GATE.md", completeGateReceipt({
      authorizedCommit: "`def456`",
      p2RemoteCommit: "`def456`",
      acceptedAppCommit: "`def456`",
      uiRemoteCommit: "`def456`",
    }));

    expect((await twoPassReadiness(records, "def456")).find((item) => item.taskId === "P3X")?.state).toBe("blocked");
  });

  it("does not substitute a generic status commit for the accepted app-state commit", async () => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/pd.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
    records.set("docs/design/handoffs/pd.md", [
      "| Latest integrated `origin/main` commit | `abc123` |",
      "| Product-owner approval | accepted |",
    ].join("\n"));
    records.set("docs/design/requirements/pd.md", "# PD UI requirements");

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "PD")?.state).not.toBe("complete");
  });

  it.each(["not accepted", "unapproved"])('rejects UI completion with product-owner approval "%s"', async (approval) => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/pd.md", "| State | complete |\n| Latest integrated `origin/main` commit | `abc123` |");
    records.set("docs/design/handoffs/pd.md", acceptedPdHandoff.replace("accepted |", `${approval} |`));
    records.set("docs/design/requirements/pd.md", "# PD UI requirements");

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "PD")?.state).not.toBe("complete");
  });

  it("does not treat an incomplete worker state as terminal", async () => {
    const records = new Map(remote);
    records.set("docs/workers/bp-1/P1.md", "| State | incomplete |\n| Latest integrated `origin/main` commit | `abc123` |");
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => records.get(path) });

    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "P1")?.state).not.toBe("complete");
  });

  it("does not treat a not-passed gate state as passed", async () => {
    const records = new Map(remote);
    records.set("docs/workers/bp-1/G1.md", records.get("docs/workers/bp-1/G1.md")!.replace("| Gate state | passed |", "| Gate state | not passed |"));
    const evidence = await loadBlueprintEvidence(manifest, { fetch: async () => undefined, revParse: async () => "abc123", readRemote: async (path) => records.get(path) });

    expect(evaluateTaskReadiness(manifest, evidence).find((item) => item.taskId === "E1")?.state).toBe("blocked");
  });

  it("keeps UI planning blocked while Layer 2 planning approval is pending", async () => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/p2.md", [
      "| Field | Value |",
      "| --- | --- |",
      "| State | planning-complete / execution-blocked |",
      "| Planning approval | pending |",
      "| Authority synchronization | no-impact finding complete |",
      "| Latest integrated `origin/main` commit | `abc123` |",
    ].join("\n"));

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "PD")?.state).toBe("blocked");
  });

  it.each(["pending", "authority-sync in progress", "authority-sync TBD"])("keeps UI planning blocked without completed Layer 2 authority or no-impact evidence (%s)", async (authority) => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/p2.md", [
      "| Field | Value |",
      "| --- | --- |",
      "| State | planning-complete / execution-blocked |",
      "| Planning approval | approved |",
      `| Authority synchronization | ${authority} |`,
      "| Latest integrated `origin/main` commit | `abc123` |",
    ].join("\n"));

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "PD")?.state).toBe("blocked");
  });

  it.each([
    ["table status with unrelated receipt pending", [
      "| Field | Value |",
      "| --- | --- |",
      "| State | planning-complete / execution-blocked |",
      "| Worker planning state | approved specification and detailed implementation plan integrated; coordinator receipt pending |",
      "| Authority synchronization | no-impact finding complete; whole-blueprint gate pending |",
      "| Latest integrated `origin/main` commit | `abc123` |",
    ].join("\n")],
    ["paragraph status fields", [
      "State: planning-handoff-integrated",
      "remoteCommit: abc123",
      "Planning approval: approved",
      "Authority synchronization: no-impact complete",
    ].join("\n")],
  ])("accepts approved Layer 2 planning from %s", async (_name, status) => {
    const records = twoPassRecords();
    records.set("docs/workers/two-pass/status/p2.md", status);

    expect((await twoPassReadiness(records)).find((item) => item.taskId === "PD")?.state).toBe("ready");
  });

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
