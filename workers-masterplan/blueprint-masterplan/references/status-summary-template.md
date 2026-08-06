# Coordinator Status Summary Template

Use at `docs/workers/<blueprint-id>/STATUS.md`. The coordinator alone edits this file after fetching the remote base and all active worker branches.

```markdown
# <Blueprint> Coordination Status

| Field | Value |
| --- | --- |
| Blueprint | `<relative path>` |
| Remote base authority | `<remote>/<base-branch>` |
| Base commit inspected | `<commit>` |
| Remote branches fetched | `<timestamp and timezone>` |
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
| <ID> | <IDs> | <IDs verified on remote base> | not-ready / ready / active / review / complete | <concise evidence> |

## Verification and remote-state gaps

| Worker | Gap | Last pushed commit | Last base sync | Required action |
| --- | --- | --- | --- | --- |
| <ID> | Stale branch / Missing tests / Open review / Non-ancestor commit | <commit> | <commit/date> | <action> |

## Gate status

| Gate | State | Satisfied evidence | Missing evidence | Verifier | Unlocks |
| --- | --- | --- | --- | --- | --- |
| <ID> | blocked / ready-for-validation / passed / failed | <artifacts> | <artifacts> | <owner> | <IDs> |

## Newly unblocked since prior snapshot

| Worker/gate | Triggering integration or evidence | Next owner action |
| --- | --- | --- |
| <ID> | <commit, gate, or approval> | <action> |

## Completion and cleanup receipts

| Worker | Integrated commit reachable | Integrated verification | Worktree removed | Local branch deleted | Remote branch deleted | Recorded complete |
| --- | --- | --- | --- | --- | --- | --- |
| <ID> | Yes / No | <evidence> | Yes / No / Host-managed | Yes / No | Yes / No | <timestamp or pending> |

## Coordinator next actions

1. <highest-leverage bounded action>
2. <next action>
3. <next action>
```

## Aggregation rules

- Fetch before calculating; never trust a cached local branch list.
- Read each worker's status from its remote feature branch while active.
- Recompute hard-dependency readiness from remote base ancestry and gate evidence.
- Treat a worker's `complete` claim as advisory until integration and cleanup checks pass.
- Keep coordinator conclusions out of worker-owned status files.
- Mark the entire snapshot stale if remote fetch fails.
- Report “no blocker” only after checking dependency, review, verification, conflict, and external-decision state.
- Active worker branches remain. Delete only branches for verified integrated workers.
