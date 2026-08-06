# Living Masterplan Template

## Contents

- Template
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

## Section rules

- Keep purpose, scope, and authority explicit so another session can route new information correctly.
- Use project vocabulary; define legacy synonyms only when readers may encounter them.
- Put stable behavior and boundaries in the domain-specific contract, not chronological prose.
- Cite implementation state with reproducible evidence.
- Keep unresolved decisions visibly separate from approved current state.
- Link related authorities with repository-relative paths.
- Preserve user-instructed structure when updating an established document unless the user approves a redesign.
- Omit an empty optional section only when its responsibility is genuinely irrelevant, not merely inconvenient to investigate.

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
