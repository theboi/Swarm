# MVP3 Swarm Linkage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the approved MVP3 path/layer blueprint into the production swarm coordinator so it can safely launch worker planning while exposing the remaining readiness blockers.

**Architecture:** Extend the existing manifest contract with optional path/layer presentation metadata while preserving `dependsOn` as the only scheduling authority. Permit planning-worker output files to be absent before the worker authors them, then import a planning-only production projection plus coordinator-owned initial status artifacts. Execution and UI launch nodes remain absent until their required plans, receipts, and implemented prerequisites exist.

**Tech Stack:** TypeScript 5.8, React 19, React Flow, Vitest, JSON and Markdown coordination artifacts.

**Spec:** `docs/plans/EdenMind_MVP3_Implementation_Masterplan.md`

## Global Constraints

- Work directly on `main` as explicitly requested; do not create a feature branch or linked worktree.
- `pathId` and `pathStep` affect graph layout and inspection only; they never create a scheduling dependency or global layer barrier.
- Preserve backward compatibility for manifests without path/layer metadata.
- The production manifest initially launches planning only. It must not claim that execution workers or UI-design workers are ready.
- Worker-owned specification and implementation-plan destinations may be missing before planning; the masterplan, coordination root, and status artifacts must already exist.
- Use red-green-refactor for coordinator behavior changes and commit/push each coherent checkpoint.

---

### Task 1: Add path/layer-aware manifest and flowchart behavior

**Files:**
- Modify: `workers-masterplan/swarm/src/shared/contracts.ts`
- Modify: `workers-masterplan/swarm/src/shared/manifest.ts`
- Modify: `workers-masterplan/swarm/src/shared/contracts.test.ts`
- Modify: `workers-masterplan/swarm/src/client/pages/FlowchartPage.tsx`
- Modify: `workers-masterplan/swarm/src/client/pages/FlowchartPage.test.tsx`

**Interfaces:**
- Consumes: the existing `TaskManifestTask` and React Flow graph.
- Produces: optional `pathId?: string` and `pathStep?: number` fields and deterministic path-column/layer-row positions.

- [ ] **Step 1: Write failing contract tests**

Add literal cases proving a task accepts paired metadata and rejects a missing pair, blank path ID, negative step, fractional step, and duplicate path position:

```ts
const layered = {
  ...validManifest,
  tasks: [
    { ...validManifest.tasks[0], pathId: "P", pathStep: 1 },
    { ...validManifest.tasks[1], pathId: "P", pathStep: 2 },
  ],
};
expect(validateTaskManifest(layered)).toEqual({ ok: true, data: layered });
```

- [ ] **Step 2: Run the focused contract test and verify RED**

Run: `cd workers-masterplan/swarm && npm test -- src/shared/contracts.test.ts`

Expected: FAIL because path/layer metadata is not validated and duplicate positions are accepted.

- [ ] **Step 3: Implement the minimal manifest contract**

Add the optional fields to `TaskManifestTask`. Require both together, validate `pathId` with the existing trimmed-string rule, require a non-negative integer `pathStep`, and reject two tasks with the same `pathId`/`pathStep` pair using a `MANIFEST_INVALID` duplicate error.

- [ ] **Step 4: Run the contract test and verify GREEN**

Run: `cd workers-masterplan/swarm && npm test -- src/shared/contracts.test.ts`

Expected: all contract tests pass.

- [ ] **Step 5: Write the failing flow-layout test**

Export a pure `taskLayoutPositions(tasks)` helper and assert the literal map below:

```ts
expect(taskLayoutPositions([
  task({ id: "F0", pathId: "shared", pathStep: 0 }),
  task({ id: "P1", pathId: "P", pathStep: 1 }),
  task({ id: "C1", pathId: "C", pathStep: 1 }),
  task({ id: "P2", pathId: "P", pathStep: 2 }),
])).toEqual(new Map([
  ["F0", { x: 130, y: 0 }],
  ["P1", { x: 0, y: 170 }],
  ["C1", { x: 260, y: 170 }],
  ["P2", { x: 0, y: 340 }],
]));
```

- [ ] **Step 6: Run the focused UI test and verify RED**

Run: `cd workers-masterplan/swarm && npm test -- src/client/pages/FlowchartPage.test.tsx`

Expected: FAIL because `taskLayoutPositions` does not exist.

- [ ] **Step 7: Implement path columns and layer rows**

Use first appearance to order non-`shared` paths, center `shared` nodes over those paths, and retain the current three-column index layout unless every visible task has valid path metadata. Show the selected task's path and layer in the inspector.

- [ ] **Step 8: Run focused tests and typecheck**

Run:

```bash
cd workers-masterplan/swarm
npm test -- src/shared/contracts.test.ts src/client/pages/FlowchartPage.test.tsx
npm run typecheck
```

Expected: focused tests and both TypeScript programs pass.

- [ ] **Step 9: Commit, reconcile, and push**

```bash
git add workers-masterplan/swarm/src/shared/contracts.ts workers-masterplan/swarm/src/shared/manifest.ts workers-masterplan/swarm/src/shared/contracts.test.ts workers-masterplan/swarm/src/client/pages/FlowchartPage.tsx workers-masterplan/swarm/src/client/pages/FlowchartPage.test.tsx
git commit -m "feat(swarm): support path-layer task layout"
git pull --no-rebase origin main
git push origin main
```

### Task 2: Permit future planning artifacts without weakening authorities

**Files:**
- Modify: `workers-masterplan/swarm/src/server/tasks/manifestLoader.ts`
- Modify: `workers-masterplan/swarm/src/server/tasks/tasks.test.ts`

**Interfaces:**
- Consumes: `loadManifest(path, repositoryRoot)`.
- Produces: planning manifests whose future spec/plan destinations stay inside the repository even when not created yet.

- [ ] **Step 1: Write a failing loader test**

Create the masterplan, coordination root, and all status files, omit a planning task's specification and plan, and assert `loadManifest` resolves. Then replace either output path with `../outside.md` and assert rejection.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd workers-masterplan/swarm && npm test -- src/server/tasks/tasks.test.ts`

Expected: FAIL with `Manifest path does not exist` for the future planning output.

- [ ] **Step 3: Implement output-destination validation**

Continue requiring `masterplanPath`, `coordinationRoot`, and every `statusPath` to exist and resolve inside the repository. For a task with `kind: "planning"`, allow an absent `specificationPath` or `implementationPlanPath` after proving its resolved lexical destination is inside the repository. Existing output files still receive the realpath/symlink containment check. All non-planning referenced paths remain existence-required.

- [ ] **Step 4: Verify and push the checkpoint**

Run:

```bash
cd workers-masterplan/swarm
npm test -- src/server/tasks/tasks.test.ts src/server/tasks/blueprintEvidence.test.ts
npm run typecheck
```

Then commit `fix(swarm): allow future planning artifact paths`, reconcile with `origin/main`, rerun the affected checks, push, and prove the commit is an ancestor of `origin/main`.

### Task 3: Import the approved MVP3 planning topology

**Files:**
- Modify: `workers-masterplan/swarm/manifests/mvp3.json`
- Modify: `workers-masterplan/swarm/README.md`
- Modify: `workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md`
- Create: `docs/workers/2026-08-14-mvp3/STATUS.md`
- Create: `docs/workers/2026-08-14-mvp3/status/f0.md`
- Create: `docs/workers/2026-08-14-mvp3/status/p1.md` through `p4.md`
- Create: `docs/workers/2026-08-14-mvp3/status/c1.md` through `c4.md`
- Create: `docs/workers/2026-08-14-mvp3/status/q1.md` through `q4.md`
- Create: `docs/workers/2026-08-14-mvp3/status/a1.md` through `a4.md`
- Create: `docs/workers/2026-08-14-mvp3/status/e1.md` through `e4.md`
- Create: `docs/workers/2026-08-14-mvp3/status/g1.md` through `g4.md`
- Create: `docs/workers/2026-08-14-mvp3/status/x0.md`

**Interfaces:**
- Consumes: the approved MVP3 masterplan's worker registry and hard planned-contract order.
- Produces: the production planning graph, one coordinator snapshot, and one initial worker status per ordinary worker.

- [ ] **Step 1: Add a production-manifest integration test**

Load `manifests/mvp3.json` against the repository root and assert blueprint ID `2026-08-14-mvp3`, 26 planning tasks, path lengths `P=4`, `C=4`, `Q=4`, `A=4`, `E=4`, `G=4`, shared nodes `F0` and `X0`, and exactly one initially dependency-ready task (`F0`).

- [ ] **Step 2: Run the integration test and verify RED**

Run: `cd workers-masterplan/swarm && npm test -- src/server/tasks/tasks.test.ts`

Expected: FAIL because the production manifest is still the empty blocked seed.

- [ ] **Step 3: Import the planning projection and status roots**

Use IDs `F0`, `P1`–`P4`, `C1`–`C4`, `Q1`–`Q4`, `A1`–`A4`, `E1`–`E4`, `G1`–`G4`, and `X0`. Set all tasks to `kind: "planning"` and `promptTemplate: "planning"`, populate the exact reserved spec/plan/status paths from Section 9.3, and add `pathId`/`pathStep` metadata. Encode planned-contract prerequisites only; do not encode UI review order or a global layer barrier.

- [ ] **Step 4: Update stable coordinator documentation**

Record the optional metadata and future-output-path rule in the coordinator design, keep its existing no-product-impact finding, and update the README to state that the production manifest now exposes planning while execution and UI remain evidence-blocked.

- [ ] **Step 5: Verify the imported graph and documentation**

Run:

```bash
cd workers-masterplan/swarm
npm test -- src/server/tasks/tasks.test.ts src/shared/contracts.test.ts src/client/pages/FlowchartPage.test.tsx
npm run typecheck
npm run build
```

Also validate JSON parsing, exactly 26 unique planning IDs, six four-step domain paths, shared `F0`/`X0`, acyclicity, reserved path parity with the masterplan, no placeholder language, and `git diff --check`.

- [ ] **Step 6: Commit, reconcile, push, and prove readiness evidence**

Commit `docs(mvp3): import swarm planning topology`, fetch and merge newer `origin/main`, rerun affected checks, push, verify `HEAD` equals `origin/main`, and leave no owned dirty state.
