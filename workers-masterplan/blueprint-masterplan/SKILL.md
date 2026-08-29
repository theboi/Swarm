---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across workers, agents, branches, worktrees, clones, or machines; flattening a dependency flowchart; assigning collision-safe ownership; or writing worker briefs, readiness rules, delivery gates, and phase-specific launch prompts.
---

# Blueprint Masterplan

## Overview

Turn current living authorities into a frozen execution contract: establish foundations, expose independently owned trades in parallel, converge through named integration owners, and close through evidence gates.

**Core principle:** Minimize drift while maximizing delivery. Workers never communicate with one another through Codex chats. They work their assigned surfaces alongside concurrent workers on `main`; parallel read-only planning is normal. A genuinely shared checkout has one exclusive main-mutation lock for filesystem edits and Git/index operations through remote-reachability proof. If that lock cannot exist, use normal `main` clones only on different machines or when the shared checkout is incompatible; across clones, a push lock or queue covers reconciliation, focused verification, push, and remote-ancestry proof. Keep local `main` and `origin/main` current without discarding unrelated work. Write code and tests continuously, run only the relevant test segment after each independently testable substep, and run the full suite once at the end of all tasks owned by that worker.

**TWO-PASS LIFECYCLE:** First complete planning for the whole frozen blueprint; then execute it. In Pass 1, every ordinary worker authors its dated specification and implementation plan, while every required UI-design worker designs only presentation and contents against fixtures/mock state, writes a separate UI requirements contract, and integrates its accepted presentation handoff. No ordinary product execution or live wiring starts in Pass 1. The coordinator passes one global receipt only after every ordinary plan, UI requirements contract, UI handoff, authority update, and reconciliation is approved and reachable from `origin/main`. In Pass 2, ordinary workers execute only after that receipt and their hard implemented prerequisites exist. A worker's own approved plan is necessary but never sufficient to start execution.

## Mandatory response-shape preflight

An output is operative only when it creates or recommends worker assignments,
gives a Git/integration lifecycle, emits a launch packet/prompt, or resolves a
coordinator-versus-worker authorship dispute while directing work. Audits,
status reports, factual explanations, and direct answers that assign no work
remain concise. Operative outputs must show required facts rather than saying
only to follow this skill or a template.

`phase_required` is true exactly for an operative multiworker-blueprint or
coordinator-authorship answer. When `phase_required` is true, the first
structured output, after at most one outcome sentence, MUST be exactly one
verbatim **Coordinator/worker phase contract** block before every graph, worker
table, readiness decision, assignment, or launch instruction. Gate-correct
prose is insufficient.

**Coordinator/worker phase contract**

| Phase | Required fact |
| --- | --- |
| Coordinator | Freeze the blueprint, DAG, gates, contracts, briefs, and reserved paths; do not author a worker's detailed specification or implementation plan. |
| Pass 1 — worker planning and UI design | Each ordinary worker authors its own dated specification and detailed plan. Each UI-design worker uses fixtures/mock state to design presentation and contents, writes a separate UI requirements contract and presentation handoff, integrates its evidence into `origin/main`, and stops before live wiring. |
| Whole-blueprint gate | The coordinator passes the receipt only after the complete Pass 1 set is reconciled and reachable from `origin/main`; one worker's approved plan or UI handoff never authorizes execution. |
| Pass 2 — worker execution | Only after that passed receipt does an ordinary execution prompt direct implementation, after verifying the worker's hard implemented prerequisites and required evidence on `origin/main`. The named live-wiring worker consumes the UI requirements contract and accepted handoff. |

When `phase_required` is false—including non-operative, UI-only, and
UI-exception-only answers—render zero phase blocks. If a **Shared-main lifecycle** block
independently applies, render it exactly once immediately after the phase block;
never merge or duplicate the blocks.

Before returning, mechanically set `phase_required` and check count and
position. When true, require one phase heading and each of the four canonical
rows before every graph, worker table, readiness decision, assignment, or launch
instruction, with no more than one outcome sentence before the block. Otherwise
require zero phase headings and rows. Count **Shared-main lifecycle** and
UI-design checklist blocks independently; do not return until these checks pass.

Use `docs/superpowers/plans/2026-08-05-mvp1/2026-08-05-mvp1-implementation-masterplan.md` as the structural exemplar when it exists. Generalize its authority boundary and section responsibilities; do not copy project-specific behavior into unrelated blueprints.

## Required companion skills

- **REQUIRED SUB-SKILL:** Use `living-masterplan` when an authority is missing or stable approved information changes.
- **REQUIRED SUB-SKILL:** Use `superpowers:brainstorming` before freezing or materially revising an unsettled blueprint.
- **REQUIRED SUB-SKILL:** Use `grilling` when scope, decomposition, ownership, gates, or acceptance remains materially unsettled.
- **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` before declaring the blueprint valid.
- **REQUIRED WORKER SUB-SKILLS:** Ordinary execution-worker briefs or prompts require applicable Superpowers planning, TDD, review, and verification skills. A UI-design worker instead follows the separate live-design lifecycle and mandatory design-source reads below; it has no implementation plan.
- **COEXISTENCE OVERRIDE:** Workers operate directly on `main`. A shared checkout permits concurrent read-only planning, but every filesystem edit and Git/index operation uses its exclusive main-mutation lock. If that lock cannot exist, use normal `main` clones only on different machines or when the shared checkout is incompatible; their required push lock or queue serializes reconciliation, affected focused verification, push, and remote-ancestry proof. Generic sub-skills must not create feature lanes, impose a global edit lock across independent normal clones, or require worker-to-worker Codex chat. Workers preserve and report unrelated changes, stage only owned paths, and use repository state plus coordinator-owned artifacts as the coordination surface.
- **VERIFICATION OVERRIDE:** During implementation, run focused tests only at meaningful code checkpoints. Do not run the full suite after each substep; run it once after the worker finishes all owned tasks.

Do not restart discovery for explicit, settled, evidence-backed maintenance.

## Freeze the right document

The coordinator-owned masterplan contains these responsibilities in this order:

1. purpose, authority, and the one execution question;
2. bounded outcome and measurable delivery gates;
3. foundations workers must reuse;
4. locked product, architecture, security, data, and ownership boundaries;
5. a flattened hard-dependency DAG and graph-shape evidence;
6. readiness and blocker rules;
7. the mandatory worker lifecycle;
8. compact worker briefs;
9. shared integration contracts;
10. integration gates;
11. coordination without worker-to-worker chat, shared-lane safety, drift and conflict control, downstream-change propagation, handoff/cleanup, exclusions, and revision policy.

Read [the blueprint template](references/blueprint-masterplan-template.md) completely before drafting.

The masterplan owns worker boundaries, not worker implementation detail. A worker brief defines outcome, Pass 1 and Pass 2 prerequisites, ownership, non-ownership, acceptance evidence, merge condition, and downstream unblock. It classifies the worker as ordinary execution or conditional UI design. An ordinary worker authors its own dated Superpowers specification and implementation plan in Pass 1; a UI-design worker produces a fixture/mock-backed presentation design, UI requirements contract, accepted presentation handoff, and approval evidence instead of an implementation plan. The named ordinary live-wiring worker plans against those UI outputs in Pass 1 and implements the live behavior only in Pass 2.

## Establish current authority

1. Identify the bounded objective, coordinator, decision owners, requested gates, owned surfaces, and the checkout/clone mode each worker will use.
2. If workers share one checkout, name its exclusive main-mutation lock for all filesystem edits and Git/index operations. If that lock cannot exist, document why the checkout is incompatible and assign normal `main` clones only on different machines; name the cross-clone push lock or queue that covers reconciliation, affected focused verification, push, and remote-ancestry proof.
3. Read relevant business, product, architecture, implementation, operations, security, and custom authorities.
4. Read existing code, migrations, tests, generated artifacts, components, and operational foundations that constrain decomposition.
5. Use `living-masterplan` before freezing when an authority is missing or stable approved information changed.
6. Record an authority-refresh record for every cited authority: its path, inspected `origin/main` commit, and `current`, `updated`, or `blocked` result. A remote-uninspected readiness or authority finding is `unverified`, never ready.
7. Stop when a contradiction or unanswered decision makes scope, ownership, dependencies, or acceptance unreliable.

Living authorities own approved behavior and current truth. The frozen blueprint owns delivery decomposition. Worker status owns transient progress.

## Name the blueprint and its artifact roots

Create one stable `<blueprint-id>` as `YYYY-MM-DD-<short-slug>`, using the date the delivery effort began. Do not change the folder because an individual worker starts later.

Follow established project paths. Otherwise use:

```text
docs/plans/<project>_<objective>_Implementation_Masterplan.md
docs/superpowers/specs/<blueprint-id>/
docs/superpowers/plans/<blueprint-id>/
docs/workers/<blueprint-id>/
```

Reserve worker paths inside the one blueprint folder:

```text
docs/superpowers/specs/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>-design.md
docs/superpowers/plans/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>.md
```

Do not create a folder per worker. The blueprint folder contains all worker documents for that delivery effort in date/ID order.

## Map foundations and mutable surfaces

Inventory reusable modules, contracts, infrastructure, migrations, generated outputs, components, tests, environments, and decision records.

For every likely mutable surface, name exactly one owner. Include more than files: schemas, migration sequences, APIs, generated artifacts, central composition, environments, and operational records also collide.

When proposed workers overlap, choose one:

- assign the whole surface to one foundation or integration owner;
- sequence the packages behind a remote-merge dependency; or
- first merge an approved interface that makes later ownership independent.

Checkout or clone separation does not make overlapping semantic ownership parallel. One worker owns each mutable surface. In a genuinely shared checkout, workers may plan read-only in parallel but must acquire the exclusive main-mutation lock before every filesystem edit or Git/index operation, and release it only after remote-reachability proof. If that lock cannot exist, use the documented normal-clone fallback; independent clones never require a global edit lock, but their push lock or queue is required. In either mode, preserve and report unrelated dirt, stage only owned paths, and never remove unrelated work to make integration possible.

## Build a moderately flat DAG

Start from real contract and evidence dependencies. Remove convenience sequencing and execution wave-wide barriers. The one global planning barrier authorizes ordinary execution only after the entire planning set is reconciled; it does not turn planned contracts into implemented hard prerequisites.

For a multi-worker objective, target **three to seven concurrently ready workers** in each substantive post-foundation trade layer. Label each frontier as planning-ready or execution-ready; the two predicates remain distinct. This is a design band:

- roots, contract foundations, joins, gates, closeout, and small objectives may be narrower;
- accept a substantive layer wider than seven only after testing whether its packages can be grouped by domain, protocol, risk, runtime/toolchain, release boundary, and shared verification; and
- record concrete evidence for every remaining exception.

Flatten a serial wrapper when it owns no distinct surface, contract, decision, or acceptance evidence. Split an oversized worker only when every child has:

- one coherent outcome and useful downstream handoff;
- non-overlapping mutable ownership;
- independently producible acceptance evidence; and
- enough work to justify planning, review, integration, and status overhead.

Before accepting a substantive frontier wider than seven, test grouping by domain, protocol, risk, runtime/toolchain, release boundary, and shared verification. Separate files, provider-specific acceptance evidence, independent ownership, and open execution slots do not alone justify an exception; keep provider tests inside a coherent adapter bundle where safe. A remaining exception must cite concrete incompatible ownership, security/isolation, runtime/toolchain, deployment/release, or verification evidence. Keep migrations, generated artifacts, central facades, and tightly coupled files under one owner. Never invent hard edges, group a shared migration or facade with adapter work, or force a group when documented constraints make it unsafe.

Measure planning readiness and execution readiness independently from active execution slots. Work that satisfies the relevant predicate but lacks a slot remains ready in that predicate; a planning-complete worker never becomes execution-ready merely by waiting.

## Record graph-shape evidence

Every blueprint records:

| Metric | Required evidence |
| --- | --- |
| Worker nodes | Count and why each package is coherent |
| Hard edges | Count and why remote integration is required |
| Layer widths | Worker IDs in each substantive frontier, labeled planning-ready or execution-ready |
| Peak ready width | Widest logical frontier |
| Active execution slots | Current capacity, separate from graph width |
| Width exceptions | Structural reason for layers outside three to seven |

Validate that the graph is acyclic; every node exists; every arrow matches written `Depends on` and `Unblocks`; gates are real nodes; and coordination-only relationships are not hard edges.

If a cycle appears, redesign ownership or the interface. Do not hide it in prose.

## Write worker briefs, not worker plans

Each masterplan brief contains:

- stable worker/task ID and bounded outcome;
- planning prerequisites, hard execution prerequisites, and the immediate planning-start rule;
- owned and excluded surfaces;
- whether the observable UI-design trigger applies and, when it does, the named presentation files, sequential ownership-transfer target, mandatory complete reads of `claude-design/codex/AGENTS.md`, `claude-design/codex/system-prompt.md`, every relevant procedure under `claude-design/codex/skills/`, and `.agents/skills/better-ui/SKILL.md`, and the canonical pre-edit source-read checklist below before editing instructions;
- coordination relationships that are not hard dependencies;
- work outcomes, not step-by-step implementation instructions;
- exact acceptance evidence;
- merge condition; and
- downstream nodes and supplied contracts/evidence.

Every worker also has the named status contract
`docs/workers/<blueprint-id>/status/<worker-id>.md`; the coordinator owns the
aggregate `docs/workers/<blueprint-id>/STATUS.md`. The initial coordinator
snapshot is taken at one inspected `origin/main` commit and separates planning
readiness from execution readiness, with evidence and blockers for each. Do not
label a remote-uninspected row ready: it is `unverified`.

The coordinator reserves artifact paths but does not pre-author the ordinary worker's detailed specification or implementation plan. The coordinator alone owns `docs/workers/<blueprint-id>/PLANNING_GATE.md`; workers never edit that receipt.

### Planning readiness

A worker is planning-ready when the frozen blueprint, its brief, relevant living authorities, and every approved planned contract required to make task decisions are available. Planning never waits for predecessor implementation merely because execution will depend on it.

### Execution readiness

A worker is execution-ready only when the coordinator-owned planning-gate receipt is passed at the named `origin/main` commit and every hard implemented prerequisite and required execution evidence for that worker is reachable from `origin/main`.

A planning-complete worker remains blocked from execution while the global planning gate is open. A passed global planning gate does not waive an unimplemented hard prerequisite.

### Produce the complete planning set

Independent planning runs concurrently once each ordinary execution worker is planning-ready. An ordinary worker's planning phase:

1. inspects the live worktree without disturbing unrelated changes, records the checkout/clone mode and required lock or queue, fetches `origin/main`, and fast-forwards clean local `main` with `git pull --ff-only origin main` only when safe;
2. synchronizes its assigned `main` checkout with current local and remote `main`, records the relevant baseline without running the full suite, and distinguishes planned-contract inputs from later implemented execution prerequisites;
3. reads the frozen blueprint, relevant living authorities, brief, and approved planned-contract handoffs;
4. uses Superpowers brainstorming for task-local decisions;
5. writes and obtains approval for its dated specification inside the blueprint specs folder;
6. immediately identifies every affected product specification masterplan and
   consolidates all approved changes from the dated specification into the
   high-level frontend-to-backend product contract, or records an
   evidence-backed no-impact finding;
7. uses `superpowers:writing-plans` to write its detailed plan inside the blueprint plans folder;
8. updates other stable living authorities before implementation depends on changed decisions;
9. propagates any dependency, blocker, contract, acceptance, or implementation impact into every affected downstream worker document through its owner; and
10. after each independently testable planning substep—a coherent plan task or
    subtask with its own focused verification—runs that focused verification,
    stages only owned paths, commits directly to `main`, fetches and merges newer
    `origin/main`, reruns affected checks, pushes, and proves remote reachability
    before beginning the next substep; and
11. records authority-refresh and planning-readiness evidence in its named status
    contract for the coordinator to consume, without editing `STATUS.md`.

Repeat step 6 whenever the dated specification changes. Do not defer this
product-specification maintenance to a different worker or a later delivery
phase. A planning handoff is incomplete while an affected product specification
masterplan is stale. It is a planning artifact, never individual authorization
to begin ordinary implementation.

UI-related ordinary implementation planning may begin after its upstream
functional specifications and implementation plans are approved on `origin/main`;
implemented predecessor code is not a planning prerequisite. A UI-design worker
may start at the same point, but only with fixtures/mock state and no live wiring.
The named live-wiring worker must plan against both the accepted UI-design handoff
and separate UI requirements contract. All three workers remain
execution-blocked until the global planning gate passes and their implemented
hard prerequisites exist.

## Separate live UI design from implementation

UI design exists when work introduces or changes visual hierarchy, layout, component treatment, responsive behavior, motion, interaction states, or interface copy. Create a separate UI-design worker for each coherent affected surface. Pure implementation of an already accepted design is ordinary implementation and does not create another design worker.

Whenever an output instantiates a UI-design worker—a brief, worker package,
lifecycle, or launch prompt—it MUST include exactly one verbatim copy of the
following canonical Markdown checklist per design worker, before any editing
instructions. An ordinary worker output contains no copy of this checklist:

**Mandatory pre-edit source-read checklist** — do not abbreviate:
- [ ] Completely read `claude-design/codex/AGENTS.md`.
- [ ] Completely read `claude-design/codex/system-prompt.md`.
- [ ] Completely read every relevant procedure under `claude-design/codex/skills/`.
- [ ] Completely read `.agents/skills/better-ui/SKILL.md`.

The instantiating output is incomplete if it has fewer or more than one such
block per UI-design worker, if an ordinary worker output contains the block, or
if any checklist row or literal is absent. Emit this block only when the
observable UI-design trigger applies; never emit it for ordinary implementation
of an accepted design or unrelated UI discussion. Generic shorthand for the
mandatory source reads is allowed only after the block.

Before returning an output that instantiates UI-design workers, mechanically
check every worker: its output must contain exactly one verbatim canonical
four-row checklist block, with four distinct rows and the four literal source
requirements above. Mechanically confirm that ordinary worker outputs contain
zero such blocks. Do not return the output until those per-worker cardinality
checks pass.

The UI-design worker MUST complete the canonical checklist before editing and
read linked supporting references required by those sources. It has no
implementation plan. In Pass 1 it may produce only a fixture/mock-backed,
presentation-and-contents design; it must write both an accepted presentation
handoff and a separate UI requirements contract using
`references/ui-requirements-template.md`. Those two artifacts, together with
approval evidence, replace the implementation-plan artifact in the planning-gate
receipt.

The UI-design worker is the only pre-gate app-edit exception. It may edit composition, hierarchy, spacing, responsive arrangement, visual component variants, motion, interface copy, and interaction-state presentation in the actual application, but must make those states deterministic with fixtures/mock data. It may not create or change live API calls, authorization, persistence, migrations, domain rules, scoring, background processing, or other business behavior. A discovered functional need returns to ordinary specification and planning and is captured in the UI requirements contract for the named live-wiring planner.

Before editing, inventory and reuse the repository's existing components, tokens, typography, spacing, icons, motion, and interaction patterns. Do not create a competing component library or token system. Start the established live development server, publish its command and localhost URL, keep it available through iterative user feedback, and verify the rendered application in a browser. Show a working skeleton early, incorporate user feedback in the real app, and repeat until approval or a material product decision blocks design. When alternatives make feedback cheaper, use a small set of substantively different options in one temporary toggleable comparison surface backed by shared components. Remove rejected comparison-only code after approval unless the user explicitly accepts a development-only comparison control.

A localhost presentation is review-ready only when the application and every runtime dependency required to enter the presentation are running against the exact endpoints configured in the client. Follow the repository's local setup authority: start required authentication emulators or services, local Supabase, APIs, seeds, or other access prerequisites even when the presentation data itself uses fixtures. Prove dependency health and authenticate one documented local fixture identity without publishing secrets; when a browser is available, complete the real sign-in and protected-route entry there. Keep the application and access dependencies alive through user review. A protected-route redirect or `200` response from the sign-in page proves only that the unauthenticated shell is reachable; it is never login proof or a valid presentation handoff. If browser integration is unavailable, record that visual limitation, but still verify the auth service, documented credential, exact configured endpoint, and localhost process before asking the user to review.

The UI-design handoff records the accepted app-state commit reachable from `origin/main`, user approval evidence, affected routes/components and reused design-system foundations, verified applicable wide, narrow, interaction, keyboard/focus, and reduced-motion states, the development-server command and reviewed localhost URL, required access-runtime commands and endpoint health, the source of the documented fixture identity without secret values, retained limitations and functional decisions returned to planning, and the implementation worker that receives mutable ownership. The separate UI requirements contract records the required reads, commands, actor capabilities, lifecycle and error states, navigation/client state, files/exports, accessibility, deterministic fixtures, planned-contract traceability, Pass 2 acceptance mapping, and unresolved product decisions. It is the contract the Pass 1 live-wiring planner and downstream planners consume; it is not live wiring.

The design worker owns the named presentation files until its accepted handoff is integrated into `origin/main`. Transfer mutable ownership to the implementation worker only afterward; the two workers never edit the same mutable UI surface concurrently.

## Generate launch prompts when needed

Read [the worker prompt templates](references/worker-prompt-templates.md) completely before generating prompts.

Create separate ordinary-worker planning and execution prompts when phases may run in different sessions or the user requests a launch packet. Both prompts name the blueprint, living authorities, worker brief, planning and execution prerequisites, owned/excluded surfaces, artifact paths, named worker-status contract, coordinator `STATUS.md`, checkout/clone mode, required shared-checkout lock or cross-clone push queue, `origin/main` integration authority, independently-testable-substep cadence, focused-test cadence, final full-suite requirement, the ban on worker-to-worker Codex chat, and the exact terminal condition.

An ordinary planning prompt stops after the worker-authored specification,
affected product-specification consolidation or no-impact findings, detailed
plan, stable authority updates, and planning handoff to the coordinator. It
explicitly states that the handoff does not authorize implementation. An
ordinary execution prompt names the passed coordinator-owned planning-gate
receipt and its pinned `origin/main` commit, requires execution-readiness
verification before editing, and then covers implementation, review,
integration evidence, handoff, and clean-main completion.

### EdenMind swarm coordinator launch packets (conditional)

Use this adapter only when the frozen blueprint explicitly declares the
EdenMind swarm coordinator. It does not change ordinary Blueprint Masterplan
prompts or turn this generic skill into an application specification. Read [the
coordinator launch-packet adapter](references/worker-prompt-templates.md#edenmind-swarm-coordinator-launch-packets)
completely before rendering any coordinator packet.

The coordinator renderer and this skill resolve each packet directly from the
single canonical source under `workers-masterplan/swarm/templates`; never copy
or independently maintain packet bodies in the reusable skill. Supply the
selected macOS account, worker ID, model routing, coordinator chat name, and
phase terminal condition, selected Git mode, same-Mac mutation lock, and
independent-clone push queue as explicit launch metadata. The selected account
is not a worker: an account may own unlimited chats, while the global
active-turn default is `3`.

For this conditional mode, use one loopback Codex app-server per selected macOS
account through `su - <account>`; never launch Codex desktop for a bot account.
The planning packet is terminal before execution, and the execution packet
routes bounded implementation to Terra High, difficult implementation,
integration, migrations, or debugging to Terra Xhigh, and Sol High only to
unexpected planning required during execution. Continue to apply this skill's
direct-main lifecycle and remote-reachability proof without weakening it for
the coordinator: each canonical packet must render its phase terminal condition
and the full checkpoint sequence—focused check, owned-path staging, direct-main
commit, fetch/merge, affected-check rerun, push, and remote-reachability proof.

The coordinator may automatically approve an app-server request only after
positive proof that every target is contained in the assigned account's
EdenMind clone. Ambiguous, destructive, home/system, cross-account, glob,
symlink-sensitive, or otherwise unproven requests fail closed to the exact
method-compatible human decision; dangerous actions never receive a
session-wide approval. Public ngrok access may run only from `10:00` until
`00:00` in `Asia/Singapore`; local coordinator access remains available outside
that public window.

### Render operative lifecycle outputs without compression

Apply the operative-output classification and the **Coordinator/worker phase
contract** from [Mandatory response-shape preflight](#mandatory-response-shape-preflight).
Do not redefine, move, merge, or duplicate that canonical block here.

For every operative Git/integration lifecycle or actual ordinary-worker launch
packet, render exactly once this canonical Markdown block with all four visible
rows:

**Shared-main lifecycle**

| Item | Required fact |
| --- | --- |
| Mode | In a genuinely shared checkout, read-only planning may run in parallel; the exclusive shared-checkout main-mutation lock covers every filesystem edit and Git/index operation through remote-reachability proof. |
| Fallback | Only when that lock cannot exist, use normal clones on `main` for different machines or a documented incompatible shared checkout. A cross-clone push lock or queue covers only reconciliation → affected focused verification → push → remote-ancestry proof; it does not impose a global edit lock across clones. |
| Checkpoint cadence | After every independently testable substep—a coherent plan task or subtask with its own focused verification—run the focused check, stage only owned paths, commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability before the next substep. |
| Safety | Preserve and report unrelated dirt; never clean, stash, reset, overwrite, or remove it. Never rebase or force-push published `main`. |

The phase block is defined only in the mandatory preflight. UI-design exceptions
retain their existing dedicated conditional workflow; do not emit either
ordinary-worker block solely because the observable UI-design trigger applies.

Only when the observable UI-design trigger is true, read [the UI-design worker
prompt template](references/ui-design-worker-prompt-template.md) completely and
generate that separate prompt. It is incomplete without the canonical pre-edit
source-read checklist exactly once per UI-design worker before editing
instructions; only after that block may it use generic source-read shorthand.
It must also require the presentation-only real-app boundary, live-server
feedback loop, approval evidence, no-plan handoff, and sequential ownership
transfer.

## Require remote-evidenced readiness

| State | Meaning |
| --- | --- |
| planning-blocked | A required frozen authority, brief, or approved planned contract is unavailable |
| planning-ready | The planning-readiness predicate is satisfied at an inspected `origin/main` commit; implemented predecessor code is not required |
| planning-in-progress | The worker is producing its required planning artifacts, or a UI-design worker is producing its fixture/mock presentation handoff and separate UI requirements contract |
| planning-complete / execution-blocked | The worker's planning artifacts are reconciled, but the global planning gate is open or an implemented hard prerequisite is absent |
| execution-ready | The execution-readiness predicate is satisfied at the named `origin/main` commit |
| unverified | The needed remote commit or evidence has not been inspected; it is neither planning-ready nor execution-ready |
| in-progress | An execution-ready worker claimed its owned surfaces, refreshed local `main` from `origin/main`, and is producing coherent checkpoints |
| blocked | A named dependency, decision, conflict, or external condition prevents progress |
| review | Work exists but review, evidence, or integration remains open |
| complete | The coordinator verified final full-suite evidence, `origin/main` integration, handoff, and cleanup of any dedicated temporary lane |

A feature-branch-only commit, unpushed local commit, stash, or working-tree change never satisfies a planned contract, hard prerequisite, or required evidence. The coordinator cannot pass the planning gate until the complete Pass 1 planning set, UI requirements contracts, and UI handoffs are reachable from `origin/main`; execution readiness additionally requires each worker's implemented hard prerequisites.

Use [the worker status template](references/worker-status-template.md) for each active worker and [the coordinator summary template](references/status-summary-template.md) for `STATUS.md`. A worker owns only its named status file; the coordinator alone owns the aggregate, authority-refresh record, and initial readiness table.

## Reconcile through the coordinator-owned planning gate

Before writing, passing, or reopening the receipt, read [the planning-gate
template](references/planning-gate-template.md) completely.

After the complete planning set is produced, the coordinator reconciles it
together before ordinary execution. The coordinator writes
`docs/workers/<blueprint-id>/PLANNING_GATE.md`, pins one inspected
`origin/main` commit, and records state `open`, `passed`, or `reopened`. This
receipt is the only whole-blueprint planning authorization.

The receipt contains the blueprint ID and path, coordinator and approval time,
the pinned commit, verification and review evidence, unresolved contradictions
with owner and unblock criterion, and the material-change rule. It has one row
for every ordinary execution worker with its specification path and commit,
implementation-plan path and commit, approval, living-authority synchronization,
and cross-plan reconciliation result. It has one row for every UI-design worker
with accepted presentation app-state commit, approval evidence, separate UI
requirements path, handoff path, completed fixture/mock live review,
requirements-to-plan reconciliation, and sequential ownership-transfer target.
`not applicable` is valid only for the UI-design worker implementation-plan
field and only with its accepted design artifacts.

Before passing the gate, the coordinator verifies that every brief has the
required planning artifact, producer and consumer planned interfaces agree,
shared mutable surfaces have exactly one current owner, migration,
generated-artifact, central-composition, and integration ordering are explicit,
accepted UI design and its UI requirements contract are reflected in affected
live-wiring implementation plans, affected living authorities and downstream
documents are current, all approvals and review evidence are reachable from
`origin/main`, and no material decision or cross-plan contradiction remains.
The gate passes only when every required row is complete.

## Keep every worker current on `main`

All planning, implementation, review fixes, and documentation updates happen directly on checked-out `main`. Local `main` and `origin/main` remain the integration truth. Select and record exactly one of these modes before any mutation:

1. **Genuinely shared checkout:** read-only planning may proceed in parallel, but an exclusive main-mutation lock is required for every filesystem edit and every Git/index operation. The holder keeps it from pre-edit reconciliation through focused verification, staging, commit, reconciliation, push, and proof that the published commit is reachable from `origin/main`.
2. **Independent normal clones:** use only when workers are on different machines or a shared checkout is incompatible with the required lock. No global edit lock spans the clones, but a required cross-clone push lock or queue covers reconciliation, affected focused verification, push, and remote-ancestry proof.

A clean baseline means reconciled local `main` plus no owned dirty state. Unrelated dirt is preserved and reported; it is never cleaned, stashed, reset, overwritten, or treated as the worker's clean-baseline failure.

**Mandatory lane rules:**

- Workers are banned from messaging, following up with, or handing off to other workers through Codex chats. Publish progress through commits, owned status/handoff artifacts, and coordinator-owned summaries.
- Never stop merely because another worker is active on `main` or another normal clone. In a shared checkout, wait only for the required main-mutation lock before mutation; read-only planning may continue in parallel.
- Never reset, overwrite, clean, stash, or reformat another worker's changes. Stage explicit owned paths and review the exact staged diff before committing.
- Fetch `origin/main` before starting. Fast-forward only a clean, reconcilable local `main` with `git pull --ff-only origin main`; preserve and report unrelated dirt rather than making it disappear.
- Treat an independently testable substep as one coherent plan task or subtask with its own focused verification, not every edit. After each such substep: run the focused check, stage only owned paths, commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability before beginning the next substep.
- Before every push, use the mode's required lock or queue and reconcile concurrent upstream changes. If rejected, preserve all work, fetch and merge the new remote state, run the affected focused tests, and retry. Never rebase or force-push published `main`.
- Do not create new feature branches or linked worktrees. Preserve legacy or uncertain lanes and retire them only after final integration and remote proof.

## Require the worker execution lifecycle

1. Inspect the current checkout/clone mode, acquire the required shared-checkout main-mutation lock before mutation or identify the cross-clone push queue to use at reconciliation, preserve and report unrelated changes, fetch `origin/main`, establish a clean baseline when no owned dirt remains, and prove the named planning-gate receipt is passed at its pinned commit.
2. Prove every hard implemented prerequisite and required execution evidence is reachable from `origin/main`. Stop unless the execution-readiness predicate is satisfied.
3. Enter the assigned `main` checkout, reconcile it with `origin/main`, record the authority-refresh and readiness evidence at that inspected commit, and inspect the relevant baseline before editing.
4. Read the worker-authored approved specification and detailed plan, including the accepted UI-design handoff when the implementation consumes one.
5. Implement only owned surfaces with TDD where applicable.
6. Write code and tests in coherent chunks. For every independently testable substep (a coherent plan task or subtask with its own focused verification), run only the test segment relevant to changed behavior; do not run the full suite at every small turning point.
7. Resolve ordinary concurrent edits and conflicts within owned surfaces. Escalate only a genuine semantic, ownership, migration, generated-artifact, or contract decision, through the coordinator rather than another worker's Codex chat.
8. After every independently testable substep, stage only owned paths, commit directly to `main`, fetch and merge newer `origin/main`, rerun affected focused tests, push, and prove remote reachability before the next substep. Use the required lock or queue throughout that lifecycle.
9. Request/address review and run fresh focused verification for the completed owned scope.
10. After all tasks owned by the worker are finished, refresh from local and remote `main`, run the full suite once, integrate and push the final state, prove remote reachability, and produce the evidence-backed handoff. The assigned checkout has no owned dirt; unrelated dirt remains preserved and reported.

**Verification and synchronization cadence:**

1. Before work: record checkout/clone mode, required lock or queue, inspected `origin/main` commit, authority-refresh record, and the separate planning/execution readiness findings; remote-uninspected findings are `unverified`.
2. During work: after each independently testable substep (a coherent plan task or subtask with its own focused verification), run the narrow affected test segment, stage only owned paths, commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability before the next substep.
3. During long tasks: use the same per-substep lifecycle rather than delaying synchronization; preserve unrelated dirt and report any inability to reconcile without removing it.
4. At worker completion: refresh again, run the full suite once, fix failures, then integrate and push final evidence.
5. On a shared checkout: read-only planning may be parallel, while its exclusive main-mutation lock covers filesystem edits and Git/index work through remote proof. Across independent clones, use the required push queue for reconcile → affected verification → push → ancestry proof. Never use worker-to-worker Codex chat, and never impose a global edit lock across independent clones.

## Propagate living-authority changes downstream

Whenever a worker updates a living business, product/specification, architecture, implementation, operations, security, release, or custom masterplan, it MUST assess the direct and transitive downstream workers and gates before integrating the update.

Writing or modifying a dated task specification always requires this assessment
for every affected product specification masterplan. The worker must consolidate
all and only approved product behavior into one high-level frontend-to-backend
contract in the same planning substep, or record an evidence-backed no-impact
finding. Do not use available-now, approved-future, deferred, worker, or
delivery-history categories in that product specification masterplan.

An accepted UI design enters this downstream impact assessment only when it
changes approved product behavior or a product interaction contract. In that
case, update the affected product specification masterplan and downstream
planning artifacts before the planning gate passes. Purely visual evidence does
not become product behavior or delivery-status history in a product
specification masterplan.

If the authority change affects a dependency, readiness condition, blocker, contract, ownership boundary, acceptance evidence, test expectation, launch instruction, or implementation assumption, the change is incomplete until:

1. the affected downstream set is identified from the DAG and coordination contracts;
2. every affected worker brief, specification, implementation plan, launch prompt, worker status, and coordinator status is updated where relevant;
3. the originating worker records the impact in its owned artifact; the coordinator or owning worker consumes that repository evidence without direct worker-to-worker Codex chat, and no worker overwrites a cross-owned document;
4. affected downstream work is marked blocked or not-ready until its documents and assumptions are current;
5. the authority change and all required downstream document updates are verified with the relevant focused checks, committed as a coherent checkpoint, reconciled with current local and remote `main`, and pushed to `origin/main`; and
6. the originating worker records propagation evidence or an explicit evidence-backed finding of no downstream impact.

If the change alters frozen blueprint scope, ownership, dependencies, gates, or completion semantics, the coordinator must issue the required approved blueprint revision. No affected downstream worker may continue from stale documents.

## Reopen the global planning gate for material changes

A material change to frozen scope, ownership, dependency edges, contracts, acceptance, security/privacy behavior, an accepted UI design, or an implementation plan reopens the global planning gate. No new execution starts. Directly affected execution pauses at a safe checkpoint. The coordinator reauthorizes execution only after every affected artifact and living authority is current, the complete planning set is reconciled again, and a new passed receipt is reachable from `origin/main`. Already-running unrelated work continues only with an evidence-backed no-impact finding in the reopened receipt.

When reopening, the coordinator changes the receipt state to `reopened` and
ensures each affected specification, plan, UI handoff, prompt, living authority,
and status is updated through its owner. A new passed receipt pins the updated
`origin/main` commit. This rule applies even if an individual worker's prior
plan or handoff remains approved.

## Complete and clean up safely

A worker is complete only after:

1. one fresh full-suite run after all of the worker's owned tasks are finished;
2. approved integration into current local `main`;
3. proof its final commit and required downstream-document updates are reachable from `origin/main`;
4. integrated or CI verification;
5. preserved handoff and archival status;
6. no owned dirty state in the assigned checkout, with any unrelated dirt preserved and reported;
7. cleanup of any fully integrated legacy dedicated lane, while shared `main` remains intact; and
8. a coordinator completion receipt.

Preserve dirty, unpushed, failing, under-review, or uncertain-ancestry work. Never reset, overwrite, force-push, or force-clean it.

## Verify and freeze

Before freezing:

- re-read cited authorities and promote stable changes first;
- verify every shared surface has one owner;
- compare Mermaid edges with briefs and gate prerequisites;
- compute node/edge counts, layers, peak width, and cycles;
- review narrow serial stretches and over-wide micro-packages;
- verify worker artifact roots use the blueprint ID;
- verify the coordinator wrote briefs, not worker specifications/plans;
- test planning-blocked, planning-ready, planning-complete/execution-blocked, execution-ready, review, and completion readiness;
- verify the coordinator-owned `PLANNING_GATE.md` has every required ordinary-worker and UI-design row, a pinned `origin/main` commit, complete reconciliation evidence, and no unresolved material contradiction before ordinary execution;
- verify an ordinary execution worker cannot begin because only its own planning handoff is approved;
- verify a UI-design worker is created only for the observable trigger, follows the mandatory source reads and presentation-only live-app boundary, and transfers UI ownership sequentially after its accepted handoff;
- verify a material change reopens the receipt, pauses affected execution safely, and requires a new passed remote-evidenced receipt;
- verify worker-to-worker Codex chat is prohibited and repository/coordinator artifacts carry coordination;
- verify each worker's checkout/clone mode, that shared-checkout mutation uses an exclusive main-mutation lock, and that independent clones use the required push queue without a global edit lock;
- verify a clean baseline means reconciled local `main` and no owned dirty state, while unrelated dirt is preserved and reported;
- verify workers refresh local `main` from `origin/main` before work and, after each independently testable substep, run focused verification, stage only owned paths, commit directly to `main`, merge newer `origin/main`, rerun affected checks, push, and prove remote reachability before the next substep;
- verify implementation uses focused test segments and each worker runs the full suite only once after all owned tasks finish;
- verify every authority-refresh record names its path, inspected `origin/main` commit, and `current`, `updated`, or `blocked` result; remote-uninspected readiness remains `unverified`;
- verify the initial coordinator readiness table at the inspected remote commit separates planning readiness from execution readiness, including evidence and blockers, and names each worker status contract plus `STATUS.md`;
- mechanically check every Git lifecycle or worker prompt for checkout/clone mode, the required lock or queue, independently-testable-substep cadence, remote reachability proof, published-main no-rebase/no-force, and unrelated-dirt preservation;
- verify every new or modified worker specification synchronizes each affected
  product specification masterplan in the same planning substep, or carries an
  evidence-backed no-impact finding;
- verify product specification masterplans read as unified high-level
  frontend-to-backend contracts rather than availability or delivery-status
  dashboards;
- verify living-authority changes require downstream-impact assessment and all relevant downstream document updates;
- scan for placeholders, unsupported assumptions, stale references, and unrelated edits; and
- obtain approval, then commit the frozen snapshot when authorized.

Ordinary progress updates status, not the blueprint. Revise the frozen blueprint only when approved stable information changes scope, ownership, dependencies, gates, or completion semantics.

## Quick reference

| Situation | Response |
| --- | --- |
| Authority missing or stale | Bootstrap or maintain it before blueprint work |
| Independent packages share approved planned contracts | Expose them in the same planning-ready frontier; execution still waits for the global gate and hard implemented prerequisites |
| Layer narrower than three | Remove artificial edges or record the bottleneck |
| Layer wider than seven | Test grouping by domain, protocol, risk, runtime/toolchain, release boundary, and shared verification; retain only evidence-backed unsafe exceptions |
| Fewer active slots than ready workers | Keep the DAG flat and schedule from the ready queue |
| Shared file/schema/generated output | Assign one owner or sequence behind its merge |
| Worker needs detailed steps | Once planning-ready, the ordinary worker authors its own specification and detailed plan before the global planning gate may pass |
| Worker has only its own approved plan | Keep it execution-blocked until the passed coordinator-owned planning-gate receipt and its hard implemented prerequisites are proven on `origin/main` |
| Work changes visual hierarchy, layout, component treatment, responsive behavior, motion, interaction states, or interface copy | Create the separate live UI-design worker and use its conditional prompt; do not give it an implementation plan |
| Worker specification is created or changed | Consolidate approved changes into every affected product specification in the same planning substep, or record no impact |
| Workers share one checkout | Permit parallel read-only planning; require the exclusive main-mutation lock for edits and Git/index operations through remote proof |
| Workers use independent normal clones | Allow only different machines or an incompatible shared checkout; require the push queue, not a global edit lock |
| Worker tries to message another worker in Codex | Ban the chat; publish through commits, owned artifacts, and coordinator summaries |
| Worker says done on its feature branch or only locally | Keep execution dependants not-ready; planning may use only approved planned-contract evidence already reachable from `origin/main` |
| Worker completes an independently testable substep | Run the focused test, stage only owned paths, commit, merge newer `origin/main`, rerun affected checks, push, and prove remote reachability before the next substep |
| Worker finishes all owned tasks | Refresh, run the full suite once, push and prove `origin/main`, leave no owned dirt, preserve/report unrelated dirt, then remove only dedicated temporary lanes |
| Living-authority change affects downstream work | Update every relevant downstream document through its owner and block stale work until `origin/main` contains the updates |
| Main checkout is dirty or has unpushed commits | Preserve it and report the integration blocker |

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Maximizing worker count | Optimize coherent ownership and safe throughput |
| One worker per independent file | Group related surfaces by outcome and verification |
| Treating slot capacity as graph width | Report both; queued ready work is still logically parallel |
| Coordinator writes every task plan | Coordinator writes briefs; each worker writes its own plan |
| An approved individual plan starts implementation | Require the passed whole-blueprint planning receipt and per-worker execution readiness |
| UI exploration changes functional behavior before the gate | Keep the live UI-design worker presentation-only; return functional needs to ordinary planning |
| Design and implementation workers edit one UI surface together | Transfer mutable presentation ownership only after the accepted handoff is integrated |
| Flat shared specs/plans roots | Use one dated folder per blueprint in both roots |
| Treating a required shared-checkout lock as optional | Use the exclusive lock for all filesystem edits and Git/index operations; use normal clones only for the documented fallback |
| Treating separate files, provider evidence, or free slots as a wide-frontier exception | Test coherent domain/protocol/risk/runtime/release/verification bundles and cite concrete incompatibility evidence for any exception |
| Workers coordinate through Codex chat | Use repository evidence and coordinator-owned artifacts instead |
| Local-only checkpoint treated as a dependency handoff | Reconcile current local/remote `main`, push the coherent commit, and prove ancestry |
| Full suite run after every small substep | Run focused affected tests during implementation and the full suite once at worker completion |
| Long task drifts from `main` | Preserve coherent progress, refresh local and remote `main`, reconcile, and push a checkpoint |
| Dedicated finished worktree retained for convenience | Remove it after final merge and remote proof; never remove a shared lane |
| Worker specification lands while product specification is stale | Integrate the specification, product-specification update or no-impact finding, and required propagation together |
| Living authority updated without downstream propagation | Identify affected downstream workers and update their relevant briefs, specs, plans, prompts, and statuses before they continue |
| Daily progress rewrites the blueprint | Update worker/coordinator status instead |
| Force cleanup saves time | Preserve uncertain work and expose the blocker |

## Stop conditions

Pause with an owner, unblock criterion, and downstream impact when authorities contradict; an authority or readiness result is remote-uninspected; the objective is too broad; a material decision is unapproved; the DAG cycles; semantic ownership overlaps; a migration/generated artifact has competing writers; artifact paths mix blueprints; existing worker state cannot be integrated safely; a genuinely shared checkout lacks its required main-mutation lock and does not qualify for the normal-clone fallback; planning readiness is absent; the global planning gate is open, reopened, stale, incomplete, or lacks evidence/verifier; an execution worker lacks an implemented prerequisite; `origin/main` cannot be pulled or pushed safely after retry; a conflict requires a genuine semantic or cross-owner decision; remote ancestry cannot be proven; a dependant started from feature-only or unpushed work or a stale document; a changed worker specification leaves an affected product specification masterplan stale without an evidence-backed no-impact finding; required downstream propagation is incomplete; or the UI-design boundary would require functional behavior. Another worker using an independent normal clone is never, by itself, a stop condition; in a shared checkout, wait only for the required mutation lock before editing.
