# Blueprint Masterplan Rewrite and MVP2 Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Blueprint Masterplan skill around the approved EdenMind execution contract, then replace the stale MVP2 planning packet with one validated 15-worker implementation masterplan.

**Architecture:** The skill defines one coordinator-owned frozen blueprint and worker-owned planning artifacts grouped by blueprint ID. The MVP2 authority uses three foundations, seven independent trades, one publication owner, three live adapters, and one assembly/release owner. A deterministic preservation gate runs before any obsolete MVP2 files are deleted.

**Tech Stack:** Markdown, YAML, Mermaid, Git, shell validation, Python skill validator.

## Global Constraints

- Preserve all unrelated user changes.
- Use `apply_patch` for file content edits and explicit paths for deletions.
- Do not pre-author individual workers' task specifications or implementation plans.
- Store future worker artifacts under one `YYYY-MM-DD-<blueprint-slug>` folder in each Superpowers artifact root.
- Keep substantive graph layers normally three to seven workers wide without inventing nodes or dependencies.
- Do not delete old MVP2 artifacts until the new masterplan passes the responsibility and product-decision preservation gate.

---

### Task 1: Record the RED evidence and rewrite contract

**Files:**
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`
- Reference: `workers-masterplan/blueprint-masterplan/SKILL.md`

- [ ] **Step 1: Preserve the observed baseline failures**

Record that the current skill produced a 14-wide frontier and flat `docs/superpowers/specs`/`plans` paths, while correctly assigning worker plan authorship.

- [ ] **Step 2: Add application scenarios**

Add explicit expected behavior for the three-to-seven width band, blueprint-scoped artifact roots, and coordinator-versus-worker authorship.

- [ ] **Step 3: Run the static baseline checks**

Run: `rg -n "three to seven|blueprint-id|worker authors" workers-masterplan/evals/blueprint-masterplan-scenarios.md`

Expected: all three contracts are represented by evaluation criteria.

### Task 2: Rewrite the Blueprint Masterplan skill

**Files:**
- Modify: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Modify: `workers-masterplan/blueprint-masterplan/agents/openai.yaml`
- Delete: `workers-masterplan/blueprint-masterplan/blueprint-masterplan`

- [ ] **Step 1: Rewrite the main skill around the exemplar output contract**

Keep authority establishment, foundations, locked boundaries, flattened DAG, readiness, worker briefs, shared contracts, gates, coordination, merge/conflict, handoff/teardown, exclusions, and revisions. State positively that the coordinator writes briefs and each worker writes its own detailed spec/plan.

- [ ] **Step 2: Add blueprint-scoped paths**

Use `docs/superpowers/specs/<blueprint-id>/...` and `docs/superpowers/plans/<blueprint-id>/...`, with `<blueprint-id>` fixed to the delivery effort's start date and slug.

- [ ] **Step 3: Add flattened-graph evidence**

Require worker/edge counts, layer widths, peak ready width, active execution slots, and justified exceptions outside three to seven.

- [ ] **Step 4: Update reusable templates and metadata**

Make prompt roles and reserved paths match the skill; regenerate or validate `openai.yaml`.

- [ ] **Step 5: Remove the recursive symlink**

Delete only `workers-masterplan/blueprint-masterplan/blueprint-masterplan`; confirm it was a symlink before deletion.

- [ ] **Step 6: Validate the skill**

Run the skill validator, YAML parser, `git diff --check`, and forward-test scenarios.

Expected: valid frontmatter/templates; evaluators group an over-wide adapter frontier, use blueprint folders, and assign worker-authored plans.

### Task 3: Rewrite the MVP2 implementation authority

**Files:**
- Modify: `docs/plans/EdenMind_MVP2_Implementation_Masterplan.md`
- Move: `docs/superpowers/specs/2026-08-07-mvp2-design.md` to `docs/superpowers/specs/2026-08-07-mvp2/2026-08-07-mvp2-design.md`
- Modify: directly affected links in `docs/plans/*.md`

- [ ] **Step 1: Rewrite the masterplan around the 15-worker graph**

Preserve approved product boundaries and gates. Replace 28 pre-authored task-plan references with worker-owned reserved artifact paths and planning responsibilities.

- [ ] **Step 2: Add graph-shape and responsibility evidence**

Record 15 workers, 30 hard edges, widths `3 -> 7 -> 1 -> 3 -> 1`, and the complete old-to-new responsibility mapping.

- [ ] **Step 3: Move the retained product design**

Place it in the `2026-08-07-mvp2` blueprint folder and update every surviving reference.

- [ ] **Step 4: Update living cross-references**

Remove the flat-graph design as an architecture authority and identify the rewritten masterplan as the sole execution authority.

### Task 4: Run the mandatory pre-deletion integrity review

**Files:**
- Review: `docs/plans/EdenMind_MVP2_Implementation_Masterplan.md`
- Review: `docs/superpowers/specs/2026-08-07-mvp2/2026-08-07-mvp2-design.md`
- Review: all files in the approved deletion set

- [ ] **Step 1: Verify responsibility preservation**

Compare every old worker brief/plan outcome with the new mapping. Fail on missing or duplicate responsibility.

- [ ] **Step 2: Verify product-decision preservation**

Check access, teacher records, report evidence/revisions, persona, statistics, taxonomy, dashboards, privacy, migrations, failures, gates, and exclusions against the approved product design.

- [ ] **Step 3: Verify graph and paths**

Parse the Mermaid edges, prove acyclicity and exact counts/widths, then check every `Depends on`/`Unblocks` pair and every surviving link.

- [ ] **Step 4: Review the pre-deletion diff**

Run `git diff --check` and inspect the full targeted diff. Do not continue if any approved behavior disappeared or a deleted file remains authoritative.

### Task 5: Delete obsolete MVP2 artifacts and verify completion

**Files:**
- Delete: `docs/superpowers/specs/2026-08-08-mvp2-flat-worker-graph-design.md`
- Delete: `docs/superpowers/plans/2026-08-07-mvp2-w*.md`
- Delete: `docs/superpowers/plans/2026-08-08-mvp2-*.md`
- Delete: `docs/workers/mvp2-analysis/**`

- [ ] **Step 1: Delete only the approved explicit file set**

Use an explicit generated manifest reviewed against Git before passing it to `apply_patch`. Do not use a broad recursive deletion command.

- [ ] **Step 2: Verify no stale references survive**

Search for deleted paths, W0-W8 launch authority, the 28-worker graph, and `mvp2-analysis` references. Update only legitimate surviving authorities.

- [ ] **Step 3: Run final validation**

Run skill validation, YAML parsing, Markdown/link/placeholder checks, graph validation, `git diff --check`, and targeted repository documentation checks.

- [ ] **Step 4: Review Git state**

Confirm unrelated MVP1 moves remain untouched and report every deletion as Git-recoverable. Do not stage, commit, or push unless separately authorized.
