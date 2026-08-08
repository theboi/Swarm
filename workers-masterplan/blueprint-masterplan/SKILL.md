---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across workers, agents, branches, worktrees, clones, or machines; flattening a dependency flowchart; assigning collision-safe ownership; or writing worker briefs, readiness rules, delivery gates, and phase-specific launch prompts.
---

# Blueprint Masterplan

## Overview

Turn current living authorities into a frozen execution contract: establish foundations, expose independently owned trades in parallel, converge through named integration owners, and close through evidence gates.

**Core principle:** Maximize safe throughput, not worker count. A coordinator freezes the execution system; each worker designs and plans its own bounded task.

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
11. coordination, merge/conflict, handoff/teardown, exclusions, and revision policy.

Read [the blueprint template](references/blueprint-masterplan-template.md) completely before drafting.

The masterplan owns worker boundaries, not worker implementation detail. A worker brief defines outcome, prerequisites, ownership, non-ownership, acceptance evidence, merge condition, and downstream unblock. The assigned worker later authors its own dated Superpowers specification and implementation plan.

## Establish current authority

1. Identify the bounded objective, coordinator, remote, base branch, decision owners, and requested gates.
2. Fetch remote state and inspect the current base without discarding local work.
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

1. proves prerequisites are integrated on the remote base;
2. enters its unique isolated branch/worktree or clone;
3. reads the blueprint, relevant living authorities, brief, and prerequisite handoffs;
4. uses Superpowers brainstorming for task-local decisions;
5. writes and obtains approval for its dated specification inside the blueprint specs folder;
6. uses `superpowers:writing-plans` to write its detailed plan inside the blueprint plans folder;
7. updates stable living authorities before implementation depends on changed decisions; and
8. hands off those approved artifacts before implementation begins.

## Generate launch prompts when needed

Read [the worker prompt templates](references/worker-prompt-templates.md) completely before generating prompts.

Create separate planning and execution prompts when phases may run in different sessions or the user requests a launch packet. Both prompts name the blueprint, living authorities, worker brief, prerequisites, owned/excluded surfaces, artifact paths, status path, remote/base, unique branch/workspace, synchronization rhythm, and exact terminal condition.

The planning prompt stops after the worker-authored specification, implementation plan, stable authority updates, and planning handoff. The execution prompt consumes those approved artifacts and continues through implementation, review, integration evidence, handoff, and safe teardown.

## Require remote-evidenced readiness

| State | Meaning |
| --- | --- |
| not-ready | At least one hard prerequisite is not integrated |
| ready | Every hard prerequisite and required contract is integrated |
| in-progress | The worker claimed an isolated workspace and pushed current work |
| blocked | A named dependency, decision, conflict, or external condition prevents progress |
| review | Work exists but review, evidence, or integration remains open |
| complete | The coordinator verified integration, handoff, evidence, and cleanup |

An unmerged branch may be inspected for coordination. It never satisfies a hard prerequisite.

Use [the worker status template](references/worker-status-template.md) for active workers and [the coordinator summary template](references/status-summary-template.md) when aggregate coordination is needed. A worker owns only its status file; the coordinator alone owns the aggregate.

## Require the worker execution lifecycle

1. Fetch the remote base and prove every prerequisite/evidence is integrated.
2. Enter the assigned isolated branch/worktree or clone and run a clean baseline.
3. Read the worker-authored approved specification and implementation plan.
4. Implement only owned surfaces with TDD where applicable.
5. After each independently testable plan substep: verify, update only the worker status, commit owned changes, fetch/incorporate the remote base, resolve only mechanical owned conflicts, reverify, and push.
6. Stop on semantic, cross-owner, migration, generated-artifact, or contract conflicts.
7. Request/address review and run fresh verification-before-completion.
8. Integrate at meaningful package/dependency/gate boundaries, not after every substep.
9. Produce an evidence-backed handoff and perform safe teardown only after integration.

Use one branch and isolated worktree per same-machine worker. Use separate clones for separate machines or incompatible environments. Keep the user's control checkout outside worker ownership.

## Integrate and tear down safely

A worker is complete only after:

1. fresh full verification;
2. approved integration;
3. proof its final commit is reachable from the remote base;
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
| Worker says done off-base | Keep dependants not-ready |
| Worker tree is dirty or unmerged | Preserve it and report the cleanup blocker |

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Maximizing worker count | Optimize coherent ownership and safe throughput |
| One worker per independent file | Group related surfaces by outcome and verification |
| Treating slot capacity as graph width | Report both; queued ready work is still logically parallel |
| Coordinator writes every task plan | Coordinator writes briefs; each worker writes its own plan |
| Flat shared specs/plans roots | Use one dated folder per blueprint in both roots |
| Unmerged branch satisfies dependency | Require remote-base ancestry and evidence |
| Daily progress rewrites the blueprint | Update worker/coordinator status instead |
| Force cleanup saves time | Preserve uncertain work and expose the blocker |

## Stop conditions

Pause with an owner, unblock criterion, and downstream impact when authorities contradict; the objective is too broad; a material decision is unapproved; the DAG cycles; ownership overlaps; a migration/generated artifact has competing writers; artifact paths mix blueprints; remote ancestry cannot be proven; a dependant started from an unmerged branch; a gate lacks evidence/verifier; or safe isolation/cleanup cannot be established.
