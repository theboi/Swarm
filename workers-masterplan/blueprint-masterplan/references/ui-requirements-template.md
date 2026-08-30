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

List every route, panel, dialog, menu, responsive variant, and deep link. For
each surface, identify the user goal, entry point, primary content, actions,
and all required loading, empty, error, unavailable, and permission states.

## Actor and capability matrix

| Actor | Surface/action | Allowed | Omitted versus disabled behavior | Reason / product authority |
| --- | --- | --- | --- | --- |

## Read requirements

For every view model, name the exact fields, grouping, ordering, filters,
search, pagination or cursor behavior, freshness expectation, and loading,
empty, error, unavailable, and stale states.

| Requirement ID | UI state | Required fields and grouping | Ordering/filter/search/pagination or cursor | Freshness/loading/empty/error behavior | Producer / consumer |
| --- | --- | --- | --- | --- | --- |

## Command requirements

For each command, define the user intent, inputs, client-visible validation,
capability/permission expectation, confirmation requirement, idempotency,
success state, failure state, recovery action, and the planned producer and
consumer. This describes UI needs only; the ordinary planner owns the API,
authorization, persistence, and domain implementation.

| Requirement ID | User intent | Inputs, validation, and capability | Confirmation / idempotency | Success, failure, and recovery behavior | Producer / consumer |
| --- | --- | --- | --- | --- | --- |

## Async and lifecycle states

Specify the presentation and permitted action for every applicable loading,
queued, processing, waiting, attention-required, partial-success, failed,
cancelled, completed, stale, and revoked state. Include retry, cancellation,
polling or refresh expectations where the UI needs them; do not design live
wiring in this Pass 1 contract.

## Navigation and client state

Specify routes, URL/deep-link parameters, navigation context switching,
selected-tab and panel state, dirty-state protection, focus restoration,
refresh/retry behavior, and unavailable-state behavior.

## Files and exports

Where applicable, specify upload, download, preview, export, progress,
validation, file type and size limits, authorization/capability behavior,
recovery, and unavailable-state behavior.

## Accessibility contract

Specify keyboard operation, logical focus order and restoration, semantic roles
and accessible names, screen-reader announcements, reduced-motion behavior,
contrast or non-color cues where relevant, and state-specific accessible names
or descriptions.

## Deterministic fixture scenarios

List at least one deterministic fixture/mock scenario for every required state,
including all permissions, async, empty, error, and unavailable variants. State
explicitly that this Pass 1 presentation uses fixture/mock data and no live
wiring, API calls, persistence, or runtime behavior.

## Planned-contract traceability

| Requirement ID | User intent/state | Producer worker | Specification section | Implementation-plan task | Consumer | Reconciliation state |
| --- | --- | --- | --- | --- | --- | --- |

Every requirement maps to an existing upstream specification section and
implementation-plan task, or explicitly names the missing-contract owner,
reconciliation action, and downstream work that must wait. Do not hide a
missing upstream contract behind a generic `pending` state.

## Pass 2 acceptance mapping

Map each requirement to focused contract, browser, integration, or acceptance
checks that the named live-wiring worker will complete in Pass 2.

## Open product decisions and reconciliation state

| Decision or contradiction | Decision owner | Blocking behavior | Affected plans | Planned resolution | Observable closure evidence | State |
| --- | --- | --- | --- | --- | --- | --- |

Record `none` only after explicitly reconciling the relevant upstream plans and
product authority; otherwise every open decision must state its owner, blocking
behavior, affected plans, and observable closure evidence.

Business and domain intent remain in living product authorities. An approved
endpoint shape may be cited, but the named ordinary planner owns APIs,
authorization, domain behavior, and persistence decisions.
````
