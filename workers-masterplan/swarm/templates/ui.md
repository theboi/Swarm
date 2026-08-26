# UI design worker launch packet

You are worker `{{WORKER_ID}}` assigned to macOS account `{{ACCOUNT_ID}}`.
An account is not a worker: this account may have many chats, but this chat
owns only the presentation task `{{TASK_ID}}` — `{{TASK_TITLE}}`. Work through
the assigned Codex app-server chat; do not use Codex desktop for this account.

Read `{{BLUEPRINT_PATH}}`, `{{MASTERPLAN_PATH}}`, `{{STATUS_PATH}}`, the live
application surface, and the established design system before editing.

**Mandatory pre-edit source-read checklist** — do not abbreviate:
- [ ] Completely read `claude-design/codex/AGENTS.md`.
- [ ] Completely read `claude-design/codex/system-prompt.md`.
- [ ] Completely read every relevant procedure under `claude-design/codex/skills/`.
- [ ] Completely read `.agents/skills/better-ui/SKILL.md`.

Reuse `/components/ui` and the existing tokens/components; do not create a
competing component library.

This is phase `{{PHASE}}`. The phase terminal condition is:
`{{PHASE_TERMINAL_CONDITION}}`

Your presentation-only owned surfaces are:

`{{OWNED_SURFACES}}`

Do not modify functional surfaces outside that boundary:

`{{EXCLUDED_SURFACES}}`

Do not change APIs, authorization, persistence, migrations, domain logic,
scoring, or processing. Return any required functional decision to planning and
record it in `{{STATUS_PATH}}`.

Work directly on `main` in `{{EDENMIND_CLONE_PATH}}`; do not create feature
branches or linked worktrees. Preserve unrelated changes. The selected Git mode
is `{{CHECKOUT_MODE}}`; its same-Mac mutation lock is
`{{MAIN_MUTATION_LOCK}}`, and its independent-clone push queue is
`{{MAIN_PUSH_QUEUE}}`. In `coordinator_managed_same_mac_clones` mode, acquire
the named mutation lock before every filesystem or Git/index mutation and hold
it through browser or focused verification, staging only owned paths, commit,
fetch and merge newer `origin/main`, rerun affected checks, push, and prove
remote reachability. In `independent_main_clone` mode, do not impose a global
edit lock; use the named push queue only for reconciliation, affected
verification, push, and remote-ancestry proof. Never reset, clean, stash,
rebase, force-push, or overwrite unrelated work.

Do not write a separate implementation plan for this draft. Edit the live
application presentation directly. Start `{{DEV_SERVER_COMMAND}}`,
publish the local preview URL for review, and verify responsive, keyboard/focus,
reduced-motion, and relevant interaction states. At each coherent design
checkpoint, run the focused check, update `{{STATUS_PATH}}`, stage only owned
paths, commit directly to `main`, fetch and merge newer `origin/main`, rerun
affected checks, push, and prove remote reachability before continuing.

Stop at Claudio's review boundary. The handoff must identify the accepted
app-state commit, reviewed URL, verified states, affected presentation
surfaces, reused design foundations, limitations, returned functional decisions,
and ownership transfer. Do not proceed to implementation beyond the approved
presentation handoff.
