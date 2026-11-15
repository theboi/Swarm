# Execution Worker Status Template

The coordinator owns specifications and plans. The worker owns this execution
status and its completion manifest; status does not replace implementation evidence.

# <worker-id> — <implementation outcome>

| Field | Value |
| --- | --- |
| Blueprint | <path and ID> |
| Supplied specification | <coordinator-authored path/commit> |
| Supplied detailed implementation plan | <coordinator-authored path/commit> |
| Coordinator plan-set receipt | <path/commit if used> |
| Phase | execution, or conditional presentation design |
| State | execution-blocked / execution-ready / in-progress / review / complete / unverified |
| Hard implemented prerequisites | <IDs, commits and checks> |
| Owned / excluded surfaces | <exact paths/contracts> |
| Checkout and branch | <normal main checkout path> |
| Lock / push queue | <mode, exact name and holder protocol> |
| Latest origin/main inspected | <commit> |
| Unrelated dirt | <preserved paths or none> |

## Current checkpoint

Completed: <coherent implementation task, checks and reachable commit>.
Next: <next applicable task in supplied plan>.

## Genuine discoveries

| Evidence | Affected contract/plan | Proposed bounded correction | Coordinator action |
| --- | --- | --- | --- |

Do not create a worker planning phase or independently rewrite the supplied
plan. Routine corrections within prior authorization need no new product round.
An actual new material decision is identified precisely.

## Verification and remote integration

| Scope | Exact command/check | Result | Source commit/environment |
| --- | --- | --- | --- |

Use focused tests during tasks and the final full owned suite at completion.
Record runtime/model/index/migration qualification separately from fakes.

## Final handoff

Record implemented tasks, review, tests, exact remote commits, downstream
unblocks, migrations/index/runtime actions, limitations and owned cleanliness.
Publish completion-manifest/<worker-id>.json before the final response.
No worker-authored planning manifest is a prerequisite.

Conditional UI designers additionally record accepted app-state commit, owner
approval, UI requirements, handoff and sequential mutable-owner transfer. They
do not author implementation plans; the coordinator consumes their output.
