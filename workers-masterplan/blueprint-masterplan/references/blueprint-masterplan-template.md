# Blueprint Masterplan Template

The coordinator authors this blueprint AND all detailed worker specifications
and implementation plans before handoff. Empty reserved paths are not plans.

## Required blueprint sections

1. Purpose, bounded outcome, decision owner, integration authority and source baseline.
2. Approved shared design and living-authority updates/no-impact findings.
3. Reused code, schemas, tests, migrations, providers and runtime foundations.
4. Exactly one mutable owner for every shared file/schema/registry/environment.
5. Complete coordinator-authored worker specification and plan inventory.
6. Exact shared types/signatures/versions, producers and consumers.
7. DAG, hard implemented prerequisites, integration owner and acceptance.
8. Main-only lifecycle, lock/queue, status/manifest and runtime allocations.
9. Executable handoffs, verification evidence, exclusions and correction policy.

## Blueprint body

# <Project> <Objective> Implementation Masterplan

| Field | Value |
| --- | --- |
| Blueprint ID | <YYYY-MM-DD-short-slug> |
| Coordinator and plan author | <same coordinator for every worker plan> |
| Decision owner / existing authorization | <owner and approved scope> |
| Inspected origin/main commit | <commit> |
| Integration authority | origin/main |
| Checkout mode | <shared checkout or permitted independent normal main clones> |
| Main-mutation lock / push queue | <exact name, holder and protocol> |
| Specification root | docs/superpowers/specs/<blueprint-id>/ |
| Implementation-plan root | docs/superpowers/plans/<blueprint-id>/ |
| Coordination root | docs/workers/<blueprint-id>/ |

### Outcome and boundaries

State delivered behavior, required evidence and explicit exclusions. Distinguish
approved intent, implemented foundations and unperformed qualification.

### Complete worker plan inventory

| Worker | Bounded implementation outcome | Coordinator-authored specification | Coordinator-authored detailed plan | Owned / excluded surfaces | Hard execution prerequisites | Verification / downstream handoff |
| --- | --- | --- | --- | --- | --- | --- |

Every listed specification and plan is written by the coordinator NOW, using
writing-plans task granularity. Each contains exact files/interfaces, meaningful
tests, commands and acceptance. A brief alone does not satisfy this table.
Do not dispatch workers to fill in these artifacts.

### Shared mutable ownership

| Surface | Single implementation owner | Producer/consumer contract | Integration/correction owner |
| --- | --- | --- | --- |

Include database models/migrations, generated outputs, prompt/schema registries,
central composition, shared fixtures and runtime namespaces, not just modules.

### Dependency graph and execution readiness

Draw only real implementation prerequisites; planned contracts do not prove
implemented prerequisites. Record nodes/edges, acyclicity, layer widths and
active slots. Target 3–7 ready workers in a substantive frontier; justify small
foundations/joins or a small objective. Check every edge against written Depends
on / Unblocks. Check for hidden prompt/schema import cycles.

| Node | Depends on | Unblocks | Evidence required on origin/main |
| --- | --- | --- | --- |

Coordinator plan-completeness review occurs before any ordinary handoff and is
not a worker node or a later reconciliation phase. When a project records it in
PLANNING_GATE.md, fill the receipt from the coordinator's completed plan set.
Do not wait for worker-authored plans or worker planning manifests.

### Worker briefs and execution packets

Each brief names its finished plan, owned/excluded paths, exact implemented
prerequisites, tests/review, integration condition and status/manifest paths.
Use references/worker-prompt-templates.md. The first ordinary handoff directs
implementation, not independent specification or plan authoring.

A conditional UI-design worker supplies accepted presentation and UI
requirements. The coordinator incorporates these into affected plans before
live wiring. Preserve the separate presentation-only and runtime-isolation
workflow; ordinary workers still do not author plans.

### Main-only integration

Shared checkout: consistent exclusive lock for filesystem and Git/index
mutations through remote proof. Normal clones only on different machines or a
documented incompatible shared checkout; push queue covers reconcile/check/
push/proof, not global editing. Preserve unrelated dirt; no worktrees, branches,
stash/reset/clean/rebase/force-push shortcuts.

After each coherent independently testable substep: focused check, stage owned
paths, commit main, fetch/merge, rerun affected checks, push, fetch and prove
ancestry. Final full owned suite once at completion. Workers coordinate through
repository evidence and coordinator status, not worker-to-worker Codex chat.

### Corrections, acceptance and cleanup

Routine implementation discoveries are recorded; coordinator corrects affected
specs/plans together. No mandatory new planning round for all workers. Material
product changes need the actual owner's decision; reuse prior approval for
routine choices. Preserve existing plans/history and completed work.

A proven ended failed upstream implementation may be repaired by its downstream
consumer within the bounded approved scope, followed by tests/integration and
resumption. An active or uninspected worker does not qualify.

Acceptance includes concrete security, model/index/migration, caller and
end-to-end evidence appropriate to scope. Source/qualification/runtime claims
must name actual checks. No paid/live actions are authorized by a plan alone.
Completion requires remote-reachable code, review/tests, handoff/manifest, no
owned dirt and preservation of unrelated work.
