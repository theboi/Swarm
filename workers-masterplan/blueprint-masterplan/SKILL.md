---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across workers, agents, branches, worktrees, clones, or machines; flattening a dependency flowchart; assigning collision-safe ownership; or writing worker briefs, readiness rules, delivery gates, and phase-specific launch prompts.
---

# Blueprint Masterplan

## Overview

Turn current living authorities into a frozen execution contract: establish foundations, expose independently owned trades in parallel, converge through named integration owners, and close through evidence gates.

**Core principle:** Every worker works directly on `main`. Feature branches and Git worktrees are banned. After every independently testable worker subtask or plan substep, verify and commit directly to local `main`, reconcile it with `origin/main`, reverify, and push `origin/main` before starting the next subtask.

Use `docs/plans/EdenMind_Implementation_Masterplan.md` as the structural exemplar when it exists. Generalize its authority boundary and section responsibilities; do not copy project-specific behavior into unrelated blueprints.

## Required companion skills

- **REQUIRED SUB-SKILL:** Use `living-masterplan` when an authority is missing or stable approved information changes.
- **REQUIRED SUB-SKILL:** Use `superpowers:brainstorming` before freezing or materially revising an unsettled blueprint.
- **REQUIRED SUB-SKILL:** Use `grilling` when scope, decomposition, ownership, gates, or acceptance remains materially unsettled.
- **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` before declaring the blueprint valid.
- **REQUIRED WORKER SUB-SKILLS:** Require applicable Superpowers planning, TDD, review, and verification skills in worker briefs or prompts.
- **PROHIBITED WORKER SUB-SKILLS:** Do not use worktree-creation or branch-finishing workflows. A generic skill instruction to create a feature branch or worktree does not apply to a blueprint governed by this skill.

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
11. coordination, direct-main integration, conflict and downstream-change propagation, handoff/cleanup, exclusions, and revision policy.

Read [the blueprint template](references/blueprint-masterplan-template.md) completely before drafting.

The masterplan owns worker boundaries, not worker implementation detail. A worker brief defines outcome, prerequisites, ownership, non-ownership, acceptance evidence, merge condition, and downstream unblock. The assigned worker later authors its own dated Superpowers specification and implementation plan.

## Establish current authority

1. Identify the bounded objective, coordinator, decision owners, requested gates, and confirm that every worker uses local `main` pushed to `origin/main`.
2. Define the exclusive same-checkout mutation lock and cross-checkout main-push lock or queue, verify workers may push `main` to `origin/main`, then pull and inspect `origin/main` without discarding local work.
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

Direct-main work does not make overlapping semantic ownership parallel. Same-checkout workers may inspect and plan concurrently, but only the mutation-lock holder may change files or Git state.

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

1. enters the assigned normal checkout or clone and proves it is on `main` and is not a linked worktree;
2. acquires the mutation lock when the checkout is shared, pulls `origin/main`, proves prerequisites are integrated there, and runs a clean baseline;
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
10. commits the dated specification, affected product specification updates or
    no-impact findings, approved planning artifacts, and propagation updates into
    local `main`, pushes `origin/main`, and hands them off before implementation begins.

Repeat step 6 whenever the dated specification changes. Do not defer this
product-specification maintenance to a different worker or a later delivery
phase. A planning handoff is incomplete while an affected product specification
masterplan is stale.

## Generate launch prompts when needed

Read [the worker prompt templates](references/worker-prompt-templates.md) completely before generating prompts.

Create separate planning and execution prompts when phases may run in different sessions or the user requests a launch packet. Both prompts name the blueprint, living authorities, worker brief, prerequisites, owned/excluded surfaces, artifact paths, status path, `origin/main` integration authority, assigned main checkout or clone, lock/queue mechanisms, synchronization rhythm, and exact terminal condition.

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
| in-progress | The worker claimed its owned scope on `main` and every completed substep is integrated into `origin/main` |
| blocked | A named dependency, decision, conflict, or external condition prevents progress |
| review | Work exists but review, evidence, or integration remains open |
| complete | The coordinator verified `origin/main` integration, handoff, evidence, and a clean main checkout |

An off-main commit, unpushed local `main` commit, stash, or working-tree change never satisfies a hard prerequisite or counts as a completed substep.

Use [the worker status template](references/worker-status-template.md) for active workers and [the coordinator summary template](references/status-summary-template.md) when aggregate coordination is needed. A worker owns only its status file; the coordinator alone owns the aggregate.

## Ban branches and worktrees

All planning, implementation, review fixes, conflict resolution, and documentation updates happen on checked-out `main`.

**No exceptions for new worker work:**

- Do not create, switch to, or continue work on a feature, worker, review, rescue, integration, or temporary branch.
- Do not create or use a linked Git worktree.
- Do not use detached HEAD, stash queues, patch queues, or hidden refs as substitute worker lanes.
- A separate normal clone is allowed only when workers use different machines or cannot share one checkout; every clone remains on `main`.
- On one shared checkout, the exclusive main-mutation lock covers file edits, verification, commits, pulls, merges, and pushes. Other workers may perform read-only planning while they wait.
- Across multiple main-only clones, workers may edit owned surfaces concurrently, but the exclusive main-push lock serializes remote reconciliation, final verification, and pushes.

Legacy convergence below is a one-time transition, not a worker lane. It permits read-only inspection of frozen legacy branches/worktrees but no new edit or commit there.

### Converge existing branch/worktree work before new execution

When adopting this rule in an effort that already has worker branches or worktrees, freeze new edits there and drain them into `main` before launching new implementation:

1. inventory every existing worker branch and worktree, including tracked diffs, untracked files, unpushed commits, review state, ownership, and uncertainty;
2. freeze it against new edits or commits; inspect it read-only and preserve dirty, failing, under-review, or uncertain work with a named owner;
3. for committed legacy work, acquire the main-push lock, update local `main`, merge the existing branch into `main` without rewriting published history, run authoritative verification on `main`, push `origin/main`, and prove every retained commit is reachable there;
4. for dirty or untracked legacy work, create one immutable recovery bundle outside Git containing a binary-capable tracked diff, an untracked-file archive, a manifest, and content hashes; apply it once to local `main` under the mutation/push locks, verify on `main`, commit directly to `main`, push, and prove the resulting `origin/main` content matches the manifest;
5. keep the frozen legacy state and recovery bundle until remote commit/content proof succeeds, then have its owner remove only the now-proven duplicate dirty state, confirm the checkout is clean, and remove the linked worktree without force;
6. delete only fully integrated local and remote worker branches without force; and
7. record a blocker for anything that cannot yet be preserved, integrated, proven, cleaned, or retired.

The recovery bundle is not a patch queue and cannot become an ongoing work surface. All fixes, verification-driven changes, and commits happen on `main`.

No new planning or implementation write phase starts while any legacy worker branch or worktree remains. If a legacy surface cannot be integrated and retired safely, the whole execution is blocked with a named owner and recovery criterion.

## Require the worker execution lifecycle

1. Enter the assigned normal checkout or clone, confirm the current branch is `main`, confirm it is not a linked worktree, and prove every prerequisite/evidence is on `origin/main`.
2. Acquire the applicable main-mutation lock before changing a shared checkout; pull `origin/main` and run a clean baseline.
3. Read the worker-authored approved specification and implementation plan.
4. Implement only owned surfaces with TDD where applicable.
5. After each independently testable plan substep, complete the mandatory continuous-main cycle below before beginning another substep.
6. Stop on semantic, cross-owner, migration, generated-artifact, or contract conflicts.
7. Request/address review and run fresh verification-before-completion.
8. Push every verified substep directly from local `main` to `origin/main`; package, dependency, and gate boundaries add review and evidence requirements but never delay substep integration.
9. Produce an evidence-backed handoff only after integration and a clean main checkout.

In this skill, a completed subtask means an independently testable planning or execution plan substep. The lifecycle's initial main-mutation-lock acquisition covers the first subtask. Before editing every subsequent subtask in a shared checkout, the worker MUST reacquire that lock, reconcile clean local `main` with `origin/main`, and hold the lock through remote reachability proof. After every such subtask, the worker MUST:

1. confirm the applicable main-mutation lock is still held;
2. run focused verification on local `main`;
3. update only its worker-owned status and any owned living-authority or downstream-impact documents;
4. review the exact owned diff and commit only owned verified changes directly to `main`;
5. acquire the exclusive main-push lock or queue slot before remote reconciliation;
6. fetch `origin/main` and merge it into local `main` when the histories diverge, without rebasing or rewriting published history;
7. resolve only mechanical conflicts within owned surfaces and stop on every semantic or cross-owner conflict;
8. rerun affected verification on the reconciled local `main`;
9. push local `main` with `git push origin main`; and
10. fetch and confirm the substep commit is reachable from `origin/main` before releasing both locks; reacquire the mutation lock before editing the next substep.

If the push is rejected because another main-only checkout integrated first, keep the work on local `main`, fetch and merge the new `origin/main`, reverify, and retry under the main-push lock. Never force-push `main`. Never begin the next independently testable substep with a completed local commit still unpushed.

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
5. the authority change and all required downstream document updates are committed directly to `main` and pushed to `origin/main`; and
6. the originating worker records propagation evidence or an explicit evidence-backed finding of no downstream impact.

If the change alters frozen blueprint scope, ownership, dependencies, gates, or completion semantics, the coordinator must issue the required approved blueprint revision. No affected downstream worker may continue from stale documents.

## Complete and clean up safely

A worker is complete only after:

1. fresh full verification;
2. approved direct-main integration;
3. proof its final commit and required downstream-document updates are reachable from `origin/main`;
4. integrated or CI verification;
5. preserved handoff and archival status;
6. a clean assigned main checkout or clone;
7. no worker branch or linked worktree created by the effort; and
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
- verify direct-main, branch/worktree prohibition, synchronization, integration, and cleanup rules;
- verify every completed substep is committed directly to local `main`, reconciled with, and pushed to `origin/main`;
- verify the blueprint names workable main-mutation and main-push locks or queues and workers can push `origin/main`;
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
| Existing branch/worktree effort adopts this rule | Freeze new edits, verify and merge retained work into `main`, push `origin/main`, then safely retire integrated branches/worktrees |
| Worker proposes a branch or worktree | Reject it; use the assigned normal checkout on `main` |
| Worker says done off-main or only locally | Keep dependants not-ready |
| Worker completes a testable substep | Commit directly to `main`, reconcile with `origin/main`, reverify, and push before continuing |
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
| Feature branch or worktree proposed for safety | Enforce ownership plus main-mutation/main-push locks; all work remains on `main` |
| Local-main commit treated as substep completion | Require reconciliation, verification, push to `origin/main`, and ancestry proof |
| Main integration deferred to package completion | Integrate each independently testable substep; use package/gate boundaries for added review, not delayed merging |
| Worker specification lands while product specification is stale | Integrate the specification, product-specification update or no-impact finding, and required propagation together |
| Living authority updated without downstream propagation | Identify affected downstream workers and update their relevant briefs, specs, plans, prompts, and statuses before they continue |
| Daily progress rewrites the blueprint | Update worker/coordinator status instead |
| Force cleanup saves time | Preserve uncertain work and expose the blocker |

## Stop conditions

Pause with an owner, unblock criterion, and downstream impact when authorities contradict; the objective is too broad; a material decision is unapproved; the DAG cycles; ownership overlaps; a migration/generated artifact has competing writers; artifact paths mix blueprints; the checkout is not on `main` or is a linked worktree; legacy branch/worktree state cannot yet be integrated safely; `origin/main` cannot be pulled or pushed safely; remote ancestry cannot be proven; a dependant started from off-main or unpushed work or a stale document; a changed worker specification leaves an affected product specification masterplan stale without an evidence-backed no-impact finding; required downstream propagation is incomplete; a gate lacks evidence/verifier; or safe direct-main coordination cannot be established.
