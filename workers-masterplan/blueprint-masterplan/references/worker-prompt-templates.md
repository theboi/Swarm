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
3. Name the worker/task ID, bounded outcome, status path, `origin/main`, assigned normal checkout or clone, `<MAIN_MUTATION_LOCK>`, and `<MAIN_PUSH_LOCK>` mechanisms.
4. Require prerequisite commits/evidence on `origin/main`.
5. Include owned and excluded mutable surfaces plus exact downstream unblocks.
6. Reserve the worker's paths under `docs/superpowers/specs/<blueprint-id>/` and `docs/superpowers/plans/<blueprint-id>/`.
7. State that the worker—not the coordinator—authors the detailed specification and implementation plan.
8. State one terminal condition: approved planning handoff, or approved-plan execution complete.
9. Include the approved model/effort policy and fallback.
10. Remove every feature-branch, worktree, detached-HEAD, and branch-finishing instruction; every worker and editing subagent must stay on `main`.

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

Work directly on `main` in `<MAIN_CHECKOUT_OR_CLONE_PATH>`. Feature branches and linked Git worktrees are prohibited. Confirm the checkout is on `main` and is not a linked worktree. Before planning, acquire `<MAIN_MUTATION_LOCK>` when the checkout is shared, pull `origin/main`, prove `<PREREQUISITE_IDS>` and their evidence are integrated there, and run a clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until you have authored, obtained approval for, committed, and integrated this task's specification and implementation plan into `origin/main`. Do not begin product implementation in this phase.

During planning:

1. Inspect existing foundations before proposing replacements.
2. Use `grilling` for material unanswered decisions and `superpowers:brainstorming` for approval.
3. Ask the authorized decision owner only when evidence cannot settle a material boundary.
4. Write `<SPEC_PATH>` with the task-local architecture, behavior, error handling, tests, and acceptance decisions.
5. Immediately identify every affected product specification masterplan. In the
   same planning substep, consolidate all and only approved changes from
   `<SPEC_PATH>` into its unified high-level product contract: applicable user
   journeys, frontend surfaces and client data, APIs and authorization, records
   and storage, processing and integrations, reliability, security, privacy,
   observability, acceptance, and product boundaries. Do not organize that
   masterplan by available now, approved future, deferred, worker, or delivery
   history. If `<SPEC_PATH>` has no approved product impact, record an
   evidence-backed no-impact finding instead.
6. Use `superpowers:writing-plans` to write `<PLAN_PATH>` with exact files, interfaces, tests, commands, ownership, dependencies, and review gates.
7. Split plan tasks only when execution state and mutable surfaces are independent; sequence shared contracts, migrations, generated artifacts, and central composition.
8. Add review and verification checkpoints for every subagent-produced change.
9. Update relevant non-product living masterplans with stable approved decisions before implementation relies on them. For every living-authority change, identify direct and transitive downstream workers and gates. If dependencies, blockers, contracts, ownership, acceptance, tests, launch instructions, or implementation assumptions change, ensure the relevant downstream briefs, specs, plans, prompts, and statuses are updated and approved by their owners before those workers continue. Keep transient progress in `<STATUS_PATH>`.

The initial `<MAIN_MUTATION_LOCK>` acquisition above covers the first planning subtask or plan substep. Before editing every subsequent substep in a shared checkout, reacquire that lock, reconcile clean local `main` with `origin/main`, and hold the lock through remote reachability proof. After completing the substep, run focused checks on local `main`, update only owned documents and `<STATUS_PATH>`, review the exact owned diff, and make a bounded commit directly to `main`. Acquire `<MAIN_PUSH_LOCK>`, fetch `origin/main`, merge it into local `main` if histories diverge, resolve only mechanical owned conflicts, and rerun affected checks. Push local `main` to `origin/main` and prove the substep commit is reachable there before releasing both locks. Reacquire `<MAIN_MUTATION_LOCK>` before editing the next substep. If the push is rejected, fetch and merge the new `origin/main`, reverify, and retry under the locks. Never rebase or force-push published `main`.

Planning is complete only when the worker-authored specification, affected
product specification masterplan updates or evidence-backed no-impact findings,
and plan are approved, committed, integrated into `origin/main`, linked from
status, and affected non-product living authorities plus required downstream
documents contain stable current decisions. Hand off exact commits, verification,
propagation evidence, unresolved questions, known limitations, and execution
inputs. Then stop before implementation.
```

## Execution worker prompt

```markdown
Read `<BLUEPRINT_PATH>` and these relevant living masterplans:

- `<LIVING_MASTERPLAN_PATH>`
- `<LIVING_MASTERPLAN_PATH>`

Read the `<WORKER_ID>` / `<TASK_ID>` brief, prerequisite handoffs, worker-authored approved specification `<SPEC_PATH>`, and worker-authored approved implementation plan `<PLAN_PATH>`. Do not rely on private conversation history.

You are `<WORKER_ID>`, responsible for executing `<BOUNDED_OUTCOME>` to its defined acceptance evidence.

Work directly on `main` in `<MAIN_CHECKOUT_OR_CLONE_PATH>`. Feature branches and linked Git worktrees are prohibited. Confirm the checkout is on `main` and is not a linked worktree. Before implementation, acquire `<MAIN_MUTATION_LOCK>` when the checkout is shared, pull `origin/main`, prove `<PREREQUISITE_IDS>` and their evidence are integrated there, and run the clean baseline.

Your owned surfaces are `<OWNED_SURFACES>`. You do not own `<EXCLUDED_SURFACES>`. Stop and report a semantic, ownership, contract, migration-order, or generated-artifact conflict rather than overwriting another worker's intent.

Continue until every applicable task in `<PLAN_PATH>` is implemented, reviewed, verified, integrated through `origin/main`, handed off, and leaves the assigned main checkout clean. If repository evidence invalidates the plan, revise the worker-authored artifacts and affected living authorities through their approval rules.

During execution:

1. Follow the approved plan task-by-task and use test-driven development where applicable.
2. Use subagents only for genuinely independent packages under `<SUBAGENT_MODEL_POLICY>`.
3. Give editing subagents explicit owned paths, interfaces, tests, main-only checkout and lock rules, and terminal deliverables. Do not let a subagent create or use a branch or worktree.
4. Review every subagent diff/evidence before adoption; a subagent report is not verification.
5. Request/address code review and run verification-before-completion.
6. When execution changes the approved product contract or changes
   `<SPEC_PATH>`, immediately consolidate the approved change into every affected
   product specification masterplan using the same unified high-level
   frontend-to-backend format, or record an evidence-backed no-impact finding.
   Do not add availability or delivery-status partitions. Update other living
   masterplans with stable implementation evidence, changed approved decisions,
   and durable limitations. For every living-authority change, identify direct
   and transitive downstream workers and gates. If dependencies, blockers,
   contracts, ownership, acceptance, tests, launch instructions, or
   implementation assumptions change, ensure the relevant downstream briefs,
   specs, plans, prompts, and statuses are updated and approved by their owners
   before those workers continue. Keep transient work in `<PLAN_PATH>` or
   `<STATUS_PATH>`.

The initial `<MAIN_MUTATION_LOCK>` acquisition above covers the first implementation subtask or plan substep. Before editing every subsequent substep in a shared checkout, reacquire that lock, reconcile clean local `main` with `origin/main`, and hold the lock through remote reachability proof. After completing the substep, run focused verification on local `main`, update only owned documents and `<STATUS_PATH>`, review the exact owned diff, and make a bounded commit directly to `main`. Acquire `<MAIN_PUSH_LOCK>`, fetch `origin/main`, merge it into local `main` if histories diverge, resolve only mechanical owned conflicts, and rerun affected checks. Push local `main` to `origin/main` and prove the substep commit is reachable there before releasing both locks. Reacquire `<MAIN_MUTATION_LOCK>` before editing the next substep. If the push is rejected, fetch and merge the new `origin/main`, reverify, and retry under the locks. Never rebase or force-push published `main`.

Execution is complete only when acceptance evidence is fresh, review is closed, the final commit and all required downstream-document updates are reachable from `origin/main`, the handoff is integrated, and the assigned main checkout is clean. Never reset, overwrite, force-push, or force-clean dirty, unpushed, failing, or under-review work.
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
- Interpret “pull regularly” as reconciling local `main` with `origin/main`; fetching without incorporation is insufficient.
- Require every independently testable substep to be committed directly to local `main` and pushed to `origin/main` before the next substep.
- Reject every feature-branch, worktree, detached-HEAD, stash-lane, and branch-finishing instruction.
- Require living-authority changes to update every relevant downstream worker document through its owner before affected work continues.
- Require every new or modified worker specification to synchronize every
  affected product specification masterplan in the same planning substep, or to
  record an evidence-backed no-impact finding.
- Route stable decisions/evidence through `living-masterplan`; keep transient work in plans/status.
- State the fallback when subagents or requested model settings are unavailable.
