# Plan-First Execution and Live UI Design Skill Design

## Purpose

Revise `blueprint-masterplan` so a delivery effort completes and reconciles the
entire planning set before ordinary implementation begins. UI design is a
separate, live, presentation-only design lane that may edit the real app before
the planning gate without becoming an unplanned implementation lane.

The result has one coordinator-owned planning authorization, explicit planning
and execution dependency semantics, and a collision-safe handoff from accepted
UI design to later implementation.

## Scope

This change updates the generic `blueprint-masterplan` skill, its directly used
reference templates and UI metadata, and its behavioral evaluation suite. It
also performs the smallest coherent authority synchronization: the closed MVP2
blueprint records that its per-worker sequencing is historical rather than a
current reusable workflow, and the current Product authority must not retain a
simultaneously-current prototype-only UI handoff rule that contradicts live
real-app design. It does not revise `living-masterplan`, application code, or
fixture behavior.

Fixture mode is explicitly out of scope and unchanged. Nothing in this design
creates, removes, reclassifies, or changes a fixture-mode worker, gate,
acceptance rule, provider, command, or environment.

## RED baseline evidence

The current skill teaches an individual worker lifecycle rather than a
whole-blueprint planning barrier:

- a worker plans after its own prerequisites are integrated;
- that worker's execution prompt consumes its own approved specification and
  implementation plan; and
- no coordinator-owned artifact proves that every other worker's planning is
  also complete.

Under a deadline scenario where W1's plan is approved while W2-W4 remain
unfinished, the current contract would launch W1 instead of waiting for the
complete planning set.

The current skill also gives every worker the same specification-plan-execution
lifecycle. A UI exploration therefore receives a normal implementation plan,
with no mandatory loading of Claude Design and `better-ui`, no required live
server, no user-feedback loop, and no presentation-only boundary.

These are the two required failing behaviors for the RED evaluation. The
evaluation file must record them before any production skill instruction is
changed.

## Core invariants

1. All execution-worker specifications and all non-UI implementation plans are
   approved, reconciled, integrated into `origin/main`, and listed in one
   coordinator-owned `PLANNING_GATE.md` receipt before ordinary execution begins.
2. One worker's approved plan is necessary but never sufficient execution
   authorization.
3. Planning dependencies use approved authorities, briefs, and planned
   contracts. They do not require predecessor implementation to exist.
4. Execution dependencies still require implemented prerequisites and their
   evidence on `origin/main`.
5. A material change to scope, ownership, dependencies, contracts, acceptance,
   UI approval, or an execution plan reopens the planning gate.
6. UI design always belongs to a separate design worker when a package introduces
   or changes visual hierarchy, layout, component treatment, responsive
   behavior, motion, interaction states, or interface copy.
7. Pure implementation of an already accepted UI design does not create another
   UI-design lane.
8. The UI-design worker has no implementation plan. Its accepted live app state,
   approval evidence, and design handoff are its planning-gate artifacts.
9. The UI-design worker may edit only presentation behavior before the gate.
   API, authorization, persistence, migration, domain, and other business
   behavior remain gated implementation work.
10. Mutable UI ownership transfers sequentially from the design worker to the
    implementation worker after the accepted design handoff is integrated.

## Delivery phase model

### Phase 1: Freeze the blueprint

The coordinator establishes authorities, the bounded objective, worker briefs,
single-owner mutable surfaces, execution DAG, gates, reserved artifact paths,
and the coordinator-owned planning-gate path.

The execution DAG remains the model for implemented prerequisites. Planning
readiness is calculated separately so downstream workers can plan against
approved contracts before predecessor code is written.

### Phase 2: Produce the complete planning set

Each ordinary execution worker authors its dated specification and implementation
plan. Workers synchronize approved product changes
into affected product specification masterplans and propagate changes into
affected downstream planning artifacts through their owners.

Independent planning may run concurrently. Planning that consumes a contract
waits for the approved contract or specification, not its implementation.

UI-design work runs in this phase under the bounded exception below. UI-related
implementation planning may begin from approved functional authorities, but it
cannot become planning-complete until it consumes the accepted design handoff.

### Phase 3: Reconcile and authorize

The coordinator reviews the entire planning set together. Reconciliation checks:

- every worker brief has the required specification and non-UI plan;
- planned interfaces agree across producers and consumers;
- shared mutable surfaces still have one owner at a time;
- migration, generated-artifact, central-composition, and integration ordering
  are explicit;
- accepted UI design is reflected in every affected implementation plan;
- affected living authorities and downstream documents are current;
- all required approvals and review evidence are reachable from `origin/main`;
  and
- no material decision or cross-plan contradiction remains.

The coordinator then writes `docs/workers/<blueprint-id>/PLANNING_GATE.md`, using
the literal template path placeholder `<blueprint-id>`. The receipt pins one
`origin/main` commit and contains a row for every execution worker and UI-design
handoff. The receipt is the only whole-blueprint planning authorization.

### Phase 4: Execute the approved DAG

Every execution prompt names the approved planning-gate receipt and pinned
commit. Before editing, the worker verifies that receipt is current and that its
implemented hard prerequisites are reachable from `origin/main`.

Execution proceeds according to the existing collision-safe main-only lifecycle,
focused verification cadence, review, final full-suite rule, handoff, and remote
evidence requirements.

## Planning-gate receipt contract

The coordinator owns `PLANNING_GATE.md`; workers never edit it. It contains:

- blueprint ID and blueprint path;
- gate state: `open`, `passed`, or `reopened`;
- the exact inspected and authorized `origin/main` commit;
- coordinator and approval timestamp;
- one row per execution worker containing specification path and commit,
  implementation-plan path and commit, approval state, living-authority
  synchronization, and cross-plan reconciliation result;
- one row per UI-design worker containing accepted app-state commit, approval
  evidence, handoff path, live-review completion, and sequential ownership
  transfer target;
- unresolved contradictions, each with owner and unblock criterion;
- verification and review evidence; and
- the material-change rule that invalidates the receipt.

The gate passes only when every required row is complete. `not applicable` is
valid only for the UI-design worker's implementation-plan field and must be
paired with the accepted design artifacts.

## Planning and execution readiness

The skill must define two independent predicates:

- **Planning-ready:** the frozen blueprint, worker brief, relevant living
  authorities, and approved planned contracts needed to make task decisions are
  available. Implemented predecessor code is not required.
- **Execution-ready:** the global planning gate is passed at the named
  `origin/main` commit and every hard implementation prerequisite for that
  worker is integrated with required evidence.

A planning-complete worker remains blocked from execution while the global gate
is open. A passed global gate does not make a worker execution-ready when a hard
implementation prerequisite is still absent.

## Material changes and gate reopening

A material change is any approved change to blueprint scope, ownership,
dependency edges, contracts, acceptance, security/privacy behavior, an accepted
UI design, or an implementation plan that can invalidate another worker's plan.

When one occurs:

1. the coordinator changes the planning receipt to `reopened`;
2. no new execution worker starts;
3. directly affected execution pauses at a safe checkpoint;
4. every affected specification, plan, UI handoff, prompt, living authority,
   and status is updated through its owner;
5. the complete planning set is reconciled again; and
6. the coordinator issues a new passed receipt pinned to the updated
   `origin/main` commit.

Already-running unrelated execution may continue only after an evidence-backed
no-impact finding is recorded in the reopened receipt.

## Separate live UI-design worker

### Trigger and loading contract

Create one separate UI-design worker for each coherent UI surface that introduces
or changes visual design. Its launch prompt requires complete reads of:

- `claude-design/codex/AGENTS.md`;
- `claude-design/codex/system-prompt.md`;
- each relevant procedure under `claude-design/codex/skills/`; and
- `.agents/skills/better-ui/SKILL.md`.

The worker reads linked supporting references required by those instructions.
It may load additional applicable accessibility, layout, typography, color, or
writing skills, but these do not replace the two mandatory design sources.

### Real-app, presentation-only work

The worker edits the actual application surface, not a disconnected prototype.
Before editing, it inventories existing design-system components, tokens,
typography, spacing, icons, motion, and nearby interaction patterns. It reuses
those foundations and creates no competing component library or token system.

The pre-gate exception covers only presentation: composition, hierarchy,
spacing, responsive arrangement, visual component variants, motion, interface
copy, and interaction-state presentation. It does not authorize new or changed
API calls, authorization, persistence, migrations, domain rules, scoring,
background processing, or other business behavior. A discovered functional need
returns to the ordinary specification and planning process.

The UI-design worker writes no implementation plan. It maintains its status and
design handoff and integrates only the accepted presentation state.

### Live feedback loop

The worker starts the repository's established development server, records the
exact command and URL, and keeps the server session available while the user
reviews. It shows a working skeleton early, receives user feedback, edits the
real app, browser-verifies the result, and repeats until the user approves or a
material product decision blocks design.

Alternative versions are optional. When alternatives will make feedback cheaper,
the worker exposes a small set of substantively different options through one
temporary toggleable comparison surface backed by shared components. It avoids
duplicated full pages or independent component systems. After approval, it
removes rejected comparison-only code unless the user explicitly accepts
retaining a development-only comparison control.

### Acceptance and ownership transfer

The UI-design handoff contains:

- accepted app-state commit reachable from `origin/main`;
- user approval evidence;
- affected routes/components and reused design-system foundations;
- verified wide, narrow, interaction, keyboard/focus, and reduced-motion states
  applicable to the surface;
- the development-server command and reviewed URL;
- retained limitations and functional decisions returned to planning; and
- the implementation worker that receives mutable ownership.

The design worker owns the named presentation files until this handoff is
integrated. The implementation worker receives them only afterward. Both workers
must never edit the same mutable UI surface concurrently.

## Artifact and prompt changes

The generic skill package will add:

- `workers-masterplan/blueprint-masterplan/references/planning-gate-template.md`;
  and
- `workers-masterplan/blueprint-masterplan/references/ui-design-worker-prompt-template.md`.

The existing blueprint template, planning/execution prompt templates, worker
status, coordinator status, skill body, UI metadata, and evaluation scenarios
will route to and enforce those new conditional references.

The existing skill trigger description remains correct because it already
targets worker decomposition, readiness rules, gates, and phase-specific launch
prompts. UI metadata may be revised so the default invocation demonstrates the
plan-first and live-design modes without summarizing them in frontmatter.

## Authority synchronization

The current product-specification synchronization rule remains in force for all
new or changed dated specifications. Accepted UI design that changes approved
product behavior or a product-level interaction contract must update the affected
product specification masterplan and downstream planning artifacts before the
planning gate passes. Purely visual evidence does not become product behavior or
delivery-status history in a product specification masterplan.

No change to `living-masterplan`, the Business Masterplan, or Product 2 behavior
is required. The blueprint skill consumes the existing approved-only,
same-substep synchronization contract. The MVP2 Implementation Masterplan keeps
its closed execution history but records that its per-worker sequencing must not
be copied into new or reopened work. The current Product authority replaces any
still-current requirement for a disconnected `docs/design/claude/` package and
later live-wire owner with the accepted live real-app design boundary, without
changing product behavior.

## Validation contract

The change is complete only after:

- the two RED scenarios are recorded against the unmodified skill;
- wording micro-tests compare no-guidance control and candidate guidance with at
  least five fresh-context samples per variant;
- the same pressure scenarios pass with no zero on a critical behavior;
- new rationalizations are countered and the scenarios pass again;
- existing main-only, artifact-root, product-specification synchronization,
  readiness, completion, and cleanup scenarios still pass;
- both new references are discoverable from `SKILL.md` only in their relevant
  modes;
- the skill validator, Markdown link/fence/heading checks, placeholder checks,
  and `git diff --check` pass; and
- an independent review confirms fixture behavior is unchanged and the bounded
  authority updates preserve historical delivery evidence and product behavior.
