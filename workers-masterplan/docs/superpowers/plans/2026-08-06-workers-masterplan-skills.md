# Workers Masterplan Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained `workers-masterplan` collection with validated `living-masterplan` and `blueprint-masterplan` Codex skills, their templates, evaluation scenarios, and project records.

**Architecture:** Keep each skill independently valid and progressively disclosed through one-level `references/` files. Author and validate `living-masterplan` before starting `blueprint-masterplan`; keep collection-level design, plan, and evaluation artifacts beneath `workers-masterplan/` so the directory can become its own repository.

**Tech Stack:** Markdown, YAML, Git, Codex skill-creator validation scripts, shell-based structural checks.

## Global Constraints

- Use strict Markdown contracts; do not introduce YAML execution manifests, generators, GitHub Projects integration, or orchestration daemons.
- Use only `name` and `description` in each `SKILL.md` frontmatter.
- Start descriptions with `Use when...`, describe trigger conditions rather than the workflow, and keep frontmatter below 1024 characters.
- Keep each `SKILL.md` below 500 lines and place detailed templates in one-level `references/` files.
- Generate `agents/openai.yaml` through the skill-creator scripts with quoted strings and a default prompt that explicitly names the skill with `$skill-name`.
- Require applicable Superpowers skills and Grill Me when material decisions are unsettled; explicit evidence-backed maintenance updates must not force a full interview.
- Do not create a collection README, changelog, installation guide, or other auxiliary file.
- Do not use subagents in this execution session. Preserve evaluation scenarios for later fresh-agent RED/GREEN pressure testing.
- Use `apply_patch` for repository file edits and moves.

---

### Task 1: Make the collection records self-contained

**Files:**
- Move: `docs/superpowers/specs/2026-08-06-workers-masterplan-skills-design.md` → `workers-masterplan/docs/superpowers/specs/2026-08-06-workers-masterplan-skills-design.md`
- Modify: `workers-masterplan/docs/superpowers/specs/2026-08-06-workers-masterplan-skills-design.md`
- Existing: `workers-masterplan/docs/superpowers/plans/2026-08-06-workers-masterplan-skills.md`

**Interfaces:**
- Consumes: the user-approved design and EdenMind's source-project reference at `docs/superpowers/plans/2026-08-05-mvp1/2026-08-05-mvp1-implementation-masterplan.md`.
- Produces: extraction-ready design and plan records whose runtime file references resolve within `workers-masterplan/`.

- [x] **Step 1: Move the approved design into the collection**

Use `apply_patch` to move the file without changing its historical contents unnecessarily.

- [x] **Step 2: Update the collection layout and reference language**

Add `docs/superpowers/specs`, `docs/superpowers/plans`, and `evals` to the architecture tree. Mark the EdenMind path as a source-project design reference, while making the generic blueprint template the runtime authority.

- [x] **Step 3: Verify self-contained record paths**

Run:

```bash
test -f workers-masterplan/docs/superpowers/specs/2026-08-06-workers-masterplan-skills-design.md
test -f workers-masterplan/docs/superpowers/plans/2026-08-06-workers-masterplan-skills.md
test ! -e docs/superpowers/specs/2026-08-06-workers-masterplan-skills-design.md
git diff --check
```

Expected: all commands exit 0.

- [x] **Step 4: Commit the record relocation**

```bash
git add docs/superpowers/specs/2026-08-06-workers-masterplan-skills-design.md workers-masterplan/docs/superpowers
git commit -m "docs: make workers masterplan records self-contained"
```

---

### Task 2: Create and verify `living-masterplan`

**Files:**
- Create: `workers-masterplan/evals/living-masterplan-scenarios.md`
- Create: `workers-masterplan/living-masterplan/SKILL.md`
- Create: `workers-masterplan/living-masterplan/agents/openai.yaml`
- Create: `workers-masterplan/living-masterplan/references/masterplan-types.md`
- Create: `workers-masterplan/living-masterplan/references/living-masterplan-template.md`

**Interfaces:**
- Consumes: repository evidence, user-provided decisions, existing authority documents, Grill Me, and Superpowers brainstorming/verification workflows.
- Produces: parameterized living business, product, architecture, implementation, operations, or custom masterplans with bootstrap and maintenance behavior.

- [x] **Step 1: Write the RED evaluation scenarios before the skill exists**

Create three realistic scenarios and a scoring rubric:

1. bootstrap a new repository whose README, roadmap, and implementation disagree;
2. update one existing product masterplan from explicit implementation evidence without re-grilling settled decisions; and
3. handle new user information that contradicts both a commercial authority and repository evidence.

Require the rubric to check evidence inspection, authority classification, targeted updates, contradiction handling, approval boundaries, and commit behavior. Record that fresh-agent baseline and pressure runs are pending because this execution session cannot dispatch subagents.

- [x] **Step 2: Verify the skill is absent at RED**

Run:

```bash
test ! -e workers-masterplan/living-masterplan/SKILL.md
```

Expected: exit 0, proving the behavior is not yet supplied by the collection.

- [x] **Step 3: Initialize the skill with deterministic metadata**

Run:

```bash
python3 /Users/bot4/.codex/skills/.system/skill-creator/scripts/init_skill.py living-masterplan \
  --path /Users/bot4/Dev/EdenMind/workers-masterplan \
  --resources references \
  --interface 'display_name=Living Masterplan' \
  --interface 'short_description=Maintain authoritative project masterplans' \
  --interface 'default_prompt=Use $living-masterplan to create or update the project authoritative masterplans.'
```

Expected: the skill, reference directory, and `agents/openai.yaml` are created.

- [x] **Step 4: Write reusable masterplan references**

Write `masterplan-types.md` with:

- authority roles for business/commercial, product/feature specification, architecture, implementation state, operations/security/release, and custom types;
- routing rules for facts, decisions, proposals, temporary execution status, historical information, and task-level detail;
- authority-precedence and contradiction handling; and
- bootstrap versus maintenance selection.

Write `living-masterplan-template.md` with:

- metadata and authority table;
- purpose and scope;
- current state and implemented evidence;
- approved decisions and boundaries;
- unresolved decisions separated from facts;
- dependencies and related authorities;
- exclusions and superseded material; and
- evidence-backed change history.

- [x] **Step 5: Replace the scaffold with the minimal workflow skill**

Write `SKILL.md` in imperative form with these required sections:

- Overview and core principle
- Required companion skills
- Bootstrap-or-maintenance decision
- Bootstrap workflow
- Maintenance workflow
- Information routing
- Contradiction and approval gates
- Verification and commit gate
- Quick reference
- Common mistakes
- Stop conditions

Link both reference files directly from `SKILL.md`. Do not repeat their full contents.

- [x] **Step 6: Validate `living-masterplan`**

Run:

```bash
python3 /Users/bot4/.codex/skills/.system/skill-creator/scripts/quick_validate.py workers-masterplan/living-masterplan
test "$(find workers-masterplan/living-masterplan/references -maxdepth 1 -type f | wc -l | tr -d ' ')" = "2"
test "$(wc -l < workers-masterplan/living-masterplan/SKILL.md | tr -d ' ')" -lt 500
rg -n 'TBD|TODO|FIXME|XXX' workers-masterplan/living-masterplan workers-masterplan/evals/living-masterplan-scenarios.md && exit 1 || true
git diff --check
```

Expected: validator success, exactly two references, SKILL under 500 lines, no placeholders, and no whitespace errors.

- [x] **Step 7: Check the evaluation rubric against the skill contract**

For each expected behavior in `living-masterplan-scenarios.md`, cite the exact `SKILL.md` or direct reference section that supplies it. Fix any uncovered behavior before continuing. Do not claim fresh-agent GREEN pressure testing was run.

- [x] **Step 8: Commit the verified first skill**

```bash
git add workers-masterplan/living-masterplan workers-masterplan/evals/living-masterplan-scenarios.md
git commit -m "feat: add living masterplan skill"
```

Do not begin Task 3 until this commit exists and all Task 2 checks pass.

---

### Task 3: Create and verify `blueprint-masterplan`

**Files:**
- Create: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`
- Create: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Create: `workers-masterplan/blueprint-masterplan/agents/openai.yaml`
- Create: `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- Create: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Create: `workers-masterplan/blueprint-masterplan/references/worker-status-template.md`
- Create: `workers-masterplan/blueprint-masterplan/references/status-summary-template.md`

**Interfaces:**
- Consumes: current committed living masterplans, a bounded delivery objective, repository evidence, remote Git state, optional user gates, and applicable Superpowers skills.
- Produces: a frozen EdenMind-style execution blueprint, per-worker status contracts, aggregate blocker/readiness reporting, isolated worktree rules, and safe teardown requirements.

- [x] **Step 1: Write the RED evaluation scenarios before the skill exists**

Create four realistic scenarios and a scoring rubric:

1. split an MVP into foundation, parallel UI/backend packages, integration, and optional UI Demo/MVP gates;
2. reject false parallelism when two workers would edit the same central file and migration sequence;
3. report readiness and blockers from stale remote branches and per-worker status files; and
4. refuse completion and branch cleanup when work is dirty, unmerged, under review, or failing verification.

Require the rubric to check living-authority freshness, acyclic dependency graphs, one owner per shared surface, evidence-based gates, remote-merge prerequisites, worktree isolation, substep push/rebase behavior, and non-forced teardown. Record fresh-agent runs as pending under the current no-subagent constraint.

- [x] **Step 2: Verify the second skill is absent at RED**

Run:

```bash
test ! -e workers-masterplan/blueprint-masterplan/SKILL.md
```

Expected: exit 0.

- [x] **Step 3: Initialize the skill with deterministic metadata**

Run:

```bash
python3 /Users/bot4/.codex/skills/.system/skill-creator/scripts/init_skill.py blueprint-masterplan \
  --path /Users/bot4/Dev/EdenMind/workers-masterplan \
  --resources references \
  --interface 'display_name=Blueprint Masterplan' \
  --interface 'short_description=Plan collision-safe multi-worker execution' \
  --interface 'default_prompt=Use $blueprint-masterplan to build a gated dependency-aware worker execution blueprint.'
```

Expected: the second skill, reference directory, and `agents/openai.yaml` are created.

- [x] **Step 4: Write the blueprint and coordination templates**

Write `blueprint-masterplan-template.md` with the full required structure:

- authority and usage;
- outcomes and optional gates;
- existing foundations;
- locked boundaries and shared contracts;
- Mermaid dependency DAG;
- mandatory Superpowers/Git/worktree lifecycle;
- worker briefs and ownership;
- integration gates;
- conflict policy;
- completion, teardown, and handoff; and
- exclusions.

Write `worker-status-template.md` with worker ID, branch, pushed commit, state, completed substep, verification, blockers, unblock owner/criterion, next action, last integration sync, downstream unblock, and timestamp.

Write `worker-prompt-templates.md` with separate planning-only and execution prompts, exact terminal conditions, safe branch/worktree isolation, frequent Git synchronization, living-authority routing, and user-approved subagent model/effort guidance.

Write `status-summary-template.md` with ready/active/reviewing/complete/blocked workers, blocker ownership, stale status, verification gaps, gate state, critical path, newly unblocked work, and cleanup receipts.

- [x] **Step 5: Replace the scaffold with the minimal workflow skill**

Write `SKILL.md` in imperative form with these required sections:

- Overview and core principle
- Required companion skills
- Living-authority prerequisite
- Blueprint workflow
- Construction-style decomposition rules
- Dependency and gate validation
- Ownership and false-parallelism rules
- Same-machine worktree isolation
- Per-substep Git synchronization
- Status and blocker reporting
- Completion and safe teardown
- Quick reference
- Common mistakes and stop conditions

Require `living-masterplan` before updating stable authority information and name applicable Superpowers sub-skills explicitly. Link all four reference files directly.

- [x] **Step 6: Validate `blueprint-masterplan`**

Run:

```bash
python3 /Users/bot4/.codex/skills/.system/skill-creator/scripts/quick_validate.py workers-masterplan/blueprint-masterplan
test "$(find workers-masterplan/blueprint-masterplan/references -maxdepth 1 -type f | wc -l | tr -d ' ')" = "4"
test "$(wc -l < workers-masterplan/blueprint-masterplan/SKILL.md | tr -d ' ')" -lt 500
rg -n 'TBD|TODO|FIXME|XXX' workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md && exit 1 || true
git diff --check
```

Expected: validator success, exactly four references, SKILL under 500 lines, no placeholders, and no whitespace errors.

- [x] **Step 7: Check the evaluation rubric against the skill contract**

For each expected behavior in `blueprint-masterplan-scenarios.md`, cite the exact `SKILL.md` or direct reference section that supplies it. Fix every uncovered behavior before continuing. Do not claim fresh-agent GREEN pressure testing was run.

- [x] **Step 8: Commit the verified second skill**

```bash
git add workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md
git commit -m "feat: add blueprint masterplan skill"
```

---

### Task 4: Verify extraction readiness and complete the collection

**Files:**
- Modify: `workers-masterplan/docs/superpowers/plans/2026-08-06-workers-masterplan-skills.md`
- Verify: all files below `workers-masterplan/`

**Interfaces:**
- Consumes: both independently validated skill folders and their evaluation mappings.
- Produces: a clean, extraction-ready collection with no runtime dependency on files outside `workers-masterplan/` except explicitly named external skills and standard Git tooling.

- [x] **Step 1: Run both skill validators together**

```bash
python3 /Users/bot4/.codex/skills/.system/skill-creator/scripts/quick_validate.py workers-masterplan/living-masterplan
python3 /Users/bot4/.codex/skills/.system/skill-creator/scripts/quick_validate.py workers-masterplan/blueprint-masterplan
```

Expected: both report valid skills.

- [x] **Step 2: Verify metadata and reference links**

Run a read-only check that:

- each `agents/openai.yaml` contains `display_name`, a 25–64 character `short_description`, and a `default_prompt` naming its `$skill-name`;
- every Markdown link from either `SKILL.md` to `references/*.md` resolves;
- both skill names match their directories; and
- no skill reference requires an EdenMind-specific runtime file.

Expected: no missing or mismatched path is reported.

- [x] **Step 3: Scan the collection for unfinished content and accidental files**

```bash
rg -n 'TBD|TODO|FIXME|XXX|PLACEHOLDER' workers-masterplan/living-masterplan workers-masterplan/blueprint-masterplan workers-masterplan/evals && exit 1 || true
find workers-masterplan \( -name README.md -o -name CHANGELOG.md -o -name INSTALLATION_GUIDE.md \)
git diff --check
git status --short
```

Expected: no placeholder match, no forbidden auxiliary file, no whitespace error, and only intended collection changes before the final commit.

- [x] **Step 4: Inspect the final extraction tree**

```bash
find workers-masterplan -type f | sort
```

Expected: only the two skills, six direct reference files, two UI metadata files, two evaluation files, the design spec, and this implementation plan.

- [x] **Step 5: Record execution evidence in this plan**

Check completed steps and add a concise final evidence section containing the exact validator results, placeholder scan result, file count, and known limitation that fresh-agent pressure testing remains pending.

- [x] **Step 6: Commit final verification records**

```bash
git add workers-masterplan
git commit -m "docs: record workers masterplan verification"
```

- [x] **Step 7: Run final verification on the committed tree**

Repeat both validators, the link check, placeholder scan, `git diff --check`, and `git status --short`.

Expected: both skills valid and the worktree clean.

### Task 5: Add phase-specific worker prompt templates

**Files:**
- Create: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Modify: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/blueprint-masterplan-template.md`
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`
- Modify: collection design, plan, and verification records

**Interfaces:**
- Consumes: the user's existing planning-worker and execution-worker prompts.
- Produces: safe, parameterized launch prompts that preserve phase boundaries, frequent Git synchronization, masterplan updates, questions, and Terra High/Xhigh guidance without shared-main editing.

- [x] **Step 1: Add the RED scenario and prove the prompt reference is absent**

- [x] **Step 2: Create planning-only and execution prompt templates**

- [x] **Step 3: Link prompt generation from the blueprint workflow and template**

- [x] **Step 4: Validate the updated skill, links, counts, and evaluation coverage**

- [x] **Step 5: Commit, integrate, verify, and safely remove the follow-up worker branch**

## Execution evidence

Recorded 6 August 2026 in the isolated `codex/workers-masterplan` worktree.

| Check | Result |
| --- | --- |
| `living-masterplan` official validator | `Skill is valid!` |
| `blueprint-masterplan` official validator | `Skill is valid!` |
| Direct `SKILL.md` reference links | All six references resolve |
| Skill directory/name and discovery metadata | Both match; both descriptions start with `Use when` |
| UI metadata | Both short descriptions are 42 characters; both prompts name their `$skill-name` |
| Phase-specific worker prompts | Planning and execution terminals, worktree isolation, synchronization, masterplan routing, and Terra High/Xhigh guidance verified |
| Placeholder and unfinished-content scan | No match in skills or evaluations |
| Forbidden auxiliary files and symlinks | None |
| EdenMind-specific runtime dependency scan | None in either runtime skill folder |
| Extraction inventory | 14 files beneath `workers-masterplan/` |
| Whitespace validation | `git diff --check` passed |

The validator scripts required `PyYAML`, which neither available Python runtime supplied. Validation used `PyYAML 6.0.3` from an isolated temporary module directory; the collection gained no Python or runtime dependency.

Fresh-agent RED/GREEN pressure runs remain pending because this execution session was not authorized to dispatch subagents. Both evaluation files preserve the exact future prompts, scoring rules, critical behaviors, and static coverage mappings without claiming those runs occurred.
