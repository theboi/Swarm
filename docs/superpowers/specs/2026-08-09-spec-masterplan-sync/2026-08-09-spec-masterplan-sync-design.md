# Spec Masterplan Synchronization Skill Design

## Purpose

Ensure every approved task specification change is consolidated immediately
into the affected product specification masterplan. The product specification
masterplan remains the single high-level description of the approved product,
not a delivery diary or roadmap-status report.

## Skill boundary

Update both workers-masterplan skills:

- `living-masterplan` defines the authoritative product-specification shape and
  maintenance rules.
- `blueprint-masterplan` enforces synchronization from each worker-authored
  specification into the affected product specification masterplan during the
  planning lifecycle.

Update their directly affected templates and evaluation scenarios. The skill
trigger descriptions and UI metadata do not need to change because the current
triggers already cover masterplan maintenance and worker planning.

## Product specification masterplan contract

A product specification masterplan presents one consolidated, current view of
approved product behavior. It reads from the user experience through the
technical system and includes the applicable:

- product purpose, users, contexts, journeys, and boundaries;
- frontend routes, surfaces, interaction behavior, and client data contracts;
- APIs, authorization, domain records, persistence, and storage;
- background processing, integrations, models, and derived behavior;
- reliability, security, privacy, observability, and acceptance requirements;
  and
- explicit product boundaries needed to prevent adjacent concepts from being
  mistaken for product behavior.

The document does not divide content into availability, approved-future,
deferred, milestone, worker, gate, branch, or implementation-history categories.
It rewrites the affected high-level sections so the newest approved contract is
readable without reconstructing chronology.

Only approved behavior is promoted. Unresolved proposals remain in their task
specification or decision process until approved; transient execution progress
remains in worker status or implementation plans.

## Synchronization workflow

Whenever a worker creates or modifies a dated task specification:

1. identify every affected product specification masterplan;
2. extract approved feature, behavior, interface, data, security, reliability,
   and product-boundary changes;
3. update the affected high-level masterplan sections in the same planning
   substep;
4. reconcile contradictions with related authorities and route unresolved
   decisions through their existing approval process;
5. update affected downstream worker documents when the consolidated contract
   changes their assumptions; and
6. integrate the task specification, product specification masterplan update,
   and required downstream propagation together.

A task specification is not planning-complete while an affected product
specification masterplan is stale. If the task specification changes no approved
product behavior, record an evidence-backed no-impact finding rather than making
a cosmetic masterplan edit.

During execution, repository evidence may refine the product specification when
the approved product contract itself changes. Implementation progress alone does
not create roadmap/status sections in the product specification masterplan.

## Files to change

- `workers-masterplan/living-masterplan/SKILL.md`
- `workers-masterplan/living-masterplan/references/living-masterplan-template.md`
- `workers-masterplan/living-masterplan/references/masterplan-types.md`
- `workers-masterplan/evals/living-masterplan-scenarios.md`
- `workers-masterplan/blueprint-masterplan/SKILL.md`
- `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

## Validation

Use a baseline scenario to demonstrate that the current skills allow a worker to
finish a task specification while leaving the product specification masterplan
stale or status-oriented. After the edits, rerun an equivalent fresh-context
scenario and require:

- same-substep synchronization into every affected product specification
  masterplan;
- one unified approved feature description from frontend to backend;
- no availability/future/deferred or delivery-history organization;
- no promotion of unresolved proposals;
- downstream impact assessment or an explicit no-impact finding; and
- specification and masterplan integration as one planning-completion condition.

Run skill-package validation, Markdown/reference checks, diff checks, and static
contract coverage before completion.
