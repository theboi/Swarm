---
name: living-masterplan
description: Use when creating, consolidating, refreshing, or updating authoritative project masterplans for business, commercial, product, specification, architecture, implementation, operations, security, release, or custom domains.
---

# Living Masterplan

## Overview

Maintain the project's current authorities so a new session can recover approved intent and evidenced reality without private conversation history.

**Core principle:** Route each fact, decision, proposal, and execution update to its owning authority; never turn implementation momentum or document recency into silent policy.

## Required companion skills

- **REQUIRED SUB-SKILL:** Use `grill-me` when bootstrapping authorities or when a material decision frontier remains unsettled. If unavailable, pause and point the user to `mattpocock/skills --skill=grill-me`.
- **REQUIRED SUB-SKILL:** Use `superpowers:brainstorming` before creating an authority set or changing an unsettled business, product, or architecture decision.
- **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` before claiming a masterplan is current or internally consistent.

Do not run a full interview for an explicit, already approved, evidence-backed maintenance update.

## Choose the mode

| Observable state | Mode |
| --- | --- |
| No authoritative masterplan covers the requested scope | Bootstrap |
| Authorities exist and the user supplies a bounded update | Maintenance |
| Authorities exist but overlap or contradict one another | Maintenance with contradiction gate |
| The request is temporary worker progress | Route to worker status; do not edit a living authority |
| The request is a task implementation sequence | Route to a dated Superpowers plan |

Read [masterplan types and routing](references/masterplan-types.md) completely when choosing types, resolving overlaps, adding a custom type, or routing ambiguous information.

## Product specification masterplan contract

For a product or feature specification, write one current, high-level contract
for all approved product behavior. It must be readable from the user experience
through the technical system without requiring task history or private context.

Adapt headings to the product, but cover the applicable:

- purpose, users, record contexts, journeys, and product boundaries;
- frontend routes, surfaces, interactions, accessibility, and client data
  contracts;
- APIs, authorization, domain records, persistence, storage, and integrations;
- background processing, model behavior, derived insights, and recovery;
- reliability, security, privacy, observability, and acceptance requirements.

Consolidate every approved feature change into the affected sections so the
document describes one coherent frontend-to-backend product. Do not organize a
product specification masterplan by available now, approved future, deferred,
milestone, worker, gate, branch, evidence ledger, implementation status, or
chronological change history. Keep temporary execution progress in worker status
or implementation plans; keep unapproved proposals in their decision process.

When a dated task specification is written or modified, assess every affected
product specification masterplan in the same planning substep. Promote all and
only its approved product changes, or record an evidence-backed finding that it
has no product-specification impact. A dated task specification is not complete
while an affected product specification masterplan is stale.

## Bootstrap workflow

1. **Inspect before interviewing.**
   - Read repository instructions.
   - Search existing plans, specifications, ADRs, runbooks, release records, and historical task artifacts.
   - Inspect relevant code, migrations, tests, configuration, and recent Git history.
   - Record contradictions, missing authorities, and evidence gaps.
2. **Map authority questions.**
   - Identify which questions are already answered and by whom.
   - Select only the required business, product, architecture, implementation, operations, or custom types.
   - Preserve established vocabulary and paths. Default to `docs/plans` only when the project has no convention.
3. **Grill unsettled decisions.**
   - Ask only questions evidence cannot answer.
   - Use Grill Me to pressure-test consequences, boundaries, alternatives, decision owners, and success criteria.
   - Treat “I don't know” as an unresolved decision or a prototype/evidence need, not permission to guess.
4. **Obtain design approval.**
   - Use Superpowers brainstorming.
   - Present authority boundaries and the proposed documents before writing them.
   - Do not create mutually contradictory “approved” masterplans to meet a deadline.
5. **Write the authority set.**
   - Read [the living masterplan template](references/living-masterplan-template.md) completely.
   - Use the product specification variant for product/feature authorities; use
     the generic authority responsibilities for every other type.
   - Consolidate competing documents without deleting useful history.
6. **Verify and commit.**
   - Run the verification gate below.
   - Obtain any review required by the repository workflow.
   - Commit the approved bounded authority set before downstream blueprint planning.

## Maintenance workflow

1. Read the complete target masterplan and every directly affected authority section.
2. Inspect the supplied task specification, source, commit, code, test, release,
   or external evidence.
3. Classify the information using the routing reference.
4. Determine whether it changes current fact, approved intent, unresolved policy, scope, or only task status.
5. When the source is a new or modified dated task specification, identify every
   affected product specification masterplan and consolidate its approved product
   changes in the same bounded update, or record an evidence-backed no-impact
   finding.
6. If the update is explicit, settled, and consistent, edit only the affected sections without restarting discovery.
7. If it creates a material contradiction or new decision, stop the edit, use Grill Me as needed, and obtain Superpowers brainstorming approval.
8. Update every authority affected by one stable shared decision. Do not leave a knowingly contradictory intermediate state.
9. Preserve unrelated structure, wording, user instructions, and valid history.
10. Review the diff and run the verification gate.
11. Commit the bounded update when the request and repository workflow authorize the change.

Repository evidence may update implementation state. It does not automatically override desired product behavior, commercial policy, legal constraints, or an approved architecture boundary.

## Route incoming information

| Information | Destination |
| --- | --- |
| Implemented behavior with fresh evidence | Implementation state and affected factual sections |
| Approved business, product, or architecture decision | Owning living authority and every constrained authority |
| New or modified dated task specification | Assess every affected product specification masterplan; consolidate all approved product changes in the same planning substep or record an evidence-backed no-impact finding |
| Unapproved proposal | Unresolved decisions or a Superpowers design |
| Worker branch, substep, or blocker status | Worker-owned status file |
| Historical rule readers may still encounter | Superseded/history section |
| Detailed task steps | Dated Superpowers implementation plan |

Never copy task narration into a masterplan. Promote only stable, approved
product behavior into product specifications; retain verified current state in
the authority that owns implementation evidence.

## Approval and contradiction gates

Stop before writing current policy when any condition holds:

- two authorities disagree on the same scope and time;
- repository behavior contradicts approved intent;
- the user provides a proposal but no decision owner or acceptance boundary;
- a commercial promise conflicts with a technical, legal, security, or operational constraint;
- a custom type duplicates an existing authority;
- evidence is too stale to support a current-state claim; or
- resolving the issue would require assuming permission or inventing product behavior.

Report:

1. the conflicting claims;
2. each claim's authority and evidence;
3. whether the conflict is factual, temporal, scoped, or decisional;
4. the decision owner;
5. the exact question, evidence, or prototype needed; and
6. what work remains blocked.

Do not pick the newest file, current code, or easiest delivery path as an implicit winner.

## Verify and commit

Before claiming an authority is current:

- scan for incomplete language and unsupported certainty;
- verify purpose, scope, and decision owner are explicit;
- confirm implemented claims have reproducible evidence;
- confirm proposals are not presented as approved decisions;
- for every changed task specification, confirm each affected product
  specification masterplan is current or has an evidence-backed no-impact finding;
- for a product specification masterplan, confirm all approved behavior reads as
  one high-level frontend-to-backend contract with no availability or delivery
  status partitions;
- confirm superseded rules are not simultaneously current;
- check related authorities for stale contradictions;
- review the diff for accidental broad rewrites;
- run repository-appropriate documentation and link checks; and
- verify only intended files are staged.

Use a bounded commit message that states the authority change. Push only when the user or repository workflow requests it.

## Quick reference

| Situation | Action |
| --- | --- |
| New project lacks authorities | Inspect, grill gaps, brainstorm, then bootstrap |
| User supplies a settled verified change | Perform targeted maintenance |
| Code differs from product intent | Record implementation truth; escalate policy conflict |
| Several masterplans share one decision | Update all affected authorities coherently |
| Worker reports progress | Route to worker status |
| Dated task specification is written or changed | Update affected product specifications in the same planning substep, or record an evidence-backed no-impact finding |
| Evidence cannot settle the question | Record the blocker and decision owner |

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Rewriting the whole document for one update | Change the smallest coherent set of sections |
| Treating code as the product authority | Use code as evidence of current behavior |
| Appending a chronological diary | Rewrite current-state sections and retain only useful history |
| Treating a product specification as a roadmap or evidence dashboard | Rewrite it as one approved frontend-to-backend product contract |
| Creating “v2” beside an existing authority | Consolidate or explicitly supersede |
| Grilling a settled evidence-backed update | Verify and update it directly |
| Skipping questions because delivery is urgent | Expose the unresolved decision and its blocker |
| Copying speculative plan detail into current state | Keep it in the dated task artifact |

## Stop conditions

Pause and ask for direction when:

- the authorized decision owner is unavailable and the conflict changes scope or policy;
- required Grill Me or Superpowers skills are unavailable;
- the requested edit would overwrite protected structure or unrelated user changes;
- external evidence cannot be verified;
- the repository is dirty in overlapping files; or
- committing or pushing would require authority the user did not provide.
