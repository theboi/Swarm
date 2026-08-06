# Worker Prompt Templates

## Contents

- Assembly checklist
- Planning-only worker prompt
- Execution worker prompt
- Model and subagent policy
- Adaptation rules

## Assembly checklist

Create two prompts per worker when planning and execution may happen in separate sessions. Default paths:

```text
docs/workers/<blueprint-id>/prompts/<worker-id>-planning.md
docs/workers/<blueprint-id>/prompts/<worker-id>-execution.md
```

Before handing off a prompt:

1. Replace every angle-bracket field with an exact value or remove the irrelevant line.
2. Name the frozen blueprint and only the living masterplans relevant to the task.
3. Name the worker ID, task ID, status-file path, remote, base branch, feature branch, and isolated workspace.
4. List prerequisite worker/gate IDs and require their commits and evidence on the remote base.
5. State one terminal condition: planning artifacts complete, or approved plan execution complete.
6. Name specification and plan paths when they already exist.
7. Include the user-approved subagent model/effort policy and a fallback rule.
8. Include owned and excluded mutable surfaces from the worker brief.
9. Include the exact gate or downstream nodes this worker may unblock.
10. Review the prompt for any instruction to edit a shared long-lived checkout or treat an unmerged branch as authority.

## Planning-only worker prompt

```markdown
Read `<BLUEPRINT_PATH>` together with these relevant living masterplans:

- `<LIVING_MASTERPLAN_PATH>`
- `<LIVING_MASTERPLAN_PATH>`

Also read the brief and prerequisite handoffs for `<WORKER_ID>` / `<TASK_ID>`. Do not rely on private conversation history.

You are `<WORKER_ID>`, responsible for `<BOUNDED_PLANNING_OUTCOME>`.

Work from the latest `<REMOTE>/<BASE_BRANCH>` in the unique branch `<FEATURE_BRANCH>` and isolated workspace `<WORKTREE_OR_CLONE_PATH>`. Do not edit the shared long-lived checkout. Before planning, fetch the remote, incorporate the current base, prove `<PREREQUISITE_IDS>` and their required evidence are integrated, and run the repository-appropriate clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until you have finished the approved dated specification and implementation plan for this assigned task. Do not begin product implementation in this phase.

During planning:

1. Inspect existing foundations before proposing replacements.
2. Use Grill Me for material unanswered decisions and Superpowers brainstorming for approval.
3. Ask the user when a decision, authority, success criterion, or scope boundary cannot be established from evidence.
4. Write the task specification at `<SPEC_PATH>`.
5. Write the implementation plan at `<PLAN_PATH>` with exact files, interfaces, tests, verification commands, ownership, and dependency edges.
6. Design plan tasks so execution can use subagents in parallel only when their state and mutable surfaces are independent. Order shared-file, contract, migration, and generated-artifact work or assign one integration owner.
7. Include review and verification checkpoints for every subagent-produced change.
8. Update the relevant living masterplans with stable approved decisions before implementation depends on them. Keep transient tasks and worker progress in the plan or `<STATUS_PATH>`.

After every completed planning substep, run focused checks, update only `<STATUS_PATH>`, make a bounded commit, fetch and incorporate `<REMOTE>/<BASE_BRANCH>`, resolve only mechanical conflicts within ownership, rerun affected checks, and push `<FEATURE_BRANCH>`. Do not merge every substep into the base branch.

Planning is complete only when the specification and plan are approved, committed, pushed, linked from the worker status, and all affected living authorities contain the stable decisions. Hand off exact commits, verification evidence, unresolved questions, known planning limitations, and the execution prompt inputs. Then stop before implementation.
```

## Execution worker prompt

```markdown
Read `<BLUEPRINT_PATH>` together with these relevant living masterplans:

- `<LIVING_MASTERPLAN_PATH>`
- `<LIVING_MASTERPLAN_PATH>`

Read the `<WORKER_ID>` / `<TASK_ID>` brief, prerequisite handoffs, approved specification `<SPEC_PATH>`, and approved implementation plan `<PLAN_PATH>`. Do not rely on private conversation history.

You are `<WORKER_ID>`, responsible for executing `<BOUNDED_EXECUTION_OUTCOME>` to its defined completion evidence.

Work from the latest `<REMOTE>/<BASE_BRANCH>` in the unique branch `<FEATURE_BRANCH>` and isolated workspace `<WORKTREE_OR_CLONE_PATH>`. Do not edit the shared long-lived checkout. Before implementation, fetch the remote, incorporate the current base, prove `<PREREQUISITE_IDS>` and their evidence are integrated, and run the clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until every applicable step in `<PLAN_PATH>` is implemented, reviewed, verified, integrated through the approved path, handed off, and eligible for safe teardown. If repository changes invalidate the plan, update the dated artifacts and affected living authorities through their approval rules before continuing.

During execution:

1. Follow the approved plan task-by-task and use test-driven development where applicable.
2. Use subagents for genuinely independent packages. Apply this assignment's model policy: `<SUBAGENT_MODEL_POLICY>`.
3. Give every editing subagent explicit owned paths, interfaces, tests, and a terminal deliverable. Do not let parallel subagents edit overlapping mutable surfaces or share an unsafe checkout.
4. Use read-only subagents for research or review when editing isolation is unavailable.
5. Review every subagent diff and evidence before adoption; a subagent report is not verification.
6. Request and address code review, then run verification-before-completion.
7. Update relevant living masterplans with stable implementation evidence, changed approved decisions, and durable known limitations. Keep transient remaining tasks and active blockers in `<PLAN_PATH>` or `<STATUS_PATH>`.

After every completed implementation-plan substep, run focused verification, update only `<STATUS_PATH>`, make a bounded commit, fetch and incorporate `<REMOTE>/<BASE_BRANCH>`, resolve only mechanical conflicts within ownership, rerun affected checks, and push `<FEATURE_BRANCH>`. Do not merge every substep into the base branch.

Execution is complete only when acceptance evidence is fresh, required review is closed, the final commit is integrated into `<REMOTE>/<BASE_BRANCH>`, the handoff is merged, and safe teardown can prove the worktree is clean and the worker branch is merged. Follow the blueprint's closeout protocol; never force-delete dirty, unmerged, failing, or under-review work.
```

## Model and subagent policy

Use the user's explicit model and reasoning settings. For the supplied EdenMind-style policy, write:

> When the host supports it, use Terra High for bounded implementation and Terra Xhigh for difficult implementation, integration, migrations, or debugging. If those settings are unavailable, use the closest available model/effort and report the deviation before dispatch.

Model strength does not make unsafe parallelism acceptable. The parent worker remains responsible for ownership, context, review, testing, and integration.

## Adaptation rules

- Replace fixed names such as “Product 1” with the living authorities relevant to the assigned task.
- Keep the Business Masterplan only when commercial constraints affect the worker.
- Keep planning and execution terminal conditions separate even if one person runs both phases.
- If the user explicitly authorizes direct work on a long-lived branch, still do not run concurrent editing workers in one checkout; explain the collision risk and obtain a safe isolation decision.
- Interpret “pull regularly” as fetching and rebasing or otherwise incorporating the current remote base without discarding local or other workers' changes.
- Interpret “update masterplans with todos” through `living-masterplan` routing: durable known limitations and verified current state may enter living authorities; transient tasks remain in plans or worker status.
- Do not promise that subagents will be available. State the approved fallback when the host cannot dispatch them.
