# Living Masterplan Template

## Contents

- Template
- Product specification variant
- Section rules
- Update rules

## Template

Adapt headings to established project vocabulary while preserving their responsibilities.

```markdown
# <Project or Scope> <Authority Type> Masterplan

> Living authority for <the question this document answers>.

| Field | Value |
| --- | --- |
| Status | Draft / Approved / Superseded |
| Authority type | Business / Product specification / Architecture / Implementation / Operations / Custom |
| Scope | <bounded products, systems, users, organizations, or period> |
| Decision owner | <role or named owner> |
| Effective date | <date> |
| Last evidence review | <date and commit or release> |
| Related authorities | <repository-relative links> |
| Historical task artifacts | <repository-relative location> |

## 1. Purpose and authority

State the question this document answers, who relies on it, and which nearby questions belong to other authorities.

## 2. Current state

Describe approved and evidenced current reality. Distinguish implemented behavior from desired behavior.

### 2.1 Implemented evidence

| Capability or boundary | State | Evidence | Last verified |
| --- | --- | --- | --- |
| <item> | Implemented / Partial / Absent | <paths, commits, tests, release> | <date> |

## 3. Approved decisions and boundaries

Record stable decisions in project vocabulary. Include rationale only when it prevents future reversal or misinterpretation.

### 3.1 Decision register

| ID | Decision | Scope | Owner | Effective date | Supersedes |
| --- | --- | --- | --- | --- | --- |
| <stable-id> | <approved decision> | <bounded scope> | <owner> | <date> | <prior ID or none> |

## 4. Domain-specific contract

Use sections appropriate to this authority type. Examples include customers and pricing, user journeys and domain rules, component and data boundaries, implemented modules and migrations, or operational controls and release gates.

## 5. Dependencies and related authorities

| Authority | Relationship | Required synchronization |
| --- | --- | --- |
| <relative link> | Consumes / Constrains / Supplies | <when both must change> |

## 6. Unresolved decisions

| Question | Why unresolved | Decision owner | Evidence or prototype needed | Blocks |
| --- | --- | --- | --- | --- |
| <question> | <conflict or missing evidence> | <owner> | <input needed> | <work or gate> |

Do not mix proposals into approved-decision sections.

## 7. Explicit exclusions and deferred scope

List nearby work that is intentionally outside the current authority or period. Link its owning authority when one exists.

## 8. Superseded and historical material

Retain only history needed to explain migrations, rejected vocabulary, compatibility constraints, or why an apparently reasonable path is no longer current.

## 9. Evidence-backed change history

| Date | Change | Basis | Commit or source |
| --- | --- | --- | --- |
| <date> | <bounded authority change> | Decision / Repository evidence / External constraint | <identifier> |
```

## Product specification variant

Use this variant for a product or feature specification masterplan instead of
the generic status, current-state/evidence, unresolved-decision, deferred-scope,
and change-history sections above. It is the consolidated high-level description
of all approved product behavior, not a delivery dashboard.

```markdown
# <Product or Feature> Spec Masterplan

> Living product specification for <the complete approved user and system behavior>.

| Field | Value |
| --- | --- |
| Authority type | Product specification |
| Scope | <bounded products, users, domains, and systems> |
| Decision owner | <role or named owner> |
| Related authorities | <repository-relative links> |

## 1. Product purpose and boundaries

State the product outcome, users, scope, and explicit product boundaries.

## 2. Users, contexts, and journeys

Describe the authorized users, record or tenant contexts, and complete journeys.

## 3. Frontend experience

Describe routes, screens, interaction behavior, accessibility, and client data
contracts.

## 4. Application and domain behavior

Describe APIs, authorization, domain records, persistence, storage, and the
business rules that connect the frontend to system behavior.

## 5. Processing, integrations, and derived behavior

Describe applicable background work, models, integrations, derived insights,
retries, and recovery behavior.

## 6. Reliability, security, privacy, and observability

Describe product-facing quality, access, data-protection, audit, and
safe-failure requirements.

## 7. Acceptance requirements

List the observable conditions that prove the approved product behavior is
coherent from frontend to backend.

## 8. Product boundaries

List adjacent behavior that is outside this product specification so compatible
ideas are not mistaken for approved product behavior.
```

For a product specification variant:

- consolidate approved changes from every affected dated task specification in
  the same planning substep, or record an evidence-backed no-impact finding;
- rewrite affected sections to the latest approved product contract;
- include neither availability/future/deferred categories nor worker, gate,
  branch, implementation-history, evidence-ledger, or chronological-diary
  organization; and
- keep unapproved proposals and transient execution information in their owning
  task, decision, or status authority.

## Section rules

- Keep purpose, scope, and authority explicit so another session can route new information correctly.
- Use project vocabulary; define legacy synonyms only when readers may encounter them.
- Put stable behavior and boundaries in the domain-specific contract, not chronological prose.
- Cite implementation state with reproducible evidence.
- Keep unresolved decisions visibly separate from approved current state.
- Link related authorities with repository-relative paths.
- Preserve user-instructed structure when updating an established document unless the user approves a redesign.
- Omit an empty optional section only when its responsibility is genuinely irrelevant, not merely inconvenient to investigate.
- For product specifications, use the product specification variant rather than
  preserving generic authority sections that would turn the document into a
  status or history report.

## Update rules

For maintenance updates:

1. Read the complete target document and directly related authority sections.
2. Establish the incoming information's classification and authority.
3. Inspect supporting repository or external evidence.
4. Identify every affected section before editing.
5. Make the smallest coherent update that leaves the document internally consistent.
6. Mark superseded decisions rather than silently deleting history that readers still need.
7. Update metadata and change history only when the underlying authority or evidence actually changed.
8. Review the diff for accidental rewrites, duplicated authority, unsupported certainty, and stale cross-references.
9. Commit the approved bounded update with its evidence.

Do not append a running diary. Rewrite current-state sections so the document remains readable as an authority, then retain only useful history in the designated sections.

For a product specification variant, rewrite the affected high-level product
sections instead of adding status, evidence, or history entries.
