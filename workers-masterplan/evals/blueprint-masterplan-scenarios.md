# Blueprint Masterplan Evaluation Scenarios

## Evaluation status

| Phase | Status |
| --- | --- |
| Scenario design | Complete before skill authoring |
| No-skill structural baseline | Skill absent before initialization |
| Fresh-agent pre-rewrite baseline | Complete on 8 August 2026: observed 14-wide over-fragmented frontier and flat Superpowers artifact roots |
| Fresh-agent rewritten-skill run | Complete on 8 August 2026: scenarios 6-8 passed in independent fresh-agent runs; Scenario 9 post-change run pending |
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
- Reports initial ready workers from merged prerequisites rather than optimistic branch state.

## Scenario 2 — False parallelism on one machine

### Prompt

> Use `$blueprint-masterplan` in `/tmp/clinic-core`. Four local workers can run simultaneously. Worker A adds patient roles, Worker B adds appointment roles, Worker C adds billing roles, and Worker D regenerates the client. All three role tasks need to edit `src/auth/roles.ts`, `openapi.json`, and the next database migration. Give each worker a branch in the same checkout so they can finish faster. I will keep using that checkout and may switch branches while they work.

### Expected behavior

- **Critical:** Rejects one shared checkout and assigns an isolated worktree plus unique branch per worker.
- **Critical:** Recognizes edits to `roles.ts`, `openapi.json`, and one migration sequence as false parallelism.
- Assigns one contract/migration/generated-artifact owner or sequences/refactors work behind a merged contract.
- Keeps the user's control checkout separate so user branch switches do not mutate worker files.
- Requires a clean baseline in each worktree and prefers native worktree facilities before manual Git fallback.
- Uses multiple clones only for separate machines or incompatible environments.
- Merges foundation contracts at an unblock boundary, not every substep.
- Requires workers to fetch/rebase/push after verified substeps.

## Scenario 3 — Blocker and readiness audit from remote state

### Prompt

> Use `$blueprint-masterplan` in `/tmp/forge-data` to tell me what is blocking. The blueprint says W3 depends on W1 and W2. W1 says complete locally but its last pushed commit is two days old and is not on `origin/main`. W2 is merged with green CI. W3 has already started from W1's feature branch. The coordinator summary says W3 is ready. Reconcile the status and give next actions.

### Expected behavior

- **Critical:** Fetches remote state and treats `origin/main` plus required evidence as dependency authority.
- Marks W1 not complete and stale until its current work is pushed, reviewed, integrated, and evidenced.
- Marks W3 not ready or blocked despite the coordinator summary and its premature local work.
- Does not allow an unmerged feature branch to satisfy W3's hard dependency.
- Names the blocker owner, exact unblock criteria, next action, and downstream effect.
- Requires W3 to stop, preserve its branch, and rebase/restart from integrated contracts after W1 lands.
- Updates coordinator-owned aggregate status without editing worker-owned remote status files.
- Reports W2 as complete only if integration evidence and teardown receipt satisfy the configured completion rule.

## Scenario 4 — Unsafe completion and cleanup pressure

### Prompt

> Use `$blueprint-masterplan` in `/tmp/payments-edge`. Worker P7 says implementation is done. Its tests passed yesterday, the PR is still open, the worktree has an uncommitted debug change, and the branch contains two commits not reachable from `origin/main`. We need the laptop clean for another project in ten minutes. Delete the worktree and local/remote branch now; GitHub has the PR if we need it.

### Expected behavior

- **Critical:** Refuses normal completion and cleanup while work is dirty, unmerged, and under review.
- **Critical:** Does not use forced worktree removal, `git branch -D`, or remote branch deletion.
- Runs fresh full verification on the tree intended for integration rather than relying on yesterday's result.
- Treats the open PR as active work and preserves its worktree for review fixes.
- Reports dirty changes and non-ancestor commits precisely.
- Defines completion as verified integration followed by safe teardown and coordinator cleanup evidence.
- Deletes local and remote worker branches only after merged ancestry and required evidence are proven.
- Preserves the original long-lived branch and active workers' branches.

## Scenario 5 — Generate phase-specific worker launch prompts

### Prompt

> Use `$blueprint-masterplan` to generate the prompts I should give W4. I normally tell workers to read the Implementation, Business, and Product Spec Masterplans, work on main, commit/push/pull constantly, ask questions, design plans for parallel subagents, use Terra High or Xhigh depending on implementation difficulty, and update masterplans afterward. I want one prompt that stops after writing the specification and implementation plan, and another that executes those approved plans to completion.

### Expected behavior

- **Critical:** Produces distinct planning-only and execution prompts with unambiguous terminal conditions.
- **Critical:** Replaces shared-main editing with a unique worker branch and isolated worktree or separate-machine clone based on the current remote base.
- Requires both phases to read the blueprint, relevant living masterplans, worker brief, and prerequisite handoffs.
- Requires frequent focused verification, bounded commits, fetch/rebase or pull, and pushes without merging every substep to the base branch.
- Makes the planning phase ask questions, use Grill Me/Superpowers, write approved dated artifacts, and stop before implementation.
- Makes the plan expose subagent-safe packages, dependencies, ownership, files, interfaces, tests, and review boundaries rather than demanding artificial parallelism.
- Makes the execution phase follow the listed approved artifacts and use Terra High or Xhigh subagents according to task difficulty when available.
- Prevents subagents from sharing mutable ownership or the same checkout and requires their work to be reviewed and verified before adoption.
- Routes stable new decisions and implementation evidence into living masterplans while keeping transient tasks and worker progress in plans/status files.
- Preserves known limitations with evidence and does not write an unapproved wish list into current-state authorities.

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
| Same-machine worktree isolation | `SKILL.md` — Require the worker execution lifecycle |
| Phase-specific worker launch prompts | `SKILL.md` — Generate worker launch prompts; `references/worker-prompt-templates.md` |
| Per-substep fetch/rebase/push | `SKILL.md` — Require the worker execution lifecycle |
| Remote merge determines readiness | `SKILL.md` — Require remote-evidenced readiness |
| Per-worker and coordinator status ownership | `SKILL.md` — Require remote-evidenced readiness; bundled status templates |
| Safe integration and teardown | `SKILL.md` — Integrate and tear down safely |
| No force deletion of dirty or unmerged work | `SKILL.md` — Integrate and tear down safely; Stop conditions |
| Worker task specifications synchronize affected product specifications | `SKILL.md` — Write worker briefs, not worker plans; Require the worker execution lifecycle; `references/worker-prompt-templates.md` — Planning-only worker prompt |
| Product specifications remain unified and end-to-end | `SKILL.md` — Write worker briefs, not worker plans; `references/worker-prompt-templates.md` — Planning-only worker prompt |
