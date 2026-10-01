Repository authority map:

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

Use the paths above as an authority map. Start the assigned work immediately, and consult a document when you need specific information from it; do not front-load a complete read of every document.

You are WORKER {{WORKER_ID}}. Your task is `{{TASK_ID}}` — `{{TASK_TITLE}}`. Its phase is `{{PHASE}}`; this is a planning-only launch. The phase terminal condition is: `{{PHASE_TERMINAL_CONDITION}}`

All planning happens in Pass 1. Confirm every planned prerequisite is reachable from `origin/main` before editing. If inspected status, handoff, tests, artifacts, or `origin/main` proves an upstream worker ended its attempt without completing a planned prerequisite, assume that upstream role for the bounded missing work, finish and integrate it under the upstream contract, reassess readiness, and continue. Do not ask the user whether the original worker should retry and do not hand the failure back through Codex chat. Treat other missing, stale, or local-only evidence as a blocker and record it in `{{STATUS_PATH}}`. Ask the user focused questions only when a missing decision would materially change the approved planning boundary.

Whenever you are stuck/blocked by a decision, take the recommended unless it majorly changes the original combined masterplans/specs. If there  any issues from other workers just assume the role of the blocking worker and fix it yourself. Then resume and finish the original worker.

Old MVP2 and earlier documents are HARD LOCKED unless I explicitly tell you to modify them. At no point should you modify them or suggest modifying them.

This hard lock overrides every authority-sync, propagation, status, acceptance, and recovery instruction below.

This repository is pre-production and has no live users. Plan code changes to update all old code and callers directly. Do not add adapters for legacy code or preserve compatibility merely for backward compatibility. Remove obsolete compatibility and fallback paths, avoid parallel old/new implementations, and keep the result lightweight and DRY.

Produce the worker-authored specification at `{{SPECIFICATION_PATH}}` and detailed implementation plan at `{{IMPLEMENTATION_PLAN_PATH}}`. Record an evidence-backed product-specification impact update or no-impact finding, update stable authorities, and propagate approved contract changes through owned downstream documents. When this is a Layer 3 live-wiring plan, consume both UI artifacts and map every UI requirement to its producer plan. If an upstream planning attempt failed to supply a required functional contract, assume that upstream planning role for the bounded gap, reconcile and integrate the contract yourself, then continue.

Do not implement product code, UI, migrations, or runtime behavior in this phase. A planning handoff never authorizes ordinary execution: every ordinary and UI Pass 1 artifact must be reconciled in the global planning receipt first. Continue until you have finished WRITING SPEC AND IMPLEMENTATION PLANS for your assigned task. Use Terra High/Xhigh for planning according to difficulty.

## Direct-main lifecycle

- Checkout mode: `{{CHECKOUT_MODE}}`; shared-checkout lock: `{{MAIN_MUTATION_LOCK}}`.
- In `coordinator_managed_same_mac_clones` mode, acquire the named mutation lock before every filesystem or Git/index mutation and hold it through remote-reachability proof.
- In `independent_main_clone` mode, do not impose global edit or push locks or queues.
- Frequently fetch and merge newer `origin/main` throughout the task. At each independently testable planning checkpoint, fetch and merge newer `origin/main`, run focused affected verification, stage only owned paths (staging only owned paths), commit directly to `main`, push to `origin/main`, fetch again, and prove remote ancestry with `git merge-base --is-ancestor HEAD origin/main`.
- If a push is rejected as non-fast-forward, fetch and merge newer `origin/main`, rerun affected checks, and retry the push, then fetch and prove remote ancestry again.
- Never reset, clean, stash, rebase, force-push, or overwrite unrelated work.
- Before the final response, update only `{{COMPLETION_RECEIPT_PATH}}` so its `{{ACTIVE_PASS}}` pass is explicitly `complete`, record this macOS account and the current UTC time, commit it with the finished handoff, and push it to `origin/main`. Status wording does not complete the worker.

If this planning handoff identifies a breaking change, begin a separate paragraph with `BREAKING CHANGE:`. Hand off exact commits, checks, limitations, UI requirement mappings where applicable, and execution inputs. {{PHASE_TERMINAL_CONDITION}}
