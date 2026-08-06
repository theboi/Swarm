# Blueprint Masterplan Evaluation Scenarios

## Evaluation status

| Phase | Status |
| --- | --- |
| Scenario design | Complete before skill authoring |
| No-skill structural baseline | Skill absent before initialization |
| Fresh-agent no-skill baseline | Pending because this execution session cannot dispatch subagents |
| Fresh-agent skill-enabled run | Pending for a later authorized evaluation session |
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

## Static contract coverage

| Required behavior | Supplying section |
| --- | --- |
| Living authorities precede blueprint freezing | `SKILL.md` — Establish current authority |
| Construction-style dependency decomposition | `SKILL.md` — Decompose like a construction project |
| Acyclic graph and evidence-based gates | `SKILL.md` — Build and validate the dependency graph |
| One owner prevents false parallelism | `SKILL.md` — Decompose like a construction project |
| Same-machine worktree isolation | `SKILL.md` — Isolate workers on one machine |
| Phase-specific worker launch prompts | `SKILL.md` — Generate worker launch prompts; `references/worker-prompt-templates.md` |
| Per-substep fetch/rebase/push | `SKILL.md` — Require the worker lifecycle |
| Remote merge determines readiness | `SKILL.md` — Determine readiness and blockers |
| Per-worker and coordinator status ownership | `SKILL.md` — Determine readiness and blockers; bundled status templates |
| Safe integration and teardown | `SKILL.md` — Complete and tear down workers safely |
| No force deletion of dirty or unmerged work | `SKILL.md` — Complete and tear down workers safely; Stop conditions |
