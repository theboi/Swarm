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
3. Name the worker/task ID, bounded outcome, status path, remote/base, branch, and isolated workspace.
4. Require prerequisite commits/evidence on the remote base.
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

Work from the latest `<REMOTE>/<BASE_BRANCH>` in unique branch `<FEATURE_BRANCH>` and isolated workspace `<WORKTREE_OR_CLONE_PATH>`. Do not edit the shared long-lived checkout. Before planning, fetch the remote, incorporate the current base, prove `<PREREQUISITE_IDS>` and their evidence are integrated, and run a clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until you have authored, obtained approval for, committed, and pushed this task's specification and implementation plan. Do not begin product implementation in this phase.

During planning:

1. Inspect existing foundations before proposing replacements.
2. Use `grilling` for material unanswered decisions and `superpowers:brainstorming` for approval.
3. Ask the authorized decision owner only when evidence cannot settle a material boundary.
4. Write `<SPEC_PATH>` with the task-local architecture, behavior, error handling, tests, and acceptance decisions.
5. Use `superpowers:writing-plans` to write `<PLAN_PATH>` with exact files, interfaces, tests, commands, ownership, dependencies, and review gates.
6. Split plan tasks only when execution state and mutable surfaces are independent; sequence shared contracts, migrations, generated artifacts, and central composition.
7. Add review and verification checkpoints for every subagent-produced change.
8. Update relevant living masterplans with stable approved decisions before implementation relies on them. Keep transient progress in `<STATUS_PATH>`.

After every completed planning substep, run focused checks, update only `<STATUS_PATH>`, make a bounded commit, fetch/incorporate `<REMOTE>/<BASE_BRANCH>`, resolve only mechanical owned conflicts, rerun affected checks, and push `<FEATURE_BRANCH>`. Do not merge every substep into the base.

Planning is complete only when the worker-authored specification and plan are approved, committed, pushed, linked from status, and affected living authorities contain stable decisions. Hand off exact commits, verification, unresolved questions, known limitations, and execution inputs. Then stop before implementation.
```

## Execution worker prompt

```markdown
Read `<BLUEPRINT_PATH>` and these relevant living masterplans:

- `<LIVING_MASTERPLAN_PATH>`
- `<LIVING_MASTERPLAN_PATH>`

Read the `<WORKER_ID>` / `<TASK_ID>` brief, prerequisite handoffs, worker-authored approved specification `<SPEC_PATH>`, and worker-authored approved implementation plan `<PLAN_PATH>`. Do not rely on private conversation history.

You are `<WORKER_ID>`, responsible for executing `<BOUNDED_OUTCOME>` to its defined acceptance evidence.

Work from the latest `<REMOTE>/<BASE_BRANCH>` in unique branch `<FEATURE_BRANCH>` and isolated workspace `<WORKTREE_OR_CLONE_PATH>`. Do not edit the shared long-lived checkout. Before implementation, fetch the remote, incorporate the current base, prove `<PREREQUISITE_IDS>` and their evidence are integrated, and run the clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until every applicable task in `<PLAN_PATH>` is implemented, reviewed, verified, integrated through the approved path, handed off, and eligible for safe teardown. If repository evidence invalidates the plan, revise the worker-authored artifacts and affected living authorities through their approval rules.

During execution:

1. Follow the approved plan task-by-task and use test-driven development where applicable.
2. Use subagents only for genuinely independent packages under `<SUBAGENT_MODEL_POLICY>`.
3. Give editing subagents explicit owned paths, interfaces, tests, isolated workspaces, and terminal deliverables.
4. Review every subagent diff/evidence before adoption; a subagent report is not verification.
5. Request/address code review and run verification-before-completion.
6. Update living masterplans with stable implementation evidence, changed approved decisions, and durable limitations. Keep transient work in `<PLAN_PATH>` or `<STATUS_PATH>`.

After every completed plan substep, run focused verification, update only `<STATUS_PATH>`, make a bounded commit, fetch/incorporate `<REMOTE>/<BASE_BRANCH>`, resolve only mechanical owned conflicts, rerun affected checks, and push `<FEATURE_BRANCH>`. Do not merge every substep into the base.

Execution is complete only when acceptance evidence is fresh, review is closed, the final commit is integrated into `<REMOTE>/<BASE_BRANCH>`, the handoff is merged, and safe teardown proves the workspace clean and branch merged. Never force-delete dirty, unmerged, failing, or under-review work.
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
- Interpret “pull regularly” as fetching and safely incorporating the current remote base.
- Route stable decisions/evidence through `living-masterplan`; keep transient work in plans/status.
- State the fallback when subagents or requested model settings are unavailable.
