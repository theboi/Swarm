# Coordinator Status Summary Template

Coordinator owns this summary and the entire plan/spec set. Workers own
execution status/manifests. Inspect origin/main before reporting readiness.

# <Blueprint> Coordination Status

| Field | Value |
| --- | --- |
| Blueprint / integration authority | <path/ID>; origin/main |
| Coordinator / author of all worker plans | <identity> |
| Inspected origin/main | <commit/time> |
| Initial coordinator planning | in-progress / complete |
| Plan-set receipt | <path/commit if used> |
| Existing authorization | <evidence> |

## Complete plan inventory

| Worker | Coordinator-authored specification | Coordinator-authored detailed plan | Implemented prerequisites and evidence | Execution readiness | Worker execution status |
| --- | --- | --- | --- | --- | --- |

Every plan exists before handoff. Pending coordinator planning is coordinator
work, not an assignment to a worker to write its own plan. There is no
worker-planning/reconciliation readiness column.

## Authority and ownership checks

| Authority/surface | Inspected commit | Current / updated / blocked / unverified | Evidence / owner |
| --- | --- | --- | --- |

Confirm all shared producer/consumer contracts and single mutable owners during
initial planning, not after independently drafted worker plans arrive.

## Execution progress and real blockers

| Worker/gate | Implementation checkpoint | Named blocker | Required implementation evidence | Next action |
| --- | --- | --- | --- | --- |

Distinguish missing implemented prerequisites, external authority/secrets and
genuine discoveries from a plan already supplied by the coordinator.
Do not reopen settled product approval or wait for nonexistent planning receipts.

## Corrections and downstream impact

| Actual discovery | Affected plans/authorities | Coordinator correction | Impacted execution only |
| --- | --- | --- | --- |

Conditional UI acceptance records app commit, approval, requirements/handoff and
the coordinator-updated live-wiring plan. Preserve UI ownership transfer.

## Main integration and completion

| Worker | Lock/queue mode | Focused/final checks | Remote commit/proof | Review/manifest | Owned cleanliness / preserved dirt |
| --- | --- | --- | --- | --- | --- |

No complete status from local-only or uninspected evidence. No runtime/model
qualification claims from documentation checks. Next coordinator actions should
advance concrete implementation or finish coordinator-owned plans, not launch
a plan-authoring round.
