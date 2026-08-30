Read these repository authorities from the account's EdenMind clone before acting:

- Blueprint: `{{BLUEPRINT_PATH}}`
- Masterplan: `{{MASTERPLAN_PATH}}`
- Coordination root: `{{COORDINATION_ROOT}}`
- Worker status: `{{STATUS_PATH}}`
- Upstream specification: `{{SPECIFICATION_PATH}}`
- Planned prerequisites:
  {{PLANNED_PREREQUISITES}}
- UI requirements contract destination: `{{UI_REQUIREMENTS_PATH}}`
- Presentation handoff destination: `{{UI_HANDOFF_PATH}}`

You are WORKER {{WORKER_ID}}. Your task is `{{TASK_ID}}` — `{{TASK_TITLE}}`. Its phase is `{{PHASE}}`; this is a UI-only launch. This is a UI-only Pass 1 launch. The phase terminal condition is: `{{PHASE_TERMINAL_CONDITION}}`

**Mandatory pre-edit source-read checklist** — do not abbreviate:
- [ ] Completely read `claude-design/codex/AGENTS.md`.
- [ ] Completely read `claude-design/codex/system-prompt.md`.
- [ ] Completely read every relevant procedure under `claude-design/codex/skills/`.
- [ ] Completely read `.agents/skills/better-ui/SKILL.md`.

Use the real application and existing design system to design only presentation and contents with explicit fixture/mock-backed state. Show the reviewed presentation through the established development server; preserve deterministic fixture scenarios for loading, empty, validation, success, failure, attention, and recovery states. Do not add or change live wiring, live APIs, authorization, persistence, migrations, domain rules, scoring, model behavior, background processing, or provider integration.

When the reviewed route is protected and uses fixture data, the established
review launcher must start from `edenmind-client`, export identical
account-specific `EDENMIND_AUTH_COOKIE_NAME` and
`NEXT_PUBLIC_EDENMIND_AUTH_COOKIE_NAME` values, and use
`--fixture --review-as <FIXTURE_IDENTITY>` rather than generic `--fixture`.
Complete sign-out evidence first. The last readiness action is a final
cookie-free protected-route check proving automatic bootstrap, API `/v1/me`,
visible presentation content, and the account cookie namespace; leave that
review route authenticated and keep its dependencies running.

Run the application and dependencies under a named account-owned process holder
independent of the worker's interactive command or chat session. A foreground
or yielded worker tool session is not a lifecycle holder. End the launch
command, then prove the holder, exact listeners, and protected route from a
separate command session. Record redacted holder inspection, restart, log, and
scoped shutdown commands in the worker status and handoff.

Confirm every listed UI prerequisite is reachable from `origin/main` before editing. Treat missing, stale, or local-only evidence as a blocker and record it in `{{STATUS_PATH}}`.

Write `{{UI_REQUIREMENTS_PATH}}` as a separate UI requirements contract with: authority and accepted presentation reference; surface inventory; actor/capability matrix; read and command requirements; async/lifecycle states; navigation/client state; files/exports; accessibility; deterministic fixture scenarios; planned-contract traceability; Pass 2 acceptance mapping; and open product decisions. Write `{{UI_HANDOFF_PATH}}` with the accepted app-state commit, user approval, reviewed states, affected presentation files, design foundations, limitations, and mutable ownership transfer to the named Layer 3 live-wiring consumer in the task brief. Do not embed the requirements contract only inside the handoff.

This UI design does not authorize ordinary execution. The named Layer 3 worker consumes both UI documents while planning and performs live wiring only in Pass 2 after the global planning receipt and implemented runtime prerequisites pass.

## Direct-main lifecycle

- Checkout mode: `{{CHECKOUT_MODE}}`; shared-checkout lock: `{{MAIN_MUTATION_LOCK}}`; cross-clone push queue: `{{MAIN_PUSH_QUEUE}}`.
- In `coordinator_managed_same_mac_clones` mode, acquire the named mutation lock before every filesystem or Git/index mutation and hold it through remote-reachability proof.
- In `independent_main_clone` mode, do not impose a global edit lock; use the named push queue for reconciliation, affected verification, push, and remote ancestry proof.
- At each independently testable UI checkpoint, run focused verification, stage only owned paths (staging only owned paths), commit directly to `main`, fetch and merge newer `origin/main`, rerun affected checks, push, and prove remote reachability.
- Never reset, clean, stash, rebase, force-push, or overwrite unrelated work.

If this UI handoff identifies a breaking change, begin a separate paragraph with `BREAKING CHANGE:`. UI design stops after the accepted presentation handoff and UI requirements contract are integrated on `origin/main`. {{PHASE_TERMINAL_CONDITION}}
