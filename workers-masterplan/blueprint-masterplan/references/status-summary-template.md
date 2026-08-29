# Coordinator Status Summary Template

Use at `docs/workers/<blueprint-id>/STATUS.md`. The coordinator alone edits this file after inspecting a named `origin/main` commit and checking the named per-worker status contracts. This summary and worker-owned artifacts replace worker-to-worker Codex chat. Preserve and report unrelated dirt; do not remove it to make a status or baseline look clean.

```markdown
# <Blueprint> Coordination Status

| Field | Value |
| --- | --- |
| Blueprint | `<relative path>` |
| Integration authority | `origin/main` |
| `origin/main` commit inspected | `<commit>` |
| Initial readiness snapshot at inspected commit | `<timestamp and timezone>` |
| Worker lanes inspected | `<paths/machines, timestamp, and timezone>` |
| Coordinator | <role or named owner> |
| Snapshot status | Current / Stale / Blocked |

## Authority-refresh record

| Authority path | Inspected `origin/main` commit | Result | Evidence / blocked action |
| --- | --- | --- | --- |
| `<relative path>` | `<commit>` | current / updated / blocked | `<review evidence, update commit, or unblock criterion>` |

Record every cited authority. A remote-uninspected authority or readiness result
is `unverified`, not current, planning-ready, or execution-ready.

## Executive status

| State | Workers |
| --- | --- |
| Ready | <IDs or none> |
| In progress | <IDs or none> |
| Blocked | <IDs or none> |
| Review | <IDs or none> |
| Complete | <IDs or none> |
| Stale or missing status | <IDs or none> |

## Whole-blueprint planning gate

| Field | Value |
| --- | --- |
| Receipt | `docs/workers/<blueprint-id>/PLANNING_GATE.md` |
| State | open / passed / reopened |
| Pinned `origin/main` commit | `<commit>` |
| Coordinator | <role or named owner> |
| Approval time | `<timestamp and timezone or pending>` |
| Reauthorization required | Yes / No; `<reason or none>` |

The receipt is the only ordinary-execution authorization. A worker's approved
planning artifacts are necessary but never sufficient on their own.

## Named worker-status contracts and complete planning manifest

| Worker | Named worker-status contract | Phase | Planned predecessor evidence | Specification path and commit | Implementation plan or accepted UI artifacts | UI requirements / handoff | Requirements reconciliation | Planning state | Cross-plan reconciliation | Authority synchronization | Gate row |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <ID> | `docs/workers/<blueprint-id>/status/<worker-id>.md` | planning / execution / ui-design | `<approved upstream specification, plan, authority/no-impact, and status commit>` | `<path, commit, or approved upstream contracts>` | `<path, commit, or accepted app commit + approval>` | `<UI requirements + handoff paths, or not applicable>` | pending / complete / reopened / not applicable | pending / approved / reopened / not applicable | pending / complete / contradicted | current / missing / stale / no-impact with evidence | complete / incomplete |

List every execution worker and UI-design worker. `not applicable` is valid for
an implementation plan only for a UI-design worker whose accepted app state,
approval evidence, separate UI requirements contract, and handoff are all
recorded.

## UI-design acceptance and ownership transfer

| UI-design worker | Affected presentation surfaces | Live server command and reviewed URL | Fixture/mock state | Accepted app commit | User approval | UI requirements | Design handoff | Current → next mutable owner | Transfer state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <ID> | <paths> | `<command>`; `<URL>` | complete / pending | `<origin/main-reachable commit>` | `<evidence or pending>` | `<path>` | `<path>` | `<design worker> → <implementation worker>` | pending / integrated / transferred |

## Unresolved cross-plan contradictions

| Contradiction | Affected workers or gate | Owner | Unblock criterion | Receipt state |
| --- | --- | --- | --- | --- |
| <scope, contract, ownership, dependency, acceptance, or UI-design conflict> | <IDs> | <owner> | <observable resolution> | open / reopened |

Use `None` only after complete-plan reconciliation confirms that no material
contradiction remains.

## Authority synchronization gaps

| Authority or downstream artifact | State | Affected workers/gates | Owner | Required action |
| --- | --- | --- | --- | --- |
| <path> | current / missing / stale / no-impact with evidence | <IDs> | <owner> | <approved update, reconciliation, or none with evidence> |

## Critical path

`<worker/gate ID> → <worker/gate ID> → <objective>`

Explain the first unresolved edge and the shortest observable action that advances it.

## Active blockers

| Blocked worker/gate | Blocking condition | Owner | Unblock criterion | Downstream impact |
| --- | --- | --- | --- | --- |
| <ID> | <remote-evidenced condition> | <owner> | <observable resolution> | <IDs or gate> |

## Dependency readiness

| Worker/gate | Planning prerequisites and evidence | Planning state | Global planning-gate receipt | Implemented execution prerequisites and evidence | Execution readiness | Blocker / reason |
| --- | --- | --- | --- | --- | --- |
| <ID> | <approved authorities, brief, planned contracts, and inspected remote evidence> | planning-blocked / planning-ready / planning-in-progress / planning-complete / unverified | open / passed / reopened at `<origin/main commit>` | <IDs and evidence verified on `origin/main`> | blocked / ready / in-progress / review / complete / unverified | <concise blocker or evidence> |

Planning readiness does not require predecessor implementation. Execution
readiness requires both a passed global receipt and the worker's implemented
hard prerequisites; retain these two findings separately even when they differ.
This is the initial readiness table at the inspected remote commit and must show
evidence and blockers for both predicates. Remote-uninspected rows are
`unverified`.

## Main-integration lifecycle evidence

| Worker | Checkout/clone mode | Required shared-checkout lock or cross-clone queue | Clean-baseline evidence | Last independently testable substep | Remote reachability proof |
| --- | --- | --- | --- | --- | --- |
| <ID> | genuinely shared checkout / independent normal clone | `<lock/queue name or not applicable>` | `<reconciled main; no owned dirt; unrelated dirt preserved/reported>` | `<coherent plan task/subtask; focused check; commit>` | `<origin/main commit and ancestry command/result>` |

For a genuinely shared checkout, the exclusive main-mutation lock covers all
filesystem edits and Git/index operations through remote proof; read-only
planning may be parallel. Normal clones are allowed only on different machines
or for an incompatible shared checkout. Their push queue covers reconciliation,
affected verification, push, and remote-ancestry proof without imposing a global
edit lock across clones.

## Verification and remote-state gaps

| Worker | Gap | Latest integrated `origin/main` commit | Last `main` reconciliation | Required action |
| --- | --- | --- | --- | --- |
| <ID> | Dirty owned paths / Unpushed commit / Stale main / Missing focused tests / Missing final full suite / Open review | <commit> | <commit/date> | <action> |

## Living-authority downstream propagation

| Authority change | Affected downstream workers/gates | Required document updates | Owner/approval state | Integrated `origin/main` commit |
| --- | --- | --- | --- | --- |
| <change> | <IDs> | <briefs/specs/plans/prompts/statuses> | <owners and state> | <commit or pending> |

Any affected worker remains blocked or not-ready while a required document update is missing, unapproved, or absent from `origin/main`.

## Gate status

| Gate | State | Satisfied evidence | Missing evidence | Verifier | Unlocks |
| --- | --- | --- | --- | --- | --- |
| <ID> | blocked / ready-for-validation / passed / failed | <artifacts> | <artifacts> | <owner> | <IDs> |

## Gate reopening evidence

| Reopening cause | Affected workers / execution state | Updated artifacts and authorities | No-impact findings for unrelated work | Reauthorization required |
| --- | --- | --- | --- | --- |
| <material scope, ownership, dependency, contract, acceptance, security/privacy, accepted UI-design, or plan change> | <IDs; paused at safe checkpoint / no new execution> | <paths and owners> | <evidence or none> | updated receipt, complete reconciliation, and a new passed `origin/main`-pinned gate |

When a material change occurs, set the receipt to `reopened`; no new ordinary
execution begins. Directly affected execution pauses safely. Only evidence-backed
no-impact findings permit already-running unrelated execution to continue.

## Newly unblocked since prior snapshot

| Worker/gate | Triggering integration or evidence | Next owner action |
| --- | --- | --- |
| <ID> | <commit, gate, or approval> | <action> |

## Completion receipts

| Worker | Final main commit reachable | Final full suite | No owned dirt; unrelated dirt preserved/reported | Handoff preserved | Recorded complete |
| --- | --- | --- | --- | --- | --- |
| <ID> | Yes / No | <evidence> | Yes / No | Yes / No | <timestamp or pending> |

## Coordinator next actions

1. <highest-leverage bounded action>
2. <next action>
3. <next action>
```

## Aggregation rules

- Pull `origin/main` before calculating; never trust a cached local branch list.
- Read each worker's latest coherent-checkpoint status from `origin/main`; inspect declared worker lanes only for dirty or unpushed owned work.
- Recompute hard-dependency readiness from `origin/main` ancestry and gate evidence.
- Recompute living-authority downstream impact and require every relevant downstream document update before clearing blockers.
- Treat a worker's `complete` claim as advisory until integration, verification, handoff, and clean-main checks pass.
- Keep coordinator conclusions out of worker-owned status files.
- Mark the entire snapshot stale if the `origin/main` pull fails.
- Report “no blocker” only after checking dependency, review, verification, conflict, and external-decision state.
- In a genuinely shared checkout, wait for the required main-mutation lock before filesystem or Git/index mutation; read-only planning may continue. Across independent normal clones, require the push queue but never impose a global edit lock. Preserve concurrent and unrelated changes, require explicit surface ownership, and retire only dedicated lanes after verified integration into `origin/main`.
