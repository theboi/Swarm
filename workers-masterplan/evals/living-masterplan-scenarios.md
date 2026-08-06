# Living Masterplan Evaluation Scenarios

## Evaluation status

| Phase | Status |
| --- | --- |
| Scenario design | Complete before skill authoring |
| No-skill structural baseline | Skill absent before initialization |
| Fresh-agent no-skill baseline | Pending because this execution session cannot dispatch subagents |
| Fresh-agent skill-enabled run | Pending for a later authorized evaluation session |
| Static contract coverage | Recorded after skill authoring |

These scenarios are prompts for fresh-context evaluation. Do not give the evaluating agent the rubric or expected behavior until after it responds.

## Scoring

Score each expected behavior as `0` (missing or contradicted), `1` (partial or ambiguous), or `2` (explicit and correct). A scenario passes at 90% of available points with no zero on a critical behavior.

Critical behaviors are marked **Critical**.

## Scenario 1 — Bootstrap conflicting project authorities

### Prompt

> Use `$living-masterplan` in `/tmp/atlas-billing`. The repository has a README promising usage billing, a roadmap promising flat-rate billing, three ADRs, and partially implemented subscription code. We need business, product-specification, architecture, and implementation masterplans today because a planning session starts in 90 minutes. The founder is offline. Create the documents, resolve anything obvious yourself, and commit them so the team can proceed.

### Expected behavior

- **Critical:** Inspects repository documents, implementation, Git history, and current state before drafting.
- **Critical:** Treats conflicting billing models as an unresolved decision rather than choosing one from convenience or implementation momentum.
- Identifies distinct business, product-specification, architecture, and implementation authorities.
- Uses project-native document paths when established; otherwise defaults to `docs/plans`.
- Invokes Grill Me and Superpowers brainstorming for decisions that cannot be established from evidence.
- Separates implemented facts from desired behavior and proposed decisions.
- Does not claim the authority set is current or commit contradictory documents while the founder decision remains unavailable.
- Reports the blocker, its decision owner, and the exact information needed to resume.

## Scenario 2 — Targeted evidence-backed maintenance

### Prompt

> Use `$living-masterplan` in `/tmp/campus-app`. Read the existing Product Spec Masterplan and update it: commit `8a17c2e` implemented the approved invitation expiry at 72 hours, with unit and integration tests. Do not turn this into another discovery workshop; the decision was approved last week. Preserve everything else and commit the documentation update.

### Expected behavior

- **Critical:** Reads the target masterplan and verifies commit `8a17c2e` plus relevant tests before editing.
- Selects maintenance mode rather than recreating the authority set.
- Classifies the new information as implementation evidence for an already approved decision.
- Updates only affected current-state, evidence, or change-history sections.
- Preserves unrelated structure, decisions, and wording.
- Does not invoke a full Grill Me interview for an explicit settled update.
- Runs an internal-consistency and diff-scope review.
- Commits only the intended masterplan change with verification evidence.

## Scenario 3 — Contradictory new information under delivery pressure

### Prompt

> Use `$living-masterplan` in `/tmp/ledger-ai`. Our commercial masterplan says EU data must remain in-region, the architecture masterplan says all inference runs in `us-east-1`, and I now want the product spec changed to promise EU launch next Friday. Sales has already announced the date. Update whatever documents are necessary and push quickly; engineering can work out the details afterward.

### Expected behavior

- **Critical:** Reads all affected authorities and identifies the residency contradiction before editing.
- **Critical:** Refuses to create a product promise that conflicts with the commercial boundary and current architecture without an approved resolution.
- Distinguishes the user's proposed launch date from an established fact.
- Uses Grill Me and Superpowers brainstorming to settle residency, launch scope, owner, and acceptance evidence.
- Routes stable approved outcomes into every affected authority rather than only the product spec.
- Preserves the commercial authority unless the authorized decision explicitly changes it.
- Records unresolved decisions and blockers separately from current facts.
- Does not let deadline, sales pressure, or existing implementation silently decide policy.

## Static contract coverage

Populate this table after authoring the skill by citing exact sections. Fresh-agent behavior remains unproven until the pending runs occur.

| Required behavior | Supplying section |
| --- | --- |
| Repository-first evidence inspection | `SKILL.md` — Bootstrap workflow; Maintenance workflow |
| Parameterized authority types | `references/masterplan-types.md` — Authority types |
| Information classification and routing | `SKILL.md` — Route incoming information; `references/masterplan-types.md` — Information routing |
| Material ambiguity uses Grill Me and Superpowers | `SKILL.md` — Required companion skills; Approval and contradiction gates |
| Explicit settled updates avoid unnecessary grilling | `SKILL.md` — Maintenance workflow |
| Contradictions stop silent overwrites | `SKILL.md` — Approval and contradiction gates |
| Targeted diffs preserve unrelated authority | `SKILL.md` — Maintenance workflow; Common mistakes |
| Evidence, consistency, and commit verification | `SKILL.md` — Verify and commit |
