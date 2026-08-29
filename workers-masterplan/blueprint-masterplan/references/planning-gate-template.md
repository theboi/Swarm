# Planning-Gate Receipt Template

The coordinator alone edits `docs/workers/<blueprint-id>/PLANNING_GATE.md`.
Workers supply their owned planning artifacts and handoffs, but never create,
approve, or alter this whole-blueprint execution authorization.

````markdown
# <blueprint-id> Planning-Gate Receipt

| Field | Value |
| --- | --- |
| Gate state | open / passed / reopened |
| Blueprint | `<blueprint-path>` |
| Blueprint ID | `<blueprint-id>` |
| Authorized `origin/main` commit | `<origin-main-commit>` |
| Coordinator | `<coordinator>` |
| Approval timestamp | `<timestamp>` |

## Execution-worker planning set

| Worker | Specification and commit | Implementation plan and commit | Approval | Living-authority synchronization | Cross-plan reconciliation |
| --- | --- | --- | --- | --- | --- |
| `<worker-id>` | `<spec-path-and-commit>` | `<plan-path-and-commit>` | approved / pending | `<authority-sync-evidence>` | `<reconciliation-result>` |

## UI-design planning set

| UI worker | Accepted app commit | Approval evidence | Presentation handoff | UI requirements | Live review | Requirements-to-plan reconciliation | Mutable owner transfer | Remote commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `<design-worker-id>` | `<accepted-app-commit>` | `<approval-evidence>` | `<handoff-path>` | `<ui-requirements-path>` | fixture/mock complete / pending | `<consumer-plan mapping>` | `<implementation-owner>` | `<origin-main-commit>` |

## Unresolved contradictions

| Contradiction | Owner | Unblock criterion |
| --- | --- | --- |
| `<contradiction>` | `<owner>` | `<unblock-criterion>` |

## Verification and review evidence

Record the exact verification and review evidence, result, and reachable commit
that supports this receipt.

## Material-change reopening rule

A material change to scope, ownership, dependencies, contracts, acceptance,
security/privacy behavior, an accepted UI design, or an implementation plan
changes this receipt to `reopened`. No new ordinary execution starts until every
affected artifact and authority is updated, the complete planning set is
reconciled again, and the coordinator publishes a new passed receipt at current
`origin/main`.
````

The gate cannot pass while any required row is pending or any contradiction is
unresolved. A UI-design worker has no implementation plan; its accepted
fixture/mock presentation app state, approval evidence, separate UI requirements
contract, handoff, live review, and requirements-to-plan reconciliation must all
be complete. Every ordinary execution prompt must verify this receipt and its
pinned `origin/main` commit before editing.
