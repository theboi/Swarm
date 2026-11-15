---
name: blueprint-masterplan
description: Use when splitting a bounded delivery objective across workers, agents, branches, worktrees, clones, or machines; flattening a dependency flowchart; assigning collision-safe ownership; isolating account-local runtimes; or writing worker briefs, delivery gates, and launch prompts.
---

# Blueprint Masterplan

## Core workflow: coordinator plans, workers execute

The coordinator personally authors the complete shared design AND every one of
the N workers' detailed specifications and implementation plans before handing
off ordinary implementation. Spend the substantial planning effort up front:
inspect real code, settle producer/consumer contracts, allocate every mutable
surface, write test-first task steps and verification commands, and check the
entire set together. Worker plans are finished deliverables, not reserved paths.

Do not delegate specification or implementation-plan authorship to workers or
planning subagents. Do not launch N planning workers, require a worker-authored
Pass 1, or create a later round waiting for their independent plans to be
reconciled. The coordinator's initial planning includes all cross-plan
consistency work. More workers means more coordinator planning, not less detail.

Workers receive their already-complete plan and proceed to implementation when
their hard implemented prerequisites exist. They inspect current code as normal
execution preflight; they do not rewrite or independently approve their plans.
An actual newly discovered contract problem returns to the coordinator for a
bounded correction, not a mandatory planning/reconciliation phase for everyone.

A user-requested plan or handoff does not itself authorize implementation,
deployment, paid calls, messages or unrelated mutations. Honor approvals already
given; do not ask for a second generic approval because a skill mentions a gate.

## Roles and output shape

For an operative blueprint, assignment or launch packet, put the following
block before the DAG, assignments or readiness decisions, after at most one
outcome sentence. Factual audits/status answers need no ceremonial blocks.

**Coordinator/worker phase contract**

| Phase | Required fact |
| --- | --- |
| Coordinator planning | The coordinator alone authors the shared design and all N workers' detailed specifications and implementation plans before handoff; interfaces, ownership, tests and dependencies are checked together during that initial planning. |
| Ready-to-execute handoff | Publish the complete coordinator-authored plan set and required approvals on origin/main; do not launch a worker planning pass or require later reconciliation of independently authored plans. |
| Worker execution | Workers execute the supplied plans after verifying their hard implemented prerequisites; genuine discoveries return to the coordinator for bounded corrections. |
| Conditional UI design | A UI-design worker supplies accepted presentation and UI requirements when needed; the coordinator incorporates them into affected implementation plans before live wiring. |

For operative Git lifecycles and worker launch packets also show once:

**Shared-main lifecycle**

| Item | Required fact |
| --- | --- |
| Mode | In a genuinely shared checkout, concurrent reads are allowed; the exclusive main-mutation lock covers edits and Git/index mutations through remote-reachability proof. |
| Fallback | Normal main clones are allowed on different machines or for a documented incompatible shared checkout; the cross-clone push queue covers reconciliation, affected checks, push and ancestry proof, not a global edit lock. |
| Checkpoint cadence | After each independently testable substep, run focused checks, stage owned paths, commit on main, fetch/merge newer origin/main, rerun affected checks, push and prove remote ancestry. |
| Safety | Preserve unrelated dirt. Never clean, stash, reset, overwrite, rebase or force-push published main to discard someone else's work. |

Do not inflate simple status answers with these blocks. The templates are
contracts for useful handoffs, not a reason to restate every plan in chat.

## Skills and source routing

- Use brainstorming for unsettled product/design choices; do not reopen settled
  approved behavior or repeat an interview for explicit maintenance.
- Use writing-plans to author EACH worker's detailed task plan yourself. A brief,
  file list or empty reserved plan path is insufficient.
- Use living-masterplan when approved stable behavior changes. Consolidate
  affected product authorities in the same planning checkpoint, or record an
  evidence-backed no-impact finding.
- Use verification-before-completion before asserting the package is ready.
- Execution workers use the applicable execution, TDD, review and verification
  skills; repository main-only rules override generic worktree workflows.

Read references/blueprint-masterplan-template.md before writing the blueprint.
Read references/worker-prompt-templates.md before creating launch packets.
Use references/planning-gate-template.md for a coordinator plan-readiness receipt
when the project uses one. It records the coordinator's completed planning;
it does not wait for worker-authored artifacts or create a new approval cycle.

## Initial coordinator planning

1. Inspect current repository instructions, main/origin/main, actual code,
   callers, tests, migrations, configuration, runtime and relevant authorities.
   Preserve unrelated work. Record inspected commits, not assumed readiness.
2. Define the bounded outcome, existing authorization, non-goals and measurable
   acceptance. Ask only for decisions that materially change approved intent.
3. Decompose coherent implementation packages. One owner per mutable file,
   schema, migration sequence, prompt registry, generated artifact, environment
   and central composition surface. An independent clone does not solve
   semantic ownership collisions.
4. Freeze exact shared types, signatures, artifact versions and producer/consumer
   rules. Check SQL/RLS, source/currentness, replay, data ownership and error
   boundaries across the full flow. Do not invent columns or capabilities.
5. Personally write every worker's dated specification and detailed plan.
   Include exact files, interfaces, meaningful failing behavioral tests,
   implementation steps, focused commands, review evidence and final acceptance.
   Keep common constraints in the shared design and consume them consistently.
6. Check the whole plan set NOW: identical signatures and field names, no
   conflicting file owners, no hidden producer dependencies, no fixture/prompt
   import before its producer exists, no placeholder schemas or migrations,
   no integration consumer that rejects the newly permitted result.
7. Synchronize affected living authorities and all downstream plans. Complete
   any already-required user review without manufacturing new checkpoints.
8. Verify links, paths, DAG and complete plan coverage; commit/push the coherent
   coordinator-authored package and prove origin/main ancestry before handoff.
9. Publish execution handoffs naming the supplied plan, current readiness and
   actual hard prerequisites. Do not send workers away to author plans first.

One stable blueprint ID, e.g. YYYY-MM-DD-short-slug, owns:
- docs/superpowers/specs/<blueprint-id>/ for shared and worker specifications;
- docs/superpowers/plans/<blueprint-id>/ for blueprint and ALL worker plans;
- docs/workers/<blueprint-id>/ for prompts, worker status and completion receipts.

Follow existing repository path conventions when different. A single shared
specification may cover several workers if each plan's contract is explicit.
The coordinator owns plan/spec revisions; workers own execution status and
completion manifests. Do not mistake spec authorship for implementation ownership.

## DAG and readiness

Build a moderately flat DAG from real implemented prerequisites. Aim for 3–7
ready workers per substantive frontier; small objectives, foundations, joins
and gates may be narrower. Wider frontiers need evidence that coherent grouping
is unsafe. Report node/edge counts, layer membership, peak logical width and
active slot capacity separately. Verify acyclicity and Depends on/Unblocks parity.

A foundation exists only for distinct shared contracts/code needed by consumers.
Keep it small; defer full retrieval/security implementations to their trade
when consumers can develop independently. Conversely, a planned capability is
not implemented authority: final integration still requires its real tests.

Never make F0 import a prompt/schema/module that a worker blocked on F0 has not
written. Put pure shared contracts in F0; register real producer assets at the
integration join or assign their implementation explicitly to F0.

| State | Required evidence |
| --- | --- |
| Planning | Coordinator is still writing/checking the complete plan set. |
| Planned | Coordinator-authored specification and detailed plan exist, required approval is recorded and the complete package is reachable from origin/main. |
| Execution-blocked | A named hard implemented prerequisite or genuine external requirement is absent. |
| Execution-ready | Supplied plan is current, authorization exists and all hard prerequisite code/evidence is integrated. |
| In progress / review | Worker is implementing or awaiting required implementation review. |
| Complete | Fresh tests/review, remote integration, handoff and owned cleanliness are verified. |
| Unverified | Needed remote evidence has not been inspected; never call it ready. |

There is no worker-planning readiness state and no reconciliation barrier
dependent on independently authored plans. A readiness receipt may pin the
coordinator package; its name (including existing PLANNING_GATE.md) does not
restore the removed two-pass workflow. Never label missing plans complete.

## Execution lifecycle and coordination

Workers verify their supplied plan and actual prerequisites, then implement
owned tasks directly. Use focused tests at coherent checkpoints; run the full
owned suite once at completion, repeating broader checks only for new concerns.
Keep model calls outside DB transactions and preserve runtime/domain safeguards.

All work stays on main. Shared checkout: agree one exclusive main-mutation lock
and one consistent lock protocol before mutations; never unlink an active lock.
Different-machine normal clones: named push queue for reconcile/check/push/proof.
The queue may be the optimistic origin/main-reconciliation protocol: the remote
accepts only fast-forward pushes; rejected pushes fetch/merge/check/retry. This
needs no extra cross-machine lock service or launch metadata. Name that protocol
consistently when canonical swarm packets use it.
No feature branches, worktrees, stash queues or hidden lanes. A rejected push
means fetch/merge/check/retry, never rebase published main or force push.

Workers coordinate through origin/main, owned status/handoffs and coordinator
summaries, not worker-to-worker Codex chats. Report a real contract discovery to
the coordinator; the coordinator updates affected plans/authorities together.
Do not require all workers to stop for unrelated discoveries. Already-approved
routine fixes do not need a fresh product-approval round.

If repository evidence proves an upstream attempt ENDED without a concrete
required deliverable, the downstream worker temporarily assumes that bounded
implementation role, completes/tests/integrates it, updates evidence and
resumes. Active, queued, slow or uninspected work is not failed work. Never
overwrite active/uncertain changes, invent policy or bypass new authority.

Each execution handoff names exact commits, coordinator-authored spec/plan,
tests/review, migration/index/runtime actions, downstream evidence, limitations,
owned cleanliness and docs/workers/<blueprint-id>/completion-manifest/<id>.json.
Publish the manifest before final response; coordinator independently verifies.

## Conditional UI design and account-local runtimes

A real presentation change uses a UI-design worker only for fixtures/mock-backed
presentation and contents, accepted UI requirements and an owner-reviewed
handoff. The coordinator remains the implementation-plan author and incorporates
that handoff before live wiring; ordinary workers do not start a planning pass.
Read references/ui-design-lifecycle.md and
references/ui-design-worker-prompt-template.md for that conditional workflow.
Required design-method sources remain:
- claude-design/codex/AGENTS.md
- claude-design/codex/system-prompt.md
- claude-design/codex/skills/
- .agents/skills/better-ui/SKILL.md

When any worker starts/configures/stops/seeds/tests client, API, Supabase, Docker
or Colima on a shared machine, read references/account-local-runtime-isolation.md
completely. Allocate account/UID-derived ports, names, cookie namespace, holder
and real identity/reviewer-entry canaries before runtime commands. No borrowing
another account's stack, free-port substitution or broad cleanup. A 431 is
transport/header evidence, not proof of bad credentials. Preserve existing
runtime isolation, authentication consistency and durable-holder requirements.

## Launches, legacy packets and verification

Worker packets consume completed coordinator-authored plans and request
implementation, not plan authorship. Include an authority map, owned/excluded
paths, prerequisites, status/manifest paths, lock/queue, checkpoint cadence,
terminal outcome, approved model settings and bounded recovery instructions.
Use the user's model/effort settings; do not invent new model policy.

Conditional EdenMind swarm packets retain one canonical source under
templates. The planning packet is coordinator-only:
the same coordinator writes ALL plans. It must not be launched once per ordinary
worker. Execution packets consume those plans; UI packets remain conditional
presentation-only. Preserve runtime isolation and main-only safety when rendering.

Before handoff, confirm all N plans are authored by the coordinator, complete,
internally consistent and remote-reachable; one owner per shared surface;
acyclic implemented dependency graph; no delegated planning or later independent
plan-reconciliation requirement; actual approval/authorization; concrete test
coverage; no paid/live/runtime completion claims without evidence.

For existing projects, preserve historical artifacts and completed worker work.
Apply this workflow to new plans and remaining coordinator work when asked;
do not delete old plans, falsify old receipts or automatically authorize runtime
execution merely because the skill changed.

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Reserve N plan paths and call planning complete | Coordinator writes all N detailed plans before handoff. |
| Launch workers to produce Pass 1 plans | Send implementation handoffs consuming finished plans. |
| Wait for independent plans, then reconcile | Coordinator checks all interfaces and dependencies during initial planning. |
| Delegate coordinator planning to subagents | Coordinator personally authors the implementation-plan set. |
| Treat no reconciliation round as no integration | Keep real implementation dependencies, review and integration tests. |
| Redesign unrelated UI/runtime policy | Preserve existing conditional presentation and runtime safeguards. |
| Reapprove settled behavior because a template says gate | Reuse existing authorization; ask only for new authority or material decisions. |
