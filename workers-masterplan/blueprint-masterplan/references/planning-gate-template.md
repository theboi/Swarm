# Coordinator Plan-Readiness Receipt

Keep the existing PLANNING_GATE.md path when a project uses it. This receipt
records the coordinator's completed initial planning, not a worker-planning
phase or a later reconciliation of independently authored plans.

# <blueprint-id> Coordinator Plan-Readiness Receipt

| Field | Value |
| --- | --- |
| State | drafting / ready / superseded |
| Blueprint | <path> |
| Coordinator and author of ALL worker plans | <coordinator> |
| Reviewed origin/main plan-set commit | <commit> |
| Existing owner authorization | <approved scope and evidence> |
| Additional approval genuinely required | <specific material decision or none> |

## Complete coordinator-authored plan set

| Worker | Specification and commit | Detailed implementation plan and commit | Plan author | Interface/ownership/dependency check | Execution prerequisites |
| --- | --- | --- | --- | --- | --- |
| <worker-id> | <path/commit> | <path/commit> | <coordinator> | <evidence> | <implemented prerequisites or none> |

Every ordinary worker has a concrete plan already written by the coordinator.
No reserved-only paths, worker-authored planning receipt or pending independent
consumer agreement is a valid complete row. The coordinator performs these
checks while creating the full set, before handoff.

## Conditional UI evidence

When UI design is required, record accepted presentation commit, owner approval,
UI requirements contract, presentation handoff and the coordinator-authored
live-wiring plan consuming them. No UI-design implementation plan is required.

## Verification

Record authority synchronization/no-impact, complete task coverage, exact shared
signatures, single ownership, acyclic DAG, no hidden prompt/schema producer cycle,
link/path checks, reviews and remote ancestry. Do not claim runtime tests merely
because planning checks pass.

## Readiness meaning

A ready receipt means initial coordinator planning is complete and required
authorization is recorded. Workers may execute as their actual hard implemented
prerequisites exist. The receipt cannot invent authority, waive those
prerequisites or start deployment/paid calls.

Legacy gate states open/passed/reopened may be retained by an existing project;
interpret them as coordinator package readiness, not as a requirement to run
ordinary workers through a planning pass. Do not rewrite historical receipts
or mark old incomplete artifacts complete automatically.

## Bounded correction rule

Coordinator updates affected plans/authorities when real discoveries require
it. Pause only affected work when necessary; no all-worker re-planning round.
Material scope/security/authorization changes require the relevant owner decision.
