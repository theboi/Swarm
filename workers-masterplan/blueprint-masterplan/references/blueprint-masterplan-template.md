# Blueprint Masterplan Template

## Contents

- Blueprint template
- Graph rules
- Worker brief rules
- Gate rules
- Revision rules

## Blueprint template

Adapt vocabulary and paths to the project. Preserve every section responsibility. Keep worker-level step-by-step specifications and implementation plans outside this masterplan.

````markdown
# <Project> <Objective> Implementation Masterplan

> Frozen execution blueprint for delivering <bounded outcome> through independently owned worker packages.

| Field | Value |
| --- | --- |
| Status | Approved execution snapshot |
| Blueprint ID | `YYYY-MM-DD-<short-slug>` |
| Effective date | <date> |
| Integration authority | `origin/main` |
| Same-checkout commit/push guard | `<lock if available, otherwise fetch/reconcile/retry>` |
| Cross-checkout main-push guard | `<lock if available, otherwise fetch/reconcile/retry>` |
| Coordinator | <role or named owner> |
| Business authority | `<relative path>` |
| Product authority | `<relative path>` |
| Architecture authority | `<relative path>` |
| Existing implementation authority | `<relative path>` |
| Worker specification root | `docs/superpowers/specs/<blueprint-id>/` |
| Worker implementation-plan root | `docs/superpowers/plans/<blueprint-id>/` |
| Coordination root | `docs/workers/<blueprint-id>/` |

## 1. How to use this document

State the one execution question this blueprint answers. Explain that living masterplans own approved behavior and current truth; this frozen document owns delivery boundaries, dependencies, gates, and integration mechanics.

Every worker receives:

1. this blueprint;
2. relevant living authorities;
3. its worker ID and bounded brief;
4. prerequisite handoffs;
5. the assigned normal checkout or clone on `main`; and
6. the pull/push retry mechanism and reserved artifact/status paths.

Workers never communicate with one another through Codex chats. They coordinate through `origin/main`, owned status/handoff artifacts, and coordinator-owned summaries. No worker depends on private conversation history, off-main work, or an unpushed local commit. Each worker authors its own detailed specification and implementation plan after its prerequisites are integrated. Feature branches and linked Git worktrees are prohibited; several workers using `main` is normal and is not a blocker.

## 2. Outcome and delivery gates

Describe the final bounded outcome and measurable inspection/release gates.

| Gate | Outcome | Hard prerequisites | Evidence | Verifier | Unlocks |
| --- | --- | --- | --- | --- | --- |
| <G1> | <observable milestone> | <worker/gate IDs> | <commands, artifacts, or approval> | <owner> | <IDs> |

Omit a gate without measurable evidence, a verifier, failure ownership, and a downstream consequence.

## 3. Foundation already implemented

List existing modules, infrastructure, components, contracts, migrations, tests, and operational patterns workers must reuse. Cite authorities and repository paths.

State which foundations workers may not duplicate for local convenience.

## 4. Locked boundaries and ownership rules

List the approved product, architecture, security, integration, data, and operational boundaries that determine worker interfaces.

### 4.1 Shared mutable surfaces

| Surface | Single owner | Dependants | Change protocol |
| --- | --- | --- | --- |
| <contract, migration sequence, generated output, central file> | <worker ID> | <IDs> | <merge/evidence required before use> |

## 5. Execution graph

```mermaid
flowchart TD
    ROOT["Living authorities approved"] --> F0["F0 - Foundation contract"]
    F0 --> W1["W1 - Independent trade A"]
    F0 --> W2["W2 - Independent trade B"]
    F0 --> W3["W3 - Independent trade C"]
    W1 --> PUB["PUB - Integration owner"]
    W2 --> PUB
    W3 --> PUB
    PUB --> G1["G1 - Inspection gate"]
    G1 --> DONE["OBJECTIVE COMPLETE"]
```

Every arrow is a hard prerequisite satisfied only by remote integration and required evidence. Describe coordination-only relationships outside the graph.

### 5.1 Graph-shape evidence

| Metric | Value | Explanation |
| --- | --- | --- |
| Worker nodes | <count> | <why every package is coherent> |
| Hard dependency edges | <count> | <why every edge requires remote integration> |
| Substantive layer widths | <counts and worker IDs> | <ready frontiers by graph state> |
| Peak ready width | <count and IDs> | <widest logical frontier> |
| Active execution-slot limit | <count> | <capacity, separate from graph width> |
| Width exceptions | <none or layers> | <structural reason outside three to seven> |

For a multi-worker objective, target three to seven concurrently ready workers in each substantive post-foundation trade layer. Do not force roots, joins, gates, closeout, or small objectives into the band. Group related micro-surfaces rather than inventing dependencies.

### 5.2 Dependency and unblock parity

| ID | Depends on | Unblocks |
| --- | --- | --- |
| <ID> | <IDs or approved authorities> | <IDs and supplied contract/evidence> |

## 6. Readiness and blocker rules

- `not-ready`: at least one hard prerequisite is not integrated into `origin/main`.
- `ready`: every hard prerequisite and required contract is integrated into `origin/main`.
- `in-progress`: the worker claimed its owned scope on `main`, refreshed from `origin/main`, and is producing coherent checkpoints.
- `blocked`: a named dependency, decision, conflict, or external condition prevents progress.
- `review`: work exists but required review, evidence, or integration is open.
- `complete`: the coordinator verified integration, handoff, evidence, and cleanup.

`origin/main` is authoritative. An off-main commit, unpushed local `main` commit, stash, working-tree change, or local “done” claim does not unblock a dependant or complete a dependency handoff.

## 7. Mandatory lifecycle for every worker

### 7.1 Worker-authored Superpowers planning

1. Enter the assigned normal checkout or clone and prove it is on `main` and is not a linked worktree.
2. Inspect live shared-checkout state, pull `origin/main` when safe, prove prerequisites and evidence are integrated there, and inspect the relevant baseline without running the full suite.
3. Read this blueprint, relevant living authorities, the worker brief, and prerequisite handoffs.
4. Use Superpowers brainstorming for task-local decisions.
5. Write and obtain approval for `docs/superpowers/specs/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>-design.md`.
6. Immediately identify every affected product specification masterplan and
   consolidate all approved changes from the dated specification into its unified
   high-level frontend-to-backend product contract, or record an evidence-backed
   no-impact finding.
7. Use `superpowers:writing-plans` to write `docs/superpowers/plans/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>.md`.
8. Update affected non-product living authorities with stable approved decisions.
9. Hand off the dated specification, product specification updates or no-impact
   findings, approved plan, and required downstream propagation together; then
   stop before implementation.

Repeat step 6 whenever the dated specification changes. Do not complete planning
or unblock implementation while an affected product specification masterplan is
stale.

The coordinator reserves these paths but does not author their detailed contents.

### 7.2 Execution

1. Read the worker-authored approved specification and implementation plan.
2. Implement only owned surfaces with TDD where applicable.
3. Run the relevant focused test segment at meaningful implementation checkpoints and address review.
4. If work runs long, commit coherent progress, refresh local and remote `main`, reconcile, and push a checkpoint to limit drift.
5. After every owned task is finished, refresh again, run the full suite once, integrate/push final evidence, and leave the assigned main checkout clean.

### 7.3 Main-only execution

All new planning, implementation, review fixes, conflict resolution, and documentation updates happen on checked-out `main`. Do not create, switch to, or continue on feature, worker, review, rescue, integration, or temporary branches. Do not create or use linked Git worktrees, detached HEAD, stash queues, patch queues, or hidden refs as substitute worker lanes.

A separate normal clone is allowed only for a different machine or when workers cannot share one checkout, and every clone remains on `main`. Workers in one shared checkout edit their non-overlapping owned surfaces alongside one another, inspect live status, stage only owned paths, and preserve every unrelated change. Use a commit/push lock when available; absence of a lock is not a blocker—fetch, reconcile, and retry safely. Across multiple main-only clones, use the same guarded or optimistic retry process for remote reconciliation and pushes.

Inventory legacy worker branches/worktrees without blocking unrelated owned work. Preserve dirty or uncertain state; integrate coherent committed work into current `main`, run affected focused checks, push `origin/main`, and prove ancestry. Retire only fully integrated dedicated lanes, never a shared or uncertain lane.

### 7.4 Verification and Git synchronization cadence

1. Before work, inspect live state, fetch `origin/main`, pull it into clean local `main`, and confirm prerequisites.
2. During work, prioritize writing code and tests. Run only the narrow affected test segment after a coherent chunk, before publishing a checkpoint, or while diagnosing a failure—not after every edit.
3. When a task runs long or drift risk rises, review and stage only owned paths, preserve a coherent commit, fetch/pull, reconcile concurrent changes, rerun affected focused checks, and push.
4. Before a dependency handoff, prove its coherent commit is reachable from `origin/main`.
5. After all tasks owned by the worker are finished, refresh local/remote `main`, run the full suite once, fix failures, push final evidence, and prove remote ancestry.

If another checkout wins the push race, preserve all work, fetch and merge the new `origin/main`, rerun affected focused checks, and retry. Never rebase or force-push published `main`. Do not contact another worker through Codex chat; repository evidence and coordinator-owned artifacts are the coordination mechanism.

### 7.5 Living-authority downstream propagation

Whenever a worker changes a living business, product/specification, architecture, implementation, operations, security, release, or custom masterplan:

1. identify every direct and transitive downstream worker or gate;
2. assess changes to dependencies, blockers, contracts, ownership, acceptance, tests, launch instructions, and implementation assumptions;
3. record the impact in owned repository artifacts so the coordinator or document owner can update every relevant downstream brief, specification, plan, prompt, worker status, and coordinator status without direct worker-to-worker Codex chat;
4. mark affected downstream work blocked or not-ready until its documents are current and approved;
5. integrate the authority and downstream-document updates into `origin/main`; and
6. record propagation evidence or an evidence-backed finding of no downstream impact.

If frozen blueprint scope, ownership, dependencies, gates, or completion semantics change, require an approved blueprint revision before affected work continues.

## 8. Worker packages

### Worker <ID> — <task and outcome>

**Depends on:** <worker/gate IDs or approved living authorities>.

**Owns:** <paths, contracts, records, migrations, generated artifacts, tests, status>.

**Does not own:** <nearby shared or dependant surfaces>.

**Coordination evidence:** <owned artifacts, coordinator summaries, and non-hard contract boundaries; no worker-to-worker Codex chat>.

**Work outcomes:**

- <bounded outcome>
- <bounded outcome>
- <stable living-authority effect, when applicable>

**Reserved worker artifacts:**

- Specification: `docs/superpowers/specs/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>-design.md`
- Implementation plan: `docs/superpowers/plans/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>.md`

**Acceptance evidence:**

- <exact test, review, artifact, or observable result>
- <negative or conflict-safety evidence>

**Merge condition:** <what must be approved and green before integration>.

**Unblocks:** <worker/gate IDs and supplied contract/evidence>.

Repeat for every worker. Keep one coherent outcome per package. Do not place the worker's step-by-step specification or implementation plan here.

### 8.1 Phase-specific launch prompts

When planning and execution may run in separate sessions or a launch packet is requested, create:

- `docs/workers/<blueprint-id>/prompts/<worker-id>-planning.md`; and
- `docs/workers/<blueprint-id>/prompts/<worker-id>-execution.md`.

The planning prompt makes the worker author its own reserved specification/plan,
synchronize every affected product specification masterplan in the same planning
substep, and stop before product implementation. The execution prompt consumes
those approved files and continues through integrated evidence and a clean main checkout.

## 9. Shared integration contracts

| Contract | Owner and authority | Consumers | Compatibility/validation | Merge/escalation |
| --- | --- | --- | --- | --- |
| <contract> | <worker and path/schema> | <IDs> | <rules/evidence> | <owner/process> |

## 10. Integration gates

### Gate <ID> — <name>

**Purpose:** <inspection or release decision>.

**Prerequisites:** <worker/gate IDs>.

**Acceptance evidence:**

- <observable criterion and exact evidence>
- <observable criterion and exact evidence>

**Verifier:** <role or named owner>.

**On failure:** <owner, remediation path, and blocked downstream nodes>.

**Unlocks:** <worker/gate/release IDs>.

## 11. Coordination status

- An active worker owns `docs/workers/<blueprint-id>/status/<worker-id>.md`; publish it with coherent progress checkpoints and the final handoff.
- The coordinator alone owns `docs/workers/<blueprint-id>/STATUS.md` when aggregate status is needed.
- The coordinator pulls `origin/main` before reporting readiness or blockers and records any main-only checkout with unpushed or dirty work as an integration gap.
- Ready-but-unscheduled workers remain `ready` when execution slots are full.

## 12. Main integration and conflict policy

- Require every editing worker to operate directly on checked-out `main`; prohibit feature branches and linked worktrees.
- Treat `origin/main` as the only integration authority.
- Assign every shared mutable surface one owner.
- Run focused affected tests at meaningful checkpoints; do not run the full suite after every small substep.
- Refresh and push coherent checkpoints when a long-running task risks drift, then run the full suite once after all worker-owned tasks finish.
- Regenerate generated files from their authority.
- Coordinate migration ordering through `origin/main`.
- Resolve mechanical owned conflicts and reverify.
- Stop on semantic or cross-owner conflicts.
- Use commit/push guards when available; otherwise inspect live state, fetch, reconcile, and retry without treating shared-main work as a blocker.
- Ban worker-to-worker Codex chat. Propagate living-authority changes through owned repository evidence and coordinator/document-owner updates.
- Never force-push `main`.
- Never reset, overwrite, or discard another worker's change to make integration pass.

## 13. Completion, handoff, and cleanup

A worker handoff includes its ID, final local `main` commit/reachable `origin/main`
commit, worker-authored spec/plan, affected product specification masterplan
updates or evidence-backed no-impact findings, living-authority and
downstream-document updates, verification, review, migrations/generated/
operational actions, conflict resolutions, limitations, and downstream unblock.

After all worker-owned tasks finish: refresh local and remote `main`, run the full suite once, prove ancestry from `origin/main`, verify downstream-document propagation, preserve the handoff/status, confirm the assigned main checkout is clean, and record a completion receipt.

Preserve dirty, unpushed, failing, under-review, or uncertain work. Never reset, overwrite, force-push, or force-clean it.

## 14. Explicit exclusions

List adjacent products, deferred capabilities, speculative infrastructure, and future gates that must not delay the bounded objective.

## 15. Revision policy

Ordinary progress updates status, not this frozen blueprint. When approved stable information changes scope, ownership, dependencies, gates, or completion:

1. update affected living authorities and consolidate changes from every changed
   worker specification into its affected product specification masterplans, or
   record evidence-backed no impact;
2. identify every directly or transitively affected worker and invalidated assumption;
3. update all relevant downstream briefs, specs, plans, prompts, and statuses through their owners;
4. issue an explicit blueprint revision/replacement;
5. update graph, briefs, prompts/status baseline, and readiness together;
6. integrate the coherent update into `origin/main`; and
7. obtain approval before affected workers continue.
````

## Graph rules

- Use a directed acyclic graph.
- Target three to seven ready workers per substantive post-foundation layer; justify exceptions.
- Calculate logical width separately from execution-slot capacity.
- Remove serial wrappers without distinct ownership/evidence.
- Group over-granular micro-surfaces by coherent outcome and shared verification.
- Give every node a stable ID used in the graph, parity table, briefs, gates, and status.
- Draw hard dependencies only; record coordination separately.
- Make gates distinct nodes.
- Verify every arrow against `Depends on` and `Unblocks`.

## Worker brief rules

- One package owns one coherent outcome.
- Create a worker only for non-overlapping ownership, independent evidence, a useful handoff, and lifecycle-worthy work.
- One shared mutable surface has one owner.
- Include contracts, records, migrations, and generated artifacts—not only files.
- Dependants consume merged contracts.
- Reserve worker artifact paths; do not pre-author worker specs/plans.
- Name exact acceptance evidence.

## Gate rules

- Add a gate only for a real inspection/release decision.
- Require measurable evidence, a verifier, failure owner, and downstream consequence.
- Do not call an arbitrary phase a gate.

## Revision rules

Clarifications that do not change behavior may amend the blueprint. Scope, dependency, ownership, gate, or completion changes require an explicit approved revision after living authorities are current.
