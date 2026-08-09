---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across workers, agents, branches, worktrees, clones, or machines; flattening a dependency flowchart; assigning collision-safe ownership; or writing worker briefs, readiness rules, delivery gates, and phase-specific launch prompts.
---

# Blueprint Masterplan

## Overview

Turn current living authorities into a frozen execution contract: establish foundations, expose independently owned trades in parallel, converge through named integration owners, and close through evidence gates.

**Core principle:** Minimize drift between workers. Give every worker exactly one dedicated feature branch in exactly one linked Git worktree, integrate every independently testable worker subtask or plan substep into local `main` immediately, and keep local `main`, `origin/main`, and every active worker branch synchronized. Resolve conflicts at the earliest integration point instead of allowing divergent work to accumulate.

Use `docs/plans/EdenMind_Implementation_Masterplan.md` as the structural exemplar when it exists. Generalize its authority boundary and section responsibilities; do not copy project-specific behavior into unrelated blueprints.

## Required companion skills

- **REQUIRED SUB-SKILL:** Use `living-masterplan` when an authority is missing or stable approved information changes.
- **REQUIRED SUB-SKILL:** Use `superpowers:brainstorming` before freezing or materially revising an unsettled blueprint.
- **REQUIRED SUB-SKILL:** Use `grilling` when scope, decomposition, ownership, gates, or acceptance remains materially unsettled.
- **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` before declaring the blueprint valid.
- **REQUIRED WORKER SUB-SKILLS:** Require applicable Superpowers worktree setup, planning, TDD, review, verification, and branch-finishing skills in worker briefs or prompts.
- **WORKTREE/BRANCH OVERRIDE:** Generic sub-skills do not permit a worker to hold more than one worktree/branch pair, defer integration until the whole package is complete, or leave a finished worktree or branch behind. This skill's continuous integration and cleanup lifecycle is authoritative.

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
11. coordination, worktree/branch integration, drift and conflict control, downstream-change propagation, handoff/cleanup, exclusions, and revision policy.

Read [the blueprint template](references/blueprint-masterplan-template.md) completely before drafting.

The masterplan owns worker boundaries, not worker implementation detail. A worker brief defines outcome, prerequisites, ownership, non-ownership, acceptance evidence, merge condition, and downstream unblock. The assigned worker later authors its own dated Superpowers specification and implementation plan.

## Establish current authority

1. Identify the bounded objective, coordinator, decision owners, requested gates, and one uniquely named feature branch plus linked worktree path per worker.
2. Define the exclusive main-integration lock or queue, verify workers may update local `main` and push `main` to `origin/main`, and prove each worker can pull the latest `origin/main` into local `main` and synchronize its feature branch without discarding local work.
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

Worktree isolation does not make overlapping semantic ownership parallel. One worker owns each mutable surface, each worker has at most one active worktree/branch pair, and only the main-integration-lock holder may pull, merge into local `main`, resolve conflicts there, or push `origin/main`.

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

1. acquires the main-integration lock, proves local `main` is clean, runs `git pull --ff-only origin main`, then enters its assigned linked worktree and proves the assigned feature branch is the only active worktree/branch pair it owns;
2. synchronizes the current local `main` into the feature branch, proves prerequisites are integrated there, and runs a clean baseline;
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
    updates to the feature branch; immediately merges that commit into local
    `main`, pushes `origin/main`, synchronizes the feature branch from the resulting
    `main`, and hands it off before implementation begins.

Repeat step 6 whenever the dated specification changes. Do not defer this
product-specification maintenance to a different worker or a later delivery
phase. A planning handoff is incomplete while an affected product specification
masterplan is stale.

## Generate launch prompts when needed

Read [the worker prompt templates](references/worker-prompt-templates.md) completely before generating prompts.

Create separate planning and execution prompts when phases may run in different sessions or the user requests a launch packet. Both prompts name the blueprint, living authorities, worker brief, prerequisites, owned/excluded surfaces, artifact paths, status path, assigned feature branch and linked worktree, the one-pair-per-worker cap, `origin/main` integration authority, the main-integration lock or queue, synchronization rhythm, and exact terminal condition.

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
| in-progress | The worker claimed its owned scope in its sole feature worktree and every completed substep is integrated into `origin/main` |
| blocked | A named dependency, decision, conflict, or external condition prevents progress |
| review | Work exists but review, evidence, or integration remains open |
| complete | The coordinator verified `origin/main` integration, handoff, evidence, and removal of the finished worker worktree and branch |

A feature-branch-only commit, unpushed local `main` commit, stash, or working-tree change never satisfies a hard prerequisite or counts as a completed substep. A substep becomes complete only when its commit is reachable from `origin/main`.

Use [the worker status template](references/worker-status-template.md) for active workers and [the coordinator summary template](references/status-summary-template.md) when aggregate coordination is needed. A worker owns only its status file; the coordinator alone owns the aggregate.

## Isolate every worker in one worktree and branch

All planning, implementation, review fixes, and documentation updates happen on the worker's assigned feature branch inside its assigned linked Git worktree. Local `main` is the clean integration surface and is kept as close as possible to `origin/main`.

**Mandatory lane rules:**

- One worker owns exactly one uniquely named feature branch in exactly one linked worktree while it is active. Never share a worker worktree.
- Each worker is capped at one active worktree and one active branch at a time. Do not create stacked, rescue, review, conflict, or temporary branches/worktrees around that lane.
- Whenever a branch is created for worker work, create and use it through `git worktree`; do not work on a worker feature branch in the main checkout.
- Do not use detached HEAD, stash queues, patch queues, or hidden refs as substitute lanes.
- Keep the main checkout clean and reserved for integration. The exclusive main-integration lock covers updating local `main`, merging a worker branch, resolving conflicts on `main`, verification required by that merge, and pushing `origin/main`.
- Run `git pull --ff-only origin main` in local `main` immediately before each integration. After each successful push, prove the integrated commit is on `origin/main`, then fast-forward or merge the resulting local `main` into the still-active worker branch before the worker starts another substep.
- As soon as a worker's final substep is integrated and remotely proven, remove its linked worktree and delete its fully merged local feature branch immediately. Delete any remote counterpart if one was created. Never force-remove uncertain or unintegrated work.

If a worker already owns a worktree/branch pair, reuse it. Before creating a replacement, either integrate and remove the existing pair through the normal lifecycle or record a blocker with an owner and recovery criterion.

## Require the worker execution lifecycle

1. Confirm the main checkout is clean; acquire the main-integration lock, run `git pull --ff-only origin main`, and prove every prerequisite/evidence is present there.
2. Create or enter the worker's sole linked worktree and feature branch, merge current local `main` into it, and run a clean baseline before editing.
3. Read the worker-authored approved specification and implementation plan.
4. Implement only owned surfaces with TDD where applicable.
5. After each independently testable planning or execution substep, complete the mandatory continuous-integration cycle below before beginning another substep.
6. Stop on semantic, cross-owner, migration, generated-artifact, or contract conflicts.
7. Request/address review and run fresh verification-before-completion.
8. Merge every verified feature-branch substep into local `main` and push it to `origin/main`; package, dependency, and gate boundaries add review and evidence requirements but never delay substep integration.
9. Produce an evidence-backed handoff only after integration, remote reachability proof, and immediate removal of the finished worker worktree and branch.

In this skill, a completed subtask means an independently testable planning or execution plan substep. After every such substep, the worker MUST:

1. run focused verification in its feature worktree;
2. update only its worker-owned status and any owned living-authority or downstream-impact documents;
3. review the exact owned diff and commit only owned verified changes to its local feature branch;
4. acquire the exclusive main-integration lock or queue slot immediately;
5. update clean local `main` with `git pull --ff-only origin main`;
6. merge the feature branch into local `main`;
7. if conflicts occur, resolve them immediately, stop for every semantic or cross-owner decision, and rerun affected verification on the reconciled local `main`;
8. if the merge is conflict-free, assess clash risk: omit duplicate post-merge verification only when the incoming changes clearly do not touch or affect the substep's surfaces, contracts, generated artifacts, migrations, or tests; when uncertain, reverify;
9. push local `main` with `git push origin main`, fetch, and confirm the substep commit is reachable from `origin/main`;
10. while the worker remains active, synchronize its feature branch to the resulting local `main` before releasing the lock and starting the next substep; or, after its final substep, remove the worktree and fully merged branch immediately.

If another integration reaches `origin/main` first or the push is rejected, keep the worker commit preserved, pull the new `origin/main` into local `main`, merge or resolve immediately, reverify affected behavior, and retry under the main-integration lock. Never force-push `main`. Never begin the next independently testable substep with a completed feature-branch commit absent from `origin/main` or with the feature branch behind the resulting main.

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
3. each cross-owned document is updated and approved by its owner rather than overwritten by the upstream worker;
4. affected downstream work is marked blocked or not-ready until its documents and assumptions are current;
5. the authority change and all required downstream document updates are verified and committed on the owning feature branch, then immediately merged into local `main` and pushed to `origin/main`; and
6. the originating worker records propagation evidence or an explicit evidence-backed finding of no downstream impact.

If the change alters frozen blueprint scope, ownership, dependencies, gates, or completion semantics, the coordinator must issue the required approved blueprint revision. No affected downstream worker may continue from stale documents.

## Complete and clean up safely

A worker is complete only after:

1. fresh full verification;
2. approved feature-branch integration into local `main`;
3. proof its final commit and required downstream-document updates are reachable from `origin/main`;
4. integrated or CI verification;
5. preserved handoff and archival status;
6. a clean main checkout;
7. removal of the worker's finished linked worktree and fully merged local and remote feature branch; and
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
- verify one-worktree/one-branch-per-worker isolation, synchronization, integration, and immediate cleanup rules;
- verify every completed substep is verified and committed on its feature branch, immediately merged into local `main`, reconciled with, and pushed to `origin/main`;
- verify the blueprint names a workable main-integration lock or queue and workers can pull and push `origin/main`;
- verify conflict-free merges use an explicit clash-risk assessment and every conflict or uncertain integration triggers affected reverification;
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
| Worker already has a branch/worktree | Reuse its sole assigned pair; integrate and remove it before creating another |
| Worker proposes a second branch or worktree | Reject it; one active worktree/branch pair per worker |
| Worker says done on its feature branch or only locally | Keep dependants not-ready |
| Worker completes a testable substep | Verify and commit on the feature branch; immediately merge to updated local `main`, reverify on conflict or uncertainty, push `origin/main`, and resynchronize the branch |
| Worker finishes its final substep | Prove `origin/main` integration, then immediately remove the worktree and branch |
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
| Worker creates extra branches/worktrees for safety | Enforce exactly one dedicated worktree/branch pair per worker |
| Feature-branch commit treated as substep completion | Require immediate merge to current local `main`, push to `origin/main`, and ancestry proof |
| Main integration deferred to package completion | Integrate each independently testable substep; use package/gate boundaries for added review, not delayed merging |
| Every clean merge is retested mechanically | Skip duplicate post-merge verification only after a positive low-clash-risk assessment; conflicts or uncertainty require reverification |
| Finished worktree or branch retained for convenience | Remove it immediately after its final merge and remote proof |
| Worker specification lands while product specification is stale | Integrate the specification, product-specification update or no-impact finding, and required propagation together |
| Living authority updated without downstream propagation | Identify affected downstream workers and update their relevant briefs, specs, plans, prompts, and statuses before they continue |
| Daily progress rewrites the blueprint | Update worker/coordinator status instead |
| Force cleanup saves time | Preserve uncertain work and expose the blocker |

## Stop conditions

Pause with an owner, unblock criterion, and downstream impact when authorities contradict; the objective is too broad; a material decision is unapproved; the DAG cycles; ownership overlaps; a migration/generated artifact has competing writers; artifact paths mix blueprints; a worker owns more than one active worktree or branch; a worker branch is not in its assigned linked worktree; existing worker state cannot yet be integrated or retired safely; `origin/main` cannot be pulled or pushed safely; a conflict requires a semantic or cross-owner decision; remote ancestry cannot be proven; a dependant started from feature-only or unpushed work or a stale document; a changed worker specification leaves an affected product specification masterplan stale without an evidence-backed no-impact finding; required downstream propagation is incomplete; a gate lacks evidence/verifier; or safe main-integration coordination cannot be established.
