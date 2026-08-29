# Two-Pass Planning, UI Requirements, and Live-Wiring Design

> Approved architecture for making UI design an input to whole-DAG planning
> while keeping live functional wiring behind implemented prerequisites.

| Field | Value |
| --- | --- |
| Status | Approved in conversation by the EdenMind product owner on 29 August 2026; written specification awaiting repository review |
| Decision owner | EdenMind product owner |
| Effective scope | Reusable `blueprint-masterplan` workflow and the `2026-08-14-mvp3` delivery blueprint/coordinator projection |
| Integration authority | `origin/main` |
| Supersedes | MVP3 rolling execution authorization and UI readiness based on completed Layer 2 implementation |
| Preserves | Existing ordinary Layer 3 IDs `P3`, `C3`, `Q3`, `A3`, `E3`, and `G3` |
| Product behavior impact | None by itself; later accepted UI requirements may trigger product-specification changes through normal reconciliation |
| Business impact | None; customer, pricing, demo, procurement, and live-data promises do not change |

## 1. Problem and decision

The current MVP3 blueprint makes each UI-design worker review-ready only after
its path's Layer 2 implementation is integrated. That ordering prevents the UI
from informing the complete implementation plan. It also causes Layer 3
planners to wait for execution even though they need the UI's required data,
commands, states, and interactions during planning.

The approved replacement is a strict two-pass lifecycle:

1. **Pass 1 — whole-DAG planning and UI design:** every ordinary worker writes
   its specification and implementation plan; each UI-design worker designs
   against approved planned contracts and fixture/mock presentation state;
   each UI-design worker also writes an explicit UI requirements contract; the
   applicable Layer 3 planner consumes both UI artifacts and reconciles any
   missing functionality into affected upstream plans; and the coordinator
   passes one whole-blueprint planning gate only after the complete set agrees.
2. **Pass 2 — execution:** ordinary workers implement the reconciled DAG. A
   Layer 3 live-wiring worker begins execution only after the whole-blueprint
   gate is passed, its upstream runtime prerequisites are implemented on
   `origin/main`, and its accepted UI artifacts are integrated.

No product execution begins during Pass 1. A worker's approved individual plan
does not authorize execution.

## 2. Goals

- Let visual hierarchy, content, interaction states, and presentation structure
  shape implementation plans before code execution begins.
- Give downstream planners a precise, reviewable account of the APIs,
  capabilities, view models, and functional states needed to run the UI.
- Keep UI-design workers presentation-only and prevent fixture/mock design work
  from masquerading as live integration.
- Preserve one ordinary Layer 3 worker per path as the live-wiring owner.
- Reconcile UI-discovered functional gaps into the owning upstream plans before
  the global planning gate passes.
- Make the lifecycle the reusable `blueprint-masterplan` default and project it
  correctly in the EdenMind swarm coordinator.
- Preserve direct-main, remote-evidenced status, ownership-transfer, review,
  and verification rules.

## 3. Non-goals

- UI-design workers do not implement API calls, authentication, authorization,
  persistence, migrations, domain rules, scoring, model behavior, background
  processing, or live-provider integration.
- A UI requirements contract does not independently approve new product
  behavior or let a design worker take ownership from a functional planner.
- This change does not alter EdenMind customer scope, user permissions,
  commercial claims, data policy, or MVP3 feature behavior.
- This change does not add `PD2`, `CD2`, `QD2`, `AD2`, `ED2`, or `GD2` workers.
- Layer 2 implementation is not required for UI-design planning readiness.
- Fixture/mock presentation work does not satisfy live-wiring or end-to-end
  acceptance.

## 4. Two-pass lifecycle

### 4.1 Pass 1 — complete planning and design

All planning occurs before any product execution. Planned-contract edges order
only the information needed to plan; they do not claim implementation exists.

For one representative path:

```text
P1 specification/plan
        |
        v
P2 specification/plan
        |
        v
PD fixture-backed presentation design
        |-- accepted presentation handoff
        `-- UI requirements contract
                    |
                    v
P3 specification/plan for live wiring
        |
        v
P4 specification/plan for path acceptance
```

The same shape applies to the `C`, `Q`, `A`, `E`, and `G` paths. Existing
cross-path planned-contract dependencies remain. UI review order remains a
one-at-a-time product-owner scheduling constraint rather than a domain edge.

If a UI requirements contract identifies a missing functional contract, the
Layer 3 planner uses the approved planning-propagation rule to amend the
affected upstream specification, implementation plan, and status artifacts.
The change is then re-consumed by all affected downstream plans. No affected
row is complete while this reconciliation remains open.

Pass 1 terminates only when:

- every ordinary worker specification and implementation plan is approved and
  reachable from `origin/main`;
- every required UI presentation state, approval, handoff, and UI requirements
  contract is accepted and reachable from `origin/main`;
- every UI requirement is mapped to an already-satisfied planned contract or a
  reconciled owning plan;
- every affected living authority is updated or carries an evidence-backed
  no-impact finding;
- ownership and producer/consumer interfaces agree across the complete DAG;
  and
- one coordinator-owned `PLANNING_GATE.md` records a passed receipt pinned to
  the reconciled `origin/main` commit.

### 4.2 Pass 2 — execute the reconciled DAG

Execution begins only after the global receipt passes. Ordinary workers still
respect their hard implemented prerequisites; the global gate does not turn a
planned predecessor into an implemented one.

For one representative path:

```text
F0 implementation
        |
        v
P1 implementation
        |
        v
P2 implementation
        |
        v
P3 live wiring of the accepted PD design
        |
        v
P4 path acceptance
```

`P3` consumes the accepted PD app state, PD handoff, PD UI requirements
contract, implemented P2 interfaces, and the reconciled P3 plan. It owns live
queries and commands through the established provider/client seams, runtime
state integration, capability projection, functional error/recovery behavior,
and applicable browser/contract tests. It does not take ownership of P1/P2
domain policy or central `X0` composition.

The corresponding wiring owners are:

| UI design owner | Live-wiring owner | Hard implemented predecessor |
| --- | --- | --- |
| `PD` | `P3` | `P2` |
| `CD` | `C3` | `C2` |
| `QD` | `Q3` | `Q2` |
| `AD` | `A3` | `A2` |
| `ED` | `E3` | `E2` |
| `GD` | `G3` | `G2` |

## 5. UI-design worker contract

### 5.1 Planning readiness

A UI-design worker becomes planning-ready when:

- the frozen blueprint, relevant living authorities, and UI brief are current
  on an inspected `origin/main` commit;
- the applicable upstream Layer 2 specification, implementation plan,
  authority synchronization, and planning status are approved and remotely
  reachable; and
- the worker has the existing component system, design tokens, fixture/provider
  seam, and development-server path needed to render the surface without live
  wiring.

Implemented Layer 2 code is not a UI-design planning prerequisite.

### 5.2 Presentation-only implementation exception

During Pass 1 the UI-design worker may edit the real application's
presentation files using fixture or explicitly mock-backed state. It may shape:

- composition and information hierarchy;
- content and interface copy;
- responsive arrangement and visual component variants;
- navigation presentation and interaction states;
- loading, empty, validation, success, failure, attention, and recovery
  presentation;
- keyboard/focus, reduced-motion, and accessibility presentation; and
- fixtures needed only to demonstrate the approved states through the existing
  provider seam.

The worker may not add or change live API calls, production adapters,
authorization decisions, persistence, migrations, domain logic, scoring,
background jobs, or model behavior. Fixture mode stays explicit and cannot
silently fill a live gap.

### 5.3 Required outputs

Each UI-design worker owns three artifacts instead of an implementation plan:

1. its worker status contract;
2. its accepted presentation handoff; and
3. its UI requirements contract.

The handoff continues to record the accepted app-state commit, reviewed command
and URL, product-owner approval, affected presentation files, reused design
foundations, verified states, limitations, and mutable ownership transfer.

The UI requirements contract is a separate planning artifact so functional
needs can be reconciled and tested without mixing them into visual approval
evidence.

## 6. UI requirements contract

### 6.1 Purpose and authority

The contract describes what the accepted UI needs from functional
implementation. It is a consumer-facing planning input, not an API
implementation design and not unilateral product authority.

The UI worker authors it. The applicable Layer 3 planner verifies it against
approved product behavior, maps every requirement to an owning plan, and
propagates missing contracts before the global gate can pass. The product owner
approves any requirement that changes product interaction behavior. Purely
technical mappings that implement already-approved behavior require ordinary
plan review rather than a new product decision.

### 6.2 Required contents

Every UI requirements contract contains:

| Section | Required detail |
| --- | --- |
| Surface inventory | Routes, panels, dialogs, menus, responsive variants, and relevant deep links |
| Actor and capability matrix | Which active contexts may see or invoke each surface/action; omitted versus visibly disabled behavior |
| Read requirements | Authorised view models, fields, grouping, ordering, filtering, search, pagination/cursors, freshness, and empty-state meaning |
| Command requirements | User intent, inputs, validation, confirmation, idempotency expectation, success result, and safe failure/recovery behavior |
| Async/lifecycle states | Loading, queued, processing, waiting, attention, partial success, failed, cancelled, completed, stale, and revoked states that apply |
| Navigation and state | URL state, dirty-form protection, context switching, focus restoration, refresh/retry behavior, and route-unavailable behavior |
| Files and exports | Upload/download/preview/export needs, progress, limits, authorization, and unavailable states |
| Accessibility contract | Keyboard order, focus behavior, semantic alternatives, announcements, reduced motion, and accessible names/descriptions |
| Fixture scenarios | Deterministic fixture/mock cases demonstrating every required state without claiming live wiring |
| Planned-contract traceability | Existing upstream specification/plan section or explicit missing-contract owner for every requirement |
| Acceptance mapping | Focused contract/browser checks the live-wiring worker must satisfy in Pass 2 |

Requirements use business/domain intent rather than prescribing internal
database tables or framework-specific implementation. Exact endpoint shapes may
be recorded when already approved or when needed as a consumer contract, but
the owning functional planner remains responsible for the authoritative API,
authorization, domain, and persistence design.

### 6.3 MVP3 paths

| Worker | Status | UI requirements | Presentation handoff | Consumer |
| --- | --- | --- | --- | --- |
| `PD` | `docs/workers/2026-08-14-mvp3/status/pd.md` | `docs/design/requirements/2026-08-26-pd-platform-admin.md` | `docs/design/handoffs/2026-08-26-pd-platform-admin.md` | `P3` |
| `CD` | `docs/workers/2026-08-14-mvp3/status/cd.md` | `docs/design/requirements/2026-08-26-cd-curriculum.md` | `docs/design/handoffs/2026-08-26-cd-curriculum.md` | `C3` |
| `QD` | `docs/workers/2026-08-14-mvp3/status/qd.md` | `docs/design/requirements/2026-08-26-qd-content.md` | `docs/design/handoffs/2026-08-26-qd-content.md` | `Q3` |
| `AD` | `docs/workers/2026-08-14-mvp3/status/ad.md` | `docs/design/requirements/2026-08-26-ad-analysis-intake.md` | `docs/design/handoffs/2026-08-26-ad-analysis-intake.md` | `A3` |
| `ED` | `docs/workers/2026-08-14-mvp3/status/ed.md` | `docs/design/requirements/2026-08-26-ed-evidence.md` | `docs/design/handoffs/2026-08-26-ed-evidence.md` | `E3` |
| `GD` | `docs/workers/2026-08-14-mvp3/status/gd.md` | `docs/design/requirements/2026-08-26-gd-practice.md` | `docs/design/handoffs/2026-08-26-gd-practice.md` | `G3` |

## 7. Planning gate and readiness

### 7.1 One global planning gate

MVP3 rolling per-worker execution authorization is removed. The coordinator
owns one `docs/workers/2026-08-14-mvp3/PLANNING_GATE.md`. Its complete planning
manifest contains:

- one row per ordinary worker with approved specification, approved
  implementation plan, authority sync/no-impact result, cross-plan
  reconciliation, and remote commit;
- one row per UI-design worker with accepted app-state commit, approval
  evidence, presentation handoff, UI requirements contract, live review, and
  ownership-transfer target; and
- explicit proof that every UI requirement is satisfied by a reconciled
  producer plan and consumed by the applicable live-wiring plan.

The gate is `open`, `passed`, or `reopened`. Only `passed`, pinned to the exact
reconciled `origin/main` commit, authorizes Pass 2.

### 7.2 Readiness predicates

| State | Meaning |
| --- | --- |
| `planning-ready` | Required authorities, briefs, and approved planned-contract inputs are remote-reachable; implemented predecessors are not required |
| `ui-design-ready` | The path's Layer 2 planning handoff is approved and remote-reachable; fixture/mock presentation work may begin |
| `planning-in-progress` | An ordinary plan or UI design/requirements package is being produced |
| `planning-complete / execution-blocked` | Owned planning artifacts are reconciled, but the whole-DAG gate is not passed or a hard runtime predecessor is absent |
| `execution-ready` | The whole-DAG gate is passed and the worker's hard implemented prerequisites/evidence are remote-reachable |
| `complete` | Owned implementation or design output, evidence, remote ancestry, handoff, and clean owned state are verified |

For Layer 3, execution readiness requires all of:

- the passed global planning gate;
- implemented Layer 2 predecessor and required cross-path runtime contracts;
- accepted UI app state and presentation handoff;
- accepted UI requirements contract;
- reconciled Layer 3 specification and implementation plan; and
- integrated mutable ownership transfer.

## 8. Coordinator and manifest design

The production planning projection contains all 26 ordinary planning workers
and all six UI-design workers. UI tasks use `kind: "ui"` and
`promptTemplate: "ui"`; their planned dependency is their path's Layer 2
planning worker. Each Layer 3 planning task depends on both its Layer 2 planning
worker and its UI-design worker.

The manifest contract gains an optional UI requirements path for UI tasks and
an explicit presentation handoff path. Validation requires both for `kind:
"ui"`, forbids an implementation-plan path for UI tasks, and keeps paths
repository-contained. Future output paths may be absent before the owning UI
worker authors them; absence is pending evidence, not manifest invalidity.

UI readiness evaluates the predecessor's approved planning artifacts and
terminal planning status. It must not inspect or require predecessor
implementation evidence. UI completion requires terminal worker status plus
remote-reachable accepted app commit evidence, presentation handoff, and UI
requirements contract.

The planning-gate evaluator includes both ordinary and UI rows and verifies
the UI requirement-to-plan reconciliation. Execution task projections are
introduced only after the global receipt passes; they retain hard implemented
dependencies independently from their planning dependencies.

The aggregate coordinator status lists all 32 Pass 1 workers, their named
status contracts, UI artifacts, current planning readiness, global-gate state,
and stale/missing evidence. It never reports execution authorization while the
global gate is open or absent.

## 9. Reusable blueprint-masterplan changes

The reusable skill and all directly coupled references must make these rules
normative:

- strict whole-DAG planning before ordinary execution;
- UI design begins from approved upstream planning, not implemented upstream
  code;
- UI design uses the real presentation surface with explicit fixture/mock
  state and performs no live wiring;
- every UI-design worker produces a separate UI requirements contract;
- a named ordinary implementation worker owns later live wiring;
- the live-wiring plan consumes both UI artifacts and propagates missing
  functional contracts before the global gate passes;
- the live-wiring execution waits for the global gate and implemented runtime
  predecessors;
- planning-gate, status, worker-brief, prompt, and evaluation templates expose
  the new artifact and predicates; and
- scenario/evaluation coverage rejects implemented-predecessor UI gates,
  rolling execution, absent UI requirements, or UI workers performing live
  wiring.

The canonical UI-design checklist and existing design-source requirements
remain unchanged and mandatory.

## 10. Authority synchronization

### MVP3 Implementation Masterplan

This decision materially changes planning/execution order, readiness,
dependencies, UI artifacts, gates, completion, and coordinator projection. The
MVP3 Implementation Masterplan must be revised coherently and record the 29
August 2026 product-owner approval.

### Product Specification Masterplan

This orchestration rule changes no approved frontend behavior, API behavior,
authorization, records, persistence, processing, reliability, privacy, or
acceptance outcome. The product specification therefore receives an
evidence-backed no-impact finding for this design. A later UI requirements
contract that introduces an approved product interaction change must update the
affected Product Specification Masterplan section during planning.

### Business Masterplan

No customer, commercial scope, pricing, demo promise, pilot gate, procurement,
or real-pupil-data policy changes. No Business Masterplan content edit is
required.

### Existing worker state

Current worker statuses that encode UI readiness after implementation become
stale when the revised blueprint integrates. The coordinator marks them stale
in aggregate status and relaunches their owning workers to refresh them; it does
not overwrite worker-owned status files. Existing presentation drafts remain
provisional inputs and must be reconciled against the revised UI artifact
contract before acceptance.

Any ordinary specification or plan that assumes rolling authorization,
implemented-predecessor UI design, or no UI requirements contract is affected
and must be reconciled before the global planning gate passes.

## 11. Failure and change handling

- A UI requirement outside approved product behavior is marked decision-blocked
  and routed to the product owner; it is not silently added to an upstream plan.
- A requirement that belongs to a different worker names that owner and keeps
  affected planning incomplete until the contract is reconciled.
- If upstream planning changes after UI acceptance, the coordinator reopens the
  affected UI design/requirements review when presentation or consumer needs
  may change.
- If an accepted UI artifact changes materially, the global planning gate is
  reopened and affected plans are reconciled again.
- If implementation exposes a contract mismatch despite reconciliation, the
  affected execution pauses safely and the global gate reopens for the smallest
  coherent planning correction.
- Unrelated execution may continue after reopening only with an evidence-backed
  no-impact finding in the receipt.

## 12. Verification strategy

The implementation plan must require focused verification for:

1. blueprint text, graph, dependency/unblock, artifact, and gate parity;
2. reusable-skill pressure scenarios for strict two-pass behavior;
3. UI prompt parity and exactly one mandatory design-source checklist per UI
   worker launch;
4. manifest schema validation of UI requirement/handoff paths;
5. readiness tests proving UI design is ready after upstream planning but not
   dependent on upstream implementation;
6. planning-gate tests proving ordinary execution remains blocked until every
   ordinary and UI row is complete;
7. Layer 3 execution tests proving implemented upstream prerequisites remain
   mandatory after the gate passes;
8. coordinator flowchart/status tests for all 32 Pass 1 workers and both
   planning/execution predicates;
9. documentation link, JSON, typecheck, unit, build, and applicable browser
   tests; and
10. remote-reachability and clean-owned-state proof after each coherent
    checkpoint.

## 13. Acceptance criteria

This design is implemented only when:

- the reusable `blueprint-masterplan` and MVP3 blueprint state the same strict
  two-pass rule;
- MVP3 contains all six UI workers, all six UI requirements paths, all six
  handoff paths, and the unchanged six Layer 3 live-wiring workers;
- UI planning readiness depends on approved Layer 2 planning rather than Layer
  2 implementation;
- UI workers are fixture/mock-backed and presentation-only;
- every Layer 3 plan consumes the accepted presentation handoff and UI
  requirements contract;
- UI-discovered functional gaps are reconciled into owning plans before one
  global planning gate can pass;
- no execution task is authorized while that gate is open, absent, reopened,
  stale, or incomplete;
- Layer 3 execution still waits for implemented Layer 2 prerequisites;
- coordinator manifests, templates, readiness evaluation, aggregate status,
  tests, and documentation match the authority; and
- the Business and Product Specification Masterplan impact findings are
  explicit and no unrelated product behavior is changed.

## 14. Resolved decisions

- Whole-DAG planning is one complete first pass; execution is a separate second
  pass.
- UI design occurs in Pass 1 after upstream planning, without live wiring.
- UI workers write separate UI requirements contracts.
- Existing `P3`, `C3`, `Q3`, `A3`, `E3`, and `G3` IDs remain and own live
  wiring in Pass 2.
- UI requirements are separate from presentation handoffs.
- One global planning-gate receipt replaces MVP3 rolling execution
  authorization.
- This lifecycle becomes the reusable `blueprint-masterplan` default.

No decision in this design remains unresolved.
