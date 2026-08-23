# Plan-First Execution and Live UI Design Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `blueprint-masterplan` complete and reconcile the whole planning set before ordinary execution while routing UI design through a separate live, presentation-only design worker.

**Architecture:** The skill will distinguish planning readiness from execution readiness and make a coordinator-owned `PLANNING_GATE.md` receipt the whole-blueprint execution authorization. A conditional UI-design mode will use dedicated prompt and receipt templates: it may edit real presentation surfaces before the gate, but it has no implementation plan and transfers ownership only after user-approved live-app evidence is integrated.

**Tech Stack:** Markdown Agent Skills, Markdown reference templates, YAML skill UI metadata, fresh-context behavioral evaluations, Claude Design repository instructions, `better-ui`, Git and static validation commands.

**Spec:** `workers-masterplan/docs/superpowers/specs/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design-design.md`

## Global Constraints

- Record and verify the RED behavior before changing any production skill instruction.
- Complete all execution-worker specifications and all non-UI implementation plans before ordinary execution begins.
- Use one coordinator-owned `docs/workers/<blueprint-id>/PLANNING_GATE.md`; `<blueprint-id>` is a literal skill-template placeholder.
- Planning dependencies consume approved authorities, briefs, specifications, and planned contracts; execution dependencies still consume implemented prerequisites on `origin/main`.
- Treat one worker's approved plan as necessary but insufficient execution authorization.
- Reopen the planning gate after a material scope, ownership, dependency, contract, acceptance, UI-approval, or plan change.
- Give every UI-design scope a separate worker loaded with `claude-design/codex/AGENTS.md`, `claude-design/codex/system-prompt.md`, relevant Claude Design procedures, and `.agents/skills/better-ui/SKILL.md`.
- The UI-design worker has no implementation plan and may change only presentation in the real app before the gate.
- Reuse existing components, tokens, typography, spacing, icons, motion, and interaction patterns.
- Keep the repository's established live development server available for iterative user feedback; alternatives remain optional, cheap, shared-component, and toggleable.
- Do not let pre-gate UI design create or change API, authorization, persistence, migration, domain, scoring, background-processing, or other business behavior.
- Transfer mutable UI ownership sequentially from design to implementation after the approved handoff is integrated.
- Preserve the existing main-only coexistence, focused-test cadence, final full-suite rule, product-specification synchronization, downstream propagation, completion, and cleanup contracts.
- Fixture mode is out of scope and unchanged. Do not edit fixture behavior, fixture authorities, fixture prompts, fixture acceptance, or fixture execution records.
- Preserve closed MVP2 delivery evidence while adding only the bounded note that
  its historical per-worker sequencing is not the current reusable workflow.
- Synchronize the current Product authority only when it still presents the
  disconnected `docs/design/claude/` package plus later live-wire owner as the
  current UI-design contract; do not change product behavior.
- Record evidence-backed no impact for the Business Masterplan, Product 2
  behavior, `living-masterplan`, application code, and fixture mode.

---

## Pre-execution planning authorization

No implementation task below may begin until this complete specification and
implementation plan are approved and reachable from `origin/main`.

- [ ] **Approve the specification and plan as one planning set**

Read both files end to end and confirm the plan covers every invariant,
evaluation, authority-sync, review, validation, and fixture no-impact requirement
in the specification:

```text
workers-masterplan/docs/superpowers/specs/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design-design.md
workers-masterplan/docs/superpowers/plans/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design.md
```

- [ ] **Commit and publish the approved planning set before Task 1**

After acquiring the repository's main-operation guard, reconciling clean owned
paths with `origin/main`, and preserving unrelated work, run:

```bash
git add workers-masterplan/docs/superpowers/specs/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design-design.md workers-masterplan/docs/superpowers/plans/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design.md
git commit -m "docs: plan plan-first live UI skill"
git push origin main
```

- [ ] **Prove remote planning authorization**

Run:

```bash
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
git status --short
```

Expected: the planning commit is an ancestor of `origin/main`; the two planning
paths are clean; unrelated user changes, if any, remain preserved and unstaged.

## File map

| Path | Responsibility |
| --- | --- |
| `workers-masterplan/evals/blueprint-masterplan-scenarios.md` | RED/GREEN pressure scenarios, observations, scoring, regression expectations, and static coverage |
| `workers-masterplan/blueprint-masterplan/SKILL.md` | Core planning barrier, readiness semantics, UI-design routing, gate reopening, verification, and stop rules |
| `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md` | Blueprint phase model, planning receipt path, worker artifact rules, execution prerequisites, and revision policy |
| `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md` | Ordinary planning and execution prompt contracts tied to the global receipt |
| `workers-masterplan/blueprint-masterplan/references/planning-gate-template.md` | Coordinator-owned whole-blueprint planning authorization template |
| `workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md` | Conditional live UI-design worker prompt and handoff contract |
| `workers-masterplan/blueprint-masterplan/references/worker-status-template.md` | Worker phase, planning evidence, global gate, UI review, and ownership-transfer status |
| `workers-masterplan/blueprint-masterplan/references/status-summary-template.md` | Coordinator planning manifest, gate state, contradictions, and reopening status |
| `workers-masterplan/blueprint-masterplan/agents/openai.yaml` | UI-facing description and default invocation aligned with the revised skill |
| `docs/plans/EdenMind_MVP2_Implementation_Masterplan.md` | Historical limitation note for the closed per-worker execution sequence |
| current Product specification masterplan | Removes a conflicting prototype-only UI delivery rule if it remains current after concurrent authority consolidation |

### Task 1: Record the failing planning-barrier and UI-design scenarios

**Files:**
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**
- Consumes: the approved design and the unmodified `blueprint-masterplan` skill.
- Produces: two pressure scenarios whose critical rubrics fail for the approved RED reasons and remain reusable for GREEN/REFACTOR testing.

- [ ] **Step 1: Add Scenario 11 for the whole-blueprint planning barrier**

Append this prompt and rubric before `Static contract coverage`:

```markdown
## Scenario 11 — Whole-blueprint planning barrier under deadline pressure

### Prompt

> Use `$blueprint-masterplan` for a four-worker launch. W1's API specification and implementation plan are approved on `origin/main`, but W2's client plan, W3's migration plan, and W4's hardening plan are unfinished. The CTO says W1 should start coding tonight because its own plan is ready and the other workers can finish planning tomorrow. Produce the readiness decision and launch instructions.

### Expected behavior

- **Critical:** Refuses to start W1 or any ordinary implementation while any required worker specification or non-UI implementation plan remains unfinished.
- **Critical:** Requires one coordinator-owned `docs/workers/<blueprint-id>/PLANNING_GATE.md` receipt, pinned to `origin/main`, before any execution prompt is launchable.
- Allows W2-W4 to plan against approved authorities, specifications, and planned contracts without waiting for predecessor implementation.
- Distinguishes planning readiness from execution readiness.
- Requires cross-plan contract, ownership, migration, generated-artifact, acceptance, living-authority, and downstream-document reconciliation before the planning gate passes.
- Keeps implemented hard prerequisites as additional per-worker execution dependencies after the global gate passes.
- Treats W1's individual approved plan as necessary but insufficient authorization.
```

The `<blueprint-id>` value above is an intentional literal template placeholder in the evaluated skill output.

- [ ] **Step 2: Add Scenario 12 for separate live UI design**

Append this prompt and rubric after Scenario 11:

```markdown
## Scenario 12 — Separate live UI-design worker

### Prompt

> Use `$blueprint-masterplan` for an educator dashboard whose API and approved product behavior are already specified. Leadership wants the dashboard implementation worker to explore a polished layout while wiring data, write the usual implementation plan, and send screenshots at the end. Instead, define the UI-design and implementation lifecycle. The repository has an existing component system and development server.

### Expected behavior

- **Critical:** Creates a separate UI-design worker instead of assigning visual exploration to the ordinary implementation worker.
- **Critical:** Requires complete reads of `claude-design/codex/AGENTS.md`, `claude-design/codex/system-prompt.md`, relevant `claude-design/codex/skills/` procedures, and `.agents/skills/better-ui/SKILL.md`.
- **Critical:** Gives the UI-design worker no implementation plan and makes accepted live app state, user approval, and a design handoff its planning-gate artifacts.
- Requires the worker to inspect and reuse existing components, tokens, typography, spacing, icons, motion, and interaction patterns.
- Requires direct editing of presentation-only real-app surfaces, an established live development server kept available for user feedback, early browser review, and iterative refinement.
- Allows a small toggleable set of cheap, substantive alternatives when it improves feedback; rejects duplicated full pages or a competing component system.
- Prohibits API, authorization, persistence, migration, domain, scoring, background-processing, and other business behavior in the pre-gate design lane.
- Transfers mutable UI ownership sequentially to the implementation worker only after the accepted handoff is integrated into `origin/main`.
- Requires the later UI implementation plan to consume the accepted design handoff and the execution prompt to consume the passed global planning receipt.
```

- [ ] **Step 3: Run both prompts against the unmodified skill in fresh contexts**

Use one clean evaluator context per prompt. Give the evaluator only the current
skill directory and the prompt. Keep the expected behavior and approved design
hidden.

Use these exact evaluator requests:

```text
Read /Users/bot3/Dev/EdenMind/workers-masterplan/blueprint-masterplan/SKILL.md and every reference it requires for this request. Then answer Scenario 11 exactly as if the user had invoked $blueprint-masterplan. Do not edit the repository.
```

```text
Read /Users/bot3/Dev/EdenMind/workers-masterplan/blueprint-masterplan/SKILL.md and every reference it requires for this request. Then answer Scenario 12 exactly as if the user had invoked $blueprint-masterplan. Do not edit the repository.
```

- [ ] **Step 4: Verify the RED failures and record them verbatim**

Scenario 11 must fail because the current skill authorizes W1's execution after
W1's own planning handoff even while W2-W4 remain unfinished. Scenario 12 must
fail because the current skill gives UI exploration the ordinary
specification-plan-execution lifecycle without the mandatory design sources,
live server, feedback loop, or presentation-only exception.

Record the evaluator's exact relevant sentences under `Observed pre-change
baseline` for each scenario. If either evaluator unexpectedly satisfies every
critical behavior, strengthen only that scenario's pressures and rerun it before
editing the skill.

- [ ] **Step 5: Review the RED evaluation change**

Check that each expected behavior is observable, that the rubric remains hidden
during evaluation, and that no item merely searches for a heading or phrase.
Confirm existing Scenarios 1-10 remain unchanged in this RED commit.

- [ ] **Step 6: Run the RED checkpoint checks**

Run:

```bash
git diff --check -- workers-masterplan/evals/blueprint-masterplan-scenarios.md
rg -n "Scenario 11|Scenario 12|Observed pre-change baseline|PLANNING_GATE|claude-design/codex/AGENTS.md|better-ui" workers-masterplan/evals/blueprint-masterplan-scenarios.md
git diff -- workers-masterplan/evals/blueprint-masterplan-scenarios.md
```

Expected: clean diff check; both scenarios, both observations, and every critical
contract are present; only the evaluation file changed.

- [ ] **Step 7: Commit and publish the RED checkpoint**

After acquiring the repository's main-operation guard, reconciling clean owned
paths with `origin/main`, and preserving unrelated work, run:

```bash
git add workers-masterplan/evals/blueprint-masterplan-scenarios.md
git commit -m "test: expose plan-first and live UI gaps"
git push origin main
```

Record the reachable `origin/main` commit in the evaluation status table.

### Task 2: Implement the core plan-first and live-design policy

**Files:**
- Modify: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Test: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**
- Consumes: the RED observations from Task 1 and the approved design.
- Produces: the normative global barrier, two readiness predicates, conditional UI-design lifecycle, and gate-reopening rule used by every template.

- [ ] **Step 1: Replace the per-worker execution authorization with the global barrier**

Add this binding contract near the overview, after the existing core principle:

```markdown
**GLOBAL PLANNING BARRIER:** Complete planning for the whole frozen blueprint before ordinary execution. No execution worker may begin product implementation until every execution worker's dated specification and every non-UI implementation plan, every required UI-design handoff, affected living-authority updates, and cross-plan reconciliation are approved, reachable from `origin/main`, and recorded in the coordinator-owned planning-gate receipt. A worker's own approved plan is necessary but never sufficient to start execution.
```

Update the required companion skills so ordinary execution workers retain
planning, TDD, review, and verification requirements, while UI-design workers
use the explicit design lifecycle added in Step 3.

- [ ] **Step 2: Split planning readiness from execution readiness**

Replace the single ambiguous readiness contract with these definitions:

```markdown
### Planning readiness

A worker is planning-ready when the frozen blueprint, its brief, relevant living authorities, and every approved planned contract required to make task decisions are available. Planning never waits for predecessor implementation merely because execution will depend on it.

### Execution readiness

A worker is execution-ready only when the coordinator-owned planning-gate receipt is passed at the named `origin/main` commit and every hard implemented prerequisite and required execution evidence for that worker is reachable from `origin/main`.

A planning-complete worker remains blocked from execution while the global planning gate is open. A passed global planning gate does not waive an unimplemented hard prerequisite.
```

Update the readiness table, quick reference, verification checklist, and stop
conditions to use these predicates consistently.

- [ ] **Step 3: Add the observable UI-design trigger and bounded exception**

Add a dedicated `Separate live UI design from implementation` section with this
core wording:

```markdown
UI design exists when work introduces or changes visual hierarchy, layout, component treatment, responsive behavior, motion, interaction states, or interface copy. Create a separate UI-design worker for each coherent affected surface. Pure implementation of an already accepted design is ordinary implementation and does not create another design worker.

The UI-design worker MUST read `claude-design/codex/AGENTS.md`, `claude-design/codex/system-prompt.md`, every relevant procedure under `claude-design/codex/skills/`, and `.agents/skills/better-ui/SKILL.md` completely before editing. It has no implementation plan. Its accepted real-app presentation state, user approval evidence, and design handoff replace that artifact in the planning-gate receipt.

The UI-design worker is the only pre-gate app-edit exception. It may edit composition, hierarchy, spacing, responsive arrangement, visual component variants, motion, interface copy, and interaction-state presentation in the actual application. It may not create or change API calls, authorization, persistence, migrations, domain rules, scoring, background processing, or other business behavior.

Before editing, inventory and reuse the repository's existing components, tokens, typography, spacing, icons, motion, and interaction patterns. Start the established live development server, publish its command and URL, keep it available through iterative user feedback, and verify the rendered application in a browser. When alternatives make feedback cheaper, use a small set of substantively different options in one temporary toggleable comparison surface backed by shared components. Remove rejected comparison-only code after approval unless the user explicitly accepts a development-only comparison control.

The design worker owns the named presentation files until its accepted handoff is integrated into `origin/main`. Transfer mutable ownership to the implementation worker only afterward; the two workers never edit the same mutable UI surface concurrently.
```

Route readers to the new UI-design prompt reference only when this observable
trigger is true.

- [ ] **Step 4: Define whole-blueprint planning and gate reopening**

Rewrite the worker planning section so all execution-worker planning occurs
before ordinary implementation. Preserve worker authorship of detailed specs and
plans. State that UI-related implementation planning is incomplete until it
consumes the accepted design handoff.

Add this reopening rule:

```markdown
A material change to frozen scope, ownership, dependency edges, contracts, acceptance, security/privacy behavior, an accepted UI design, or an implementation plan reopens the global planning gate. No new execution starts. Directly affected execution pauses at a safe checkpoint. The coordinator reauthorizes execution only after every affected artifact and living authority is current, the complete planning set is reconciled again, and a new passed receipt is reachable from `origin/main`. Already-running unrelated work continues only with an evidence-backed no-impact finding in the reopened receipt.
```

- [ ] **Step 5: Preserve authority synchronization and fixture exclusion**

Keep the existing rule that every new or modified dated task specification
synchronizes affected product specification masterplans in the same planning
substep or records evidence-backed no impact. Add accepted UI design to downstream
impact assessment only when it changes approved product behavior or a product
interaction contract.

Do not add or change fixture terminology. Do not edit any file outside the
blueprint skill package and its evaluation/design/plan records.

- [ ] **Step 6: Run focused GREEN static checks**

Run:

```bash
rg -n "GLOBAL PLANNING BARRIER|Planning readiness|Execution readiness|Separate live UI design|PLANNING_GATE|reopens the global planning gate|claude-design/codex/AGENTS.md|better-ui|live development server|sequential" workers-masterplan/blueprint-masterplan/SKILL.md
rg -n "Each worker.*after its prerequisites|execution prompt consumes.*those approved artifacts|Worker needs detailed steps.*after launch" workers-masterplan/blueprint-masterplan/SKILL.md
git diff --check -- workers-masterplan/blueprint-masterplan/SKILL.md
git diff -- workers-masterplan/blueprint-masterplan/SKILL.md
```

Expected: every new invariant is present; the obsolete per-worker authorization
phrases return no active matches; the diff is limited to the intended skill file.

- [ ] **Step 7: Request focused skill review**

Give a fresh reviewer the approved design, RED observations, and updated
`SKILL.md`. Ask it to report only contradictions, missing invariants, overly broad
authorization, and conflicts with existing main-only or authority-sync behavior.
Resolve every high-severity finding before continuing.

- [ ] **Step 8: Commit and publish the core policy checkpoint**

After safe main reconciliation, run:

```bash
git add workers-masterplan/blueprint-masterplan/SKILL.md
git commit -m "feat: require whole-blueprint planning"
git push origin main
```

### Task 3: Add the planning receipt and role-specific launch templates

**Files:**
- Create: `workers-masterplan/blueprint-masterplan/references/planning-gate-template.md`
- Create: `workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Test: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**
- Consumes: the normative policy from Task 2.
- Produces: exact coordinator receipt, conditional UI-design launch packet, and ordinary planning/execution prompts that cannot bypass the global gate.

- [ ] **Step 1: Create the coordinator-owned planning-gate template**

Create `planning-gate-template.md` with an explanation that the coordinator alone
edits `docs/workers/<blueprint-id>/PLANNING_GATE.md`. Use the following literal
template placeholders in its fenced template: `<blueprint-id>`,
`<blueprint-path>`, `<origin-main-commit>`, `<coordinator>`, `<timestamp>`,
`<worker-id>`, `<spec-path-and-commit>`, `<plan-path-and-commit>`,
`<authority-sync-evidence>`, `<reconciliation-result>`, `<design-worker-id>`,
`<accepted-app-commit>`, `<approval-evidence>`, `<handoff-path>`,
`<implementation-owner>`, `<contradiction>`, `<owner>`, and
`<unblock-criterion>`.

The template must contain:

```markdown
| Field | Value |
| --- | --- |
| Gate state | open / passed / reopened |
| Blueprint | `<blueprint-path>` |
| Blueprint ID | `<blueprint-id>` |
| Authorized `origin/main` commit | `<origin-main-commit>` |
| Coordinator | `<coordinator>` |
| Approval timestamp | `<timestamp>` |

## Execution-worker planning set

| Worker | Specification and commit | Implementation plan and commit | Approval | Living-authority synchronization | Cross-plan reconciliation |
| --- | --- | --- | --- | --- | --- |
| `<worker-id>` | `<spec-path-and-commit>` | `<plan-path-and-commit>` | approved / pending | `<authority-sync-evidence>` | `<reconciliation-result>` |

## UI-design handoffs

| Design worker | Accepted app commit | User approval | Handoff | Live review complete | Ownership transfers to |
| --- | --- | --- | --- | --- | --- |
| `<design-worker-id>` | `<accepted-app-commit>` | `<approval-evidence>` | `<handoff-path>` | yes / no | `<implementation-owner>` |

## Unresolved contradictions

| Contradiction | Owner | Unblock criterion |
| --- | --- | --- |
| `<contradiction>` | `<owner>` | `<unblock-criterion>` |
```

State below the template that the gate cannot pass with a pending row or
unresolved contradiction; only a UI-design row may use `not applicable` for an
implementation plan; and every execution prompt verifies the receipt and pinned
commit.

- [ ] **Step 2: Create the UI-design worker prompt template**

Create `ui-design-worker-prompt-template.md` with an assembly checklist and one
fenced prompt. The prompt uses these literal template placeholders:
`<BLUEPRINT_PATH>`, `<LIVING_MASTERPLAN_PATH>`, `<DESIGN_WORKER_ID>`,
`<BOUNDED_UI_SURFACE>`, `<OWNED_PRESENTATION_SURFACES>`,
`<EXCLUDED_FUNCTIONAL_SURFACES>`, `<MAIN_CHECKOUT_PATH>`, `<STATUS_PATH>`,
`<DESIGN_HANDOFF_PATH>`, `<IMPLEMENTATION_WORKER_ID>`, and
`<ESTABLISHED_DEV_SERVER_COMMAND>`.

Require, in this order:

1. read the blueprint, authorities, UI brief, existing app, and existing design system;
2. load all mandatory Claude Design and `better-ui` sources;
3. stay within named presentation ownership and preserve functional boundaries;
4. edit the actual app with existing components and tokens;
5. run `<ESTABLISHED_DEV_SERVER_COMMAND>`, publish the URL, and keep the server available;
6. show a skeleton early and iterate from user feedback;
7. optionally provide cheap substantive alternatives through one toggleable surface;
8. browser-verify applicable wide, narrow, interaction, keyboard/focus, and reduced-motion states;
9. obtain explicit user approval;
10. remove rejected comparison-only code unless explicitly retained;
11. integrate the accepted app state and handoff into `origin/main`; and
12. transfer ownership to `<IMPLEMENTATION_WORKER_ID>`.

The terminal condition must say that this worker never writes an implementation
plan and stops only after accepted design evidence is integrated or a named
functional decision returns to planning.

- [ ] **Step 3: Add the phase model and receipt to the blueprint template**

In `blueprint-masterplan-template.md`:

- add `Planning-gate receipt` with
  `docs/workers/<blueprint-id>/PLANNING_GATE.md` to the metadata table;
- replace per-worker post-prerequisite planning language with planning-ready and
  execution-ready definitions;
- add a pre-execution phase section covering conditional UI design, the complete
  planning set, reconciliation, and gate approval;
- make the planning gate a hard prerequisite for every execution node without
  replacing its implemented DAG edges;
- add UI-design handoff and ownership-transfer fields to worker packages;
- require ordinary execution prompts to name the passed receipt and commit; and
- reopen the gate in the revision policy after every material change.

Do not add UI-design workers to blueprints with no visual-design trigger.

- [ ] **Step 4: Update ordinary planning and execution prompts**

In `worker-prompt-templates.md`, change the planning terminal condition to:

```markdown
This worker's planning handoff is complete only when its approved specification, non-UI implementation plan, authority synchronization, downstream propagation, and cross-plan inputs are reachable from `origin/main`. This handoff does not authorize execution. Ordinary implementation remains prohibited until the coordinator publishes a passed whole-blueprint planning-gate receipt.
```

Add `<PLANNING_GATE_PATH>` and `<PLANNING_GATE_COMMIT>` as literal execution
template placeholders. Make the execution prompt verify both before editing and
stop when the receipt is open, reopened, stale, missing the worker row, or pinned
to a different commit.

Route UI-design work to `ui-design-worker-prompt-template.md`; do not adapt the
ordinary implementation prompt for that role.

- [ ] **Step 5: Run reference and parity checks**

Run:

```bash
rg -n "PLANNING_GATE|planning-ready|execution-ready|UI-design|ownership transfer" workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md workers-masterplan/blueprint-masterplan/references/planning-gate-template.md workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md
rg -n "planning-gate-template.md|ui-design-worker-prompt-template.md" workers-masterplan/blueprint-masterplan/SKILL.md
git diff --check -- workers-masterplan/blueprint-masterplan/references
git diff -- workers-masterplan/blueprint-masterplan/references
```

Expected: template fields and terminal conditions agree, both new references are
linked from the skill in the applicable mode, and no prompt permits an individual
planning handoff to start execution.

- [ ] **Step 6: Review template usability and authority boundaries**

Use a fresh reviewer to instantiate each template mentally for Scenario 11 and
Scenario 12. Require it to identify missing required fields, mismatched literal
placeholders, unbounded pre-gate authorization, shared UI ownership, or a prompt
that cannot reach its terminal condition. Correct every high-severity issue.

- [ ] **Step 7: Commit and publish the template checkpoint**

After safe main reconciliation, run:

```bash
git add workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md workers-masterplan/blueprint-masterplan/references/planning-gate-template.md workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md
git commit -m "feat: add planning gate and live design prompts"
git push origin main
```

### Task 4: Align status, metadata, regression rubrics, and authority coverage

**Files:**
- Modify: `workers-masterplan/blueprint-masterplan/references/worker-status-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/status-summary-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/agents/openai.yaml`
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**
- Consumes: the policy and templates from Tasks 2-3.
- Produces: observable status fields, discoverable UI metadata, updated regression expectations, and complete static contract coverage.

- [ ] **Step 1: Add worker phase and planning evidence**

In `worker-status-template.md`, add fields for:

- `Phase`: `ui-design`, `planning`, or `execution`;
- `Worker planning state`: `pending`, `approved`, `reopened`, or `not applicable`;
- `Global planning gate`: `open`, `passed`, or `reopened` plus receipt path and commit;
- `UI-design live review`: server command, URL, last reviewed app commit, user approval, and handoff path; and
- `Mutable ownership transfer`: current owner, next owner, handoff commit, and transfer state.

In the final handoff, permit `Implementation plan: not applicable — UI-design
worker` only when accepted app commit, approval, and design handoff are present.

- [ ] **Step 2: Add coordinator planning status and reopening evidence**

In `status-summary-template.md`, add:

- a planning-gate summary with receipt path, state, pinned commit, coordinator,
  and approval time;
- a complete worker planning manifest;
- a UI-design acceptance and ownership-transfer table;
- unresolved cross-plan contradictions;
- missing or stale authority synchronization; and
- gate-reopening cause, affected workers, no-impact findings, and required
  reauthorization.

Keep execution readiness separate from planning completion in the dependency
table.

- [ ] **Step 3: Update UI metadata without changing discovery policy**

Set `agents/openai.yaml` to exactly:

```yaml
interface:
  display_name: "Blueprint Masterplan"
  short_description: "Plan-first worker DAGs with live UI design"
  default_prompt: "Use $blueprint-masterplan to build a whole-blueprint planning gate and a collision-safe execution DAG, with a separate live UI-design worker when visual design is in scope."
```

Do not add an explicit-only invocation policy or dependencies.

- [ ] **Step 4: Update existing scenario expectations that conflict with the new policy**

Amend only these expectations:

- Scenario 1: require separate UI-design ownership for the portal's visual
  design and a global planning gate before implementation.
- Scenario 5: require every execution prompt to verify the whole-blueprint
  receipt; the individual planning prompt still stops at its own handoff.
- Scenario 6: split “complete UI” visual design from implementation and preserve
  moderate execution-DAG width reporting.
- Scenario 8: retain worker-authored detailed plans but require all six workers'
  planning artifacts before any execution launch.
- Scenario 9: keep same-substep product-specification synchronization and add
  that W3 cannot execute until the entire blueprint planning gate passes.

Do not weaken any existing main-only, remote-evidence, cleanup, artifact-root,
product-specification, or final-verification requirement.

- [ ] **Step 5: Add new static contract coverage rows**

Add rows for:

- whole-blueprint planning barrier;
- coordinator-owned planning-gate receipt;
- planning versus execution dependency semantics;
- material-change gate reopening;
- separate UI-design trigger and no-plan exception;
- mandatory Claude Design and `better-ui` loading;
- real-app presentation-only live feedback;
- optional cheap toggleable alternatives; and
- sequential UI ownership transfer.

- [ ] **Step 6: Record authority synchronization and fixture no-impact**

In the implementation notes for the scenarios, state that the existing
same-substep product-specification synchronization contract is preserved and
that `living-masterplan` requires no edit. Record an evidence-backed no-impact
finding for fixture mode because this skill-policy change neither changes nor
routes fixture behavior.

- [ ] **Step 7: Run status, metadata, and regression static checks**

Run:

```bash
rg -n "Phase|Worker planning state|Global planning gate|UI-design live review|Mutable ownership transfer" workers-masterplan/blueprint-masterplan/references/worker-status-template.md
rg -n "planning-gate|planning manifest|UI-design|reopened|no-impact" workers-masterplan/blueprint-masterplan/references/status-summary-template.md
rg -n "Plan-first worker DAGs with live UI design|whole-blueprint planning gate" workers-masterplan/blueprint-masterplan/agents/openai.yaml
rg -n "whole-blueprint planning barrier|planning-gate receipt|planning versus execution|gate reopening|Claude Design|toggleable|ownership transfer" workers-masterplan/evals/blueprint-masterplan-scenarios.md
git diff --check -- workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md
```

- [ ] **Step 8: Review and commit the aligned contract**

Review the full skill/template/status/eval diff for contradictory terminal
conditions and unintended fixture or frozen-masterplan edits. Then, after safe
main reconciliation, run:

```bash
git add workers-masterplan/blueprint-masterplan/references/worker-status-template.md workers-masterplan/blueprint-masterplan/references/status-summary-template.md workers-masterplan/blueprint-masterplan/agents/openai.yaml workers-masterplan/evals/blueprint-masterplan-scenarios.md
git commit -m "docs: align planning and live design evidence"
git push origin main
```

### Task 5: Synchronize the affected project authorities

**Files:**
- Modify: `docs/plans/EdenMind_MVP2_Implementation_Masterplan.md`
- Modify when the conflicting paragraph remains current: the current Product specification masterplan selected from repository state
- Verify only: `docs/plans/EdenMind_Business_Masterplan.md`
- Verify only: the Product 2 scope in the current Product specification authority

**Interfaces:**
- Consumes: the approved generic workflow and the repository's current post-consolidation authority topology.
- Produces: no simultaneously-current project instruction that authorizes the superseded per-worker or disconnected-prototype workflow.

- [ ] **Step 1: Reconcile with concurrent authority work before editing**

Fetch `origin/main`, inspect `git status`, and identify the current Product
specification authority. Preserve every unrelated uncommitted change. If the
legacy Product 1 and Product 2 files have been replaced by an integrated combined
authority, edit only that current file after its owning change is committed and
reachable from `origin/main`.

- [ ] **Step 2: Record the closed-MVP2 limitation**

Add a concise post-closure process note near the MVP2 metadata or lifecycle:

```markdown
The per-worker planning-to-execution sequence below records how this closed MVP2 blueprint was delivered. It is not the reusable workflow for new or reopened execution. Future blueprints complete and reconcile the whole planning set, including accepted live UI-design handoffs, before ordinary implementation begins under the current `blueprint-masterplan` skill.
```

Do not rewrite the historical graph, worker states, receipts, fixture/live
evidence, or completion claims.

- [ ] **Step 3: Remove any still-current prototype-only UI delivery conflict**

Search the current Product specification authority for a rule that requires one
repository-wide Claude package under `docs/design/claude/` followed by separate
live wiring. If present, replace only that delivery paragraph with a product-level
statement that accepted visual design is reviewed in the live real application,
reuses the existing design system, remains subordinate to functional/access/
privacy/reliability/content-order rules, and does not itself authorize new
business behavior. Do not add worker status, planning-gate mechanics, or model
selection policy to the product specification.

- [ ] **Step 4: Record no-impact findings**

In the implementation-plan completion notes, record that the Business Masterplan
and Product 2 behavior do not define worker scheduling or UI-design delivery, and
that fixture mode remains unchanged. Do not edit those authorities merely to add
delivery history.

- [ ] **Step 5: Verify and publish the authority checkpoint**

Run:

```bash
rg -n "historical|reusable workflow|whole planning set|live real application|docs/design/claude" docs/plans/EdenMind_MVP2_Implementation_Masterplan.md docs/plans/EdenMind_Product*_Masterplan.md
git diff --check -- docs/plans
git diff -- docs/plans/EdenMind_MVP2_Implementation_Masterplan.md docs/plans/EdenMind_Product*_Masterplan.md
```

Expected: the closed MVP2 history is preserved; no current Product authority
requires the conflicting disconnected-prototype workflow; no fixture or product
behavior changed. Stage only the exact authority files edited, commit with
`docs: align plan-first UI authority`, reconcile `origin/main`, and push.

### Task 6: Run GREEN evaluation and REFACTOR against new rationalizations

**Files:**
- Modify if test evidence requires correction: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Modify if test evidence requires correction: `workers-masterplan/blueprint-masterplan/references/planning-gate-template.md`
- Modify if test evidence requires correction: `workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md`
- Modify if test evidence requires correction: `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- Modify if test evidence requires correction: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**
- Consumes: updated skill package, original hidden Scenario 11-12 rubrics, and RED observations.
- Produces: fresh behavioral evidence, minimal rationalization counters, and converged GREEN results.

- [ ] **Step 1: Micro-test the global-barrier wording**

Run at least five fresh-context samples of the deadline prompt with the complete
updated skill context. Run at least five no-guidance control samples with the
same prompt and ordinary agent instructions. Manually read every response.

Score only these decisions:

- whether W1 starts before the complete planning set;
- whether a global receipt is required;
- whether planning can use approved contracts before implementation; and
- whether implemented prerequisites still gate execution.

If candidate responses vary, revise the smallest responsible positive contract
or explicit prohibition and repeat both candidate and control samples.

- [ ] **Step 2: Micro-test the UI-design role contract**

Run at least five fresh-context samples of the dashboard prompt with the complete
updated skill context and at least five no-guidance controls. Manually score:

- separate design worker;
- mandatory source loading;
- no implementation plan;
- real-app presentation-only edits;
- live server and user iteration;
- optional toggleable alternatives;
- functional exclusions; and
- sequential ownership transfer.

Revise only wording supported by an observed failure.

- [ ] **Step 3: Run full GREEN Scenario 11 and Scenario 12 evaluations**

Use the exact prompts from Task 1 in new evaluator contexts. Keep the rubrics,
RED observations, and intended answers hidden. Score each expected behavior as
`0`, `1`, or `2` using the existing evaluation rules.

Both scenarios must reach at least 90 percent with no zero on a critical
behavior. Record exact post-change observations and evaluation date.

- [ ] **Step 4: Run regression scenarios**

Rerun Scenarios 1, 2, 5, 6, 8, 9, and 10 in fresh contexts. Confirm:

- UI work routes through a separate design lane only when visual design exists;
- global planning does not reintroduce artificial execution-DAG edges;
- main-only coexistence and remote readiness remain intact;
- artifact roots and worker authorship remain intact;
- product specifications still synchronize in the same planning substep; and
- branch/worktree, completion, and cleanup pressure remains safely handled.

- [ ] **Step 5: REFACTOR only observed loopholes**

For every failed or ambiguous behavior, record the agent's exact rationalization.
Classify it as a discipline failure, wrong output shape, omitted required field,
or conditional-routing failure. Apply the matching minimal correction:

- prohibition plus rationalization counter for knowingly starting early;
- positive receipt or prompt shape for structural omissions;
- required template field for missing evidence; or
- observable UI-design predicate for routing ambiguity.

Rerun the failed micro-test set and full scenario until the behavior converges.
Do not add hypothetical rules unsupported by test evidence.

- [ ] **Step 6: Review the behavioral evidence**

Have an independent reviewer compare RED and GREEN outputs without seeing the
implementation diff. Require a verdict on whether behavior changed for the
intended reason and whether the new UI exception authorizes functional work.
Resolve every high-severity concern and rerun the affected scenario.

- [ ] **Step 7: Commit and publish evaluation-driven corrections**

After safe main reconciliation, stage only files changed by observed test
evidence:

```bash
git add workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md
git commit -m "test: verify plan-first live UI workflow"
git push origin main
```

If no correction beyond evaluation observations was required, stage and commit
only `workers-masterplan/evals/blueprint-masterplan-scenarios.md`.

### Task 7: Validate, review, and publish completion evidence

**Files:**
- Verify: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Verify: `workers-masterplan/blueprint-masterplan/agents/openai.yaml`
- Verify: all files under `workers-masterplan/blueprint-masterplan/references/`
- Verify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`
- Verify: `workers-masterplan/docs/superpowers/specs/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design-design.md`
- Verify: `workers-masterplan/docs/superpowers/plans/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design.md`
- Verify: the bounded MVP2 and current Product authority updates from Task 5

**Interfaces:**
- Consumes: the behaviorally verified skill package and all review evidence.
- Produces: validated repository state, complete authority/no-impact evidence, and an exact completion report.

- [ ] **Step 1: Run the skill-package validator**

Run:

```bash
python3 /Users/bot3/.codex/skills/.system/skill-creator/scripts/quick_validate.py workers-masterplan/blueprint-masterplan
```

Expected: `Skill is valid!`

- [ ] **Step 2: Validate local Markdown links**

Run this read-only checker:

```bash
ruby -e 'Dir["workers-masterplan/blueprint-masterplan/**/*.md"].each { |f| File.read(f).scan(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/).flatten.each { |p| next if p =~ %r{\A(?:https?:|/)}; q = File.expand_path(p, File.dirname(f)); abort("missing link: #{f} -> #{p}") unless File.exist?(q) } }; puts "local links: ok"'
```

Expected: `local links: ok`

- [ ] **Step 3: Validate fences, headings, and placeholders**

Run:

```bash
ruby -e 'Dir["workers-masterplan/blueprint-masterplan/**/*.md", "workers-masterplan/evals/blueprint-masterplan-scenarios.md"].each { |f| n = File.readlines(f).count { |l| l.start_with?("```") }; abort("odd fence count: #{f}") if n.odd? }; puts "fences: ok"'
ruby -e 'Dir["workers-masterplan/blueprint-masterplan/**/*.md"].each { |f| inside = false; h = []; File.foreach(f) { |l| if l.start_with?("```"); inside = !inside; next; end; h << l.strip if !inside && l.match?(/^\#{1,6} /) }; d = h.group_by(&:itself).select { |_k,v| v.size > 1 }; abort("duplicate headings: #{f}: #{d.keys.join(", ")}") unless d.empty? }; puts "headings: ok"'
rg -n "T[B]D|T[O]DO|implement la[t]er|fill in deta[i]ls" workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md workers-masterplan/docs/superpowers/specs/2026-08-23-plan-first-live-ui-design workers-masterplan/docs/superpowers/plans/2026-08-23-plan-first-live-ui-design
```

Expected: fence and heading checks print `ok`; the placeholder scan returns no
matches. Literal angle-bracket fields inside reference templates are permitted
only where the surrounding text identifies them as template placeholders.

- [ ] **Step 4: Verify invariant parity and obsolete authorization removal**

Run:

```bash
rg -n "GLOBAL PLANNING BARRIER|PLANNING_GATE|planning-ready|execution-ready|reopened|UI-design worker|claude-design/codex/AGENTS.md|better-ui|live development server|presentation|ownership transfer" workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md
rg -n "own approved artifacts.*continues through implementation|worker authors its own spec and plan after launch|after its prerequisites are integrated" workers-masterplan/blueprint-masterplan
```

Expected: required invariants appear in every responsible skill/template/prompt/
status/eval surface; obsolete individual-launch authorization returns no active
matches.

- [ ] **Step 5: Verify authority and fixture no-impact**

Run:

```bash
plan_first_root=$(git rev-parse "$(git log --format=%H --grep='^docs: plan plan-first live UI skill$' -1)^")
git diff --name-only "$plan_first_root"..HEAD -- workers-masterplan/living-masterplan docs/plans docs/superpowers/specs docs/superpowers/plans | rg -v '^workers-masterplan/docs/superpowers/(specs|plans)/2026-08-23-plan-first-live-ui-design/'
git diff "$plan_first_root"..HEAD -- workers-masterplan/blueprint-masterplan | rg -n -i "fixture mode|fixture-mode|fixture provider|fixture gate"
```

Expected: no modified `living-masterplan`, frozen project masterplan, application
specification, or unrelated plan file; no fixture behavior change. The only new
design/plan records are the two authoritative files for this change.

- [ ] **Step 6: Run final diff and repository checks**

Run:

```bash
plan_first_root=$(git rev-parse "$(git log --format=%H --grep='^docs: plan plan-first live UI skill$' -1)^")
git diff --check "$plan_first_root"..HEAD -- workers-masterplan
git status --short
git diff --stat "$plan_first_root"..HEAD -- workers-masterplan
git diff "$plan_first_root"..HEAD -- workers-masterplan
```

Review every changed line. Confirm no unrelated user change is staged or included.

- [ ] **Step 7: Obtain final specification and skill-quality reviews**

Run two independent read-only reviews:

1. specification compliance against the approved design, including all ten core
   invariants and fixture no-impact; and
2. skill quality against the RED/GREEN/REFACTOR evidence, progressive disclosure,
   conditional reference routing, template usability, and authorization bounds.

Resolve every high-severity finding and rerun the affected validation and
behavioral scenarios.

- [ ] **Step 8: Commit and publish final corrections when needed**

If validation or review changed files, after safe main reconciliation run:

```bash
git add workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md workers-masterplan/docs/superpowers/specs/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design-design.md workers-masterplan/docs/superpowers/plans/2026-08-23-plan-first-live-ui-design/2026-08-23-plan-first-live-ui-design.md
git commit -m "docs: finalize plan-first live UI skill"
git push origin main
```

Do not create an empty commit when validation produces no correction.

- [ ] **Step 9: Report completion evidence**

Report:

- exact changed and created paths;
- RED observations and GREEN scores;
- wording micro-test sample counts and convergence;
- regression scenario results;
- skill validator and static-check outputs;
- review verdicts and resolved findings;
- authority synchronization and fixture no-impact evidence;
- every checkpoint commit reachable from `origin/main`;
- repository divergence and preserved unrelated changes; and
- whether any external publication beyond `origin/main` occurred.

Do not claim completion from static text searches alone.
