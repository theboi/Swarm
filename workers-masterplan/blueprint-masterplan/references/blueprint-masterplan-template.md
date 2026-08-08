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
| Integration authority | `<remote>/<base-branch>` |
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
5. the current repository and remote integration branch; and
6. its unique branch/workspace and reserved artifact/status paths.

No worker depends on private conversation history or an unmerged implementation branch. Each worker authors its own detailed specification and implementation plan after its prerequisites are integrated.

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

- `not-ready`: at least one hard prerequisite is not integrated.
- `ready`: every hard prerequisite and required contract is integrated.
- `in-progress`: the worker claimed its isolated workspace and pushed current work.
- `blocked`: a named dependency, decision, conflict, or external condition prevents progress.
- `review`: work exists but required review, evidence, or integration is open.
- `complete`: the coordinator verified integration, handoff, evidence, and cleanup.

Remote integration state is authoritative. A local “done” claim or pushed feature branch does not unblock a dependant.

## 7. Mandatory lifecycle for every worker

### 7.1 Worker-authored Superpowers planning

1. Prove prerequisites and evidence are integrated on the remote base.
2. Enter the assigned unique isolated branch/worktree or clone and run a clean baseline.
3. Read this blueprint, relevant living authorities, the worker brief, and prerequisite handoffs.
4. Use Superpowers brainstorming for task-local decisions.
5. Write and obtain approval for `docs/superpowers/specs/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>-design.md`.
6. Use `superpowers:writing-plans` to write `docs/superpowers/plans/<blueprint-id>/YYYY-MM-DD-<worker-id>-<topic>.md`.
7. Update affected living authorities with stable approved decisions.
8. Hand off the approved planning artifacts and stop before implementation.

The coordinator reserves these paths but does not author their detailed contents.

### 7.2 Execution

1. Read the worker-authored approved specification and implementation plan.
2. Implement only owned surfaces with TDD where applicable.
3. Request/address review and run verification-before-completion.
4. Integrate through the approved path.
5. Hand off evidence and perform safe teardown.

### 7.3 Worktree isolation

Use one branch and isolated worktree per local worker. Prefer native platform worktree support; otherwise use an ignored project-local `.worktrees/<worker-id>` path after verifying isolation and a clean baseline.

Use separate clones for separate machines or incompatible environments.

### 7.4 Substep Git synchronization

After each independently testable plan substep:

1. run focused verification;
2. update only the worker-owned status file;
3. commit only owned verified changes;
4. fetch and incorporate the current remote base;
5. resolve only mechanical conflicts within ownership;
6. stop on semantic, ownership, contract, generated-file, or migration conflicts;
7. rerun affected checks; and
8. push before the next substep.

Merge at contract/dependency, completed-package, or gate boundaries—not after every substep.

## 8. Worker packages

### Worker <ID> — <task and outcome>

**Depends on:** <worker/gate IDs or approved living authorities>.

**Owns:** <paths, contracts, records, migrations, generated artifacts, tests, status>.

**Does not own:** <nearby shared or dependant surfaces>.

**Coordinates with:** <owners and non-hard contract boundaries>.

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

The planning prompt makes the worker author its own reserved specification/plan and stops before product implementation. The execution prompt consumes those approved files and continues through integrated evidence and safe teardown.

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

- An active worker owns `docs/workers/<blueprint-id>/status/<worker-id>.md` on its branch.
- The coordinator alone owns `docs/workers/<blueprint-id>/STATUS.md` when aggregate status is needed.
- The coordinator fetches active remote branches before reporting readiness or blockers.
- Ready-but-unscheduled workers remain `ready` when execution slots are full.

## 12. Merge and conflict policy

- Use narrow feature branches and unique worktrees.
- Treat the named remote base as the only integration authority.
- Assign every shared mutable surface one owner.
- Merge foundations early only when their complete evidence unblocks dependants.
- Regenerate generated files from their authority.
- Coordinate migration ordering through the remote base.
- Resolve mechanical owned conflicts and reverify.
- Stop on semantic or cross-owner conflicts.
- Never reset, overwrite, or discard another worker's change to make integration pass.

## 13. Completion, handoff, and teardown

A worker handoff includes its ID, branch/final commit/base, worker-authored spec/plan, living-authority updates, verification, review, migrations/generated/operational actions, conflict resolutions, limitations, and downstream unblock.

After integration: prove ancestry, verify the integrated result, preserve the handoff/status, confirm the worker tree is clean, remove only that tree without force, safely delete merged branches, and record a cleanup receipt.

Preserve dirty, unmerged, failing, under-review, or uncertain work.

## 14. Explicit exclusions

List adjacent products, deferred capabilities, speculative infrastructure, and future gates that must not delay the bounded objective.

## 15. Revision policy

Ordinary progress updates status, not this frozen blueprint. When approved stable information changes scope, ownership, dependencies, gates, or completion:

1. update affected living authorities;
2. identify invalidated worker assumptions;
3. issue an explicit blueprint revision/replacement;
4. update graph, briefs, prompts/status baseline, and readiness together; and
5. obtain approval before affected workers continue.
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
