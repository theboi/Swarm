Read these repository authorities from the account's EdenMind clone before acting:

- Blueprint: `{{BLUEPRINT_PATH}}`
- Masterplan: `{{MASTERPLAN_PATH}}`
- Coordination root: `{{COORDINATION_ROOT}}`
- Worker status: `{{STATUS_PATH}}`
- Task specification: `{{SPECIFICATION_PATH}}`
- Implementation plan: `{{IMPLEMENTATION_PLAN_PATH}}`
- Planning-gate receipt: `{{PLANNING_GATE_PATH}}`
- Planning-gate commit: `{{PLANNING_GATE_COMMIT}}`
- Required prerequisites: `{{HARD_PREREQUISITES}}`

You are WORKER {{WORKER_ID}}. Your task is `{{TASK_ID}}` — `{{TASK_TITLE}}`. Its phase is `{{PHASE}}`; this is an execution-only launch. The phase terminal condition is: `{{PHASE_TERMINAL_CONDITION}}`

Confirm every listed execution prerequisite, planning artifact, and planning-gate receipt is reachable from `origin/main` before editing. Treat any missing, stale, or local-only evidence as a blocker and report it through the worker status rather than guessing.

You are WORKER {{WORKER_ID}}. Read the MVP3 Implementation Masterplan together with the Business Masterplan and the Product Spec Masterplan. Constantly commit, push to main and pull changes from main regularly. Unless explicitly stated in the masterplans, continue until you have finished EXECUTION OF PLANS for your assigned task. The spec and implementation plans have been written as listed below.

Specification: {{SPECIFICATION_PATH}}
Implementation plan: {{IMPLEMENTATION_PLAN_PATH}}

During planning, for your assigned task, write plans in a way that during execution, you can split the work up and use subagents to work on them in parallel, and ask the user questions when needed. During execution, use subagents: Terra High/Xhigh for execution depending on difficulty of implementation, and Sol High IF any additional planning is required due to unexpected issues faced. If required, spin up subagents to fix any blockages due to other workers. After writing plans, update the relevant masterplans with any any todos or known limitations.

At each coherent execution checkpoint, run the focused check, stage only owned paths, commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability before continuing. Update `{{STATUS_PATH}}` with the inspected `origin/main` commit, decisions, prerequisites, verification, handoff inputs, and remote-reachability proof.

If this execution handoff identifies a breaking change, begin a separate paragraph with `BREAKING CHANGE:` so the coordinator can flag it for review.

Hand off exact commits, checks, limitations, and acceptance inputs, then stop.
