# UI Requirements Contract Template

Use this separate contract for every conditional UI-design worker. It records
what the presentation needs from later live wiring; it never authorizes or
implements APIs, authorization, persistence, domain rules, or other runtime
behavior. The UI-design worker owns this document in Pass 1. The named
live-wiring worker consumes it while writing its Pass 1 implementation plan and
implements it only in Pass 2 after the whole-blueprint planning gate passes.

````markdown
# <Worker ID> <Surface> UI Requirements Contract

## Authority and accepted presentation reference

- UI-design worker: `<worker-id>`
- Live-wiring consumer: `<worker-id>`
- Product authority: `<path and approved section>`
- Accepted presentation app-state commit: `<origin/main-reachable commit or pending>`
- Approval evidence: `<user/product-owner evidence or pending>`
- Presentation handoff: `<relative path>`

## Surface inventory

List routes, panels, dialogs, menus, responsive variants, and deep links.

## Actor and capability matrix

| Actor | Surface/action | Allowed | Omitted versus disabled behavior | Reason / product authority |
| --- | --- | --- | --- | --- |

## Read requirements

| Requirement ID | UI state | Required fields | Freshness/loading/empty/error behavior | Producer / consumer |
| --- | --- | --- | --- | --- |

## Command requirements

| Requirement ID | User intent | Inputs and validation | Confirmation / idempotency | Success, failure, and recovery behavior | Producer / consumer |
| --- | --- | --- | --- | --- | --- |

## Async and lifecycle states

Specify loading, queued, processing, waiting, attention, partial success,
failed, cancelled, completed, stale, and revoked states that the UI must render.

## Navigation and client state

Specify URL/deep-link behavior, dirty state, focus restoration, refresh/retry,
and unavailable-state behavior.

## Files and exports

Specify upload, download, preview, export, progress, limits, authorization,
and unavailable-state behavior where applicable.

## Accessibility contract

Specify keyboard operation, focus order/restoration, semantic roles and names,
screen-reader announcements, reduced motion, and any state-specific accessible
names or descriptions.

## Deterministic fixture scenarios

List fixture/mock scenarios for every required state. State explicitly that this
Pass 1 presentation uses no live wiring.

## Planned-contract traceability

| Requirement ID | User intent/state | Producer worker | Specification section | Implementation-plan task | Consumer | Reconciliation state |
| --- | --- | --- | --- | --- | --- | --- |

Every requirement maps to an existing specification and implementation-plan
task, or names the missing owner and reconciliation action.

## Pass 2 acceptance mapping

Map each requirement to its contract, browser, integration, or acceptance test
that the live-wiring worker will complete in Pass 2.

## Open product decisions and reconciliation state

| Decision or contradiction | Owner | Blocking effect | Planned resolution | State |
| --- | --- | --- | --- | --- |

Business and domain intent remain in living product authorities. An approved
endpoint shape may be cited, but the named ordinary planner owns APIs,
authorization, domain behavior, and persistence decisions.
````
