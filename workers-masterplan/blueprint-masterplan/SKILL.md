---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across workers, agents, branches, worktrees, clones, or machines; flattening a dependency flowchart; assigning collision-safe ownership; or writing worker briefs, readiness rules, delivery gates, and phase-specific launch prompts.
---

# Blueprint Masterplan

## Overview

Turn current living authorities into a frozen execution contract: establish foundations, expose independently owned trades in parallel, converge through named integration owners, and close through evidence gates.

**Core principle:** Maximize safe throughput through continuous verified integration, not worker count. Every independently testable worker subtask or plan substep must be pulled against `origin/main`, merged into local `main`, and pushed to `origin/main` before the worker starts its next subtask.

Use `docs/plans/EdenMind_Implementation_Masterplan.md` as the structural exemplar when it exists. Generalize its authority boundary and section responsibilities; do not copy project-specific behavior into unrelated blueprints.

## Required companion skills

- **REQUIRED SUB-SKILL:** Use `living-masterplan` when an authority is missing or stable approved information changes.
- **REQUIRED SUB-SKILL:** Use `superpowers:brainstorming` before freezing or materially revising an unsettled blueprint.
- **REQUIRED SUB-SKILL:** Use `grilling` when scope, decomposition, ownership, gates, or acceptance remains materially unsettled.
- **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` before declaring the blueprint valid.
- **REQUIRED WORKER SUB-SKILLS:** Require applicable Superpowers planning, worktree, TDD, review, verification, and branch-finishing skills in worker briefs or prompts.

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
11. coordination, continuous-main integration, conflict and downstream-change propagation, handoff/teardown, exclusions, and revision policy.

Read [the blueprint template](references/blueprint-masterplan-template.md) completely before drafting.

The masterplan owns worker boundaries, not worker implementation detail. A worker brief defines outcome, prerequisites, ownership, non-ownership, acceptance evidence, merge condition, and downstream unblock. The assigned worker later authors its own dated Superpowers specification and implementation plan.

## Establish current authority

1. Identify the bounded objective, coordinator, decision owners, requested gates, and confirm that worker integration authority is local `main` pushed to `origin/main`.
2. Define the exclusive main-integration lock or queue, verify workers may push `main` to `origin/main`, then pull and inspect `origin/main` without discarding local work.
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

Worktrees prevent filesystem collisions. They do not make overlapping semantic ownership parallel.

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

1. pulls `origin/main` and proves prerequisites are integrated there;
2. enters its unique isolated branch/worktree or clone;
3. reads the blueprint, relevant living authorities, brief, and prerequisite handoffs;
4. uses Superpowers brainstorming for task-local decisions;
5. writes and obtains approval for its dated specification inside the blueprint specs folder;
6. uses `superpowers:writing-plans` to write its detailed plan inside the blueprint plans folder;
7. updates stable living authorities before implementation depends on changed decisions;
8. propagates any dependency, blocker, contract, acceptance, or implementation impact into every affected downstream worker document through its owner; and
9. integrates the approved planning artifacts and propagation updates into `main`, pushes `origin/main`, and hands them off before implementation begins.

## Generate launch prompts when needed

Read [the worker prompt templates](references/worker-prompt-templates.md) completely before generating prompts.

Create separate planning and execution prompts when phases may run in different sessions or the user requests a launch packet. Both prompts name the blueprint, living authorities, worker brief, prerequisites, owned/excluded surfaces, artifact paths, status path, `origin/main` integration authority, unique branch/workspace, synchronization rhythm, and exact terminal condition.

The planning prompt stops after the worker-authored specification, implementation plan, stable authority updates, and planning handoff. The execution prompt consumes those approved artifacts and continues through implementation, review, integration evidence, handoff, and safe teardown.

## Require remote-evidenced readiness

| State | Meaning |
| --- | --- |
| not-ready | At least one hard prerequisite is not integrated into `origin/main` |
| ready | Every hard prerequisite and required contract is integrated into `origin/main` |
| in-progress | The worker claimed an isolated workspace and every completed substep is integrated into `origin/main` |
| blocked | A named dependency, decision, conflict, or external condition prevents progress |
| review | Work exists but review, evidence, or integration remains open |
| complete | The coordinator verified integration, handoff, evidence, and cleanup |

An unmerged branch may be inspected for coordination. It never satisfies a hard prerequisite or counts as a completed substep.

Use [the worker status template](references/worker-status-template.md) for active workers and [the coordinator summary template](references/status-summary-template.md) when aggregate coordination is needed. A worker owns only its status file; the coordinator alone owns the aggregate.

## Require the worker execution lifecycle

1. Pull `origin/main` and prove every prerequisite/evidence is integrated there.
2. Enter the assigned isolated branch/worktree or clone and run a clean baseline.
3. Read the worker-authored approved specification and implementation plan.
4. Implement only owned surfaces with TDD where applicable.
5. After each independently testable plan substep, complete the mandatory continuous-main cycle below before beginning another substep.
6. Stop on semantic, cross-owner, migration, generated-artifact, or contract conflicts.
7. Request/address review and run fresh verification-before-completion.
8. Integrate every verified substep into `main` and push `main` to `origin/main`; package, dependency, and gate boundaries add review and evidence requirements but never delay substep integration.
9. Produce an evidence-backed handoff and perform safe teardown only after integration.

In this skill, a completed subtask means an independently testable planning or execution plan substep. After every such subtask, the worker MUST:

1. run focused verification on the feature branch;
2. update only its worker-owned status and any owned living-authority or downstream-impact documents;
3. commit only owned verified changes;
4. pull changes from `main` into the feature branch with `git pull --no-rebase origin main`;
5. resolve only mechanical conflicts within owned surfaces and stop on every semantic or cross-owner conflict;
6. rerun affected verification on the reconciled feature branch;
7. acquire the repository's exclusive `main` integration lock or queue slot;
8. update local `main` with `git pull --ff-only origin main`;
9. merge the verified feature-branch substep into local `main` without rewriting published history;
10. run affected verification on the merged local `main`;
11. push local `main` with `git push origin main`; and
12. confirm the integrated substep commit is reachable from `origin/main` before releasing the lock and starting the next substep.

Pushing only the feature branch does not complete a substep. If the `main` push is rejected because another worker integrated first, return to the feature branch, pull the new `origin/main`, reconcile, reverify, and repeat the locked main integration cycle. Never force-push `main`.

Use one feature branch and isolated workspace per worker. Because every worker must update local `main`, use either a worker-private clone or a serialized dedicated integration worktree that the completing worker controls while holding the integration lock. Keep the user's control checkout outside worker ownership. Use separate clones for separate machines or incompatible environments.

## Propagate living-authority changes downstream

Whenever a worker updates a living business, product/specification, architecture, implementation, operations, security, release, or custom masterplan, it MUST assess the direct and transitive downstream workers and gates before integrating the update.

If the authority change affects a dependency, readiness condition, blocker, contract, ownership boundary, acceptance evidence, test expectation, launch instruction, or implementation assumption, the change is incomplete until:

1. the affected downstream set is identified from the DAG and coordination contracts;
2. every affected worker brief, specification, implementation plan, launch prompt, worker status, and coordinator status is updated where relevant;
3. each cross-owned document is updated and approved by its owner rather than overwritten by the upstream worker;
4. affected downstream work is marked blocked or not-ready until its documents and assumptions are current;
5. the authority change and all required downstream document updates are merged into `main` and pushed to `origin/main`; and
6. the originating worker records propagation evidence or an explicit evidence-backed finding of no downstream impact.

If the change alters frozen blueprint scope, ownership, dependencies, gates, or completion semantics, the coordinator must issue the required approved blueprint revision. No affected downstream worker may continue from stale documents.

## Integrate and tear down safely

A worker is complete only after:

1. fresh full verification;
2. approved integration;
3. proof its final commit and required downstream-document updates are reachable from `origin/main`;
4. integrated or CI verification;
5. preserved handoff and archival status;
6. a clean worker-owned worktree;
7. non-forced worktree removal;
8. safe deletion of merged local and remote worker branches; and
9. a coordinator cleanup receipt.

Preserve dirty, unmerged, failing, under-review, or uncertain-ancestry work. Never force normal cleanup.

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
- verify worktree, synchronization, integration, and teardown rules;
- verify every completed substep must be pulled against, merged into, and pushed through `origin/main`;
- verify the blueprint names a workable exclusive main-integration lock or queue and workers can push `origin/main`;
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
| Worker says done off-main | Keep dependants not-ready |
| Worker completes a testable substep | Pull `origin/main`, reverify, merge into local `main`, verify, and push `origin/main` before continuing |
| Living-authority change affects downstream work | Update every relevant downstream document through its owner and block stale work until `origin/main` contains the updates |
| Worker tree is dirty or unmerged | Preserve it and report the cleanup blocker |

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Maximizing worker count | Optimize coherent ownership and safe throughput |
| One worker per independent file | Group related surfaces by outcome and verification |
| Treating slot capacity as graph width | Report both; queued ready work is still logically parallel |
| Coordinator writes every task plan | Coordinator writes briefs; each worker writes its own plan |
| Flat shared specs/plans roots | Use one dated folder per blueprint in both roots |
| Unmerged branch satisfies dependency | Require `origin/main` ancestry and evidence |
| Feature-branch push treated as substep completion | Require merge into local `main`, verification on `main`, push to `origin/main`, and ancestry proof |
| Main integration deferred to package completion | Integrate each independently testable substep; use package/gate boundaries for added review, not delayed merging |
| Living authority updated without downstream propagation | Identify affected downstream workers and update their relevant briefs, specs, plans, prompts, and statuses before they continue |
| Daily progress rewrites the blueprint | Update worker/coordinator status instead |
| Force cleanup saves time | Preserve uncertain work and expose the blocker |

## Stop conditions

Pause with an owner, unblock criterion, and downstream impact when authorities contradict; the objective is too broad; a material decision is unapproved; the DAG cycles; ownership overlaps; a migration/generated artifact has competing writers; artifact paths mix blueprints; `origin/main` cannot be pulled or pushed safely; remote ancestry cannot be proven; a dependant started from an unmerged branch or stale document; required downstream propagation is incomplete; a gate lacks evidence/verifier; or safe isolation/cleanup cannot be established.
