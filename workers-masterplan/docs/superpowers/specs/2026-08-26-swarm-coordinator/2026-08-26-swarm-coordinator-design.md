# EdenMind Swarm Coordinator Design

**Status:** Approved for implementation

**Decision owner:** Claudio

**Implementation owner:** Swarm coordinator delivery worker

**Date:** 2026-08-26

## 1. Purpose

Build a local-first web application under `workers-masterplan/swarm` that lets
Claudio supervise Codex workers running under the macOS accounts `bot1` through
`bot8` on one Mac mini. Claudio runs the coordinator from the `claudiothe`
account. Each macOS account retains its own Codex authentication, Codex home,
EdenMind clone, Git identity, rate limits, and thread history.

The coordinator is the operating surface for the MVP3 Workers Masterplan. It
does not implement EdenMind customer-facing product behavior and does not alter
the EdenMind Business or Product Spec Masterplans.

## 2. Terminology

- A **macOS account** is one local user account, such as `bot3`, with one Codex
  login and one EdenMind clone.
- A **worker** is a Workers Masterplan work package such as `T0`, `U1`, or `I0`.
- A **chat** is a Codex app-server thread. One worker usually has one primary
  chat, but a macOS account may own any number of chats and a worker may gain
  additional chats when Claudio requests them.
- An **active turn** is a currently running Codex turn. The coordinator defaults
  to three active turns globally. Claudio may change that limit at runtime.

The UI and API must never use “worker” as a synonym for a macOS account.

## 3. Approved operating model

### 3.1 Account isolation

The coordinator launches exactly one Codex app-server process per connected
macOS account. The process runs as that account through:

```text
su - <account> -c "codex app-server --listen ws://127.0.0.1:<port>"
```

The parent process allocates a pseudo-terminal through macOS `/usr/bin/script`
so `su` can request a password. The account password is injected only into that
pseudo-terminal. It is never passed as a command-line argument, returned to the
browser, persisted in coordinator state, or written to logs.

The app-server listens on a unique loopback-only WebSocket port and requires a
fresh per-launch capability token. The coordinator supplies only the token's
SHA-256 digest through `--ws-auth capability-token --ws-token-sha256 <digest>`;
the plaintext token stays in coordinator memory, is presented only on the
loopback WebSocket handshake as `Authorization: Bearer <token>`, and is
destroyed when the process exits. Missing and incorrect tokens must be rejected
with HTTP 401 before upgrade.
App-server JSON-RPC never travels through the pseudo-terminal. The coordinator
connects to the loopback WebSocket, initializes the protocol, and owns
reconnection. A loopback peer without the launch token is unauthorized.

There is no terminal-CLI fallback in this release. If app-server startup or
Codex authentication fails, the account becomes `action_required` and the UI
offers the exact terminal command Claudio can run after logging into that macOS
account manually.

### 3.2 Codex protocol baseline

Implementation targets the installed `codex-cli 0.146.0` app-server v2
protocol. The integration uses these stable boundaries:

- `initialize`, followed by the required client `initialized` notification;
- `account/read` for Codex authentication state and Codex-home discovery;
- `account/rateLimits/read` and `account/rateLimits/updated` for capacity;
- `thread/list`, `thread/read`, `thread/start`, `thread/resume`,
  `thread/archive`, and `thread/name/set` for chats;
- `turn/start`, `turn/steer`, and `turn/interrupt` for control;
- item, turn, error, and output-delta notifications for live transcripts;
- method-specific command/file/permissions approval requests and responses for
  safety decisions; and
- `fs/readFile` for Markdown files inside an account's EdenMind clone.

The server wraps protocol payloads behind coordinator-owned TypeScript types so
a Codex CLI upgrade changes one adapter rather than the web application.

### 3.3 Git and repository behavior

Each macOS account works only in its own `~/Dev/EdenMind` clone on `main`.
Workers continuously fetch, fast-forward when safe, commit coherent checkpoints,
reconcile newer `origin/main`, push, and prove remote reachability as required by
the Workers Masterplan skill.

The coordinator does not silently reset, stash, clean, rebase, force-push, or
rewrite any clone. It may display Git command events already present in a Codex
thread and may launch prompts that require the shared-main lifecycle. Git
mutation remains the worker's visible Codex work.

## 4. System architecture

```text
Authenticated browser
        |
        | HTTPS through scheduled ngrok or local HTTP
        v
Coordinator HTTP/WebSocket server (claudiothe)
        |-- auth/session service
        |-- account registry and su launcher
        |-- app-server JSON-RPC adapters
        |-- scheduler and rate-limit recovery
        |-- task graph/masterplan loader
        |-- approval safety policy
        |-- durable local state/event journal
        |-- ngrok daily-window controller
        |
        +--> bot1 app-server on loopback
        +--> bot2 app-server on loopback
        +--> ...
        +--> bot8 app-server on loopback
```

The browser never connects to account app-servers directly. It receives a
normalized coordinator snapshot over one authenticated WebSocket and sends
commands through authenticated HTTP endpoints.

## 5. Configuration and secrets

`workers-masterplan/swarm/.env` is local-only and ignored by Git. The committed
`.env.example` documents:

```text
SWARM_HOST=127.0.0.1
SWARM_PORT=4310
SWARM_TIMEZONE=Asia/Singapore
SWARM_LOGIN_EMAIL=
SWARM_LOGIN_PASSWORD_HASH=
SWARM_TOTP_SECRET=
SWARM_SESSION_SECRET=
SWARM_DEFAULT_CONCURRENCY=3
SWARM_MASTERPLAN_PATH=
SWARM_COORDINATION_ROOT=
SWARM_CODEX_BIN=/opt/homebrew/bin/codex
SWARM_NGROK_ENABLED=true
SWARM_NGROK_BIN=ngrok
SWARM_NGROK_AUTHTOKEN=
SWARM_NGROK_DOMAIN=
SWARM_NGROK_START=10:00
SWARM_NGROK_STOP=00:00
BOT1_PASSWORD=
...
BOT8_PASSWORD=
```

The web login password is stored as a scrypt hash, not plaintext. The eight
local `su` passwords remain environment values because `su` requires the
original secret. Logs redact all configured secrets and common authorization
headers. Startup refuses a secrets file readable by group or others and reports
the required `chmod 600` remediation without echoing secret values.

Durable state lives under `workers-masterplan/swarm/.data/` by default and is
ignored by Git. Writes are atomic. State contains task/chat/account mappings,
queued launches, approval requests, the latest normalized rate-limit snapshots,
and ngrok schedule state; it contains no account passwords, web password, TOTP
secret, session secret, or Codex tokens.

## 6. Authentication and remote access

### 6.1 Web authentication

The only web user signs in with the configured email, password, and a six-digit
TOTP code. Authentication has two steps and issues a signed, HTTP-only,
SameSite=Strict session cookie only after both succeed.

Login attempts are rate-limited independently by normalized email and source
address, with bounded backoff. A forwarded source address is trusted only when
the direct socket peer is loopback and trusted-proxy mode is explicitly enabled
for the managed ngrok process. Authentication responses do not reveal whether
email, password, or TOTP was wrong. Password challenges expire, are single-use,
and cannot be completed by replaying a TOTP. Sessions are durable across restart
but expire after twelve hours of inactivity; every use atomically advances the
idle deadline.

All state-changing requests require a valid same-origin `Origin` header and an
authenticated session. WebSocket upgrades use the same cookie validation.

### 6.2 Scheduled ngrok window

ngrok is available only from 10:00 until 00:00 each day in
`Asia/Singapore`. “00:00” means the midnight ending that day's access window.

- At 10:00 the coordinator starts `ngrok http 127.0.0.1:<port>` when ngrok is
  enabled and not already healthy.
- At midnight it terminates the managed ngrok process and removes the public URL
  from the client snapshot.
- Outside the window the application remains reachable locally.
- After restart, the controller computes the current window: it starts ngrok
  immediately when inside the window and remains stopped otherwise.
- Clock jumps, process exits, and missed timers are reconciled by a one-minute
  schedule heartbeat.
- The UI shows `Public until 00:00`, `Public access starts at 10:00`, or an
  actionable ngrok error.
- Claudio may stop the managed tunnel early. This suppresses automatic restart
  until the next daily 10:00 boundary. The release does not offer a manual
  outside-window start.

The application never treats ngrok as an authentication layer. Web login and
TOTP remain mandatory on local and public URLs.

## 7. Task and worker model

### 7.1 Task manifest

The coordinator consumes one versioned JSON manifest selected by
`SWARM_MASTERPLAN_PATH` or discovered beside the active MVP3 Implementation
Masterplan. The manifest contains:

```ts
type TaskManifest = {
  blueprintId: string;
  title: string;
  masterplanPath: string;
  coordinationRoot: string;
  tasks: Array<{
    id: string;
    title: string;
    kind: "planning" | "execution" | "ui" | "gate";
    dependsOn: string[];
    statusPath?: string;
    specificationPath?: string;
    implementationPlanPath?: string;
    promptTemplate: "planning" | "execution" | "ui";
    preferredAccount?: string;
  }>;
};
```

The loader validates unique IDs, known dependencies, acyclicity, referenced
paths, and gate semantics. Invalid manifests are displayed as blocking errors;
the coordinator never guesses an execution order from malformed input.

The manifest is a frozen projection of an authoritative Blueprint Masterplan,
not a second planning authority. `masterplanPath`, `coordinationRoot`, every
worker status path, and every gate receipt path must resolve inside the
repository and match the blueprint ID. The readiness service parses the
authoritative blueprint/status/receipt formats, fetches `origin/main`, and
records the remote commit that supplies each piece of evidence. Local-only
claims never satisfy a dependency.

Task readiness is derived from literal phase predicates:

- planning requires every hard planned prerequisite to be remotely complete;
- the planning gate requires every planning worker's remotely reachable status,
  specification, implementation plan, and required authority-sync evidence;
- execution requires a passed gate receipt plus every hard implemented
  prerequisite named by the blueprint; and
- completion requires terminal status and remote-reachability evidence.

The repository currently has no frozen authoritative MVP3 Implementation
Masterplan. The committed seed manifest therefore reports
`MASTERPLAN_NOT_READY` and contains no launchable workers. The coordinator may
preview this blocked state but must not invent the MVP3 graph, infer work from
interim notes, or launch a worker until Claudio supplies the authoritative
blueprint and a validated projection is imported.

### 7.2 Prompt templates

The committed templates preserve Claudio's approved drafts and add exact paths,
phase prerequisites, account/worker terminology, app-server chat naming, and
the Workers Masterplan lifecycle.

Planning prompts terminate after the worker-authored specification,
product-spec synchronization or evidence-backed no-impact finding, detailed
implementation plan, authority updates, downstream propagation, status update,
and remote-reachability proof. They explicitly prohibit implementation.

Execution prompts verify the passed planning-gate receipt and hard implemented
prerequisites before editing. They require TDD, Terra High/Xhigh implementation
subagents based on difficulty, Sol High only for unexpected planning, frequent
coherent commits/pulls/pushes, review, focused checks, one final full-suite run,
and a final handoff.

UI prompts require Claude Design and Better UI, edit the live app presentation
only, reuse `/components/ui`, start a localhost preview, and stop at Claudio's
review boundary.

One canonical template source lives under `workers-masterplan/swarm/templates`.
The coordinator renderer and the reusable
`workers-masterplan/blueprint-masterplan` skill both reference that source; a
parity test prevents drift. The installed `.agents/skills/blueprint-masterplan`
path is a symlink to the same authority and is not edited as an independent
copy. Skill behavior is verified with pressure scenarios before and after the
edit.

## 8. Account scheduling and rate-limit recovery

The scheduler selects a macOS account only from accounts whose app-server is
connected, Codex account is authenticated, and reported rate limit is not
exhausted.

For every reported rate-limit bucket, remaining capacity is
`clamp(100 - usedPercent, 0, 100)`. Sparse updates merge by limit ID without
erasing unchanged buckets. Account score is the lowest known remaining
percentage across all current buckets, including the primary (normally
five-hour) and secondary (normally weekly) windows. Nullable or malformed
buckets make the account ineligible until refreshed rather than being treated
as unused. `resetsAt` is interpreted as Unix seconds. Accounts with more
remaining capacity rank first; ties prefer fewer active turns and then the
oldest last-assigned timestamp.

The global active-turn limit defaults to three. It is a dispatch limit, not an
account chat limit. Claudio can explicitly launch another chat on any account
even when that account already has chats; a launch that would exceed global
concurrency requires an explicit override in the request.

Every launch is a durable outbox record with a stable random
`clientUserMessageId` and one of `queued`, `submitting`, `accepted`,
`waiting_for_limit`, `completed`, `failed`, or `attention_required`. State is
flushed before sending. On startup or adapter reconnect, any `submitting` record
is reconciled with `thread/read` (including turns) and the stable client message
ID before another send is allowed. A matching turn moves the record to
`accepted`. Every recovered `submitting` record without a match is still
ambiguous because app-server may materialize it later, so it becomes
`attention_required` and is never automatically retried. Claudio may explicitly
abandon it and create a new dispatch after inspecting the thread. Only records
that never reached `submitting` dispatch automatically. This makes the crash
windows before send, after send, before acknowledgement, and after
acknowledgement non-duplicating.

When app-server reports exhaustion:

1. the affected durable outbox record becomes `waiting_for_limit`;
2. if `resetsAt` is known, retry is scheduled just after that timestamp;
3. if no reset time is known, the coordinator schedules a deterministic jittered
   heartbeat between forty and eighty minutes;
4. the heartbeat refreshes `account/rateLimits/read` and resumes only when the
   account is available; and
5. restart recovery reconstructs these timers from durable state and runs the
   outbox reconciliation above before resubmission.

The UI shows both windows, percentage remaining, reset time, and whether the
next check came from a known reset or fallback heartbeat.

## 9. Safety and approvals

The coordinator automatically accepts an app-server approval request only when
the structured request positively proves that every target is confined to the
assigned account's EdenMind clone and the requested decision is offered by the
protocol. Unknown, ambiguous, or unparseable requests fail closed into Claudio's
attention queue. This includes compound shell strings, unresolved globs,
symlink-sensitive paths, interpreter-generated commands, and broad tools such
as `find -delete` when exact containment cannot be proven.

Clearly dangerous includes:

- recursive deletion or destructive overwrite of `/`, `/Users`, a home
  directory, or another macOS account's files;
- deletion or replacement of operating-system, shell, SSH, Git, Codex, package
  manager, login, or security configuration outside the assigned EdenMind clone;
- disk formatting, partitioning, account deletion, permission takeover, or
  equivalent destructive administration; and
- an app-server file-write grant outside the assigned account's EdenMind clone.

The classifier is conservative about the target, not the command name alone.
For example, deleting a generated directory inside the assigned clone can be
ordinary only after realpath containment is proven; `rm -rf /Users/bot4` is
dangerous. A human-required request appears in the chat and Home attention queue
with only the actions valid for that exact protocol method and its
`availableDecisions`, plus Cancel turn when supported. Command, file, and
permissions requests use their method-specific response schema; permissions
responses include the explicit granted permission set and scope rather than a
generic string. There is no “approve dangerous actions for session” control.

Every approval decision is journaled with request method, protocol request ID,
account, thread, turn, item, normalized target set, containment proof or failure
reason, redacted request summary, offered decisions, chosen response, actor,
timestamp, and send outcome. Unknown server requests receive a safe
method-appropriate refusal when possible and always create a human-visible
diagnostic; they are never left hanging indefinitely.

Coordinator-created or resumed work never inherits a bot's permissive local
defaults. `thread/start` and `thread/resume` pin the canonical clone `cwd`,
`approvalPolicy: "untrusted"`, `approvalsReviewer: "user"`, and
`sandbox: "workspace-write"`; the echoed thread settings must match. Every
`turn/start` repeats those controls and supplies `sandboxPolicy.workspaceWrite`
with exactly one writable root—the assigned `/Users/<account>/Dev/EdenMind`
clone—plus network access for required Git synchronization and temporary-path
exclusions. `danger-full-access` and `approvalPolicy: "never"` are forbidden.
If app-server cannot confirm the effective cwd/settings, launch fails closed.
Approval classification is a second guard, not the only sandbox boundary.

## 10. Web experience

The accepted interface uses Cordial dark mode by default. It has a labeled left
rail on desktop, an icon rail on tablet, and fixed bottom navigation on mobile.
All primary controls are at least 44 by 44 CSS pixels, keyboard reachable, and
have visible focus states. Reduced-motion preferences disable nonessential
transition and graph animation.

### 10.1 Home

Home is a compact operating cockpit:

- global active, ready, blocked/attention, and push-queue state;
- active work rows with macOS account, worker ID, task, phase, and live state;
- account cards with connection/auth state and five-hour/weekly remaining
  capacity;
- next-ready task and suggested account;
- pending dangerous approvals and action-required account logins; and
- ngrok schedule/public URL state.

Home launches a ready worker through a review dialog that shows prompt, phase,
dependencies, selected account, concurrency impact, and Launch.

### 10.2 Flowchart

Desktop and mobile render the same dependency graph. The graph supports pan,
pinch/wheel zoom, fit-to-view, filters, keyboard node selection, and visible
ready/blocked/running/complete states.

Desktop may keep a side inspector. On mobile, selecting a node opens a contained
overlay with worker/task details, dependencies, readiness evidence, suggested
account, and `Open chat`. There is no alternate mobile dependency-list view and
no separate expand mode.

### 10.3 Chats

Chats are grouped by macOS account and preserve the exact app-server thread
history, including user/assistant messages, plans, reasoning summaries when
available, tool calls, terminal output, file changes, subagent activity,
approvals, warnings, errors, and turn status.

The selected desktop account reveals its chats in the sidebar. On tablet/mobile,
account pills replace the sidebar. The selected account's chat dropdown remains
hidden until Claudio clicks the already-selected account pill; clicking it again
closes the dropdown.

Chat controls include send, steer, interrupt, archive, open terminal command,
new chat, and approval responses when applicable. Controls are enabled only
when the app-server reports the corresponding thread/turn capability.

Markdown preview is not a permanent pane or tab. A path recognized as a
Markdown file (`.md` or `.markdown`) is rendered as a link in the transcript.
Selecting it asks that account's app-server to read the file, validates the path
is within the account's EdenMind clone, sanitizes rendered Markdown, and opens a
document viewer with the filename and a visible Close button. Closing returns to
the exact prior chat scroll position.

## 11. HTTP and WebSocket contracts

The server exposes versioned `/api/v1` routes for:

- authentication challenge, TOTP completion, session status, and logout;
- coordinator snapshot and settings;
- account connect/disconnect/retry and rate-limit refresh;
- task manifest validation, launch preview, launch, and queued-work cancellation;
- account thread list/read/start/archive;
- turn start/steer/interrupt;
- approval decisions;
- safe Markdown file reads; and
- ngrok status and early stop.

Every response uses `{ data }` or `{ error: { code, message, details? } }`.
Expected operational failures return stable codes such as
`ACCOUNT_AUTH_REQUIRED`, `ACCOUNT_OFFLINE`, `TASK_NOT_READY`,
`GLOBAL_CONCURRENCY_REACHED`, `RATE_LIMIT_WAIT`, `DANGEROUS_APPROVAL_REQUIRED`,
`HUMAN_APPROVAL_REQUIRED`, `MASTERPLAN_NOT_READY`, and
`FILE_OUTSIDE_WORKSPACE`.

The authenticated browser WebSocket sends a full normalized snapshot after
connection and ordered incremental events thereafter. Every event contains a
monotonic coordinator sequence number. A client detecting a gap requests a new
snapshot rather than applying uncertain state.

## 12. Reliability and observability

- Account launch allowlists only `bot1` through `bot8`, resolves a configured
  Codex binary, verifies the account Codex home, allocates ports by binding the
  OS rather than guessing, places children in a managed process group, and uses
  bounded exponential reconnect with a visible terminal state after repeated
  authentication failure.
- App-server request IDs are unique per account connection and all pending
  requests reject on disconnect.
- Initial history is loaded with `thread/read` including turns; pagination,
  ordering, sparse deltas, reconnect replay, and every v2 `ThreadItem` variant
  are preserved. Transcript reducers are idempotent by account, thread, turn,
  and item ID, and retain unknown items as safe opaque records instead of
  silently dropping them.
- Durable writes are atomic and corrupt state is quarantined with a visible
  recovery error rather than overwritten.
- One shared structured logger/redactor includes component, account, thread,
  event, duration, and
  outcome while redacting secrets and transcript content by default.
- `/api/v1/health` uses one versioned response contract and reports server,
  state store, readiness evidence, outbox, scheduler, ngrok controller, and
  account adapter health without exposing secrets.
- Graceful shutdown stops accepting launches, closes browser sockets, flushes
  state, terminates managed ngrok and child launchers, and exits within ten
  seconds.

## 13. Testing strategy

Implementation follows red-green-refactor. Required coverage includes:

- unit tests for configuration, dual-key login throttling, expiring single-use
  challenges, scrypt/TOTP/session authentication, task DAG and authoritative
  evidence validation, scheduler scoring/sparse rate-limit merging and jitter,
  safety classification, redaction,
  app-server JSON-RPC framing/reconnection, transcript reduction, path
  containment, and ngrok window calculations;
- server integration tests with fake app-server WebSockets for capability-token
  rejection, initialize/initialized/account-read, account launch, sparse and
  multi-bucket rate-limit updates, exhaustive thread history/streaming,
  method-specific auto/manual approvals, file reads, disconnect recovery,
  outbox crash windows, and API authorization;
- UI component tests for the three tabs, responsive navigation, hidden chat
  picker, exact transcript items, Markdown link viewer/Close, node overlay/Open
  chat, rate-limit states, login/TOTP, and accessibility semantics;
- end-to-end browser tests at 1440px desktop, 768px tablet, and 390px mobile
  viewports against fake accounts, including graph filters/accessibility,
  chat-scroll restoration, archive/new-chat/send/steer/interrupt capability
  gating, and computed 44px primary targets;
- a macOS smoke test that launches a real bot3 app-server through `su` using a
  local ignored environment file, rejects a connection without its capability
  token, initializes and reads account/rate-limit/thread metadata, and, only
  when `SWARM_SMOKE_START_TURN=true`, starts a disposable no-tools turn that
  must answer `SMOKE_OK`, then archives it and disconnects without changing the
  repository; and
- skill pressure scenarios proving the worker launch contract includes the
  approved phase prompts, model routing, main synchronization cadence, and
  planning-gate boundary.

## 14. Acceptance requirements

The implementation is accepted when:

1. `npm test`, typecheck, production build, and browser end-to-end tests pass
   from `workers-masterplan/swarm`.
2. A fake eight-account test demonstrates default concurrency three plus an
   explicit override, best-capacity account selection, unlimited chats,
   sparse/multi-bucket rate limits, known-reset resume, forty-to-eighty-minute
   unknown-reset heartbeat behavior, and non-duplicating crash recovery.
3. Authentication rejects missing/invalid password or TOTP and protects HTTP
   and WebSocket state.
4. ngrok is started only inside 10:00–00:00 Asia/Singapore, stopped at midnight,
   and correctly reconciled after restart.
5. A real opt-in bot3 smoke test proves capability-token enforcement and that
   the `su` launcher can initialize app-server, verify `account/read`, and read
   rate-limit/thread metadata without Codex desktop. A second explicitly gated
   smoke proves a disposable harmless turn can complete.
6. Home, Flowchart, and Chats match the approved compact dark responsive
   interaction contract at desktop and mobile sizes.
7. A transcript Markdown link opens a sanitized document viewer and Close
   returns to chat; no permanent Markdown tab or pane exists.
8. Positively contained repository approvals continue automatically while
   ambiguous, destructive home/system, or cross-account actions wait for an
   exact method-compatible human response.
9. Until the authoritative MVP3 blueprint exists, the UI and API show
   `MASTERPLAN_NOT_READY` and expose zero launchable workers.
9. The worker-masterplan skill mirror and launch templates pass their pressure
   scenarios and remain byte-identical between `workers-masterplan` and
   `.agents/skills`.
10. The README provides first-run password-hash/TOTP setup, `.env` creation,
    start/build/test commands, ngrok prerequisites, macOS account diagnostics,
    and the exact local URL.

## 15. Product-specification impact finding

`docs/plans/EdenMind_Product_Spec_Masterplan.md` has no product-specification
impact from this design. The coordinator is a local delivery-operations tool;
it adds no EdenMind end-user route, API, domain record, authorization policy,
stored customer data, model behavior, or customer-visible reliability promise.
The stable reusable changes belong to `workers-masterplan/blueprint-masterplan`
and this dated coordinator specification.

## 16. Explicit exclusions

- Windows or Linux account switching.
- Running the Codex desktop app in bot accounts.
- A terminal-CLI fallback when app-server is unavailable.
- Automatic creation of macOS users, Codex logins, Git credentials, or ngrok
  accounts.
- Cloud-hosted coordinator persistence or multi-operator roles.
- Starting ngrok outside the daily 10:00–00:00 Asia/Singapore window.
- Inferring or rewriting an MVP3 dependency graph from ambiguous prose.
- Silently bypassing a Workers Masterplan planning gate or hard dependency.
