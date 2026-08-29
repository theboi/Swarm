# Two-Pass UI Planning and Live-Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Blueprint Masterplan and the MVP3 coordinator enforce whole-DAG planning first, fixture-backed UI design plus a UI requirements contract during Pass 1, and live wiring by the existing Layer 3 workers only during Pass 2.

**Architecture:** Keep the active MVP3 manifest as a 32-node Pass 1 projection: 26 ordinary planning tasks and six UI-design tasks. Add explicit UI requirements and presentation-handoff paths to UI task contracts, make readiness evidence role-aware, derive UI inputs for downstream launch packets, and use one coordinator-owned global planning receipt; do not add a dispatchable gate node or Pass 2 execution nodes until the receipt is passed. Synchronize the reusable Blueprint Masterplan contract and MVP3 authority before publishing coordinator state.

**Tech Stack:** Markdown skills and living authorities, TypeScript 5.8, Node.js, React 19, Vitest, Testing Library, Vite, Playwright, JSON task manifests, Git on direct `main`.

**Spec:** `workers-masterplan/docs/superpowers/specs/2026-08-29-two-pass-ui-design-requirements/2026-08-29-two-pass-ui-design-requirements-design.md`

## Global Constraints

- Pass 1 completes planning for the whole DAG before any ordinary product execution begins.
- A UI-design worker becomes ready from its upstream Layer 2 worker's approved specification, implementation plan, authority synchronization, and remote planning status; implemented Layer 2 code is not required.
- UI-design workers edit only real-app presentation surfaces with explicit fixture/mock-backed state. They perform no live API, authorization, persistence, migration, domain, scoring, model, or background-processing wiring.
- Every UI-design worker owns exactly three planning outputs: its status contract, its presentation handoff, and its separate UI requirements contract. It never writes an implementation plan.
- Existing IDs `P3`, `C3`, `Q3`, `A3`, `E3`, and `G3` remain the ordinary live-wiring owners. Do not create `PD2`, `CD2`, `QD2`, `AD2`, `ED2`, or `GD2`.
- A Layer 3 planner must consume both UI artifacts, map every requirement to a producer plan, and reconcile missing functionality before the whole-blueprint gate can pass.
- Pass 2 execution requires both the passed global receipt and the worker's implemented runtime prerequisites; planned-contract readiness never substitutes for implementation evidence.
- Keep the active Pass 1 manifest at 32 tasks. `PLANNING_GATE.md` is coordinator-owned evidence, not a dispatchable 33rd worker. Execution tasks are projected only after that receipt passes.
- The Business Masterplan and Product Specification Masterplan receive evidence-backed no-impact findings for this orchestration change. Do not edit either authority unless implementation uncovers an approved behavior change.
- Do not edit worker-owned files under `docs/workers/2026-08-14-mvp3/status/`; mark stale contracts only in coordinator-owned `STATUS.md`.
- Work directly on `main`; do not create a feature branch or linked worktree. Preserve unrelated changes and stage only files owned by the current task.
- Before each task, safely pull current `origin/main`. After each independently testable task, run the focused checks, commit directly to `main`, fetch and merge newer `origin/main` if needed, rerun affected checks, push, and prove the commit is reachable from `origin/main`.

## File and Interface Map

| Surface | Files | Responsibility |
| --- | --- | --- |
| Reusable lifecycle | `workers-masterplan/blueprint-masterplan/SKILL.md`; `workers-masterplan/blueprint-masterplan/references/*.md`; `workers-masterplan/evals/blueprint-masterplan-scenarios.md` | Define the two-pass rule, UI requirements artifact, global gate, status fields, worker briefs, and pressure-test behavior. |
| MVP3 authority | `docs/plans/EdenMind_MVP3_Implementation_Masterplan.md`; `workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md`; `workers-masterplan/swarm/README.md` | Replace rolling execution and implemented-predecessor UI readiness with the approved lifecycle. |
| Manifest schema | `workers-masterplan/swarm/src/shared/contracts.ts`; `workers-masterplan/swarm/src/shared/manifest.ts`; `workers-masterplan/swarm/src/server/tasks/manifestLoader.ts` | Represent and validate `uiRequirementsPath` and `uiHandoffPath`, including safe future output paths. |
| Readiness evidence | `workers-masterplan/swarm/src/server/tasks/blueprintEvidence.ts` | Evaluate planned dependencies, UI completion, full planning-gate receipts, and later execution readiness independently. |
| Launch packets | `workers-masterplan/swarm/src/server/tasks/promptTemplates.ts`; `workers-masterplan/swarm/src/server/tasks/launchMetadata.ts`; `workers-masterplan/swarm/src/server/index.ts`; `workers-masterplan/swarm/templates/*.md` | Render upstream planned artifacts and UI artifact destinations/inputs into role-correct prompts. |
| Production projection | `workers-masterplan/swarm/manifests/mvp3.json` | Reserve six requirements paths and six handoff paths while preserving the 32-node Pass 1 topology. |
| Coordinator UI | `workers-masterplan/swarm/src/client/pages/FlowchartPage.tsx` | Show each task's status, specification, plan, UI requirements, and handoff paths in the inspector. |
| Coordinator evidence | `docs/workers/2026-08-14-mvp3/PLANNING_GATE.md`; `docs/workers/2026-08-14-mvp3/STATUS.md`; `docs/workers/2026-08-14-mvp3/gates/README.md` | Publish the open global gate, current aggregate state, and legacy-receipt interpretation without taking worker ownership. |

---

### Task 1: Teach the Reusable Blueprint Contract the Two-Pass UI Lifecycle

**Files:**

- Create: `workers-masterplan/blueprint-masterplan/references/ui-requirements-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/planning-gate-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/worker-status-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/status-summary-template.md`
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**

- Consumes: the approved spec's Pass 1/Pass 2 lifecycle, canonical four-row UI source-read checklist, direct-main lifecycle, and three-artifact UI ownership contract.
- Produces: reusable terms `UI requirements contract`, `ui-design-ready`, `planning-complete / execution-blocked`, and a gate row that pairs each UI handoff with requirements reconciliation and a named live-wiring owner.

- [ ] **Step 1: Pull and record the RED baseline before editing the skill**

Run:

```bash
git status --short --branch
git pull --ff-only origin main
git rev-parse origin/main
```

Read `superpowers:test-driven-development` and `superpowers:writing-skills` completely. Launch one fresh-context evaluation against the current `blueprint-masterplan` skill with this prompt, withholding the rubric until after the response:

```text
Use $blueprint-masterplan for a six-path product. Every Layer 2 worker has an approved specification and implementation plan on origin/main, but none has implemented code. Product leadership wants all planning completed before execution. Create one UI-design worker per path now, let each design the real app with fixtures, and have the existing Layer 3 worker wire it later. The UI must tell downstream planners every API, capability, state, and command it needs. The CTO also asks whether the first finished path may start coding while the other five UI designs are under review. Give the readiness decision, artifacts, graph relationships, and launch boundaries.
```

Score the current response as failing if it does any of the following: waits for implemented Layer 2 code before UI design; omits a separate UI requirements contract; lets the UI worker perform live wiring; creates replacement Layer 3 IDs; or authorizes rolling execution before one global receipt. Preserve the response in the execution handoff as RED evidence.

- [ ] **Step 2: Add the failing pressure scenario to the evaluation catalog**

Append a scenario titled `Two-pass UI planning under rolling-delivery pressure` to `blueprint-masterplan-scenarios.md`. Use the exact prompt from Step 1 and these critical expectations:

```markdown
- **Critical:** Makes UI design planning-ready from approved upstream specifications and plans on `origin/main`; it does not require implemented predecessor code.
- **Critical:** Gives every UI-design worker a separate status contract, presentation handoff, and UI requirements contract, with no implementation plan.
- **Critical:** Restricts Pass 1 app edits to presentation and content demonstrated by explicit fixture/mock state; live API, authorization, persistence, and domain wiring remain prohibited.
- **Critical:** Keeps the existing Layer 3 ordinary worker as the live-wiring owner and makes its Pass 1 plan consume both UI artifacts.
- **Critical:** Refuses rolling execution and requires one coordinator-owned whole-blueprint receipt after every ordinary plan, UI artifact, authority finding, and requirement-to-producer mapping is reconciled.
- Requires Pass 2 Layer 3 execution to verify the passed receipt, implemented Layer 2 predecessor, accepted UI state, handoff, requirements contract, and ownership transfer.
```

- [ ] **Step 3: Write the UI requirements reference template**

Create `ui-requirements-template.md` with a short authority explanation followed by these required headings in this order:

```markdown
# <Worker ID> <Surface> UI Requirements Contract

## Authority and accepted presentation reference
## Surface inventory
## Actor and capability matrix
## Read requirements
## Command requirements
## Async and lifecycle states
## Navigation and client state
## Files and exports
## Accessibility contract
## Deterministic fixture scenarios
## Planned-contract traceability
## Pass 2 acceptance mapping
## Open product decisions and reconciliation state
```

Under `Planned-contract traceability`, require one row per UI need with columns `Requirement ID`, `User intent/state`, `Producer worker`, `Specification section`, `Implementation-plan task`, `Consumer`, and `Reconciliation state`. State that a UI requirement is a consumer planning input, not unilateral product or API authority.

Give every section an exact completion rule:

| Section | Required contents |
| --- | --- |
| Authority and accepted presentation reference | UI worker, consumer, accepted app commit, approval evidence, handoff path, and applicable approved product authority. |
| Surface inventory | Routes, panels, dialogs, menus, responsive variants, and deep links. |
| Actor and capability matrix | Active contexts that may see or invoke each surface/action, including omitted versus visibly disabled behavior. |
| Read requirements | Authorized view models, fields, grouping, ordering, filtering, search, pagination/cursors, freshness, and empty-state meaning. |
| Command requirements | User intent, inputs, validation, confirmation, idempotency, success result, and safe failure/recovery behavior. |
| Async and lifecycle states | Applicable loading, queued, processing, waiting, attention, partial-success, failed, cancelled, completed, stale, and revoked states. |
| Navigation and client state | URL state, dirty-form protection, context switching, focus restoration, refresh/retry behavior, and route-unavailable behavior. |
| Files and exports | Upload, download, preview, export, progress, limits, authorization, and unavailable states. |
| Accessibility contract | Keyboard order, focus behavior, semantic alternatives, announcements, reduced motion, and accessible names/descriptions. |
| Deterministic fixture scenarios | One explicit fixture/mock case for every required state, with no claim of live wiring. |
| Planned-contract traceability | An existing upstream spec/plan section or explicit missing-contract owner for every requirement. |
| Pass 2 acceptance mapping | Focused contract and browser checks the live-wiring worker must satisfy. |
| Open product decisions and reconciliation state | Decision owner, blocking behavior, affected plans, and observable closure evidence; `none` only after reconciliation. |

State that requirements use business/domain intent. Existing approved endpoint shapes may be cited, but the owning ordinary planner remains authoritative for APIs, authorization, domain rules, and persistence.

- [ ] **Step 4: Revise the reusable skill and blueprint template**

Use `superpowers:writing-skills` for this edit. Change `SKILL.md` and `blueprint-masterplan-template.md` so they say, explicitly and consistently:

```text
Pass 1: all ordinary specifications and plans, fixture-backed UI presentation work, UI requirements contracts, living-authority synchronization, downstream propagation, and cross-plan reconciliation complete before the global gate.

Pass 2: ordinary execution begins only after the passed global receipt; each worker also waits for its hard implemented prerequisites.
```

Add all of these rules:

- UI planning readiness consumes the upstream ordinary worker's remotely approved specification, implementation plan, authority/no-impact result, and planning status—not its implemented code.
- The UI-design worker is the only pre-gate app-edit exception and uses explicit fixture/mock-backed state through existing seams.
- The UI-design worker owns status, accepted presentation handoff, and UI requirements; `implementation plan: not applicable` remains valid only for that role.
- The masterplan brief names the requirements path and the existing ordinary live-wiring owner.
- The live-wiring planner consumes both UI documents during Pass 1 and returns missing functional contracts to their owning upstream plans.
- The global gate remains open until every requirement has a reconciled producer and consumer.
- The live-wiring executor waits for the receipt, implemented runtime prerequisites, accepted design evidence, both UI documents, and mutable ownership transfer.
- Link `references/ui-requirements-template.md` from the skill and blueprint template.

Keep the canonical UI source-read checklist byte-for-byte unchanged and exactly once in each instantiated UI worker prompt.

- [ ] **Step 5: Revise the UI, gate, status, and launch reference shapes**

Update `ui-design-worker-prompt-template.md` to include exact placeholders `<UI_REQUIREMENTS_PATH>`, `<DESIGN_HANDOFF_PATH>`, `<UPSTREAM_SPEC_PATH>`, `<UPSTREAM_PLAN_PATH>`, and `<IMPLEMENTATION_WORKER_ID>`. Require fixture/mock presentation state, forbid live wiring, require the full UI requirements sections from Step 3, and stop only after accepted presentation state plus both documents are integrated.

Update `planning-gate-template.md` so the UI table has these columns:

```text
UI worker | Accepted app commit | Approval evidence | Presentation handoff | UI requirements | Live review | Requirements-to-plan reconciliation | Mutable owner transfer | Remote commit
```

Update `worker-status-template.md` and `status-summary-template.md` with separate rows for UI requirements, presentation handoff, planned predecessor evidence, requirements reconciliation, global gate state, implemented runtime predecessor evidence, and next mutable owner. Update `worker-prompt-templates.md` so ordinary Layer 3 planning and execution prompts name both UI artifacts when applicable.

- [ ] **Step 6: Run the GREEN evaluation and focused contract checks**

Run the same fresh-context scenario from Step 1 with the revised skill. Score every critical row before continuing. Then run:

```bash
rg -n "UI requirements contract|fixture/mock|implemented predecessor|live-wiring|whole-blueprint" workers-masterplan/blueprint-masterplan/SKILL.md workers-masterplan/blueprint-masterplan/references
rg -n "UI requirements|Requirements-to-plan reconciliation|Mutable owner transfer" workers-masterplan/blueprint-masterplan/references/planning-gate-template.md workers-masterplan/blueprint-masterplan/references/status-summary-template.md
git diff --check
```

Expected: the GREEN response passes every critical expectation; the searches show the new contract in the skill and coupled templates; `git diff --check` exits zero.

- [ ] **Step 7: Commit, reconcile, push, and prove remote reachability**

```bash
git add workers-masterplan/blueprint-masterplan/SKILL.md workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md workers-masterplan/blueprint-masterplan/references/ui-requirements-template.md workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md workers-masterplan/blueprint-masterplan/references/planning-gate-template.md workers-masterplan/blueprint-masterplan/references/worker-status-template.md workers-masterplan/blueprint-masterplan/references/status-summary-template.md workers-masterplan/evals/blueprint-masterplan-scenarios.md
git commit -m "docs(blueprint): require two-pass UI planning"
git fetch origin main
git merge --no-edit origin/main
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

If the merge incorporates upstream changes in an affected file, rerun Step 6 before pushing.

---

### Task 2: Revise the MVP3 Authority and Coordinator Design

**Files:**

- Modify: `docs/plans/EdenMind_MVP3_Implementation_Masterplan.md`
- Modify: `workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md`
- Modify: `workers-masterplan/swarm/README.md`
- Modify: `workers-masterplan/docs/superpowers/specs/2026-08-29-two-pass-ui-design-requirements/2026-08-29-two-pass-ui-design-requirements-design.md`

**Interfaces:**

- Consumes: the reusable lifecycle from Task 1 and the approved design spec.
- Produces: one authoritative MVP3 description of the Pass 1 planned DAG, the Pass 2 implemented DAG, exact UI artifact paths, and no-impact findings for business/product authorities.

- [ ] **Step 1: Pull current authority and inspect concurrent changes**

```bash
git status --short --branch
git pull --ff-only origin main
git log -1 --oneline -- docs/plans/EdenMind_MVP3_Implementation_Masterplan.md workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md workers-masterplan/swarm/README.md
```

- [ ] **Step 2: Rewrite the MVP3 planning and execution sections as two separate DAGs**

In the MVP3 masterplan, replace rolling authorization and implemented-Layer-2 UI readiness everywhere with these exact semantics:

```text
Pass 1 planned-contract path: Layer 1 plan -> Layer 2 plan -> UI design + UI requirements -> Layer 3 live-wiring plan -> Layer 4 acceptance plan -> X0 plan -> one global planning receipt.

Pass 2 implemented path: passed global receipt + implemented Layer 1 -> implemented Layer 2 -> Layer 3 live wiring of the accepted design -> Layer 4 acceptance -> X0 integration.
```

Update purpose/authority, locked decisions, dependency graph, graph metrics, dependency parity, readiness rules, lifecycle, worker packages, artifacts, gate rules, status contract, failure handling, and revision history together. Delete claims that a per-worker or rolling receipt authorizes execution. State that UI review is one-at-a-time scheduling and not a hard domain edge.

Write the failure/change rules explicitly: an out-of-scope UI requirement is decision-blocked for the product owner; a requirement assigned to another worker keeps planning incomplete until that owner reconciles it; changed upstream planning reopens affected UI review; a materially changed accepted UI artifact reopens the global gate; an implementation-time contract mismatch pauses affected execution for the smallest coherent planning correction; and unrelated execution continues after reopening only with an evidence-backed no-impact receipt.

For each UI worker, record the exact status, requirements, handoff, consumer, and planned predecessor paths from the approved spec. Define `P3/C3/Q3/A3/E3/G3` as both Pass 1 live-wiring planners and Pass 2 live-wiring executors; do not rename them.

- [ ] **Step 3: Record authority impact without mutating unaffected living masterplans**

Add an authority-refresh/no-impact table to the MVP3 masterplan or its revision record with these conclusions:

```markdown
| Authority | Result | Reason |
| --- | --- | --- |
| `docs/plans/EdenMind_Business_Masterplan.md` | no impact | No customer, price, pilot, procurement, demo, or real-pupil-data promise changes. |
| `docs/plans/EdenMind_Product_Spec_Masterplan.md` | no impact | The orchestration change adds no approved route, API, authorization, record, processing, privacy, reliability, or acceptance behavior. Later accepted UI requirements follow normal product-spec synchronization. |
```

Do not stage either cited masterplan.

- [ ] **Step 4: Synchronize the coordinator design and README**

Update the coordinator design and `swarm/README.md` to specify:

- the active manifest is the 32-task Pass 1 projection;
- UI nodes depend on Layer 2 planning evidence, not implementation;
- Layer 3 planning nodes depend on their Layer 2 planner and UI designer;
- UI output paths may be absent until authored but must remain repository-contained;
- readiness loads evidence from `origin/main` and reports UI artifacts independently;
- one coordinator-owned `PLANNING_GATE.md` replaces rolling receipts;
- no execution projection is imported or launchable while that receipt is open;
- after a passed receipt, later execution projections keep the existing IDs and require hard implemented predecessors.

Update the approved spec's Status row to `Approved by the EdenMind product owner on 29 August 2026 for implementation planning` if it is not already current.

- [ ] **Step 5: Verify the authority rewrite**

```bash
rg -n "Pass 1|Pass 2|UI requirements|P3|C3|Q3|A3|E3|G3|PLANNING_GATE.md" docs/plans/EdenMind_MVP3_Implementation_Masterplan.md workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md workers-masterplan/swarm/README.md
! rg -n "rolling execution|execution may begin.*individual|UI.*after.*implementation is integrated" docs/plans/EdenMind_MVP3_Implementation_Masterplan.md workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md workers-masterplan/swarm/README.md
git diff --check
git diff --name-only -- docs/plans/EdenMind_Business_Masterplan.md docs/plans/EdenMind_Product_Spec_Masterplan.md
```

Expected: the first search shows both passes and all six retained live-wiring IDs; the prohibited-language search succeeds with no matches; the final command prints no paths.

- [ ] **Step 6: Commit, reconcile, push, and prove remote reachability**

```bash
git add docs/plans/EdenMind_MVP3_Implementation_Masterplan.md workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md workers-masterplan/swarm/README.md workers-masterplan/docs/superpowers/specs/2026-08-29-two-pass-ui-design-requirements/2026-08-29-two-pass-ui-design-requirements-design.md
git commit -m "docs(mvp3): adopt two-pass planning lifecycle"
git fetch origin main
git merge --no-edit origin/main
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

Rerun Step 5 if reconciliation changes an owned authority.

---

### Task 3: Add UI Artifact Paths to the Manifest Contract

**Files:**

- Modify: `workers-masterplan/swarm/src/shared/contracts.ts`
- Modify: `workers-masterplan/swarm/src/shared/manifest.ts`
- Modify: `workers-masterplan/swarm/src/shared/contracts.test.ts`
- Modify: `workers-masterplan/swarm/src/server/tasks/manifestLoader.ts`
- Modify: `workers-masterplan/swarm/src/server/tasks/tasks.test.ts`

**Interfaces:**

- Produces: `TaskManifestTask.uiRequirementsPath?: string` and `TaskManifestTask.uiHandoffPath?: string`.
- Validation contract: both fields are required for `kind: "ui"`; `implementationPlanPath` is forbidden for UI; all supplied paths are trimmed and repository-contained; missing future UI output files are allowed only for UI tasks.

- [ ] **Step 1: Pull current `main` and install dependencies if needed**

```bash
git status --short --branch
git pull --ff-only origin main
cd workers-masterplan/swarm
npm ci
```

- [ ] **Step 2: Write failing schema tests**

Add these cases to `contracts.test.ts`:

```ts
it("requires both UI artifact paths and forbids a UI implementation plan", () => {
  const ui = {
    id: "PD",
    title: "Platform design",
    kind: "ui",
    dependsOn: ["T0"],
    promptTemplate: "ui",
    specificationPath: "docs/upstream-spec.md",
    uiRequirementsPath: "docs/design/requirements/pd.md",
    uiHandoffPath: "docs/design/handoffs/pd.md",
  };

  expect(validateTaskManifest({ ...validManifest, tasks: [validManifest.tasks[0], ui] })).toMatchObject({ ok: true });
  expect(validateTaskManifest({ ...validManifest, tasks: [validManifest.tasks[0], { ...ui, uiRequirementsPath: undefined }] })).toEqual({
    ok: false,
    error: { code: "MANIFEST_INVALID", field: "tasks[1].uiRequirementsPath", reason: "required" },
  });
  expect(validateTaskManifest({ ...validManifest, tasks: [validManifest.tasks[0], { ...ui, uiHandoffPath: undefined }] })).toEqual({
    ok: false,
    error: { code: "MANIFEST_INVALID", field: "tasks[1].uiHandoffPath", reason: "required" },
  });
  expect(validateTaskManifest({ ...validManifest, tasks: [validManifest.tasks[0], { ...ui, implementationPlanPath: "docs/ui-plan.md" }] })).toEqual({
    ok: false,
    error: { code: "MANIFEST_INVALID", field: "tasks[1].implementationPlanPath", reason: "value" },
  });
});
```

Extend the malformed-path table with whitespace-only and padded values for both new fields.

- [ ] **Step 3: Write failing repository-boundary tests**

In `tasks.test.ts`, extend the future-output test with a UI task whose requirements and handoff paths do not exist yet and assert `loadManifest` resolves. Then set `uiRequirementsPath: "../outside.md"` and a symlink-escaped handoff path in separate assertions and expect `outside repository`.

Run:

```bash
npx vitest run src/shared/contracts.test.ts src/server/tasks/tasks.test.ts
```

Expected: FAIL because the new fields are neither typed nor validated.

- [ ] **Step 4: Implement the manifest fields and role validation**

Add to `TaskManifestTask`:

```ts
uiRequirementsPath?: string;
uiHandoffPath?: string;
```

Extend the optional string loop in `manifest.ts`:

```ts
for (const optionalField of [
  "statusPath",
  "specificationPath",
  "implementationPlanPath",
  "uiRequirementsPath",
  "uiHandoffPath",
] as const) {
  if (value[optionalField] === undefined) continue;
  const error = requiredString(value[optionalField], `${prefix}.${optionalField}`);
  if (error) return error;
}

if (value.kind === "ui") {
  for (const field of ["uiRequirementsPath", "uiHandoffPath"] as const) {
    if (value[field] === undefined) {
      return { code: "MANIFEST_INVALID", field: `${prefix}.${field}`, reason: "required" };
    }
  }
  if (value.implementationPlanPath !== undefined) {
    return { code: "MANIFEST_INVALID", field: `${prefix}.implementationPlanPath`, reason: "value" };
  }
}
```

In `manifestLoader.ts`, validate `uiRequirementsPath` and `uiHandoffPath` with `allowMissing: task.kind === "ui"`. Keep `masterplanPath`, `coordinationRoot`, and every `statusPath` existence-required.

- [ ] **Step 5: Run focused schema tests**

```bash
npx vitest run src/shared/contracts.test.ts src/server/tasks/tasks.test.ts
npm run typecheck
```

Expected: PASS with the new UI contract and path-escape cases.

- [ ] **Step 6: Commit, reconcile, push, and prove remote reachability**

```bash
cd ../..
git add workers-masterplan/swarm/src/shared/contracts.ts workers-masterplan/swarm/src/shared/manifest.ts workers-masterplan/swarm/src/shared/contracts.test.ts workers-masterplan/swarm/src/server/tasks/manifestLoader.ts workers-masterplan/swarm/src/server/tasks/tasks.test.ts
git commit -m "feat(swarm): validate UI planning artifacts"
git fetch origin main
git merge --no-edit origin/main
cd workers-masterplan/swarm
npx vitest run src/shared/contracts.test.ts src/server/tasks/tasks.test.ts
cd ../..
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

---

### Task 4: Make Readiness and Gate Evidence Role-Aware

**Files:**

- Modify: `workers-masterplan/swarm/src/server/tasks/blueprintEvidence.ts`
- Modify: `workers-masterplan/swarm/src/server/tasks/blueprintEvidence.test.ts`

**Interfaces:**

- Produces: internal `uiArtifactsAreRemote`, `uiEvidenceIsComplete`, and role-aware dependency evidence.
- Readiness evidence codes: retain `REMOTE_PREREQUISITES`, `PLANNING_GATE`, and `PLANNING_ARTIFACTS`; add `UI_ARTIFACTS`.
- Gate contract: every ordinary planning row needs specification, plan, authority/no-impact, reconciliation, and an integrated commit; every UI row needs accepted app evidence, approval, handoff, requirements, live review, reconciliation, transfer, and an integrated commit.

- [ ] **Step 1: Pull current `main`**

```bash
git status --short --branch
git pull --ff-only origin main
```

- [ ] **Step 2: Add a two-pass evidence fixture and failing readiness tests**

Add a focused fixture to `blueprintEvidence.test.ts` with tasks `P2` planning, `PD` UI depending on `P2`, `P3` planning depending on `P2` and `PD`, `PG` gate depending on `P3`, and `P3X` execution depending on `PG` and an implemented predecessor. Use these UI paths:

```ts
uiRequirementsPath: "docs/design/requirements/pd.md",
uiHandoffPath: "docs/design/handoffs/pd.md",
```

Add this helper after the two-pass manifest and remote-record fixture:

```ts
async function state(taskId: string, records: Map<string, string>): Promise<string | undefined> {
  const loaded = await loadBlueprintEvidence(twoPassManifest, {
    fetch: async () => undefined,
    revParse: async () => "abc123",
    readRemote: async (path) => records.get(path),
  });
  return evaluateTaskReadiness(twoPassManifest, loaded).find((item) => item.taskId === taskId)?.state;
}
```

Use this accepted handoff evidence shape:

```markdown
| Accepted app-state commit | `abc123` |
| Product-owner approval | accepted |
| Live review | complete |
| Mutable ownership transfer | PD -> P3 |
```

Use one UI receipt row containing the exact worker ID, both artifact paths, `accepted app`, `approval`, `live review`, `reconciled`, `transfer PD -> P3`, and `abc123`.

Write six tests with these exact mutations and outcomes:

1. Keep complete P2 planning status/spec/plan, omit all PD outputs, and expect `await state("PD", records)` to equal `ready`. No P2 execution task or implementation record belongs in this fixture.
2. Keep PD unstarted and omit both UI artifacts; expect `await state("P3", records)` to equal `blocked`.
3. Mark PD status complete, add the accepted handoff, omit `docs/design/requirements/pd.md`, and expect PD not to equal `complete` with unsatisfied `UI_ARTIFACTS` evidence.
4. Add both accepted UI artifacts and complete PD status; expect `await state("P3", records)` to equal `ready`.
5. Add a passed gate receipt with complete P2/P3 ordinary rows but no PD row; expect `await state("P3X", records)` to equal `blocked`.
6. Add the complete PD receipt row described above and the implemented predecessor's terminal remote status; expect `await state("P3X", records)` to equal `ready`.

Run:

```bash
cd workers-masterplan/swarm
npx vitest run src/server/tasks/blueprintEvidence.test.ts
```

Expected: FAIL because UI artifacts are not loaded or evaluated and the gate scans planning rows only.

- [ ] **Step 3: Load UI artifacts and accepted app commits from remote evidence**

Extend `allReferencedPaths` to include both new task fields. Extend `remoteCommitFrom` so `Accepted app-state commit` is a recognized label and its commit enters `integratedCommits` after the ancestry check.

Implement:

```ts
function uiArtifactsAreRemote(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  const handoff = task.uiHandoffPath ? source.records.get(task.uiHandoffPath) : undefined;
  const acceptedCommit = remoteCommitFrom(handoff);
  return Boolean(
    task.uiRequirementsPath
      && task.uiHandoffPath
      && source.records.has(task.uiRequirementsPath)
      && handoff
      && acceptedCommit
      && source.integratedCommits?.has(acceptedCommit)
      && /(?:product[- ]owner|user) approval\s*[|:][^\n]*(?:accepted|approved)/i.test(handoff)
  );
}

function uiEvidenceIsComplete(task: TaskManifestTask, source: BlueprintEvidence): boolean {
  return Boolean(
    task.statusPath
      && statusIsRemoteTerminal(source.records.get(task.statusPath), source.remoteCommit, source.integratedCommits)
      && uiArtifactsAreRemote(task, source)
  );
}
```

- [ ] **Step 4: Replace terminal-only planned dependency checks with role-aware evidence**

For a `planning`, `ui`, or `gate` consumer, require a planning dependency to satisfy `planningEvidenceIsComplete` and a UI dependency to satisfy `uiEvidenceIsComplete`. For an execution consumer, retain terminal runtime dependency evidence and separately evaluate its direct gate dependency. Continue to surface `REMOTE_EVIDENCE_MISMATCH` when a cited commit is not an ancestor of the inspected remote head.

Make UI terminal state depend on `uiEvidenceIsComplete`, not the status file alone. While a UI task is not terminal, it may be `ready` or `attention_required`; if it claims terminal status with missing artifacts, keep it blocked and report `UI_ARTIFACTS: not satisfied`.

- [ ] **Step 5: Expand the global gate evaluator**

Refactor `gateEvidenceIsComplete` to scan all `kind === "planning" || kind === "ui"` tasks, regardless of the gate node's direct dependencies. Ordinary rows must match the exact ID and include their spec, plan, `authority-sync` or `no-impact`, `reconciled`, and an integrated commit. UI rows must match the exact ID and include both UI paths plus case-insensitive evidence for accepted app, approval, live review, reconciliation, transfer, and an integrated commit.

Add `UI_ARTIFACTS` to each readiness result:

```ts
evidence(
  "UI_ARTIFACTS",
  task.kind === "ui" ? uiArtifactsAreRemote(task, source) : true,
  task.uiRequirementsPath,
  source.remoteCommit,
),
```

- [ ] **Step 6: Run focused evidence tests**

```bash
npx vitest run src/server/tasks/blueprintEvidence.test.ts src/server/tasks/tasks.test.ts
npm run typecheck
```

Expected: PASS for UI readiness from approved planning, UI artifact completeness, exact receipt rows, global coverage, and later execution gating.

- [ ] **Step 7: Commit, reconcile, push, and prove remote reachability**

```bash
cd ../..
git add workers-masterplan/swarm/src/server/tasks/blueprintEvidence.ts workers-masterplan/swarm/src/server/tasks/blueprintEvidence.test.ts
git commit -m "feat(swarm): evaluate two-pass planning evidence"
git fetch origin main
git merge --no-edit origin/main
cd workers-masterplan/swarm
npx vitest run src/server/tasks/blueprintEvidence.test.ts src/server/tasks/tasks.test.ts
cd ../..
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

---

### Task 5: Render Planned Inputs, UI Outputs, and Live-Wiring Boundaries

**Files:**

- Modify: `workers-masterplan/swarm/src/server/tasks/promptTemplates.ts`
- Modify: `workers-masterplan/swarm/src/server/tasks/launchMetadata.ts`
- Modify: `workers-masterplan/swarm/src/server/tasks/launchMetadata.test.ts`
- Modify: `workers-masterplan/swarm/src/server/index.ts`
- Modify: `workers-masterplan/swarm/templates/planning.md`
- Modify: `workers-masterplan/swarm/templates/ui.md`
- Modify: `workers-masterplan/swarm/templates/execution.md`
- Modify: `workers-masterplan/swarm/src/shared/templates.test.ts`
- Modify: `workers-masterplan/swarm/src/server/tasks/tasks.test.ts`
- Modify: `workers-masterplan/evals/verify-swarm-prompt-parity.mjs`

**Interfaces:**

- Produces: `WorkerPromptValues.plannedPrerequisites`, `uiRequirementsPath`, and `uiHandoffPath`.
- Produces: `taskArtifactLaunchMetadata(task: TaskNode, tasks: TaskNode[]): { plannedPrerequisites: string; uiRequirementsPath: string; uiHandoffPath: string }`.
- Consumer rule: a UI task uses its own UI paths as destinations; an ordinary task derives UI inputs from its direct UI dependency; tasks without UI inputs render `not applicable` without unresolved placeholders.

- [ ] **Step 1: Pull current `main`**

```bash
git status --short --branch
git pull --ff-only origin main
```

- [ ] **Step 2: Write failing launch-metadata and template tests**

Add these `PD` and `P3` task fixtures to `launchMetadata.test.ts`, using the file's existing readiness shape:

```ts
const pd: TaskNode = {
  id: "PD",
  title: "Platform design",
  kind: "ui",
  dependsOn: ["P2"],
  promptTemplate: "ui",
  specificationPath: "docs/p2-spec.md",
  uiRequirementsPath: "docs/design/requirements/pd.md",
  uiHandoffPath: "docs/design/handoffs/pd.md",
  readiness: { taskId: "PD", state: "ready", phase: "ui", evidence: [], blockingCodes: [] },
};
const p2: TaskNode = {
  id: "P2",
  title: "People planning",
  kind: "planning",
  dependsOn: [],
  promptTemplate: "planning",
  specificationPath: "docs/p2-spec.md",
  implementationPlanPath: "docs/p2-plan.md",
  readiness: { taskId: "P2", state: "complete", phase: "planning", evidence: [], blockingCodes: [] },
};
const p3: TaskNode = {
  id: "P3",
  title: "Platform live wiring",
  kind: "planning",
  dependsOn: ["P2", "PD"],
  promptTemplate: "planning",
  readiness: { taskId: "P3", state: "ready", phase: "planning", evidence: [], blockingCodes: [] },
};
const tasks = [p2, pd, p3];

expect(taskArtifactLaunchMetadata(pd, tasks)).toMatchObject({
  uiRequirementsPath: "docs/design/requirements/pd.md",
  uiHandoffPath: "docs/design/handoffs/pd.md",
});
expect(taskArtifactLaunchMetadata(p3, tasks)).toMatchObject({
  uiRequirementsPath: "docs/design/requirements/pd.md",
  uiHandoffPath: "docs/design/handoffs/pd.md",
});
expect(taskArtifactLaunchMetadata(p3, tasks).plannedPrerequisites).toContain("P2");
expect(taskArtifactLaunchMetadata(p3, tasks).plannedPrerequisites).toContain("PD");
```

Extend `templates.test.ts` so:

- the UI template contains the exact canonical four-row checklist once;
- the UI template contains `{{UI_REQUIREMENTS_PATH}}`, `{{UI_HANDOFF_PATH}}`, `fixture/mock-backed state`, and `Do not add or change live wiring`;
- planning contains `{{PLANNED_PREREQUISITES}}`, both UI tokens, and the global Pass 1 stop rule;
- execution contains both UI tokens, live-wiring ownership, the planning gate, and implemented prerequisites.

Extend `tasks.test.ts` to render UI and Layer 3 planning packets with exact paths and assert no `{{TOKEN}}` remains.

Run:

```bash
cd workers-masterplan/swarm
npx vitest run src/server/tasks/launchMetadata.test.ts src/shared/templates.test.ts src/server/tasks/tasks.test.ts
```

Expected: FAIL because metadata and placeholders do not exist and the current UI packet omits the canonical checklist.

- [ ] **Step 3: Implement manifest-derived artifact metadata**

In `launchMetadata.ts`, add:

```ts
export function taskArtifactLaunchMetadata(
  task: TaskNode,
  tasks: TaskNode[],
): { plannedPrerequisites: string; uiRequirementsPath: string; uiHandoffPath: string } {
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));
  const dependencies = task.dependsOn.flatMap((id) => {
    const dependency = byId.get(id);
    return dependency ? [dependency] : [];
  });
  const ui = task.kind === "ui" ? task : dependencies.find((dependency) => dependency.kind === "ui");
  const plannedPrerequisites = dependencies.length
    ? dependencies.map((dependency) => [
        `${dependency.id}:`,
        dependency.specificationPath && `specification ${dependency.specificationPath}`,
        dependency.implementationPlanPath && `implementation plan ${dependency.implementationPlanPath}`,
        dependency.uiRequirementsPath && `UI requirements ${dependency.uiRequirementsPath}`,
        dependency.uiHandoffPath && `presentation handoff ${dependency.uiHandoffPath}`,
      ].filter(Boolean).join(" ")).join("\n")
    : "none";
  return {
    plannedPrerequisites,
    uiRequirementsPath: ui?.uiRequirementsPath ?? "not applicable",
    uiHandoffPath: ui?.uiHandoffPath ?? "not applicable",
  };
}
```

Add the three properties to `WorkerPromptValues` and its default mapping. In `server/index.ts`, spread `taskArtifactLaunchMetadata(task, nodes)` into every rendered prompt. Keep `executionLaunchMetadata` responsible only for the gate receipt, pinned commit, and hard runtime prerequisites.

- [ ] **Step 4: Replace the three canonical coordinator packet bodies**

Update `planning.md` to list planned prerequisite artifacts and both UI inputs. State that all planning happens in Pass 1, that applicable Layer 3 planners map every UI requirement to an owning plan and amend affected upstream plans, and that no product code or UI implementation begins.

Update `ui.md` to include the exact four-row checklist once, the upstream planned inputs, the two owned output paths, explicit fixture/mock state, real presentation/content work, required UI contract sections, no live wiring, user review, handoff, and ownership transfer to the named Layer 3 consumer inferred from the task brief.

Update `execution.md` to read both UI artifacts when applicable and to define Layer 3 work as live queries/commands, runtime state, capability projection, functional recovery, and contract/browser tests. Require the passed global receipt and implemented runtime predecessors before editing. Remove the current execution packet's instruction to write plans during execution.

Retain the direct-main checkpoint language and exact phase terminal condition token in all three files.

- [ ] **Step 5: Strengthen the byte-parity evaluator**

Add exact `uiRequirementsPath` and `uiHandoffPath` values to `coordinatorLaunchValues` in `verify-swarm-prompt-parity.mjs`. Add assertions that:

```text
ui renders the canonical checklist exactly once
ui renders both UI artifact paths
ui contains fixture/mock-backed state
ui forbids live wiring
planning consumes planned prerequisites and both UI artifacts
execution names the global receipt, both UI artifacts, and live wiring
planning and UI do not authorize ordinary execution
```

Keep byte-for-byte comparison between the reusable Blueprint entry point and the canonical swarm templates.

- [ ] **Step 6: Run focused prompt tests and parity verification**

```bash
npx vitest run src/server/tasks/launchMetadata.test.ts src/shared/templates.test.ts src/server/tasks/tasks.test.ts
npm run typecheck
cd ..
node evals/verify-swarm-prompt-parity.mjs
```

Expected: all Vitest cases pass and the parity script prints PASS for planning, execution, UI, and the three-packet summary.

- [ ] **Step 7: Commit, reconcile, push, and prove remote reachability**

```bash
cd ..
git add workers-masterplan/swarm/src/server/tasks/promptTemplates.ts workers-masterplan/swarm/src/server/tasks/launchMetadata.ts workers-masterplan/swarm/src/server/tasks/launchMetadata.test.ts workers-masterplan/swarm/src/server/index.ts workers-masterplan/swarm/templates/planning.md workers-masterplan/swarm/templates/ui.md workers-masterplan/swarm/templates/execution.md workers-masterplan/swarm/src/shared/templates.test.ts workers-masterplan/swarm/src/server/tasks/tasks.test.ts workers-masterplan/evals/verify-swarm-prompt-parity.mjs
git commit -m "feat(swarm): render two-pass UI launch packets"
git fetch origin main
git merge --no-edit origin/main
cd workers-masterplan/swarm
npx vitest run src/server/tasks/launchMetadata.test.ts src/shared/templates.test.ts src/server/tasks/tasks.test.ts
cd ..
node evals/verify-swarm-prompt-parity.mjs
cd ..
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

---

### Task 6: Reserve MVP3 UI Artifacts and Expose Them in the Flowchart

**Files:**

- Modify: `workers-masterplan/swarm/manifests/mvp3.json`
- Modify: `workers-masterplan/swarm/src/server/tasks/tasks.test.ts`
- Modify: `workers-masterplan/swarm/src/client/pages/FlowchartPage.tsx`
- Modify: `workers-masterplan/swarm/src/client/pages/FlowchartPage.test.tsx`

**Interfaces:**

- Consumes: the schema from Task 3 and prompt metadata from Task 5.
- Produces: six UI task output pairs and an accessible inspector view of every declared artifact path.

- [ ] **Step 1: Pull current `main` and read the applicable UI skills**

```bash
git status --short --branch
git pull --ff-only origin main
```

Before editing the React inspector, completely read `better-accessibility` and `better-ui`.

- [ ] **Step 2: Write failing production topology and inspector tests**

In `tasks.test.ts`, preserve the assertions for 32 total tasks, 26 planning tasks, and six UI IDs. Add this exact mapping assertion:

```ts
expect(Object.fromEntries(production.tasks.filter((task) => task.kind === "ui").map((task) => [task.id, [task.uiRequirementsPath, task.uiHandoffPath]]))).toEqual({
  PD: ["docs/design/requirements/2026-08-26-pd-platform-admin.md", "docs/design/handoffs/2026-08-26-pd-platform-admin.md"],
  CD: ["docs/design/requirements/2026-08-26-cd-curriculum.md", "docs/design/handoffs/2026-08-26-cd-curriculum.md"],
  QD: ["docs/design/requirements/2026-08-26-qd-content.md", "docs/design/handoffs/2026-08-26-qd-content.md"],
  AD: ["docs/design/requirements/2026-08-26-ad-analysis-intake.md", "docs/design/handoffs/2026-08-26-ad-analysis-intake.md"],
  ED: ["docs/design/requirements/2026-08-26-ed-evidence.md", "docs/design/handoffs/2026-08-26-ed-evidence.md"],
  GD: ["docs/design/requirements/2026-08-26-gd-practice.md", "docs/design/handoffs/2026-08-26-gd-practice.md"],
});
```

Also assert no task has `id === "PG0"` and every Layer 3 planning dependency remains `[Layer2, DesignWorker]`.

In `FlowchartPage.test.tsx`, create a UI task snapshot with status, upstream specification, UI requirements, and UI handoff paths. Open its inspector and assert all four labelled paths are visible under `Artifact paths`.

Run:

```bash
cd workers-masterplan/swarm
npx vitest run src/server/tasks/tasks.test.ts src/client/pages/FlowchartPage.test.tsx
```

Expected: FAIL because the production UI tasks lack both output paths and the inspector does not display artifacts.

- [ ] **Step 3: Add the six production artifact pairs**

Add `uiRequirementsPath` and `uiHandoffPath` to `PD`, `CD`, `QD`, `AD`, `ED`, and `GD` using the exact mapping from Step 2. Keep each UI task dependent only on its path's Layer 2 planning node. Keep each Layer 3 planning task dependent on both Layer 2 and the matching UI task. Do not add a gate or execution node to this Pass 1 manifest.

- [ ] **Step 4: Add an accessible artifact-path definition list**

Refactor `TaskInspector` for readability and add:

```tsx
<h3>Artifact paths</h3>
<dl>
  {task.statusPath ? <><dt>Status</dt><dd><code>{task.statusPath}</code></dd></> : null}
  {task.specificationPath ? <><dt>Specification</dt><dd><code>{task.specificationPath}</code></dd></> : null}
  {task.implementationPlanPath ? <><dt>Implementation plan</dt><dd><code>{task.implementationPlanPath}</code></dd></> : null}
  {task.uiRequirementsPath ? <><dt>UI requirements</dt><dd><code>{task.uiRequirementsPath}</code></dd></> : null}
  {task.uiHandoffPath ? <><dt>Presentation handoff</dt><dd><code>{task.uiHandoffPath}</code></dd></> : null}
</dl>
```

Preserve dialog labelling, initial close-button focus, Escape handling, focus trapping, launch enablement, and viewport restoration.

- [ ] **Step 5: Run focused topology and UI tests**

```bash
npx vitest run src/server/tasks/tasks.test.ts src/client/pages/FlowchartPage.test.tsx
npm run typecheck
```

Expected: PASS with 32 tasks, all exact path pairs, no `PG0`, and accessible inspector labels.

- [ ] **Step 6: Commit, reconcile, push, and prove remote reachability**

```bash
cd ../..
git add workers-masterplan/swarm/manifests/mvp3.json workers-masterplan/swarm/src/server/tasks/tasks.test.ts workers-masterplan/swarm/src/client/pages/FlowchartPage.tsx workers-masterplan/swarm/src/client/pages/FlowchartPage.test.tsx
git commit -m "feat(mvp3): project UI planning artifacts"
git fetch origin main
git merge --no-edit origin/main
cd workers-masterplan/swarm
npx vitest run src/server/tasks/tasks.test.ts src/client/pages/FlowchartPage.test.tsx
cd ../..
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

---

### Task 7: Publish the Open Global Gate and Refresh Coordinator State

**Files:**

- Create: `docs/workers/2026-08-14-mvp3/PLANNING_GATE.md`
- Modify: `docs/workers/2026-08-14-mvp3/STATUS.md`
- Modify: `docs/workers/2026-08-14-mvp3/gates/README.md`

**Interfaces:**

- Consumes: all 26 ordinary task paths and six UI artifact pairs from the production manifest.
- Produces: one open coordinator receipt and one current aggregate snapshot. Existing files under `gates/` remain preserved as historical rolling receipts and no longer authorize execution.

- [ ] **Step 1: Pull and capture the inspected remote baseline**

```bash
git status --short --branch
git pull --ff-only origin main
git rev-parse origin/main
```

Use the printed commit as the inspected baseline in both coordinator-owned documents. An open gate has `Authorized origin/main commit: not authorized while open`; do not claim a passed receipt.

- [ ] **Step 2: Create the global planning receipt in the open state**

Create `PLANNING_GATE.md` with blueprint ID `2026-08-14-mvp3`, the MVP3 masterplan path, state `open`, coordinator owner, inspected baseline commit, `approval time: pending`, and the material-change reopening rule.

Add one ordinary planning table row for these exact 26 IDs:

```text
F0, P1, P2, P3, P4, C1, C2, C3, C4, Q1, Q2, Q3, Q4, A1, A2, A3, A4, E1, E2, E3, E4, G1, G2, G3, G4, X0
```

Each row includes its exact manifest specification and plan paths, approval, authority sync/no-impact, cross-plan reconciliation, and remote commit. Populate unresolved cells with `pending`; never omit the paths.

Add one UI table row for `PD`, `CD`, `QD`, `AD`, `ED`, and `GD` with exact requirements and handoff paths, accepted app commit, approval, live review, requirements-to-plan reconciliation, transfer target (`P3`, `C3`, `Q3`, `A3`, `E3`, `G3`), and remote commit. Populate unverified evidence with `pending`.

Add a UI requirement reconciliation section stating the gate remains open until every row in every UI requirements contract maps to an approved producer specification/plan and the matching Layer 3 consumer plan.

- [ ] **Step 3: Refresh aggregate status without overwriting workers**

Rewrite stale claims in `STATUS.md` so it:

- lists all 32 Pass 1 tasks and their named status contracts;
- lists all six UI requirements and presentation handoff paths;
- reports the global receipt as `open` and all ordinary execution as unauthorized;
- separates planning readiness from execution readiness;
- marks worker status text that still says UI waits for implementation as stale under the 29 August authority;
- assigns each stale status refresh to its owning worker instead of editing it;
- records the Business Masterplan and Product Specification Masterplan no-impact findings;
- records that provisional presentation drafts require reconciliation against the new requirements contract;
- keeps current evidence pinned to the inspected baseline commit.

Use one aggregate task table whose worker rows begin with the exact task ID in the first column. Include these columns: `Worker`, `Status contract`, `Role`, `Planning prerequisites`, `Planning state`, `UI requirements`, `Presentation handoff`, `Global gate`, `Implemented prerequisites`, `Execution readiness`, and `Blocker/next owner action`.

Do not edit any file in `docs/workers/2026-08-14-mvp3/status/`.

- [ ] **Step 4: Preserve and demote rolling receipts**

Update `gates/README.md` to say every existing file in `gates/` is preserved historical evidence from the superseded rolling model. State that none independently authorizes Pass 2 and that only `../PLANNING_GATE.md` may authorize execution after all ordinary and UI rows reconcile.

- [ ] **Step 5: Verify counts, ownership, and gate language**

```bash
test "$(rg -c '^\| (F0|P[1-4]|C[1-4]|Q[1-4]|A[1-4]|E[1-4]|G[1-4]|X0) \|' docs/workers/2026-08-14-mvp3/PLANNING_GATE.md)" -eq 26
test "$(rg -c '^\| (PD|CD|QD|AD|ED|GD) \|' docs/workers/2026-08-14-mvp3/PLANNING_GATE.md)" -eq 6
node -e 'const fs=require("fs");const s=fs.readFileSync("docs/workers/2026-08-14-mvp3/STATUS.md","utf8");const ids=["F0","P1","P2","P3","P4","C1","C2","C3","C4","Q1","Q2","Q3","Q4","A1","A2","A3","A4","E1","E2","E3","E4","G1","G2","G3","G4","X0","PD","CD","QD","AD","ED","GD"];if(ids.some(id=>!new RegExp(`^\\| ${id} \\|`,`m`).test(s)))process.exit(1)'
rg -n "Gate state.*open|not authorized while open|UI requirements|requirements-to-plan" docs/workers/2026-08-14-mvp3/PLANNING_GATE.md docs/workers/2026-08-14-mvp3/STATUS.md
git diff --name-only -- docs/workers/2026-08-14-mvp3/status
git diff --check
```

Expected: counts are 26 and six; open/unauthorized language and UI requirements are present; no worker-owned status path is printed.

- [ ] **Step 6: Commit, reconcile, push, and prove remote reachability**

```bash
git add docs/workers/2026-08-14-mvp3/PLANNING_GATE.md docs/workers/2026-08-14-mvp3/STATUS.md docs/workers/2026-08-14-mvp3/gates/README.md
git commit -m "docs(mvp3): open whole-blueprint planning gate"
git fetch origin main
git merge --no-edit origin/main
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

If reconciliation changes the manifest or a cited worker artifact, refresh the inspected baseline and rerun Step 5 before pushing.

---

### Task 8: Run Full Verification, Review the Contract, and Publish Final Evidence

**Files:**

- Modify only if verification exposes a defect: files already owned by Tasks 1–7.
- Do not modify: `docs/plans/EdenMind_Business_Masterplan.md`, `docs/plans/EdenMind_Product_Spec_Masterplan.md`, or `docs/workers/2026-08-14-mvp3/status/*.md` without a newly approved authority change.

**Interfaces:**

- Consumes: the complete implementation from Tasks 1–7.
- Produces: passing full verification, code/contract review closure, clean owned state, and remote ancestry proof.

- [ ] **Step 1: Pull current `main` and read completion/review skills**

```bash
git status --short --branch
git pull --ff-only origin main
```

Completely read `superpowers:requesting-code-review` and `superpowers:verification-before-completion` before making any completion claim.

- [ ] **Step 2: Run the complete automated suite**

```bash
cd workers-masterplan/swarm
npm test
npm run typecheck
npm run build
npm run test:e2e
cd ..
node evals/verify-swarm-prompt-parity.mjs
cd ..
git diff --check
```

Expected: Vitest, both TypeScript configurations, the Vite/server build, Playwright, prompt parity, and whitespace validation all pass.

- [ ] **Step 3: Run deterministic contract audits**

```bash
node -e 'const fs=require("fs");const m=JSON.parse(fs.readFileSync("workers-masterplan/swarm/manifests/mvp3.json","utf8"));const ui=m.tasks.filter(t=>t.kind==="ui");if(m.tasks.length!==32||m.tasks.filter(t=>t.kind==="planning").length!==26||ui.length!==6||ui.some(t=>!t.uiRequirementsPath||!t.uiHandoffPath||t.implementationPlanPath)||m.tasks.some(t=>t.id==="PG0"))process.exit(1)'
rg -n "Pass 1|Pass 2|fixture/mock|UI requirements contract|live-wiring" workers-masterplan/blueprint-masterplan/SKILL.md docs/plans/EdenMind_MVP3_Implementation_Masterplan.md workers-masterplan/swarm/templates
! rg -n "rolling execution|UI.*after.*implementation is integrated" workers-masterplan/blueprint-masterplan/SKILL.md docs/plans/EdenMind_MVP3_Implementation_Masterplan.md workers-masterplan/swarm/README.md
test "$(rg -c '^\| (F0|P[1-4]|C[1-4]|Q[1-4]|A[1-4]|E[1-4]|G[1-4]|X0) \|' docs/workers/2026-08-14-mvp3/PLANNING_GATE.md)" -eq 26
test "$(rg -c '^\| (PD|CD|QD|AD|ED|GD) \|' docs/workers/2026-08-14-mvp3/PLANNING_GATE.md)" -eq 6
node -e 'const fs=require("fs");const s=fs.readFileSync("docs/workers/2026-08-14-mvp3/STATUS.md","utf8");const ids=["F0","P1","P2","P3","P4","C1","C2","C3","C4","Q1","Q2","Q3","Q4","A1","A2","A3","A4","E1","E2","E3","E4","G1","G2","G3","G4","X0","PD","CD","QD","AD","ED","GD"];if(ids.some(id=>!new RegExp(`^\\| ${id} \\|`,`m`).test(s)))process.exit(1)'
git diff --name-only -- docs/plans/EdenMind_Business_Masterplan.md docs/plans/EdenMind_Product_Spec_Masterplan.md docs/workers/2026-08-14-mvp3/status
```

Expected: the manifest audit exits zero; lifecycle terms are present; superseded language is absent from current authorities; receipt counts are exact; unaffected or worker-owned paths are not printed.

- [ ] **Step 4: Request a fresh review against the approved spec**

Ask the reviewer to check these questions explicitly:

1. Can every UI task become ready with approved Layer 2 planning evidence and no implemented Layer 2 code?
2. Can a UI task reach complete without remote requirements, remote handoff, accepted app commit, and approval evidence?
3. Can any execution task become ready without a complete receipt row for every ordinary and UI task?
4. Do UI packets forbid live wiring while Layer 3 planning/execution packets consume both UI documents?
5. Does the active production projection remain exactly 32 Pass 1 tasks with no dispatchable gate?
6. Did coordinator changes avoid worker-owned statuses and unaffected business/product authorities?

Address every finding with the focused test that would have caught it, then rerun Steps 2 and 3.

- [ ] **Step 5: Commit any review fixes and publish final evidence**

If review changed files:

```bash
git status --short
git add docs/plans/EdenMind_MVP3_Implementation_Masterplan.md docs/workers/2026-08-14-mvp3/PLANNING_GATE.md docs/workers/2026-08-14-mvp3/STATUS.md docs/workers/2026-08-14-mvp3/gates/README.md workers-masterplan/blueprint-masterplan/SKILL.md workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md workers-masterplan/blueprint-masterplan/references/ui-requirements-template.md workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md workers-masterplan/blueprint-masterplan/references/planning-gate-template.md workers-masterplan/blueprint-masterplan/references/worker-status-template.md workers-masterplan/blueprint-masterplan/references/status-summary-template.md workers-masterplan/evals/blueprint-masterplan-scenarios.md workers-masterplan/evals/verify-swarm-prompt-parity.mjs workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md workers-masterplan/docs/superpowers/specs/2026-08-29-two-pass-ui-design-requirements/2026-08-29-two-pass-ui-design-requirements-design.md workers-masterplan/swarm/README.md workers-masterplan/swarm/manifests/mvp3.json workers-masterplan/swarm/src/shared/contracts.ts workers-masterplan/swarm/src/shared/manifest.ts workers-masterplan/swarm/src/shared/contracts.test.ts workers-masterplan/swarm/src/shared/templates.test.ts workers-masterplan/swarm/src/server/index.ts workers-masterplan/swarm/src/server/tasks/manifestLoader.ts workers-masterplan/swarm/src/server/tasks/blueprintEvidence.ts workers-masterplan/swarm/src/server/tasks/blueprintEvidence.test.ts workers-masterplan/swarm/src/server/tasks/promptTemplates.ts workers-masterplan/swarm/src/server/tasks/launchMetadata.ts workers-masterplan/swarm/src/server/tasks/launchMetadata.test.ts workers-masterplan/swarm/src/server/tasks/tasks.test.ts workers-masterplan/swarm/src/client/pages/FlowchartPage.tsx workers-masterplan/swarm/src/client/pages/FlowchartPage.test.tsx
git commit -m "fix(mvp3): close two-pass planning review"
git fetch origin main
git merge --no-edit origin/main
```

Rerun Steps 2 and 3 after the merge. Then publish and prove ancestry:

```bash
git push origin main
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
git status --short --branch
```

Expected: the final commit is reachable from `origin/main`; local `main` has no owned dirty state; unrelated dirt, if any, is preserved and reported.
