# Coordinator Status Summary Template

Use at `docs/workers/<blueprint-id>/STATUS.md`. The coordinator alone edits this file after pulling `origin/main` and checking declared worker lanes for dirty or unpushed work. This summary and worker-owned artifacts replace worker-to-worker Codex chat.

```markdown
# <Blueprint> Coordination Status

| Field | Value |
| --- | --- |
| Blueprint | `<relative path>` |
| Integration authority | `origin/main` |
| `origin/main` commit inspected | `<commit>` |
| Worker lanes inspected | `<paths/machines, timestamp, and timezone>` |
| Coordinator | <role or named owner> |
| Snapshot status | Current / Stale / Blocked |

## Executive status

| State | Workers |
| --- | --- |
| Ready | <IDs or none> |
| In progress | <IDs or none> |
| Blocked | <IDs or none> |
| Review | <IDs or none> |
| Complete | <IDs or none> |
| Stale or missing status | <IDs or none> |

## Critical path

`<worker/gate ID> → <worker/gate ID> → <objective>`

Explain the first unresolved edge and the shortest observable action that advances it.

## Active blockers

| Blocked worker/gate | Blocking condition | Owner | Unblock criterion | Downstream impact |
| --- | --- | --- | --- | --- |
| <ID> | <remote-evidenced condition> | <owner> | <observable resolution> | <IDs or gate> |

## Dependency readiness

| Worker/gate | Written prerequisites | Integrated prerequisites | Effective state | Reason |
| --- | --- | --- | --- | --- |
| <ID> | <IDs> | <IDs verified on origin/main> | not-ready / ready / in-progress / blocked / review / complete | <concise evidence> |

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

## Newly unblocked since prior snapshot

| Worker/gate | Triggering integration or evidence | Next owner action |
| --- | --- | --- |
| <ID> | <commit, gate, or approval> | <action> |

## Completion receipts

| Worker | Final main commit reachable | Final full suite | Assigned lane clean | Handoff preserved | Recorded complete |
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
- Never treat workers sharing `main` or a checkout as a blocker. Preserve concurrent changes, require explicit surface ownership, and retire only dedicated lanes after verified integration into `origin/main`.
