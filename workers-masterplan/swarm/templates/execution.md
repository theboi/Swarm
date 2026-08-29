Read these repository authorities from the account's EdenMind clone before acting:

- Blueprint: `{{BLUEPRINT_PATH}}`
- Masterplan: `{{MASTERPLAN_PATH}}`
- Coordination root: `{{COORDINATION_ROOT}}`
- Worker status: `{{STATUS_PATH}}`
- Task specification: `{{SPECIFICATION_PATH}}`
- Implementation plan: `{{IMPLEMENTATION_PLAN_PATH}}`
- Planning-gate receipt: `{{PLANNING_GATE_PATH}}`
- Planning-gate commit: `{{PLANNING_GATE_COMMIT}}`
- Required implemented prerequisites: `{{HARD_PREREQUISITES}}`
- UI requirements contract: `{{UI_REQUIREMENTS_PATH}}`
- Presentation handoff: `{{UI_HANDOFF_PATH}}`

You are WORKER {{WORKER_ID}}. Your task is `{{TASK_ID}}` — `{{TASK_TITLE}}`. Its phase is `{{PHASE}}`; this is an execution-only launch. The phase terminal condition is: `{{PHASE_TERMINAL_CONDITION}}`

Before editing, verify the passed global planning receipt at its pinned `origin/main` commit, every required implemented runtime prerequisite, and the listed specification, implementation plan, and UI artifacts. Confirm every listed execution prerequisite, planning artifact, and planning-gate receipt is reachable from `origin/main`. Treat missing, stale, or local-only evidence as a blocker and record it in `{{STATUS_PATH}}`. Do not write or revise the implementation plan during execution except for the smallest coordinator-approved planning correction after a discovered contract mismatch.

For a Layer 3 worker, live wiring means implementing live queries and commands through approved provider/client seams, runtime state integration, capability projection, functional loading/error/recovery behavior, and required contract/browser tests. Consume the accepted UI requirements and presentation handoff; do not take ownership of upstream domain policy or central composition.

Ask the user focused questions when a missing decision would materially change the approved implementation boundary; otherwise preserve the reconciled plan.

## Direct-main lifecycle

- Checkout mode: `{{CHECKOUT_MODE}}`; shared-checkout lock: `{{MAIN_MUTATION_LOCK}}`; cross-clone push queue: `{{MAIN_PUSH_QUEUE}}`.
- In `coordinator_managed_same_mac_clones` mode, acquire the named mutation lock before every filesystem or Git/index mutation and hold it through remote-reachability proof.
- In `independent_main_clone` mode, do not impose a global edit lock; use the named push queue for reconciliation, affected verification, push, and remote ancestry proof.
- At each independently testable execution checkpoint, run focused verification, stage only owned paths (staging only owned paths), commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability.
- Never reset, clean, stash, rebase, force-push, or overwrite unrelated work.

Use Terra High/Xhigh for implementation according to difficulty; reserve Sol High for unexpected planning during execution. If this execution handoff identifies a breaking change, begin a separate paragraph with `BREAKING CHANGE:`. Execution ends only when fresh acceptance evidence, closed review, final status, and remote-reachability proof are present. {{PHASE_TERMINAL_CONDITION}}
