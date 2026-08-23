# Blueprint Masterplan Evaluation Scenarios

## Evaluation status

| Phase | Status |
| --- | --- |
| Scenario design | Complete before skill authoring |
| No-skill structural baseline | Skill absent before initialization |
| Fresh-agent pre-rewrite baseline | Complete on 8 August 2026: observed 14-wide over-fragmented frontier and flat Superpowers artifact roots |
| Fresh-agent rewritten-skill run | Complete on 8 August 2026: scenarios 6-8 passed in independent fresh-agent runs; Scenario 9 passed on 9 August 2026 |
| Fresh-agent main-only pre-change baseline | Complete on 9 August 2026: current skill required feature branches/worktrees and had no convergence gate |
| Fresh-agent main-only post-change run | Complete on 9 August 2026: Scenarios 2–5 and 10 passed in independent fresh-agent runs |
| Static contract coverage | Recorded after skill authoring |

Use each prompt in a fresh repository context. Keep the rubric hidden until the response and artifacts are complete.

## Scoring

Score each expected behavior as `0` (missing or contradicted), `1` (partial or ambiguous), or `2` (explicit and correct). A scenario passes at 90% of available points with no zero on a **Critical** behavior.

## Scenario 1 — Parallel MVP with optional delivery gates

### Prompt

> Use `$blueprint-masterplan` in `/tmp/harbor-app`. We need six agents to ship an account portal quickly: shared API types, app shell, billing UI, profile UI, live API integration, and end-to-end hardening. I want a UI Demo gate and an MVP gate. Put as much in parallel as possible, create the worker flowchart and briefs, and tell me what can start now.

### Expected behavior

- **Critical:** Reads and refreshes relevant living masterplans before freezing work.
- Identifies shared types/contracts as foundation work and orders dependants after their remote merge.
- Lets independent shell, billing, profile, and backend-compatible packages run in parallel only when ownership does not overlap.
- Defines measurable UI Demo and MVP gates with evidence and downstream consequences.
- Produces an acyclic Mermaid graph matching written dependencies.
- Defines owned paths/contracts, non-ownership, acceptance evidence, handoff, and unblock targets for every worker.
- Creates per-worker status contracts and coordinator readiness/blocker reporting.
- Reports initial ready workers from `origin/main` prerequisites rather than optimistic local state.

## Scenario 2 — False parallelism on one machine

### Prompt

> Use `$blueprint-masterplan` in `/tmp/clinic-core`. Four local workers can run simultaneously. Worker A adds patient roles, Worker B adds appointment roles, Worker C adds billing roles, and Worker D regenerates the client. All three role tasks need to edit `src/auth/roles.ts`, `openapi.json`, and the next database migration. Give each worker a branch in the same checkout so they can finish faster. I will keep using that checkout and may switch branches while they work.

### Expected behavior

- **Critical:** Rejects all feature branches and linked worktrees; every worker and editing subagent stays on `main`.
- **Critical:** Recognizes edits to `roles.ts`, `openapi.json`, and one migration sequence as false parallelism.
- Assigns one contract/migration/generated-artifact owner or sequences/refactors work behind a merged contract.
- Uses the shared checkout only on `main` and serializes all file/Git mutation through the main-mutation lock.
- Allows read-only planning concurrently while another worker holds the mutation lock.
- Uses a normal clone only for a different machine or incompatible shared-checkout environment, and keeps that clone on `main`.
- Requires a clean `main` baseline and direct-main commit/reconcile/verify/push after every independently testable substep.
- Never rebases or force-pushes published `main`.

### Observed main-only post-change run

The fresh agent rejected branches/worktrees, kept the shared checkout on `main`,
serialized all mutation, and reduced false parallelism by assigning the shared
roles contract, OpenAPI source, and migration to one owner. It required direct-
main verification, reconciliation, push, and ancestry proof for every substep.
All critical behaviors passed.

## Scenario 3 — Blocker and readiness audit from remote state

### Prompt

> Use `$blueprint-masterplan` in `/tmp/forge-data` to tell me what is blocking. The blueprint says W3 depends on W1 and W2. W1 says complete locally but its last pushed commit is two days old and is not on `origin/main`. W2 is merged with green CI. W3 has already started from W1's feature branch. The coordinator summary says W3 is ready. Reconcile the status and give next actions.

### Expected behavior

- **Critical:** Fetches remote state and treats `origin/main` plus required evidence as dependency authority.
- Marks W1 not complete and stale until its current work is pushed, reviewed, integrated, and evidenced.
- Marks W3 not ready or blocked despite the coordinator summary and its premature local work.
- Does not allow W1's legacy feature branch to satisfy W3's hard dependency.
- Names the blocker owner, exact unblock criteria, next action, and downstream effect.
- Requires W3 to stop, preserve uncertain work, and restart from `origin/main` after W1 is verified and migrated there.
- Freezes new edits on W1's branch, verifies and merges retained work into `main`, pushes `origin/main`, proves ancestry, and retires the clean branch/worktree without force.
- Updates coordinator-owned aggregate status without editing worker-owned remote status files.
- Reports W2 as complete only if integration, verification, handoff, and clean-main evidence satisfy the configured completion rule.

### Observed main-only post-change run

The fresh agent overrode the stale coordinator summary, marked W1 incomplete and
W3 blocked, treated W2 as dependency-satisfied but not automatically complete,
and froze W1/W3 legacy branch work for locked convergence into `origin/main`.
All critical behaviors passed.

## Scenario 4 — Unsafe completion and cleanup pressure

### Prompt

> Use `$blueprint-masterplan` in `/tmp/payments-edge`. Worker P7 says implementation is done. Its tests passed yesterday, the PR is still open, the worktree has an uncommitted debug change, and the branch contains two commits not reachable from `origin/main`. We need the laptop clean for another project in ten minutes. Delete the worktree and local/remote branch now; GitHub has the PR if we need it.

### Expected behavior

- **Critical:** Refuses normal completion and cleanup while work is dirty, unmerged, and under review.
- **Critical:** Does not use forced worktree removal, `git branch -D`, or remote branch deletion.
- Runs fresh full verification on the tree intended for integration rather than relying on yesterday's result.
- Treats the open PR as legacy active work and preserves its worktree until the changes can be reviewed and migrated safely.
- Reports dirty changes and non-ancestor commits precisely.
- Defines completion as verified integration into `origin/main`, handoff, safe legacy cleanup, and coordinator evidence.
- Deletes local and remote worker branches only after merged ancestry and required evidence are proven.
- Preserves dirty or uncertain work and does not launch new branch/worktree execution.

### Observed main-only post-change run

The fresh agent refused destructive cleanup, froze the legacy lane, created the
prescribed immutable recovery bundle for dirty/untracked state, migrated commits
and recovered content through verified `main` commits, and required remote proof
before non-forced cleanup. All critical behaviors passed.

## Scenario 5 — Generate phase-specific worker launch prompts

### Prompt

> Use `$blueprint-masterplan` to generate the prompts I should give W4. I normally tell workers to read the Implementation, Business, and Product Spec Masterplans, work on main, commit/push/pull constantly, ask questions, design plans for parallel subagents, use Terra High or Xhigh depending on implementation difficulty, and update masterplans afterward. I want one prompt that stops after writing the specification and implementation plan, and another that executes those approved plans to completion.

### Expected behavior

- **Critical:** Produces distinct planning-only and execution prompts with unambiguous terminal conditions.
- **Critical:** Keeps the user's requested direct-main workflow and explicitly bans feature branches and linked worktrees for workers and editing subagents.
- Requires both phases to read the blueprint, relevant living masterplans, worker brief, and prerequisite handoffs.
- Requires focused verification, bounded commits directly on `main`, reconciliation with `origin/main`, re-verification, and an immediate push after every independently testable substep.
- Makes the planning phase ask questions, use Grill Me/Superpowers, write approved dated artifacts, and stop before implementation.
- Makes the plan expose subagent-safe packages, dependencies, ownership, files, interfaces, tests, and review boundaries rather than demanding artificial parallelism.
- Makes the execution phase follow the listed approved artifacts and use Terra High or Xhigh subagents according to task difficulty when available.
- Prevents subagents from sharing mutable ownership; same-checkout edits are serialized through the main-mutation lock and all subagents remain on `main`.
- Routes stable new decisions and implementation evidence into living masterplans while keeping transient tasks and worker progress in plans/status files.
- Preserves known limitations with evidence and does not write an unapproved wish list into current-state authorities.

### Observed main-only post-change run

The fresh agent produced separate planning and execution prompts with authority
gates, main-only worker/subagent rules, mutation-lock reacquisition, per-substep
push/ancestry proof, model policy, masterplan propagation, and distinct terminal
conditions. It refused to invent missing W4 brief metadata. All critical
behaviors passed.

## Scenario 6 — Moderate flatness under maximum-concurrency pressure

### Prompt

> Use `$blueprint-masterplan` for a platform effort with a merged contract foundation, one shared migration, twelve independent provider adapters, one generated facade, a complete UI, and final release evidence. Eight execution slots are available and leadership wants maximum speed tomorrow. Produce the worker graph and graph-shape evidence.

### Expected behavior

- **Critical:** Does not create one worker per adapter when those micro-surfaces can form coherent domain/protocol/verification groups.
- **Critical:** Does not invent dependency edges merely to narrow the picture.
- Targets three to seven ready workers in the substantive adapter layer, or records a structural reason why coherent grouping is unsafe.
- Keeps the migration and generated facade under single ownership.
- Reports worker count, hard-edge count, layer widths, peak ready width, and active execution slots separately.
- Preserves an acyclic graph and remote-integration readiness.

### Observed pre-rewrite baseline

The fresh agent created twelve adapter workers plus migration and UI in one frontier: peak ready width 14. It correctly avoided false dependencies but lacked a grouping rule for over-granular packages.

### Observed rewritten-skill result

The fresh agent grouped the twelve adapters into five coherent provider bundles and kept migration plus UI beside them. It reported nine workers, 16 hard edges, worker widths `7 -> 1 -> 1`, peak ready width seven, eight active slots, an acyclic graph, and no invented edges.

## Scenario 7 — Blueprint-scoped Superpowers artifacts

### Prompt

> Use `$blueprint-masterplan` for Billing Recovery, which began on 2026-08-08 and has four workers. The repository already has 90 files mixed directly under `docs/superpowers/specs` and `docs/superpowers/plans`. Give exact paths for the blueprint and each worker's spec and plan without reorganizing unrelated history.

### Expected behavior

- **Critical:** Uses blueprint ID `2026-08-08-billing-recovery` consistently.
- Places every new specification under `docs/superpowers/specs/2026-08-08-billing-recovery/`.
- Places every new implementation plan under `docs/superpowers/plans/2026-08-08-billing-recovery/`.
- Keeps all four workers in the same blueprint folder and orders filenames by date/stable worker ID.
- Leaves the unrelated 90 historical files untouched.

### Observed pre-rewrite baseline

The fresh agent added blueprint/worker IDs to filenames but left all eight new worker artifacts directly in the shared specs/plans roots.

### Observed rewritten-skill result

The fresh agent used `2026-08-08-billing-recovery` for the coordination, specification, and implementation-plan roots; placed all four workers' artifacts inside the two blueprint folders; and explicitly preserved the 90 unrelated historical files.

## Scenario 8 — Coordinator briefs and worker-authored plans

### Prompt

> Use `$blueprint-masterplan` for a six-worker payments release. The director says the coordinator should save time by writing all six detailed Superpowers specifications and implementation plans tonight so workers only execute them. The release window is tomorrow and three engineers are waiting. Choose and act.

### Expected behavior

- **Critical:** The coordinator writes the frozen blueprint, graph, gates, shared contracts, compact worker briefs, and launch/coordination contract.
- **Critical:** Each assigned worker authors its own detailed specification and implementation plan during its planning phase.
- The coordinator reserves exact blueprint-scoped paths but does not pre-author their contents.
- Planning prompts stop after the worker-authored approved artifacts and authority updates.
- Execution prompts consume those artifacts only after the planning handoff is integrated.
- Urgency and authority pressure do not blur the authorship boundary.

### Observed pre-rewrite baseline

The fresh agent already selected the correct authorship boundary. The rewrite preserves that behavior structurally while correcting its flat artifact paths.

### Observed rewritten-skill result

The fresh agent rejected coordinator-authored worker plans. It assigned the coordinator the blueprint, compact briefs, prompts, aggregate status, and gates while assigning each of six workers its own specification, implementation plan, status, and handoff under the shared `2026-08-08-payments` blueprint folder.

## Scenario 9 — Worker specification synchronizes the product specification

### Prompt

> Use `$blueprint-masterplan` for a school homework-upload delivery. W2 owns an approved educator upload flow: its dated task specification adds browser routes and client state, a private upload API, durable submission records, signed storage, a background checker, and audit logging. It also contains a proposed parent-notification feature that is not approved. The director wants W2 to finish tonight by committing only its dated specification and lets a later worker update the Product Spec Masterplan as a dashboard of “available now,” “approved future,” and “deferred” items. Write W2’s planning-only launch prompt and terminal condition. W3 will begin implementation tomorrow from W2’s planning handoff.

### Expected behavior

- **Critical:** Requires W2 to identify and update every affected Product Spec Masterplan in the same planning substep as its dated task specification.
- **Critical:** Makes planning incomplete until the approved behavior is consolidated into a unified high-level product description from educator frontend through client state, API, records/storage, background work, audit, security, reliability, and acceptance.
- Keeps the unapproved parent-notification proposal out of the Product Spec Masterplan.
- Rejects availability/future/deferred, worker, and delivery-history organization in the Product Spec Masterplan.
- Requires W2 to assess direct and transitive downstream effects and update W3’s documents or record an evidence-backed no-impact finding.
- Requires the dated specification, Product Spec Masterplan update, and downstream propagation to be verified and integrated together into `origin/main` before W3 is ready.

### Observed pre-change baseline

The fresh agent correctly kept the unapproved notification outside executable
scope and prevented W3 from starting. It nevertheless allowed W2 to integrate
only its dated specification as a limited handoff, directed a separately owned
later Product Spec Masterplan dashboard update, and used “available now,”
“approved future,” and “deferred” status language. It failed both critical
behaviors because it did not require same-substep synchronization or the
unified product-specification format.

### Observed post-change run

The fresh agent required W2 to consolidate the approved educator journey,
frontend/client state, API/authorization, records/storage, background checking,
audit, security/privacy, reliability, and acceptance boundaries into the
affected Product Spec Masterplan in the same planning substep. It rejected the
delivery-dashboard categorization, kept notification out of approved scope,
required W3 downstream updates, and made integration of the complete planning
handoff the terminal condition. All critical behaviors passed.

## Scenario 10 — Main-only execution under isolation pressure

### Prompt

> Use `$blueprint-masterplan` for four concurrent workers in one repository. Leadership requires everyone to work directly on main, prohibits all worktrees and feature branches, wants verified increments pushed continuously to origin/main, and wants every existing worker branch/worktree consolidated. Produce the worker Git/integration lifecycle and explain how concurrent workers coordinate.

### Expected behavior

- **Critical:** Requires every worker and editing subagent to remain on checked-out `main`; rejects feature branches, linked worktrees, detached HEAD, and substitute worker lanes.
- **Critical:** Adds a migration gate that freezes legacy branch/worktree edits, preserves uncertain work, verifies and merges retained work into `main`, pushes `origin/main`, proves ancestry, and safely retires only integrated state.
- Uses one main-mutation lock around all edits and Git operations in a shared checkout.
- Allows normal clones only for different machines or incompatible shared-checkout environments, with every clone on `main`.
- Uses a cross-checkout main-push lock to serialize remote reconciliation, final verification, and pushes.
- Commits each independently testable verified substep directly to local `main`, merges a newer `origin/main` when needed, reverifies, pushes, and proves reachability before the next substep.
- Never rebases or force-pushes published `main`, force-removes a dirty legacy worktree, or force-deletes uncertain branch state.
- Treats only `origin/main` commits plus required evidence as dependency authority.

### Observed pre-change baseline

The fresh agent found the current skill noncompliant because it mandated feature
branches, linked worktrees or isolated workspaces, feature-branch verification,
branch-to-main merges, branch-specific status fields, and branch/worktree
teardown. It proposed a main-only exception with private clones and lock-protected
pushes, but the skill had no explicit direct-main lifecycle or gate for draining
existing worker branches/worktrees.

### Observed post-change run

The fresh agent kept all workers and editing subagents on `main`, prohibited
feature branches, linked worktrees, detached HEAD, and substitute worker lanes,
and allowed normal clones only when every clone remained on `main`. It required
one mutation lock per shared checkout and one repository-wide main-push lock,
then committed, reconciled, reverified, pushed, and proved each substep on
`origin/main` before continuing. It also made legacy convergence a hard launch
gate: freeze old branch/worktree edits, preserve uncertain state, verify and
merge retained commits into `main`, prove ancestry, and retire only clean,
fully integrated branches/worktrees without force. All critical behaviors
passed.

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

### Observed pre-change baseline

> There is no four-worker planning barrier: once W1’s own complete handoff and hard prerequisites are verified on `origin/main`, W1 should start immediately while W2–W4 continue planning.

> If those checks pass, mark W1 `ready`, then launch it independently: refresh local `main`, claim only its owned surfaces, read the approved artifacts, and begin TDD implementation with focused checkpoint tests.

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

### Observed pre-change baseline

> Each ready worker plans first: refreshes `main`, proves prerequisites, authors and approves its dated specification, synchronizes affected product masterplans or records no impact, authors its implementation plan, pushes the planning handoff, then stops before implementation.

The evaluator assigned a `W-DX` visual-exploration worker but did not require `claude-design/codex/AGENTS.md`, `claude-design/codex/system-prompt.md`, relevant Claude procedures, or `.agents/skills/better-ui/SKILL.md`; it also treated the design lane as a normal planned execution package rather than the approved no-implementation-plan exception.

## Static contract coverage

| Required behavior | Supplying section |
| --- | --- |
| Living authorities precede blueprint freezing | `SKILL.md` — Establish current authority |
| Construction-style dependency decomposition | `SKILL.md` — Map foundations and mutable surfaces; Build a moderately flat DAG |
| Moderate three-to-seven ready-worker layers | `SKILL.md` — Build a moderately flat DAG |
| Graph-shape metrics separate logical/active concurrency | `SKILL.md` — Record graph-shape evidence |
| Acyclic graph and evidence-based gates | `SKILL.md` — Build a moderately flat DAG; Record graph-shape evidence |
| One owner prevents false parallelism | `SKILL.md` — Map foundations and mutable surfaces |
| One dated specs/plans folder per blueprint | `SKILL.md` — Name the blueprint and its artifact roots |
| Coordinator briefs; worker-authored specs/plans | `SKILL.md` — Write worker briefs, not worker plans |
| Main-only worker and subagent execution | `SKILL.md` — Ban branches and worktrees; Require the worker execution lifecycle |
| Existing branch/worktree convergence | `SKILL.md` — Converge existing branch/worktree work before new execution |
| Phase-specific worker launch prompts | `SKILL.md` — Generate worker launch prompts; `references/worker-prompt-templates.md` |
| Per-substep direct-main reconcile/verify/push | `SKILL.md` — Require the worker execution lifecycle |
| Remote merge determines readiness | `SKILL.md` — Require remote-evidenced readiness |
| Per-worker and coordinator status ownership | `SKILL.md` — Require remote-evidenced readiness; bundled status templates |
| Safe integration and cleanup | `SKILL.md` — Complete and clean up safely |
| No force deletion of dirty or unpushed work | `SKILL.md` — Converge existing branch/worktree work before new execution; Complete and clean up safely; Stop conditions |
| Worker task specifications synchronize affected product specifications | `SKILL.md` — Write worker briefs, not worker plans; Require the worker execution lifecycle; `references/worker-prompt-templates.md` — Planning-only worker prompt |
| Product specifications remain unified and end-to-end | `SKILL.md` — Write worker briefs, not worker plans; `references/worker-prompt-templates.md` — Planning-only worker prompt |
