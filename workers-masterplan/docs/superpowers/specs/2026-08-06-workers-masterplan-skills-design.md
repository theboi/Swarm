# Workers Masterplan Skills Design

> Approved design for two reusable Codex skills that maintain living project authorities and turn them into a frozen, multi-worker execution blueprint modeled on EdenMind's current masterplanning practice.

| Field | Value |
| --- | --- |
| Status | Implemented and structurally validated; fresh-agent pressure evaluation pending |
| Date | 6 August 2026 |
| Skill collection | `workers-masterplan` |
| Source-project design reference | `docs/plans/EdenMind_Implementation_Masterplan.md` (not a runtime dependency) |
| External workflows | Superpowers and Grill Me |

## 1. Purpose

Create a repository-local `workers-masterplan` collection containing two independently valid Codex skills:

1. `living-masterplan`, which bootstraps and maintains the project's current authoritative masterplans; and
2. `blueprint-masterplan`, which reads those living authorities and freezes a construction-style execution blueprint for independent workers operating on one or more machines.

The skills must let a project divide work without relying on private conversation history, expose exactly what is blocked and what is ready, minimize shared-file and Git collisions, support optional delivery gates such as UI Demo or MVP, and preserve approved product knowledge as implementation evidence changes.

## 2. Design principles

- Follow EdenMind's current Markdown-first masterplanning model.
- Treat living masterplans as current authorities and execution blueprints as derived snapshots.
- Keep stable project knowledge out of worker-only conversations and frozen blueprints.
- Use Grill Me to pressure-test unsettled decisions and Superpowers to convert approved decisions into specifications, plans, tested changes, reviews, and verified handoffs.
- Split work like a construction project: foundations and contracts first, independent trades next, integration and inspection gates afterward.
- Maximize safe parallelism, not apparent parallelism.
- Give every shared mutable surface one owner.
- Treat remote integration-branch state as the dependency authority.
- Use isolated worktrees for concurrent workers on one machine.
- Remove completed worker worktrees and branches only after integration is proven.

## 3. Skill collection architecture

The repository root will contain:

```text
workers-masterplan/
├── docs/
│   └── superpowers/
│       ├── plans/
│       └── specs/
├── evals/
│   ├── blueprint-masterplan-scenarios.md
│   └── living-masterplan-scenarios.md
├── living-masterplan/
│   ├── SKILL.md
│   ├── agents/
│   │   └── openai.yaml
│   └── references/
│       ├── masterplan-types.md
│       └── living-masterplan-template.md
└── blueprint-masterplan/
    ├── SKILL.md
    ├── agents/
    │   └── openai.yaml
    └── references/
        ├── blueprint-masterplan-template.md
        ├── worker-status-template.md
        └── status-summary-template.md
```

Each child directory is a self-contained Codex skill. The parent directory is a collection, not a third skill or a plugin. Version one contains no generator framework; its strict Markdown contracts remain readable, portable, and easy to diff.

## 4. Authority model

```text
Repository evidence + user decisions
             ↓
     Living masterplans
             ↓
   Frozen execution blueprint
             ↓
Worker Superpowers specs and plans
             ↓
 Implementation evidence
             └──────────→ affected living masterplans
```

### 4.1 Living masterplans

Living masterplans describe the latest approved or evidenced state of the project. They may include:

- business or commercial authority;
- product or feature specifications;
- architecture and shared technical contracts;
- implementation state;
- operations, security, release, or compliance authority; and
- project-defined custom types.

The skill discovers and respects existing names and locations. For a new project with no convention, it defaults to `docs/plans`. A project may have multiple documents of the same type when their scopes are explicit.

### 4.2 Frozen execution blueprints

A blueprint is a derived execution contract. It records the approved delivery graph, worker ownership, gates, integration rules, and completion evidence for one bounded objective. It is not the ordinary progress ledger and does not replace living product or business authorities.

If later evidence changes a stable decision, the affected living masterplan is updated first. If that change alters worker dependencies, ownership, or gate criteria, the blueprint receives an explicit revision or replacement rather than silently drifting.

### 4.3 Task artifacts

Dated Superpowers specifications and plans remain task-level historical artifacts. Stable decisions discovered in them must be promoted to the relevant living masterplan before implementation depends on those decisions.

## 5. `living-masterplan` behavior

### 5.1 Bootstrap mode

One session explicitly invokes `living-masterplan` to establish the initial authority set. It must:

1. inspect repository files, documentation, history, and current implementation evidence;
2. identify existing authorities, duplication, gaps, and contradictions;
3. determine the required masterplan types and scopes;
4. use Grill Me for material unanswered decision frontiers;
5. use the Superpowers brainstorming approval process;
6. create or consolidate the living documents without discarding valid history;
7. self-review the documents for ambiguity, contradiction, and unsupported certainty;
8. obtain user approval; and
9. commit the approved authorities.

Bootstrap is performed once for a project authority set, not before every later update.

### 5.2 Maintenance mode

Later sessions may be prompted naturally to read and update an existing masterplan. They need not repeat bootstrap. The skill must:

1. read the relevant authority and its related documents;
2. inspect repository evidence relevant to the supplied update;
3. classify the incoming information;
4. update only affected sections while preserving unrelated approved decisions;
5. identify contradictions instead of overwriting them silently;
6. use further questioning only when a material decision remains unsettled;
7. record supersession or changed implementation evidence clearly;
8. verify internal consistency; and
9. commit the approved update when the request authorizes repository changes.

Natural-language requests such as "read the product spec masterplan and update it with this decision" must discover this maintenance workflow without requiring a slash command.

### 5.3 Information classification

Before updating a living authority, Codex classifies new information as one of:

- established repository fact or implementation evidence;
- approved product, commercial, architecture, or operational decision;
- proposed decision requiring clarification or approval;
- temporary worker or execution status;
- historical or superseded information; or
- task-level detail belonging in a Superpowers specification or plan.

Temporary worker status does not belong in a living product authority. Speculative implementation steps do not become product facts merely because they appeared in a task plan.

### 5.4 Superpowers and Grill Me composition

Grill Me is the decision-pressure tool. Superpowers is the approval and delivery lifecycle. The skill uses them together without forcing unnecessary ceremony:

- Bootstrap and materially ambiguous changes use both.
- Explicit, unambiguous evidence-backed maintenance updates do not require a full Grill Me interview.
- When Grill Me is required, it exhausts the currently answerable decision frontier; the same session then carries the settled answers into the Superpowers design and living documents.
- If Grill Me or an applicable Superpowers skill is unavailable, Codex pauses and reports the missing dependency rather than pretending the workflow ran.

## 6. `blueprint-masterplan` behavior

### 6.1 Preconditions

Before creating or revising a blueprint, Codex must:

1. fetch the remote repository and inspect the integration branch;
2. locate and read the relevant living masterplans;
3. confirm that they cover the proposed objective and reflect the latest known information;
4. route newly introduced stable information through `living-masterplan` rules;
5. commit approved living-authority updates before freezing the blueprint; and
6. stop if material contradictions or unanswered decisions would make worker boundaries unreliable.

`blueprint-masterplan` may update living masterplans when blueprint discovery introduces relevant stable information. It must not bury those decisions only in the blueprint.

### 6.2 Required blueprint structure

Every blueprint follows the EdenMind implementation-masterplan pattern:

1. purpose, authority, and usage instructions;
2. desired outcomes and optional delivery gates;
3. implemented foundations that workers must reuse;
4. locked boundaries and shared integration contracts;
5. a Mermaid dependency graph;
6. the mandatory Superpowers, isolation, Git, and verification lifecycle;
7. worker ownership and briefs;
8. integration and acceptance gates;
9. merge and conflict policy;
10. completion, teardown, and handoff requirements; and
11. explicit exclusions.

The exact heading names may follow the project's vocabulary, but none of these responsibilities may be omitted.

### 6.3 Construction-style decomposition

The blueprint generator must:

- establish foundation and shared-contract packages before dependant implementation;
- isolate independent trade-like packages with clear inputs and outputs;
- define one owner for each shared contract, migration sequence, generated artifact, central component, and other mutable integration surface;
- avoid assigning nominally parallel workers to edit the same shared file;
- create a designated integration worker when completed packages require assembly;
- use gates as evidence-based inspections rather than decorative milestones; and
- keep a downstream worker idle until every hard prerequisite is merged into the remote integration branch.

When two tasks must edit the same mutable surface, the generator must order them, refactor the surface behind an approved contract, or assign that surface to one owner. Separate worktrees do not make overlapping edits safely parallel.

### 6.4 Worker brief contract

Every worker brief defines:

- stable worker and task identifiers;
- the bounded outcome;
- hard prerequisites;
- owned paths, records, contracts, and generated artifacts;
- explicit non-ownership and coordination surfaces;
- required task specification and implementation plan;
- required tests and verification evidence;
- merge and completion conditions;
- handoff contents; and
- exact workers or gates unblocked by completion.

No worker may depend on private conversation history.

## 7. Dependency, status, and blocker model

### 7.1 Worker states

```text
not-ready → ready → in-progress → review → complete
                           ↘ blocked ↗
```

- `not-ready`: one or more hard prerequisites are not merged.
- `ready`: every hard prerequisite is merged and the ownership surface is available.
- `in-progress`: the worker has claimed its isolated workspace and begun its approved plan.
- `blocked`: progress cannot continue without a named decision, owner action, dependency, or external change.
- `review`: implementation is complete but review, integration, or required evidence remains open.
- `complete`: the required commits and evidence are integrated remotely, and the coordinator has recorded successful worker teardown.

### 7.2 Per-worker status

The default coordination layout is:

```text
docs/workers/<blueprint-id>/
├── STATUS.md
└── status/
    ├── <worker-id>.md
    └── ...
```

Each worker owns exactly one status file and records:

- branch and latest pushed commit;
- current state and completed plan substep;
- focused verification evidence;
- hard blockers;
- blocker owner, requested resolution, and unblock criterion;
- next action;
- last integration-branch fetch or rebase;
- expected downstream unblock; and
- update timestamp.

Workers update only their own status files on their own branches. Status paths are unique, so eventual merges do not create a shared-file hotspot.

The worker-owned status file becomes an archival handoff record when its final commit merges. The worker does not attempt to edit that deleted feature branch after teardown.

### 7.3 Aggregate status

`STATUS.md` is coordinator-owned. Workers do not edit it. A coordinator session may update it after fetching every active remote branch, or answer status questions directly from the remote per-worker files.

After integration, the coordinator advances the aggregate worker state to `complete` only when it has verified remote ancestry, required integration evidence, remote branch deletion, and the worker's cleanup receipt. This keeps post-merge teardown truth out of the now-archival feature-branch status file.

The aggregate reports:

- ready, active, reviewing, complete, and blocked workers;
- exact blockers, owners, and unblock criteria;
- stale or missing remote status;
- failed or missing verification;
- passed, pending, and failed gates;
- the current critical path; and
- work newly unblocked since the prior snapshot.

### 7.4 Gates

Gates are optional and user-defined. Common examples include UI Demo, MVP, security review, customer pilot, or production release. Every gate defines:

- a stable ID and outcome;
- upstream workers or gates;
- measurable acceptance criteria;
- required evidence;
- a verifier or decision owner; and
- downstream workers, gates, or release decisions it unlocks.

A gate with no objective evidence or downstream consequence is not included.

### 7.5 Graph validation

The dependency graph must be acyclic. Every referenced worker and gate must exist. Every node except the root has a justified prerequisite or an explicit statement that it may start immediately. The Mermaid diagram is a view of the written dependency contract and must agree with the worker briefs.

## 8. Concurrent execution on one machine

### 8.1 Isolation strategy

Use one Git worktree and one feature branch per worker. Prefer the host platform's native worktree facility. When no native facility exists, follow the Superpowers `using-git-worktrees` fallback and use an ignored project-local `.worktrees/` directory.

Before creating a worktree, Codex must detect whether the session is already isolated and distinguish a linked worktree from a submodule. A new worktree requires a unique branch, dependency installation appropriate to the project, and a clean baseline test.

Example topology:

```text
project/                              user or control checkout
project/.worktrees/
├── worker-a/                         feat/<blueprint>-worker-a
├── worker-b/                         feat/<blueprint>-worker-b
├── worker-c/                         feat/<blueprint>-worker-c
└── integration-review/               optional integration branch
```

The user may switch branches in the original checkout without affecting worker worktrees. No user or worker may edit another worker's worktree.

### 8.2 When to use separate clones

Use separate clones for different machines, incompatible environments, or cases that must not share repository-level Git configuration or object state. Multiple clones are not the default isolation mechanism on one machine because they duplicate storage and increase remote-state drift without preventing eventual semantic merge conflicts.

## 9. Worker execution and Git protocol

### 9.1 Start gate

Before beginning a worker package, the worker must:

1. fetch the remote repository;
2. rebase or pull the current integration branch;
3. read the blueprint, affected living masterplans, and prerequisite handoffs;
4. confirm every hard prerequisite and its evidence are merged remotely;
5. create or enter its isolated worktree;
6. run the baseline setup and verification; and
7. mark its own status file `in-progress`.

An unmerged feature branch may be inspected for coordination but cannot satisfy a dependency.

### 9.2 Mandatory Superpowers lifecycle

Every worker must:

1. inspect existing foundations before proposing replacements;
2. brainstorm and settle task-specific decisions;
3. write and obtain approval for a dated task specification;
4. write a detailed implementation plan;
5. update affected living masterplans with stable approved decisions before implementation;
6. implement using test-driven development where applicable;
7. request and address review;
8. run verification-before-completion; and
9. produce an evidence-backed handoff.

### 9.3 Substep synchronization

After every completed implementation-plan substep, including documentation substeps, the worker must:

1. run focused verification;
2. update only its own status file;
3. commit only its owned verified changes;
4. fetch the remote integration branch;
5. rebase or otherwise incorporate current integration state;
6. resolve mechanical conflicts while preserving all workers' intent;
7. stop on semantic, ownership, contract, generated-artifact, or migration-order conflicts;
8. rerun every check affected by the integration; and
9. push the updated feature branch before starting the next substep.

Workers push after substeps but do not merge every substep into the integration branch. Integration occurs at dependency boundaries, completed worker packages, or explicit gates. Foundation and contract packages may deliberately merge early when they unblock safe parallel work.

## 10. Completion, integration, and teardown

A worker is not complete merely because its feature branch passes. Completion requires:

1. full worker verification is green;
2. the approved integration path succeeds;
3. the worker's final commit is reachable from the remote base branch;
4. the integrated result has the required local or CI evidence;
5. the final handoff and historical status evidence are merged;
6. the worker-owned worktree is clean;
7. the owned worktree is removed without force;
8. stale worktree registrations are pruned;
9. the local feature branch is safely deleted with a merged-branch check; and
10. the corresponding remote feature branch is deleted.

Normal completion must never use forced worktree removal or forced branch deletion. If the work is unmerged, tests fail, review remains open, remote ancestry is unproven, or the worktree is dirty, teardown stops and reports the blocker.

Only worktrees created under the approved project-local worktree directory are automatically removed. Host-managed or externally placed workspaces are left to the host unless it provides a supported exit mechanism.

Active workers retain their branches. After all worker packages are integrated and torn down, only the original long-lived branch, normally `main`, should remain from that execution effort.

## 11. Conflict and failure handling

The skills stop, expose the problem, and identify an owner when:

- relevant living authorities are missing, stale, or contradictory;
- a material decision or acceptance criterion remains ambiguous;
- the dependency graph contains a cycle or missing node;
- two workers own the same mutable surface;
- a shared contract, migration sequence, or generated artifact has no owner;
- a gate lacks measurable acceptance evidence;
- a worker attempts to start from unmerged prerequisites;
- remote worker status or verification evidence is stale;
- a rebase exposes a semantic conflict;
- the base branch or integration target is uncertain;
- Grill Me or an applicable Superpowers skill is unavailable when required; or
- safe branch teardown cannot prove the work is integrated.

Mechanical conflicts inside a worker's owned surface may be resolved and reverified. Conflicts that change shared meaning require coordination with the affected owner and an update to the appropriate living masterplan.

## 12. Skill resources and discovery

### 12.1 `living-masterplan` resources

- `masterplan-types.md` defines document roles, routing, authority boundaries, and custom-type extension.
- `living-masterplan-template.md` defines the default metadata, purpose, authority, current-state, decisions, evidence, exclusions, unresolved questions, and change-history structure.

Its discovery metadata must trigger on requests to create, consolidate, refresh, maintain, or update authoritative project, business, product, architecture, implementation, or operational masterplans.

### 12.2 `blueprint-masterplan` resources

- `blueprint-masterplan-template.md` encodes the EdenMind-style frozen blueprint structure.
- `worker-status-template.md` encodes unique worker-owned status fields.
- `status-summary-template.md` encodes coordinator-owned readiness, blocker, gate, and critical-path reporting.

Its discovery metadata must trigger on requests to divide a bounded objective among independent workers, coordinate execution across branches, worktrees, machines, or agents, create dependency flowcharts, define delivery gates, or report readiness and blockers from an execution blueprint.

## 13. Validation and acceptance criteria

Implementation is accepted when:

- both skill folders pass Codex's skill validator;
- both contain accurate `agents/openai.yaml` metadata;
- all bundled reference links resolve;
- no placeholder, contradictory instruction, or ambiguous authority remains;
- the living skill supports bootstrap plus natural-language maintenance;
- masterplan types are parameterized and custom types are supported;
- explicit maintenance updates do not force unnecessary grilling;
- the blueprint skill enforces current living authorities before freezing work;
- newly discovered stable information routes back into living documents;
- the blueprint template reproduces the structural strengths of EdenMind's implementation masterplan;
- worker graphs are acyclic and their written dependencies match their Mermaid edges;
- worker ownership prevents shared-file false parallelism;
- per-worker status and coordinator aggregation expose blockers and readiness;
- gates are optional but evidence-based when present;
- same-machine workers receive isolated worktrees and branches;
- substep synchronization does not require merging every commit into `main`;
- downstream dependencies require remote integration;
- completed workers safely remove their worktrees and local/remote branches; and
- the original long-lived branch is never deleted or force-modified by the workflow.

## 14. Explicit exclusions

Version one does not include:

- a YAML execution manifest;
- a Markdown or Mermaid generator;
- GitHub Projects or issue-tracker synchronization;
- automatic branch merging;
- automatic destructive cleanup of dirty or unmerged work;
- a long-running orchestration daemon; or
- project-specific EdenMind business or product content inside the reusable templates.

These may be added later only if real usage demonstrates that strict Markdown contracts and Git evidence are insufficient.
