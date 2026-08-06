---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across independent workers, agents, branches, worktrees, clones, or machines, especially when dependencies, ownership, blocker visibility, delivery gates, Git synchronization, or collision avoidance must be explicit.
---

# Blueprint Masterplan

## Overview

Turn current living authorities into a frozen construction-style execution contract: foundations first, independently owned trades in parallel, integration and evidence gates afterward.

**Core principle:** Parallelize only work with independent ownership and merged contracts. Remote integration state—not local claims or private branches—decides readiness.

## Required companion skills

- **REQUIRED SUB-SKILL:** Use `living-masterplan` to bootstrap missing authorities or maintain affected authorities when stable information changes.
- **REQUIRED SUB-SKILL:** Use `grill-me` when scope, decomposition, ownership, gates, or acceptance criteria remain materially unsettled.
- **REQUIRED SUB-SKILL:** Use `superpowers:brainstorming` before freezing or materially revising the blueprint.
- **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` before claiming the graph, ownership, status, or gate contract is valid.
- **REQUIRED WORKER SUB-SKILLS:** Require `superpowers:using-git-worktrees`, `superpowers:writing-plans`, `superpowers:test-driven-development` where applicable, `superpowers:requesting-code-review`, and `superpowers:verification-before-completion` in worker briefs.
- **REQUIRED CLOSEOUT SUB-SKILL:** Require `superpowers:finishing-a-development-branch` for integration and teardown.

The generated blueprint must require workers to use applicable Superpowers planning, TDD, review, worktree, verification, and branch-finishing skills.

## Establish current authority

1. Identify the bounded delivery objective, remote, base branch, coordinator, and requested gates.
2. Fetch remote state and inspect the current base branch without discarding local work.
3. Find and read the relevant business, product, architecture, implementation, operations, and custom living masterplans.
4. Confirm that their scope and evidence cover the objective.
5. If an authority is missing, use `living-masterplan` bootstrap mode.
6. If new stable information appears, use `living-masterplan` maintenance mode and commit the approved update before freezing the blueprint.
7. Stop when contradictions or unanswered decisions would make ownership, dependencies, or acceptance unreliable.

Do not rerun living-masterplan bootstrap merely because this is a new session. Existing current authorities are inputs; maintain them only when evidence or decisions changed.

## Blueprint workflow

1. **Map the foundations.** Inventory reusable modules, infrastructure, components, migrations, generated artifacts, contracts, tests, and operational patterns.
2. **Map mutable surfaces.** List every file, schema, migration sequence, shared component, API contract, generated output, environment, and decision record likely to change.
3. **Pressure-test the delivery boundary.** Use Grill Me and Superpowers brainstorming for unresolved scope, gates, ownership, or success criteria.
4. **Decompose into worker packages.** Give each one a bounded outcome, prerequisites, ownership, non-ownership, acceptance evidence, merge condition, and unblock target.
5. **Build the dependency DAG.** Add hard edges only for contracts or evidence that must be integrated first. Add optional gates as real nodes.
6. **Design execution isolation.** Assign one branch and worktree or clone per worker, with a distinct status file.
7. **Write the blueprint and coordination contracts.** Use the bundled templates.
8. **Validate graph, ownership, readiness, gates, and teardown.**
9. **Obtain approval and commit the frozen snapshot.**

Read [the blueprint template](references/blueprint-masterplan-template.md) completely before drafting. Follow established project paths; otherwise default the blueprint to `docs/plans` and coordination files to `docs/workers/<blueprint-id>`.

## Decompose like a construction project

Apply this sequence:

1. **Survey and authority:** settle approved scope and current site conditions.
2. **Foundation:** merge shared types, seams, contracts, migrations, or ownership maps.
3. **Independent trades:** run packages in parallel only when they do not contend for a mutable surface.
4. **Assembly:** designate an integration owner for cross-package wiring and combined evidence.
5. **Inspection gates:** verify observable outcomes such as UI Demo, MVP, security review, pilot, or release.
6. **Closeout:** integrate, hand off, remove temporary workspaces, and delete merged worker branches.

One shared mutable surface has one owner. When two proposed workers edit the same central file, migration sequence, generated artifact, or contract, do one of:

- assign the entire surface to one foundation or integration worker;
- sequence the packages with a remote-merge dependency; or
- first refactor behind an approved, merged interface.

Do not call overlapping edits “parallel” merely because Git can create two branches.

## Build and validate the dependency graph

For every worker and gate, define:

- stable ID and outcome;
- hard prerequisites;
- owned and excluded surfaces;
- supplied contract or evidence;
- acceptance evidence;
- merge condition; and
- exact downstream nodes unblocked.

Validate:

- the graph is acyclic;
- every referenced node exists;
- every diagram edge matches written `Depends on` and `Unblocks` fields;
- every non-root node has a justified predecessor or explicit immediate-start rule;
- every shared mutable surface has exactly one owner;
- every gate has measurable evidence, a verifier, failure ownership, and a downstream consequence; and
- coordination-only relationships are not mislabeled as hard dependencies.

If a cycle appears, redesign ownership or the interface. Never hide the cycle in prose.

## Require the worker lifecycle

Put this contract in every blueprint:

1. Fetch the remote base and confirm every hard prerequisite is integrated with required evidence.
2. Enter a unique isolated worktree or clone and run a clean baseline.
3. Read the blueprint, living authorities, worker brief, and prerequisite handoffs.
4. Use Superpowers brainstorming for task-specific decisions.
5. Write the approved dated task specification and implementation plan.
6. Maintain living masterplans before implementation depends on newly approved stable contracts.
7. Implement with TDD where applicable, request review, and verify.
8. After each completed plan substep:
   - run focused verification;
   - update only the worker-owned status file;
   - commit only owned changes;
   - fetch and rebase or incorporate the remote base;
   - resolve mechanical conflicts within ownership;
   - stop on semantic or cross-owner conflicts;
   - rerun affected checks; and
   - push before the next substep.
9. Merge at dependency boundaries, completed packages, or gates—not after every substep.
10. Produce the evidence-backed handoff and perform safe teardown after integration.

An unmerged branch may be inspected for coordination. It never satisfies a hard prerequisite.

## Isolate workers on one machine

Require one worktree and one named feature branch per worker.

1. Detect whether the session is already in a linked worktree; distinguish submodules.
2. Prefer the platform's native worktree facility.
3. Otherwise use `superpowers:using-git-worktrees` and an ignored project-local `.worktrees/<worker-id>` directory.
4. Install project dependencies inside the isolated workspace as required.
5. Run a clean baseline before implementation.
6. Keep the user's control checkout out of worker ownership; user branch switches there must not alter worker files.

Use separate clones for separate machines, incompatible environments, or intentionally independent repository-level configuration. Do not default to full clones for ordinary same-machine file isolation.

Worktrees prevent filesystem collisions, not semantic merge conflicts. Ownership and dependency rules still apply.

## Determine readiness and blockers

Use these effective states:

| State | Remote-evidenced meaning |
| --- | --- |
| not-ready | at least one hard prerequisite is not integrated |
| ready | all hard prerequisites and contracts are integrated |
| in-progress | isolated workspace is claimed and current work is pushed |
| blocked | a named dependency, decision, conflict, or external condition prevents progress |
| review | implementation exists but review, evidence, or integration remains open |
| complete | coordinator verified integration and cleanup evidence |

Read [the worker status template](references/worker-status-template.md) completely before creating worker files. Each active worker owns only its unique status file on its branch.

Read [the coordinator summary template](references/status-summary-template.md) completely before creating or updating `STATUS.md). The coordinator alone owns the aggregate and must fetch the base plus active remote branches before reporting:

- ready and active workers;
- blockers, owners, unblock criteria, and downstream impact;
- stale branches or missing status;
- verification and review gaps;
- pending, passed, or failed gates;
- critical path and newly unblocked work; and
- integration and cleanup receipts.

If fetch fails, label the snapshot stale. Recompute readiness from remote ancestry and evidence; do not copy optimistic worker states.

## Complete and tear down workers safely

A worker reaches final completion only through this sequence:

1. Run fresh full verification on the worker tree.
2. Integrate through the approved path.
3. Prove the worker's final commit is reachable from the remote base.
4. Verify the integrated result or required CI evidence.
5. Preserve the merged handoff and archival worker status.
6. Confirm the worker-owned worktree is clean.
7. Remove only that owned worktree without force.
8. Prune stale worktree registrations.
9. Safely delete the merged local feature branch.
10. Delete the matching remote feature branch.
11. Give the coordinator a cleanup receipt; the coordinator records `complete`.

If work is dirty, unmerged, failing, under review, or of uncertain ancestry, stop cleanup and report the exact blocker. Never use forced worktree removal or `git branch -D` for normal completion.

Active workers retain their branches. When the execution effort closes, only the original long-lived branch, normally `main`, remains from that effort.

## Verify and freeze

Before committing a blueprint:

- re-read every cited living authority;
- confirm new stable information was promoted first;
- compare the Mermaid graph with every worker brief;
- check for cycles, missing nodes, duplicate ownership, and unnamed mutable surfaces;
- verify optional gates can be omitted and requested gates are evidence-based;
- check worker and coordinator status paths are unique;
- test readiness outcomes for initial, blocked, review, and complete examples;
- verify worktree rules protect the user's control checkout;
- verify merge cadence does not require every substep on the base branch;
- verify teardown cannot delete dirty or unmerged work;
- scan for incomplete language and unsupported assumptions; and
- review the diff for unrelated living-authority changes.

Ordinary progress updates status files, not the frozen blueprint. Revise the blueprint explicitly only after living authorities change and the revision updates graph, briefs, ownership, gates, and readiness together.

## Quick reference

| Situation | Required response |
| --- | --- |
| Living authority missing or stale | Bootstrap or maintain it before blueprint work |
| Independent packages have merged interfaces | Run them in parallel |
| Workers edit the same shared file or sequence | Assign one owner, order them, or refactor first |
| Several local workers share one machine | Give each a unique worktree and branch |
| Workers run on separate machines | Use separate clones and the same remote protocol |
| Worker says done but commit is not on base | Keep dependants not-ready |
| User requests UI Demo or MVP | Add evidence-based gate nodes |
| Worker branch is dirty or under review | Preserve it; cleanup is blocked |
| All workers integrated | Verify receipts, delete worker branches, preserve base |

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Maximizing worker count | Maximize independent ownership and safe throughput |
| Letting several sessions use one checkout | Isolate with worktrees or separate-machine clones |
| Merging every substep into `main` | Push substeps; merge only at meaningful boundaries |
| Treating a pushed branch as a prerequisite | Require remote base ancestry and evidence |
| Giving every worker broad “shared” ownership | Name one owner per mutable surface |
| Updating the frozen blueprint with daily progress | Update worker and coordinator status |
| Deleting a PR worktree to save space | Preserve it until integration and review finish |
| Using force deletion during normal closeout | Stop and expose the unmerged or dirty state |

## Stop conditions

Pause and report an owner, unblock criterion, and downstream impact when:

- living authorities are missing, contradictory, or outside current evidence;
- the delivery objective is too broad for one blueprint;
- a material decision remains unapproved;
- the graph is cyclic or references missing nodes;
- ownership overlaps or a shared contract has no owner;
- a migration or generated artifact has competing writers;
- remote fetch or ancestry proof is unavailable;
- a dependant started from an unmerged prerequisite;
- a gate lacks evidence or a verifier;
- worktree isolation cannot be established safely; or
- completion would require forced deletion or loss of unmerged work.
