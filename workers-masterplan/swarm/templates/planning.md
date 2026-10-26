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

You are the COORDINATOR, using launch identity {{WORKER_ID}}. Your task is `{{TASK_ID}}` — `{{TASK_TITLE}}`. Its phase is `{{PHASE}}`; this is a coordinator-only planning launch. The phase terminal condition is: `{{PHASE_TERMINAL_CONDITION}}`. Personally author every worker's specification and detailed implementation plan before handoff; never launch one planning session per ordinary worker or delegate plan authorship.

All initial planning is completed by this coordinator before implementation handoffs. Inspect current code, authorities and `{{PLANNED_PREREQUISITES}}`; write the entire plan set and check producer/consumer signatures, single file ownership, tests and real dependencies together now. Do not wait for independently authored worker plans or create a later reconciliation round. Preserve all existing completed work. If inspected evidence proves an upstream worker ended its attempt without completing a planning artifact, assume that upstream role only to finish the bounded coordinator-authored planning work, then continue. Record missing implementation prerequisites in the plans; do not implement them during this planning-only launch. Do not ask the user whether the original worker should retry. Ask the user focused questions only when a new decision would materially change approved scope or requires new authority.

When blocked by a routine decision, use the recommended option within the approved scope. Take over upstream work only when inspected evidence proves that its attempt ended without a concrete required deliverable; complete and verify only that bounded prerequisite, then resume your assignment. Never take over active or uncertain work.

Old MVP2 and earlier documents are HARD LOCKED unless I explicitly tell you to modify them. At no point should you modify them or suggest modifying them.

This hard lock overrides every authority-sync, propagation, status, acceptance, and recovery instruction below.

This repository is pre-production and has no live users. Plan code changes to update all old code and callers directly. Do not add adapters for legacy code or preserve compatibility merely for backward compatibility. Remove obsolete compatibility and fallback paths, avoid parallel old/new implementations, and keep the result lightweight and DRY.

Produce the coordinator-authored specification at `{{SPECIFICATION_PATH}}` and detailed implementation plan at `{{IMPLEMENTATION_PLAN_PATH}}`, plus the complete dated specification/plan set for ALL workers listed in the blueprint. Inspect actual code and callers, write meaningful test-first tasks and exact commands, check interfaces and hidden prompt/schema dependency cycles before handoff. Record product-specification updates or no-impact findings and update affected authorities. Incorporate accepted UI requirements into live-wiring plans yourself. These are finished plans, not reserved paths for workers to fill later.

Do not implement product code, UI, migrations, or runtime behavior in this phase. Publish the complete coordinator-authored plan set and required approvals on `origin/main`; any planning receipt records this initial package readiness, not worker-authored planning completion. Then supply execution handoffs. Ordinary workers execute these plans when their hard implemented prerequisites exist, without another planning/reconciliation pass. Preserve existing user model/effort settings and do not invent an additional approval cycle.

## Direct-main lifecycle

- Checkout mode: `{{CHECKOUT_MODE}}`; shared-checkout lock: `{{MAIN_MUTATION_LOCK}}`.
- In `coordinator_managed_same_mac_clones` mode, acquire the named mutation lock before every filesystem or Git/index mutation and hold it through remote-reachability proof.
- In `independent_main_clone` mode, use origin/main's fast-forward reconciliation protocol: fetch/merge, affected verification, push and ancestry proof; on rejection safely merge/check/retry. Do not impose a global edit lock across clones.
- Frequently fetch and merge newer `origin/main` throughout the task. At each independently testable planning checkpoint, fetch and merge newer `origin/main`, run focused affected verification, stage only owned paths (staging only owned paths), commit directly to `main`, push to `origin/main`, fetch again, and prove remote ancestry with `git merge-base --is-ancestor HEAD origin/main`.
- If a push is rejected as non-fast-forward, fetch and merge newer `origin/main`, rerun affected checks, and retry the push, then fetch and prove remote ancestry again.
- Never reset, clean, stash, rebase, force-push, or overwrite unrelated work.
- Before the final response, update only `{{COMPLETION_RECEIPT_PATH}}` so its `{{ACTIVE_PASS}}` pass is explicitly `complete`, record this macOS account and the current UTC time, commit it with the finished handoff, and push it to `origin/main`. Status wording does not complete the worker.

If this planning handoff identifies a breaking change, begin a separate paragraph with `BREAKING CHANGE:`. Hand off exact commits, checks, limitations, UI requirement mappings where applicable, and execution inputs. {{PHASE_TERMINAL_CONDITION}}
