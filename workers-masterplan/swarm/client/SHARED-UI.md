# Shared UI inventory

Swarm consumes Eden sources through `src/components`, `src/lib`, `src/eden-theme`
and `public/fonts`. These links resolve through the top-level `edenmind` anchor.

| Surface | Shared owner |
| --- | --- |
| Actions, submit, toolbar icons | EdenButton, EdenIcon |
| Login, task forms, chat rename | EdenField |
| Main/subagent composers and task prompts | EdenTextArea |
| Model, effort, speed, permissions and bot choices | EdenDropdown |
| Account, task, login and transcript surfaces | EdenCard |
| Account handoff choices | EdenRadioCardGroup |
| File reader, subagent, rename, handoff, profile sign-in | useEdenModal |
| Success/error notifications | useEdenToast |
| Typography, colors, focus and busy states | Eden theme/reset/Radix bridge |

Buttons use compact geometry for dense operator work, with one primary action
per group. Cards use the shared default non-floating surface. Layout stays with
Swarm; shared primitives retain their boundaries, radii, padding and states.

Potential additions to Eden for product-owner review:

- A usage-window meter supporting overlapping short/long quota windows,
  unavailable values, exhaustion, and accessible remaining/reset labels. Swarm's
  AccountUsageBar and RateLimitBar currently own this behavior.
- A transcript/turn disclosure surface supporting commentary, tools, steers,
  final answers, activity and history windowing. Swarm owns these semantics;
  promote them only if Eden's report/chat experiences need the same behavior.

Existing primitives already cover the remaining controls. No new shared control
API was introduced; the icon registry gained canonical Swarm activity glyphs.
