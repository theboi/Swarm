# Living Masterplan Evaluation Scenarios

## Evaluation status

| Phase | Status |
| --- | --- |
| Scenario design | Complete before skill authoring |
| No-skill structural baseline | Skill absent before initialization |
| Fresh-agent current-skill baseline | Scenario 4 run on 9 August 2026: the agent classified the approved upload as “approved future” and retained a status/evidence-oriented Product Spec Masterplan instead of requiring a unified end-to-end specification |
| Fresh-agent skill-enabled run | Scenario 4 passed on 9 August 2026: the agent required same-substep consolidation into the affected Product Spec Masterplan and rejected availability/future/deferred organization |
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

## Scenario 4 — Consolidate an approved task specification

### Prompt

> Use `$living-masterplan` in `/tmp/lesson-loop`. Worker W2 has just written a dated task specification for an approved homework-upload feature. It adds an educator upload page and client state, a private upload API, durable submission records, a background checker, signed file storage, and audit logging. The same specification proposes an unapproved parent-notification feature. The delivery lead says we can finish planning by committing only W2's dated specification and later classify the Product Spec Masterplan into “available now,” “approved future,” and “deferred.” It is late and another worker will start from W2's plan tomorrow. Explain exactly what must be updated before planning can complete.

### Expected behavior

- **Critical:** Treats the dated task specification as a trigger to assess the affected Product Spec Masterplan before planning completes.
- **Critical:** Requires the approved upload behavior to be consolidated into one high-level product description spanning the educator experience, client behavior, API, records/storage, background processing, audit, security, and reliability.
- Rejects availability/future/deferred or delivery-history organization for the Product Spec Masterplan.
- Keeps the unapproved parent-notification proposal out of the Product Spec Masterplan.
- Requires direct and transitive downstream impact assessment, or an explicit evidence-backed no-impact finding.
- Requires the dated task specification, Product Spec Masterplan update, and required propagation to be verified and integrated together before the next worker begins.

### Observed pre-change baseline

The fresh agent required some living-authority maintenance, but told the worker
to record the upload feature as an “approved future capability” and to classify
implementation state as absent/planned. It treated the Product Spec Masterplan
as a status/evidence authority, rather than requiring a single high-level
frontend-to-backend product contract. It therefore failed both critical
behaviors of this scenario.

### Observed post-change run

The fresh agent required same-substep consolidation of the approved educator
upload route/client state, API, submission records, signed storage, background
checking, audit, security/privacy, recovery, and acceptance into the affected
Product Spec Masterplan. It rejected available-now/approved-future/deferred
organization, kept the notification proposal out of approved scope, required
downstream assessment, and made the synchronized documentation set a planning
completion condition. All critical behaviors passed.

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
| Approved task specifications keep the product specification current | `SKILL.md` — Product specification masterplan contract; Maintenance workflow; Route incoming information |
| Unified high-level frontend-to-backend product specification | `SKILL.md` — Product specification masterplan contract; `references/living-masterplan-template.md` — Product specification variant |
