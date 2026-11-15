# Masterplan Types and Routing

## Contents

- Authority types
- Choosing document boundaries
- Information routing
- Evidence and authority precedence
- Contradiction handling
- Custom masterplan types

## Authority types

Use only the types the project needs. Preserve established project vocabulary and filenames.

| Type | Answers | Include | Exclude |
| --- | --- | --- | --- |
| Business or commercial | Why the project exists and how it creates value | market, customer, offer, pricing, commercial constraints, success measures | endpoint schemas, task checklists, temporary delivery status |
| Product or feature specification | What users may do and what complete behavior is approved | one high-level frontend-to-backend contract: users, journeys, frontend surfaces, client data, APIs, authorization, records, persistence, storage, processing, integrations, models, reliability, security, privacy, observability, acceptance boundaries, and product exclusions | availability/future/deferred or delivery-status partitions, worker branches, speculative implementation steps, sales tactics, chronological implementation history |
| Architecture | Which stable technical boundaries govern implementation | system context, components, data ownership, integration contracts, security and reliability boundaries | ordinary task sequencing, transient incidents, unapproved alternatives |
| Implementation state | What is currently implemented and what remains within approved scope | repository evidence, migrations, deployed capability, known gaps, verification state | desired behavior presented as fact, daily worker narration |
| Operations, security, or release | How the system is operated and what must be proven for release | environments, runbooks, controls, observability, release criteria, recovery | product rationale already owned elsewhere, feature implementation plans |
| Custom | A stable authority not covered above | one explicit question set, scope, evidence, owners, relationships | duplicated authority from another masterplan |

A name such as “Product 1” is a scope, not automatically a document type. A document may combine types only when the project already treats it as one authority and the boundaries remain clear.

## Choosing document boundaries

Create a separate masterplan when at least one condition holds:

- a different decision owner governs it;
- it changes on a materially different cadence;
- it answers a distinct authority question;
- combining it would make facts, intentions, and execution state ambiguous; or
- a team must read it without loading unrelated domains.

Keep information together when it shares the same owner, scope, lifecycle, and readers. Do not split documents merely to match an organizational chart.

Before creating a document, search for an existing authority that already owns the subject. Update or consolidate that authority instead of producing a competing “final”, “v2”, or “new” file.

## Information routing

Classify each incoming item before editing.

| Classification | Destination | Required treatment |
| --- | --- | --- |
| Repository fact or implementation evidence | Implementation state and any affected factual section | cite paths, commits, tests, migrations, or deployments; distinguish observed behavior from intent |
| Approved business or product decision | Owning business, product, or architecture authority | record the decision, effective scope, rationale when useful, consequences, and superseded rule |
| Proposed decision | Unresolved-decisions section or design conversation | use Grill Me and Superpowers brainstorming; do not write it as current policy |
| Temporary execution status | Worker status or execution coordination files | keep it out of living product and business authorities |
| Historical or superseded material | History or superseded section | retain only when it prevents confusion; mark dates and replacement authority |
| New or modified task-level design or steps | Dated Superpowers specification or plan and every affected product specification masterplan | consolidate all approved product changes into each affected product specification in the same planning substep, or record an evidence-backed no-impact finding; keep task narration and proposals out of the product specification |
| External claim | Owning authority after verification | cite the source and distinguish a verified constraint from an assumption |

Stable shared decisions may affect several masterplans. Update each affected authority in one bounded change or explicitly sequence the updates so no contradictory intermediate state is treated as approved.

## Evidence and authority precedence

No single source outranks every other source. Apply precedence by question:

| Question | Primary authority | Corroborating evidence |
| --- | --- | --- |
| What is commercially approved? | authorized user decision and business masterplan | contracts, approved research, pricing records |
| What should the product do? | approved product specification | accepted task specifications, user decision records |
| Which technical boundary is approved? | architecture authority or approved architecture decision | code, ADRs, integration tests |
| What does the system do now? | current repository, migrations, deployments, and fresh verification | implementation masterplan and release records |
| Is a worker or gate complete? | remote integration state and required evidence | worker handoff and coordinator status |

Code proves current behavior; it does not automatically prove desired product policy. A plan proves intended work; it does not prove implementation. A sales statement creates urgency; it does not silently override technical or commercial constraints.

Record evidence precisely enough that a new session can reproduce the conclusion. Prefer repository-relative paths, commit IDs, verification commands, dates, and named decision owners.

## Contradiction handling

When sources disagree:

1. State the conflicting claims and their authorities.
2. Determine whether the conflict is factual, temporal, scoped, or a genuine decision conflict.
3. Inspect evidence that can resolve factual or temporal differences.
4. Route genuine decision conflicts to the authorized owner.
5. Use Grill Me to expose consequences, alternatives, and acceptance criteria when the decision frontier is incomplete.
6. Use Superpowers brainstorming for approval before changing policy.
7. Update every affected authority and mark superseded material.
8. Verify that no document still presents the old and new rules as simultaneously current.

Do not resolve contradictions by choosing the newest file, the implemented behavior, the most senior-sounding document, or the answer that keeps delivery moving.

## Custom masterplan types

Define a custom type with this contract:

| Field | Requirement |
| --- | --- |
| Name | stable project vocabulary |
| Authority question | one sentence describing what this document decides |
| Scope | included products, systems, organizations, or periods |
| Decision owner | role or named authority able to approve changes |
| Evidence sources | repository, research, legal, operational, or external records |
| Relationships | masterplans it consumes, constrains, or updates |
| Update triggers | events that require maintenance |
| Exclusions | nearby information owned elsewhere |

Reject a custom type that duplicates an existing authority without a distinct question, owner, or lifecycle.
