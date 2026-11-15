# Spec Masterplan Synchronization Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every new or modified worker task specification synchronize approved product changes into the affected product specification masterplan, whose format is a unified high-level frontend-to-backend product overview.

**Architecture:** `living-masterplan` owns the product-specification document contract and consolidation rules. `blueprint-masterplan` owns the worker lifecycle rule that makes synchronization part of the same planning substep and completion condition. Their reference templates and evaluation scenarios mirror those two responsibilities.

**Tech Stack:** Markdown Agent Skills, repository evaluation scenarios, Git diff and link validation, fresh-context Codex subagent evaluation.

## Global Constraints

- Update both skills; neither the document-shape rule nor the worker-lifecycle rule is sufficient alone.
- Promote only approved product behavior from a task specification.
- Consolidate affected product specification masterplans in the same planning substep as every task-specification creation or modification.
- Present one current product contract from frontend through backend, data, processing, models, security, reliability, and acceptance.
- Do not organize product specification masterplans by availability, approved-future, deferred, milestone, worker, gate, branch, or implementation-history categories.
- Preserve temporary execution progress in worker status or implementation plans.
- Require an evidence-backed no-impact finding when a task-specification change has no approved product-specification impact.
- Do not change skill trigger descriptions or `agents/openai.yaml`; the existing discovery boundaries remain correct.

---

### Task 1: Add and run the pre-change behavior scenario

**Files:**
- Modify: `workers-masterplan/evals/living-masterplan-scenarios.md`
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**
- Consumes: the approved synchronization design and the unmodified skill behavior.
- Produces: a reusable cross-skill scenario, baseline observation, expected behavior rubric, and static-contract slots for the later skill edits.

- [ ] **Step 1: Add one cross-skill evaluation scenario**

Add a scenario in which a planning worker changes an approved frontend upload flow, API contract, background processor, and persistence behavior in its dated task specification. The prompt pressures the worker to finish after committing only the dated specification and to categorize the masterplan as available now, approved future, and deferred.

The hidden rubric requires the worker to:

- update every affected product specification masterplan in the same planning substep;
- rewrite a unified approved frontend-to-backend feature description;
- omit availability/future/deferred and delivery-history organization;
- keep an unresolved adjacent proposal out of the product specification masterplan;
- assess direct and transitive downstream impacts or record no impact; and
- refuse planning completion until the specification, masterplan, and propagation updates are integrated together.

- [ ] **Step 2: Run a fresh-context baseline against the unmodified skills**

Dispatch a fresh agent with only the skill paths and scenario prompt. Do not reveal the expected behavior or intended edits. Capture whether it permits completion with a stale or status-oriented product specification masterplan and record the exact observed failure in the evaluation files.

- [ ] **Step 3: Verify the scenario is a valid failing test**

Confirm the baseline fails at least one critical synchronization or document-shape behavior for the expected reason. If the current skill unexpectedly passes every critical behavior, stop and revise the scenario to expose the actual omission before editing either `SKILL.md`.

- [ ] **Step 4: Commit the evaluation baseline**

Run:

```bash
git diff --check -- workers-masterplan/evals/living-masterplan-scenarios.md workers-masterplan/evals/blueprint-masterplan-scenarios.md
git add workers-masterplan/evals/living-masterplan-scenarios.md workers-masterplan/evals/blueprint-masterplan-scenarios.md
git commit -m "test: cover spec masterplan synchronization"
```

### Task 2: Define the product specification masterplan contract

**Files:**
- Modify: `workers-masterplan/living-masterplan/SKILL.md`
- Modify: `workers-masterplan/living-masterplan/references/living-masterplan-template.md`
- Modify: `workers-masterplan/living-masterplan/references/masterplan-types.md`
- Test: `workers-masterplan/evals/living-masterplan-scenarios.md`

**Interfaces:**
- Consumes: an approved task specification or an evidence-backed no-impact finding.
- Produces: the authoritative consolidation and document-shape rules used by workers and coordinators.

- [ ] **Step 1: Add the product-specification specialization to `SKILL.md`**

Add an imperative section defining product specification masterplans as unified high-level approved product contracts. Enumerate the end-to-end responsibilities: purpose and boundaries; users and journeys; frontend routes, surfaces, interactions, and client data; APIs and authorization; domain records, persistence, and storage; background processing, integrations, and models; statistics or derived behavior; reliability, security, privacy, observability; and acceptance requirements.

State that the document rewrites affected sections to the latest approved contract and does not use availability, future, deferred, milestone, worker, gate, branch, implementation-history, evidence-ledger, or chronological-diary organization.

- [ ] **Step 2: Add the task-specification synchronization trigger**

In the maintenance workflow and routing table, require every newly written or modified dated task specification to trigger an affected-product-specification assessment. Require same-substep consolidation of approved product changes, or an evidence-backed no-impact finding. Do not promote unresolved proposals or transient task progress.

- [ ] **Step 3: Specialize the template**

Add a product-specification variant to `living-masterplan-template.md` with the required high-level end-to-end section responsibilities. Make clear that generic status, current-state/evidence, deferred-scope, and change-history sections do not govern the product-specification variant.

- [ ] **Step 4: Correct routing semantics**

Update `masterplan-types.md` so product or feature specifications include the complete approved user and system behavior and exclude delivery/status partitions. Change task-specification routing from optional promotion of selected decisions to mandatory affected-masterplan assessment and consolidation of all approved product changes.

- [ ] **Step 5: Run focused static checks**

Run searches proving the living skill contains the synchronization condition, no-impact alternative, frontend-to-backend coverage, and prohibited status-partition rule. Review the complete diff for conflicts with general business, architecture, implementation, operations, and custom masterplans.

- [ ] **Step 6: Commit the living-masterplan update**

Run:

```bash
git diff --check -- workers-masterplan/living-masterplan workers-masterplan/evals/living-masterplan-scenarios.md
git add workers-masterplan/living-masterplan workers-masterplan/evals/living-masterplan-scenarios.md
git commit -m "feat: keep product spec masterplans consolidated"
```

### Task 3: Enforce synchronization in worker planning

**Files:**
- Modify: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Test: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`

**Interfaces:**
- Consumes: the product-specification contract from `living-masterplan` and each worker-authored task specification.
- Produces: an enforceable planning substep, launch-prompt requirement, completion condition, and downstream propagation contract.

- [ ] **Step 1: Strengthen the worker planning lifecycle**

Immediately after the task-specification authoring step, require identification and same-substep update of every affected product specification masterplan. Make a task specification incomplete while an affected product specification masterplan is stale. Allow only an evidence-backed no-impact finding as the no-edit path.

- [ ] **Step 2: Strengthen integration and readiness rules**

Require the dated specification, consolidated product specification masterplan changes, and affected downstream-document propagation to be verified and integrated together before implementation begins. Add the rule to verification, quick reference, common mistakes, and stop conditions without duplicating long explanations.

- [ ] **Step 3: Update the blueprint template**

Add the synchronization requirement to the worker planning lifecycle, phase-specific launch-prompt responsibility, handoff contents, and revision/downstream propagation policy in `blueprint-masterplan-template.md`.

- [ ] **Step 4: Update worker prompt templates**

In the planning prompt, require the worker to consolidate approved task-specification changes into affected product specification masterplans in the same substep, using the unified high-level frontend-to-backend format. Add the no-impact alternative and planning-completion condition. In the execution prompt, retain product-contract synchronization only when implementation changes the approved specification; do not turn implementation progress into status partitions.

- [ ] **Step 5: Run focused static checks**

Verify the skill, template, and prompts all contain the same trigger, same-substep requirement, approved-only rule, unified product-spec shape, no-impact alternative, and completion condition.

- [ ] **Step 6: Commit the blueprint-masterplan update**

Run:

```bash
git diff --check -- workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md
git add workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md
git commit -m "feat: synchronize worker specs with product masterplans"
```

### Task 4: Forward-test and validate both skill packages

**Files:**
- Modify if observations require correction: `workers-masterplan/evals/living-masterplan-scenarios.md`
- Modify if observations require correction: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`
- Verify: all files under `workers-masterplan/living-masterplan/`
- Verify: all files under `workers-masterplan/blueprint-masterplan/`

**Interfaces:**
- Consumes: the updated skills and the hidden evaluation rubric from Task 1.
- Produces: fresh evidence that both the authoritative document shape and worker synchronization behavior hold.

- [ ] **Step 1: Run the same scenario with the updated skills**

Dispatch a fresh-context agent with the updated skill paths and the original scenario prompt. Keep the rubric and previous diagnosis hidden. Require an artifact or response that can be scored after completion.

- [ ] **Step 2: Score every critical behavior**

Confirm same-substep masterplan synchronization, unified frontend-to-backend description, approved-only promotion, no roadmap/status partitioning, downstream assessment, and integrated planning completion. If a critical behavior is absent or ambiguous, amend the smallest responsible instruction and rerun the scenario.

- [ ] **Step 3: Validate skill packages and references**

Run the available skill validator against both skill directories. Then run Markdown fence, local-link, placeholder, duplicate-heading, and `git diff --check` checks over every modified skill, template, evaluation, design, and plan file.

- [ ] **Step 4: Review discovery metadata**

Compare both `agents/openai.yaml` files with their unchanged trigger descriptions. Confirm they remain accurate and leave them unmodified.

- [ ] **Step 5: Commit any validation-driven corrections**

If forward-testing required skill corrections, commit only those bounded files with:

```bash
git add workers-masterplan/living-masterplan workers-masterplan/blueprint-masterplan workers-masterplan/evals
git commit -m "test: verify spec masterplan synchronization"
```

- [ ] **Step 6: Report completion evidence**

Report changed files, baseline failure, post-change result, validation commands, commit IDs, repository divergence, and whether anything was pushed. Do not claim success from static searches alone.
