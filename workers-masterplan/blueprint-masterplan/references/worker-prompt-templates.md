# Worker Prompt Templates

## Assembly checklist

Create separate prompts when planning and execution may occur in different sessions or the user requests a launch packet:

```text
docs/workers/<blueprint-id>/prompts/<worker-id>-planning.md
docs/workers/<blueprint-id>/prompts/<worker-id>-execution.md
```

Before handing off a prompt:

1. Replace every angle-bracket field with an exact value or remove the irrelevant line.
2. Name the frozen blueprint, blueprint ID, and only the living authorities relevant to the task.
3. Name the worker/task ID, bounded outcome, status path, `origin/main`, branch, isolated workspace, and `<MAIN_INTEGRATION_LOCK>` mechanism.
4. Require prerequisite commits/evidence on `origin/main`.
5. Include owned and excluded mutable surfaces plus exact downstream unblocks.
6. Reserve the worker's paths under `docs/superpowers/specs/<blueprint-id>/` and `docs/superpowers/plans/<blueprint-id>/`.
7. State that the worker—not the coordinator—authors the detailed specification and implementation plan.
8. State one terminal condition: approved planning handoff, or approved-plan execution complete.
9. Include the approved model/effort policy and fallback.
10. Remove any instruction to edit a shared long-lived checkout or treat an unmerged branch as authority.

## Planning-only worker prompt

```markdown
Read `<BLUEPRINT_PATH>` together with these relevant living masterplans:

- `<LIVING_MASTERPLAN_PATH>`
- `<LIVING_MASTERPLAN_PATH>`

Read the brief and prerequisite handoffs for `<WORKER_ID>` / `<TASK_ID>`. Do not rely on private conversation history.

You are `<WORKER_ID>`, responsible for planning `<BOUNDED_OUTCOME>` and authoring this worker's detailed task artifacts:

- Specification: `<SPEC_PATH>`
- Implementation plan: `<PLAN_PATH>`

Both paths must be inside the `<BLUEPRINT_ID>` folder. The coordinator reserved these paths but did not author their contents.

Work from the latest `origin/main` in unique branch `<FEATURE_BRANCH>` and isolated workspace `<WORKTREE_OR_CLONE_PATH>`. Do not edit the shared long-lived checkout. Before planning, pull `origin/main`, prove `<PREREQUISITE_IDS>` and their evidence are integrated there, and run a clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until you have authored, obtained approval for, committed, and integrated this task's specification and implementation plan into `origin/main`. Do not begin product implementation in this phase.

During planning:

1. Inspect existing foundations before proposing replacements.
2. Use `grilling` for material unanswered decisions and `superpowers:brainstorming` for approval.
3. Ask the authorized decision owner only when evidence cannot settle a material boundary.
4. Write `<SPEC_PATH>` with the task-local architecture, behavior, error handling, tests, and acceptance decisions.
5. Use `superpowers:writing-plans` to write `<PLAN_PATH>` with exact files, interfaces, tests, commands, ownership, dependencies, and review gates.
6. Split plan tasks only when execution state and mutable surfaces are independent; sequence shared contracts, migrations, generated artifacts, and central composition.
7. Add review and verification checkpoints for every subagent-produced change.
8. Update relevant living masterplans with stable approved decisions before implementation relies on them. For every living-authority change, identify direct and transitive downstream workers and gates. If dependencies, blockers, contracts, ownership, acceptance, tests, launch instructions, or implementation assumptions change, ensure the relevant downstream briefs, specs, plans, prompts, and statuses are updated and approved by their owners before those workers continue. Keep transient progress in `<STATUS_PATH>`.

After every completed planning subtask or plan substep, run focused checks, update only owned documents and `<STATUS_PATH>`, make a bounded commit, pull `origin/main` into `<FEATURE_BRANCH>`, resolve only mechanical owned conflicts, and rerun affected checks. Then acquire `<MAIN_INTEGRATION_LOCK>`, pull local `main` from `origin/main` with fast-forward only, merge the verified substep into local `main`, rerun affected checks on `main`, push local `main` to `origin/main`, and prove the substep commit is reachable there. If the push is rejected, pull the new `origin/main` into the feature branch and repeat reconciliation, verification, and locked integration. Never force-push `main`. A feature-branch push alone does not complete a substep.

Planning is complete only when the worker-authored specification and plan are approved, committed, integrated into `origin/main`, linked from status, and affected living authorities plus required downstream documents contain stable current decisions. Hand off exact commits, verification, propagation evidence, unresolved questions, known limitations, and execution inputs. Then stop before implementation.
```

## Execution worker prompt

```markdown
Read `<BLUEPRINT_PATH>` and these relevant living masterplans:

- `<LIVING_MASTERPLAN_PATH>`
- `<LIVING_MASTERPLAN_PATH>`

Read the `<WORKER_ID>` / `<TASK_ID>` brief, prerequisite handoffs, worker-authored approved specification `<SPEC_PATH>`, and worker-authored approved implementation plan `<PLAN_PATH>`. Do not rely on private conversation history.

You are `<WORKER_ID>`, responsible for executing `<BOUNDED_OUTCOME>` to its defined acceptance evidence.

Work from the latest `origin/main` in unique branch `<FEATURE_BRANCH>` and isolated workspace `<WORKTREE_OR_CLONE_PATH>`. Do not edit the shared long-lived checkout. Before implementation, pull `origin/main`, prove `<PREREQUISITE_IDS>` and their evidence are integrated there, and run the clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until every applicable task in `<PLAN_PATH>` is implemented, reviewed, verified, integrated through the approved path, handed off, and eligible for safe teardown. If repository evidence invalidates the plan, revise the worker-authored artifacts and affected living authorities through their approval rules.

During execution:

1. Follow the approved plan task-by-task and use test-driven development where applicable.
2. Use subagents only for genuinely independent packages under `<SUBAGENT_MODEL_POLICY>`.
3. Give editing subagents explicit owned paths, interfaces, tests, isolated workspaces, and terminal deliverables.
4. Review every subagent diff/evidence before adoption; a subagent report is not verification.
5. Request/address code review and run verification-before-completion.
6. Update living masterplans with stable implementation evidence, changed approved decisions, and durable limitations. For every living-authority change, identify direct and transitive downstream workers and gates. If dependencies, blockers, contracts, ownership, acceptance, tests, launch instructions, or implementation assumptions change, ensure the relevant downstream briefs, specs, plans, prompts, and statuses are updated and approved by their owners before those workers continue. Keep transient work in `<PLAN_PATH>` or `<STATUS_PATH>`.

After every completed implementation subtask or plan substep, run focused verification, update only owned documents and `<STATUS_PATH>`, make a bounded commit, pull `origin/main` into `<FEATURE_BRANCH>`, resolve only mechanical owned conflicts, and rerun affected checks. Then acquire `<MAIN_INTEGRATION_LOCK>`, pull local `main` from `origin/main` with fast-forward only, merge the verified substep into local `main`, rerun affected checks on `main`, push local `main` to `origin/main`, and prove the substep commit is reachable there. If the push is rejected, pull the new `origin/main` into the feature branch and repeat reconciliation, verification, and locked integration. Never force-push `main`. A feature-branch push alone does not complete a substep.

Execution is complete only when acceptance evidence is fresh, review is closed, the final commit and all required downstream-document updates are integrated into `origin/main`, the handoff is merged, and safe teardown proves the workspace clean and branch merged. Never force-delete dirty, unmerged, failing, or under-review work.
```

## Model and subagent policy

Use the user's explicit model and reasoning settings. For the EdenMind-style policy:

> When supported, use Terra High for bounded implementation and Terra Xhigh for difficult implementation, integration, migrations, or debugging. If unavailable, use the closest model/effort and report the deviation before dispatch.

Model strength does not make unsafe parallelism acceptable. The parent worker remains responsible for ownership, context, review, testing, and integration.

## Adaptation rules

- Replace fixed product names with task-relevant living authorities.
- Keep the Business Masterplan only when commercial constraints affect the worker.
- Keep planning and execution terminal conditions separate even if one person runs both.
- Preserve one blueprint ID and one specs/plans folder for the whole delivery effort.
- Interpret “pull regularly” as pulling `origin/main` into the worker branch; fetching without incorporation is insufficient.
- Require every independently testable substep to be merged into local `main` and pushed to `origin/main` before the next substep.
- Require living-authority changes to update every relevant downstream worker document through its owner before affected work continues.
- Route stable decisions/evidence through `living-masterplan`; keep transient work in plans/status.
- State the fallback when subagents or requested model settings are unavailable.
