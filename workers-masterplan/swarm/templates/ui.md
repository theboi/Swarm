Read these repository authorities from the account's EdenMind clone before acting:

- Blueprint: `{{BLUEPRINT_PATH}}`
- Masterplan: `{{MASTERPLAN_PATH}}`
- Coordination root: `{{COORDINATION_ROOT}}`
- Worker status: `{{STATUS_PATH}}`
- Task specification: `{{SPECIFICATION_PATH}}`
- Implementation plan: `{{IMPLEMENTATION_PLAN_PATH}}`

You are WORKER {{WORKER_ID}}. Your task is `{{TASK_ID}}` — `{{TASK_TITLE}}`. Its phase is `{{PHASE}}`; this is a UI-only launch. The phase terminal condition is: `{{PHASE_TERMINAL_CONDITION}}`

Confirm every listed UI prerequisite is reachable from `origin/main` before editing. Treat any missing, stale, or local-only evidence as a blocker and report it through the worker status rather than guessing.

Read {{SPECIFICATION_PATH}}. Use the claude-design skill and better-ui skill. Read the MVP3 Implementation Masterplan together with the Business Masterplan and the Product Spec Masterplan. Constantly commit, push to main and pull changes from main regularly. No need to plan, code out a draft and display it on localhost, and the user will say which parts require changing. Use the reusable UI components in /components/ui where possible.

At each coherent UI checkpoint, run the focused check, stage only owned paths, commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability before continuing. Update `{{STATUS_PATH}}` with the inspected `origin/main` commit, decisions, prerequisites, verification, and remote-reachability proof.

If this UI handoff identifies a breaking change, begin a separate paragraph with `BREAKING CHANGE:` so the coordinator can flag it for review.

Hand off exact commits, checks, limitations, and presentation inputs, then stop.
