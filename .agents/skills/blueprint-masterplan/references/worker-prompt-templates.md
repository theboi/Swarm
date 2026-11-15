# Worker Prompt Templates

## EdenMind swarm coordinator launch packets (conditional)

Use this adapter only when the frozen blueprint explicitly declares the
EdenMind swarm coordinator. Ordinary Blueprint Masterplan launch prompts remain
generic and continue to use the templates below.

The coordinator and reusable skill render the packet body from this one
canonical source map. Do not copy, fork, summarize, or independently edit the
packet body or its phase/shared-main instructions here.

| Packet | Canonical file |
| --- | --- |
| coordinator planning (never one launch per ordinary worker) | `templates/planning.md` |
| execution | `templates/execution.md` |
| ui | `templates/ui.md` |

Before rendering, the coordinator supplies these explicit metadata slots. They
are launch-envelope values; the canonical packet body remains the source for
phase behavior and worker instructions.

| Slot | Required value |
| --- | --- |
| Selected macOS account | One allowed account ID, distinct from the worker ID |
| Worker ID | The bounded Workers Masterplan work package ID |
| Model routing | Terra High / Terra Xhigh selection for execution; Sol High only for unexpected planning during execution |
| Coordinator chat name | Exact app-server chat name for the launch where the packet requires it |
| Phase terminal condition | The canonical packet's stopping boundary, recorded in the launch preview and handoff |
| Git mode | `coordinator_managed_same_mac_clones` or `independent_main_clone` |
| Same-Mac mutation lock | Exact lock name for serialized same-Mac clone mutation lifecycles |
| Independent-clone push queue | Exact queue/lock name used only for reconciliation, verification, push, and ancestry proof |
| Account runtime isolation | When the worker starts local client/API/Supabase/Docker/Colima, the fully substituted block from `account-local-runtime-isolation.md`; otherwise `not applicable` |

The envelope records that one loopback Codex app-server runs for the selected
account through `su - <account>`, never Codex desktop. An account may have
unlimited chats; the coordinator's global active-turn default is `3`. It also
records the fail-closed approval policy: automated approval needs positive
proof that every target is inside that account's EdenMind clone, while
ambiguous, destructive, home/system, cross-account, glob, symlink-sensitive,
or unproven requests require the exact method-compatible human decision and
never dangerous session approval. Public ngrok access is limited to
`10:00`–`00:00` `Asia/Singapore`; local access may continue outside that
window.

The reusable skill's parity verifier renders each source through the coordinator
and Blueprint Masterplan entry points, normalizes line endings/trailing
whitespace, and compares their bytes. It also proves that every rendered packet
contains its supplied phase terminal condition and the full direct-main
checkpoint sequence: focused check, owned-path staging, direct-main commit,
fetch/merge, affected-check rerun, push, and remote-reachability proof. The
coordinator adapter must not weaken or replace that lifecycle.

## Coordinator authoring and handoff assembly

The coordinator personally finishes all worker specifications and detailed
implementation plans before producing ordinary execution handoffs. Use
writing-plans for every plan, with real code/caller inspection and test-first
tasks. A brief or reserved destination is insufficient.

Publish the complete plan set, required approvals and initial consistency
checks in one coherent origin/main checkpoint (or several verified coordinator
checkpoints). Existing PLANNING_GATE.md can record this package's readiness;
it must not demand independent worker plans or a later reconciliation round.

Generate ordinary execution prompts only. Do not create per-worker planning
launches. A coordinator-only planning prompt may resume the SAME coordinator's
initial authoring work, covering all N plans.

Before rendering a packet:
- Substitute exact blueprint/spec/plan paths and reviewed remote commits.
- Name implementation ownership, exclusions and real implemented prerequisites.
- Name worker execution status and completion-manifest paths.
- Include the phase/shared-main blocks from SKILL.md for operative packets.
- Set actual checkout mode, lock/push queue and coherent checkpoint cadence.
- Use the user's approved model/effort; report any unavailable setting.
- Include runtime allocation from account-local-runtime-isolation.md only when
  application runtimes are needed; never borrow another account's stack.
- For live UI wiring, name accepted UI requirements and presentation handoff
  already incorporated into the coordinator's implementation plan.
- No worker-to-worker Codex chat, legacy adapters, alternate branches/worktrees,
  silent fallbacks, shared runtime resets or inferred paid-call authority.

## Coordinator-only planning continuation

You are the coordinator for <blueprint-id>. Personally complete the shared
specification and ALL <N> worker specifications and detailed implementation
plans under the blueprint's common artifact roots. Do not dispatch planning
workers or planning subagents. Inspect real code, callers, tests and authorities;
freeze exact contracts, one mutable owner per shared surface, real dependencies,
test-first steps and verification commands. Check the full set together NOW,
including prompt/schema producer cycles. Obtain only genuinely required new
decisions, preserving existing approvals. Publish complete plans and any
plan-readiness receipt to origin/main with remote proof. Then provide execution
handoffs. No worker planning/reconciliation round follows this continuation.

## Ordinary execution worker prompt

Repository authority map:
- Blueprint and shared design: <paths>
- Coordinator-authored specification: <spec-path and commit>
- Coordinator-authored detailed implementation plan: <plan-path and commit>
- Coordinator plan-set receipt, when used: <path and reviewed commit>
- Relevant living authorities: <paths>
- Actual implemented prerequisites: <IDs/commits/evidence, or none>
- Accepted UI requirements / presentation handoff: <paths, or not applicable>
- Worker status: docs/workers/<blueprint-id>/status/<worker-id>.md
- Completion manifest: docs/workers/<blueprint-id>/completion-manifest/<worker-id>.json
- Coordinator status: docs/workers/<blueprint-id>/STATUS.md

You are <worker-id>, implementing <bounded outcome>. Your plan is already
written by the coordinator. Read it and verify current code/prerequisites, then
execute its applicable tasks; do not author a separate specification or plan,
start a planning pass, or wait for other workers' planning handoffs.

Work directly on main in <assigned normal checkout> using <checkout mode>.
Verify supplied plan/approval and required implemented prerequisites are
reachable from origin/main. Planned interfaces are not implemented authority.
Acquire <exclusive mutation lock> for shared-checkout edits/Git through remote
proof; permitted independent clones use <push queue> for reconcile/check/push/
proof without global edit serialization. Preserve all unrelated changes.
Stage owned paths only. No branches/worktrees/stash/reset/clean/rebase/force-push.

Owned surfaces: <exact paths/contracts>.
Excluded surfaces: <exact paths/contracts>.
Terminal condition: all applicable supplied-plan tasks implemented, reviewed,
tested, integrated and handed off, with no owned dirt and unrelated work intact.

When blocked by a routine decision, use the recommended option within the approved scope. Take over upstream work only when inspected evidence proves that its attempt ended without a concrete required deliverable; complete and verify only that bounded prerequisite, then resume your assignment. Never take over active or uncertain work.

Recovery is only for a concrete prerequisite after inspected evidence proves
the upstream implementation attempt ended without it. Complete that bounded
scope under its existing plan, tests and integration rules, then resume.
Do not overwrite active/uncertain work or invent policy.

Old MVP2 and earlier Markdown documents are HARD LOCKED unless I explicitly tell you to modify them. At no point should you modify them or suggest modifying them.

This hard lock overrides authority-sync and recovery suggestions. In this
pre-production repository update code and all callers/tests/fixtures directly;
remove obsolete paths without legacy shims, duplicate implementations or
unnecessary fallback behavior.

Use applicable executing-plans, TDD, review and verification skills. Prioritize
implementation and tests. A real new contract problem is recorded in owned
status for a bounded coordinator plan correction; routine approved work does
not restart whole-project planning. Do not message peer workers through Codex.

After every coherent independently testable substep run focused checks, stage
owned files, commit main, fetch/merge newer origin/main, rerun affected checks,
push, fetch and prove ancestry before proceeding. On rejected push safely
merge/check/retry. After all owned tasks finish, run the final full owned suite,
close review, publish status/manifest, prove remote ancestry and owned cleanliness.

Report exact implementation commits, checks/review, downstream unblocks,
migration/index/runtime actions and genuine limitations. No model-quality,
live-runtime or release claims from synthetic tests or document checks.
