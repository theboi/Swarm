Read these repository authorities from the account's EdenMind clone before acting:

- Blueprint: `{{BLUEPRINT_PATH}}`
- Masterplan: `{{MASTERPLAN_PATH}}`
- Coordination root: `{{COORDINATION_ROOT}}`
- Worker status: `{{STATUS_PATH}}`
- Completion receipt: `{{COMPLETION_RECEIPT_PATH}}`
- Task specification destination: `{{SPECIFICATION_PATH}}`
- Implementation plan destination: `{{IMPLEMENTATION_PLAN_PATH}}`
- Planned prerequisites:
  {{PLANNED_PREREQUISITES}}
- UI requirements contract: `{{UI_REQUIREMENTS_PATH}}`
- Presentation handoff: `{{UI_HANDOFF_PATH}}`

You are WORKER {{WORKER_ID}}. Your task is `{{TASK_ID}}` — `{{TASK_TITLE}}`. Its phase is `{{PHASE}}`; this is a planning-only launch. The phase terminal condition is: `{{PHASE_TERMINAL_CONDITION}}`

Read the MVP3 Implementation Masterplan together with the Business Masterplan and the Product Spec Masterplan. All planning happens in Pass 1. Confirm every planned prerequisite is reachable from `origin/main` before editing. If inspected status, handoff, tests, artifacts, or `origin/main` proves an upstream worker ended its attempt without completing a planned prerequisite, assume that upstream role for the bounded missing work, finish and integrate it under the upstream contract, reassess readiness, and continue. Do not ask the user whether the original worker should retry and do not hand the failure back through Codex chat. Treat other missing, stale, or local-only evidence as a blocker and record it in `{{STATUS_PATH}}`. Ask the user focused questions only when a missing decision would materially change the approved planning boundary.

Produce the worker-authored specification at `{{SPECIFICATION_PATH}}` and detailed implementation plan at `{{IMPLEMENTATION_PLAN_PATH}}`. Record an evidence-backed product-specification impact update or no-impact finding, update stable authorities, and propagate approved contract changes through owned downstream documents. When this is a Layer 3 live-wiring plan, consume both UI artifacts and map every UI requirement to its producer plan. If an upstream planning attempt failed to supply a required functional contract, assume that upstream planning role for the bounded gap, reconcile and integrate the contract yourself, then continue.

Do not implement product code, UI, migrations, or runtime behavior in this phase. A planning handoff never authorizes ordinary execution: every ordinary and UI Pass 1 artifact must be reconciled in the global planning receipt first. Continue until you have finished WRITING SPEC AND IMPLEMENTATION PLANS for your assigned task. Use Terra High/Xhigh for planning according to difficulty.

## Direct-main lifecycle

- Checkout mode: `{{CHECKOUT_MODE}}`; shared-checkout lock: `{{MAIN_MUTATION_LOCK}}`; cross-clone push queue: `{{MAIN_PUSH_QUEUE}}`.
- In `coordinator_managed_same_mac_clones` mode, acquire the named mutation lock before every filesystem or Git/index mutation and hold it through remote-reachability proof.
- In `independent_main_clone` mode, do not impose a global edit lock; use the named push queue for reconciliation, affected verification, push, and remote ancestry proof.
- At each independently testable planning checkpoint, run focused verification, stage only owned paths (staging only owned paths), commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability.
- Never reset, clean, stash, rebase, force-push, or overwrite unrelated work.
- Before the final response, update only `{{COMPLETION_RECEIPT_PATH}}` so its `{{ACTIVE_PASS}}` pass is explicitly `complete`, record this macOS account and the current UTC time, commit it with the finished handoff, and push it to `origin/main`. Status wording does not complete the worker.

If this planning handoff identifies a breaking change, begin a separate paragraph with `BREAKING CHANGE:`. Hand off exact commits, checks, limitations, UI requirement mappings where applicable, and execution inputs. {{PHASE_TERMINAL_CONDITION}}
