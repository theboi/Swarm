---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across workers, agents, branches, worktrees, clones, or machines; flattening a dependency flowchart; assigning collision-safe ownership; or writing worker briefs, readiness rules, delivery gates, and phase-specific launch prompts.
---

# Blueprint Masterplan

## Overview

Turn current living authorities into a frozen execution contract: establish foundations, expose independently owned trades in parallel, converge through named integration owners, and close through evidence gates.

**Core principle:** Minimize drift while maximizing delivery. Workers never communicate with one another through Codex chats. They work their assigned surfaces alongside concurrent workers on `main`, including when they share the branch or checkout, and treat that coexistence as normal rather than a blocker. Keep local `main` and `origin/main` current: pull before starting, refresh at meaningful checkpoints, and commit/push coherent progress when work runs long. Write code and tests continuously, run only the relevant test segment during implementation, and run the full suite once at the end of all tasks owned by that worker.

Use `docs/plans/EdenMind_Implementation_Masterplan.md` as the structural exemplar when it exists. Generalize its authority boundary and section responsibilities; do not copy project-specific behavior into unrelated blueprints.

## Required companion skills

- **REQUIRED SUB-SKILL:** Use `living-masterplan` when an authority is missing or stable approved information changes.
- **REQUIRED SUB-SKILL:** Use `superpowers:brainstorming` before freezing or materially revising an unsettled blueprint.
- **REQUIRED SUB-SKILL:** Use `grilling` when scope, decomposition, ownership, gates, or acceptance remains materially unsettled.
- **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` before declaring the blueprint valid.
- **REQUIRED WORKER SUB-SKILLS:** Require applicable Superpowers planning, TDD, review, and verification skills in worker briefs or prompts.
- **COEXISTENCE OVERRIDE:** Workers operate directly on `main`; sharing the branch or checkout is allowed and expected. Generic sub-skills must not create feature lanes, turn shared-main work into a blocker, or require worker-to-worker Codex chat. Workers preserve unrelated changes, stage only owned paths, and use repository state plus coordinator-owned artifacts as the coordination surface.
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

The masterplan owns worker boundaries, not worker implementation detail. A worker brief defines outcome, prerequisites, ownership, non-ownership, acceptance evidence, merge condition, and downstream unblock. The assigned worker later authors its own dated Superpowers specification and implementation plan.

## Establish current authority

1. Identify the bounded objective, coordinator, decision owners, requested gates, owned surfaces, and the normal `main` checkout or clone each worker will use.
2. Define the main-integration lock or optimistic retry procedure, verify workers may pull local `main` and push to `origin/main`, and prove each worker can refresh without discarding any worker's changes.
3. Read relevant business, product, architecture, implementation, operations, security, and custom authorities.
4. Read existing code, migrations, tests, generated artifacts, components, and operational foundations that constrain decomposition.
5. Use `living-masterplan` before freezing when an authority is missing or stable approved information changed.
6. Stop when a contradiction or unanswered decision makes scope, ownership, dependencies, or acceptance unreliable.

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

Checkout or clone separation does not make overlapping semantic ownership parallel. One worker owns each mutable surface. Multiple workers may share `main` or its checkout, but each preserves unrelated changes, stages only owned paths, and checks current repository state before editing, committing, pulling, or pushing. Use the main-integration lock when available; otherwise fetch, reconcile, and retry without treating concurrent progress as a blocker.

## Build a moderately flat DAG

Start from real contract and evidence dependencies. Remove convenience sequencing and wave-wide barriers.

For a multi-worker objective, target **three to seven concurrently ready workers** in each substantive post-foundation trade layer. This is a design band:

- roots, contract foundations, joins, gates, closeout, and small objectives may be narrower;
- a layer may exceed seven only when packages remain independently coherent and grouping would create unsafe ownership or verification; and
- record a structural reason for every substantive exception.

Flatten a serial wrapper when it owns no distinct surface, contract, decision, or acceptance evidence. Split an oversized worker only when every child has:

- one coherent outcome and useful downstream handoff;
- non-overlapping mutable ownership;
- independently producible acceptance evidence; and
- enough work to justify planning, review, integration, and status overhead.

When a frontier exceeds seven, group related micro-surfaces by domain, protocol, risk, or shared verification. Keep migrations, generated artifacts, central facades, and tightly coupled files under one owner. Never invent hard edges to narrow the drawing.

Measure logical readiness independently from active execution slots. Ready-but-unscheduled work remains `ready`.

## Record graph-shape evidence

Every blueprint records:

| Metric | Required evidence |
| --- | --- |
| Worker nodes | Count and why each package is coherent |
| Hard edges | Count and why remote integration is required |
| Layer widths | Worker IDs in each substantive ready frontier |
| Peak ready width | Widest logical frontier |
| Active execution slots | Current capacity, separate from graph width |
| Width exceptions | Structural reason for layers outside three to seven |

Validate that the graph is acyclic; every node exists; every arrow matches written `Depends on` and `Unblocks`; gates are real nodes; and coordination-only relationships are not hard edges.

If a cycle appears, redesign ownership or the interface. Do not hide it in prose.

## Write worker briefs, not worker plans

Each masterplan brief contains:

- stable worker/task ID and bounded outcome;
- hard prerequisites and immediate-start rule;
- owned and excluded surfaces;
- coordination relationships that are not hard dependencies;
- work outcomes, not step-by-step implementation instructions;
- exact acceptance evidence;
- merge condition; and
- downstream nodes and supplied contracts/evidence.

The coordinator reserves artifact paths but does not pre-author the worker's detailed specification or implementation plan.

Each worker's planning phase:

1. inspects the live worktree without disturbing unrelated changes, fetches `origin/main`, and fast-forwards clean local `main` with `git pull --ff-only origin main` when safe;
2. synchronizes its assigned `main` checkout with current local and remote `main`, proves prerequisites are integrated there, and records the relevant baseline without running the full suite;
3. reads the blueprint, relevant living authorities, brief, and prerequisite handoffs;
4. uses Superpowers brainstorming for task-local decisions;
5. writes and obtains approval for its dated specification inside the blueprint specs folder;
6. immediately identifies every affected product specification masterplan and
   consolidates all approved changes from the dated specification into the
   high-level frontend-to-backend product contract, or records an
   evidence-backed no-impact finding;
7. uses `superpowers:writing-plans` to write its detailed plan inside the blueprint plans folder;
8. updates other stable living authorities before implementation depends on changed decisions;
9. propagates any dependency, blocker, contract, acceptance, or implementation impact into every affected downstream worker document through its owner; and
10. verifies and commits the dated specification, affected product specification
    updates or no-impact findings, approved planning artifacts, and propagation
    updates; refreshes from local and remote `main`, reconciles concurrent changes,
    pushes the coherent planning checkpoint, and hands it off before implementation begins.

Repeat step 6 whenever the dated specification changes. Do not defer this
product-specification maintenance to a different worker or a later delivery
phase. A planning handoff is incomplete while an affected product specification
masterplan is stale.

## Generate launch prompts when needed

Read [the worker prompt templates](references/worker-prompt-templates.md) completely before generating prompts.

Create separate planning and execution prompts when phases may run in different sessions or the user requests a launch packet. Both prompts name the blueprint, living authorities, worker brief, prerequisites, owned/excluded surfaces, artifact paths, status path, assigned `main` checkout or clone, whether it is shared, `origin/main` integration authority, synchronization rhythm, focused-test cadence, final full-suite requirement, the ban on worker-to-worker Codex chat, and the exact terminal condition.

The planning prompt stops after the worker-authored specification, affected
product-specification consolidation or no-impact findings, implementation plan,
stable authority updates, and planning handoff. The execution prompt consumes
those approved artifacts and continues through implementation, review,
integration evidence, handoff, and clean-main completion.

## Require remote-evidenced readiness

| State | Meaning |
| --- | --- |
| not-ready | At least one hard prerequisite is not integrated into `origin/main` |
| ready | Every hard prerequisite and required contract is integrated into `origin/main` |
| in-progress | The worker claimed its owned surfaces, refreshed local `main` from `origin/main`, and is producing coherent checkpoints |
| blocked | A named dependency, decision, conflict, or external condition prevents progress |
| review | Work exists but review, evidence, or integration remains open |
| complete | The coordinator verified final full-suite evidence, `origin/main` integration, handoff, and cleanup of any dedicated temporary lane |

A feature-branch-only commit, unpushed local commit, stash, or working-tree change never satisfies a hard prerequisite. A dependency handoff becomes ready only when its coherent commit is reachable from `origin/main`.

Use [the worker status template](references/worker-status-template.md) for active workers and [the coordinator summary template](references/status-summary-template.md) when aggregate coordination is needed. A worker owns only its status file; the coordinator alone owns the aggregate.

## Keep every worker current on `main`

All planning, implementation, review fixes, and documentation updates happen directly on checked-out `main`. A separate normal clone is optional; multiple workers may work on the same branch or checkout. Local `main` and `origin/main` remain the integration truth.

**Mandatory lane rules:**

- Workers are banned from messaging, following up with, or handing off to other workers through Codex chats. Publish progress through commits, owned status/handoff artifacts, and coordinator-owned summaries.
- Never stop merely because another worker is active on `main` or in the same checkout. Inspect live status, respect surface ownership, and continue on owned files.
- Never reset, overwrite, clean, stash, or reformat another worker's changes. Stage explicit owned paths and review the exact staged diff before committing.
- Fetch `origin/main` before starting. Fast-forward clean local `main` with `git pull --ff-only origin main` and reconcile concurrent changes safely.
- Refresh again at meaningful checkpoints, before a dependency handoff, before final verification, and whenever a long-running task risks drift. Commit and push coherent progress rather than waiting indefinitely for the entire task.
- Before every push, fetch and reconcile concurrent upstream changes. If rejected, preserve all work, integrate the new remote state, run the affected focused tests, and retry. Never force-push `main`.
- Do not create new feature branches or linked worktrees. Preserve legacy or uncertain lanes and retire them only after final integration and remote proof.

## Require the worker execution lifecycle

1. Inspect the current checkout and preserve all unrelated changes; fetch `origin/main`, fast-forward clean local `main` when safe, and prove every prerequisite/evidence is current.
2. Enter the assigned `main` checkout, reconcile it with `origin/main`, and inspect the relevant baseline before editing.
3. Read the worker-authored approved specification and implementation plan.
4. Implement only owned surfaces with TDD where applicable.
5. Write code and tests in coherent chunks. Run only the test segment relevant to changed behavior at meaningful checkpoints; do not run the full suite at every small turning point.
6. Resolve ordinary concurrent edits and conflicts within owned surfaces. Escalate only a genuine semantic, ownership, migration, generated-artifact, or contract decision, through the coordinator rather than another worker's Codex chat.
7. If the task runs long, commit coherent progress, fetch and reconcile local/remote `main`, run affected focused tests, and push the checkpoint to reduce drift.
8. Request/address review and run fresh focused verification for the completed owned scope.
9. After all tasks owned by the worker are finished, refresh from local and remote `main`, run the full suite once, integrate and push the final state, prove remote reachability, and produce the evidence-backed handoff.

**Verification and synchronization cadence:**

1. Before work: fetch `origin/main`, update clean local `main`, and reconcile the assigned lane.
2. During work: prioritize writing code and tests. Run the narrow affected test segment after a coherent implementation chunk, before publishing a checkpoint, or when diagnosing a failure—not after every edit.
3. During long tasks: use judgment. When drift risk grows, preserve a coherent commit, fetch/pull, reconcile, run only affected tests, and push.
4. At worker completion: refresh again, run the full suite once, fix failures, then integrate and push final evidence.
5. On shared `main` or a shared checkout: never use worker-to-worker Codex chat. Inspect live repository state, stage only owned paths, preserve concurrent changes, and retry safely after upstream movement.

## Propagate living-authority changes downstream

Whenever a worker updates a living business, product/specification, architecture, implementation, operations, security, release, or custom masterplan, it MUST assess the direct and transitive downstream workers and gates before integrating the update.

Writing or modifying a dated task specification always requires this assessment
for every affected product specification masterplan. The worker must consolidate
all and only approved product behavior into one high-level frontend-to-backend
contract in the same planning substep, or record an evidence-backed no-impact
finding. Do not use available-now, approved-future, deferred, worker, or
delivery-history categories in that product specification masterplan.

If the authority change affects a dependency, readiness condition, blocker, contract, ownership boundary, acceptance evidence, test expectation, launch instruction, or implementation assumption, the change is incomplete until:

1. the affected downstream set is identified from the DAG and coordination contracts;
2. every affected worker brief, specification, implementation plan, launch prompt, worker status, and coordinator status is updated where relevant;
3. the originating worker records the impact in its owned artifact; the coordinator or owning worker consumes that repository evidence without direct worker-to-worker Codex chat, and no worker overwrites a cross-owned document;
4. affected downstream work is marked blocked or not-ready until its documents and assumptions are current;
5. the authority change and all required downstream document updates are verified with the relevant focused checks, committed as a coherent checkpoint, reconciled with current local and remote `main`, and pushed to `origin/main`; and
6. the originating worker records propagation evidence or an explicit evidence-backed finding of no downstream impact.

If the change alters frozen blueprint scope, ownership, dependencies, gates, or completion semantics, the coordinator must issue the required approved blueprint revision. No affected downstream worker may continue from stale documents.

## Complete and clean up safely

A worker is complete only after:

1. one fresh full-suite run after all of the worker's owned tasks are finished;
2. approved integration into current local `main`;
3. proof its final commit and required downstream-document updates are reachable from `origin/main`;
4. integrated or CI verification;
5. preserved handoff and archival status;
6. a clean main checkout;
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
- test initial, blocked, review, and completion readiness;
- verify worker-to-worker Codex chat is prohibited and repository/coordinator artifacts carry coordination;
- verify shared `main` checkouts are accepted, surface ownership is explicit, unrelated changes are preserved, and only owned paths are staged;
- verify workers refresh local `main` from `origin/main` before work, at meaningful or long-task checkpoints, and before final verification/integration;
- verify implementation uses focused test segments and each worker runs the full suite only once after all owned tasks finish;
- verify workers can pull, reconcile, and push `origin/main`, with a safe optimistic retry path when no integration lock exists;
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
| Independent packages share merged contracts | Expose them in the same ready frontier |
| Layer narrower than three | Remove artificial edges or record the bottleneck |
| Layer wider than seven | Group coherent micro-surfaces or justify the exception |
| Fewer active slots than ready workers | Keep the DAG flat and schedule from the ready queue |
| Shared file/schema/generated output | Assign one owner or sequence behind its merge |
| Worker needs detailed steps | Worker authors its own spec and plan after launch |
| Worker specification is created or changed | Consolidate approved changes into every affected product specification in the same planning substep, or record no impact |
| Workers share `main` or a checkout | Continue on explicitly owned surfaces; inspect live state and stage only owned paths |
| Worker tries to message another worker in Codex | Ban the chat; publish through commits, owned artifacts, and coordinator summaries |
| Worker says done on its feature branch or only locally | Keep dependants not-ready |
| Worker reaches a meaningful checkpoint | Run the relevant test segment, commit coherent progress, refresh local/remote `main`, and push when drift risk warrants |
| Worker finishes all owned tasks | Refresh, run the full suite once, push and prove `origin/main`, then remove only dedicated temporary lanes |
| Living-authority change affects downstream work | Update every relevant downstream document through its owner and block stale work until `origin/main` contains the updates |
| Main checkout is dirty or has unpushed commits | Preserve it and report the integration blocker |

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Maximizing worker count | Optimize coherent ownership and safe throughput |
| One worker per independent file | Group related surfaces by outcome and verification |
| Treating slot capacity as graph width | Report both; queued ready work is still logically parallel |
| Coordinator writes every task plan | Coordinator writes briefs; each worker writes its own plan |
| Flat shared specs/plans roots | Use one dated folder per blueprint in both roots |
| Shared `main` treated as a blocker | Continue safely on owned paths and preserve concurrent changes |
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

Pause with an owner, unblock criterion, and downstream impact when authorities contradict; the objective is too broad; a material decision is unapproved; the DAG cycles; semantic ownership overlaps; a migration/generated artifact has competing writers; artifact paths mix blueprints; existing worker state cannot be integrated safely; `origin/main` cannot be pulled or pushed safely after retry; a conflict requires a genuine semantic or cross-owner decision; remote ancestry cannot be proven; a dependant started from feature-only or unpushed work or a stale document; a changed worker specification leaves an affected product specification masterplan stale without an evidence-backed no-impact finding; required downstream propagation is incomplete; or a gate lacks evidence/verifier. Another worker using the same `main` branch or checkout is never, by itself, a stop condition.
