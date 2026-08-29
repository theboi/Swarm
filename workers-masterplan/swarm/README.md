# EdenMind Swarm Coordinator

The coordinator is a local-first operations tool for supervising Codex
app-server chats across the local `claudiothe` account and `bot1` through
`bot8`. Open it locally at [http://127.0.0.1:4310](http://127.0.0.1:4310).
Codex app-server runs directly for `claudiothe`; each bot runs through `su`.
Codex Desktop must never be launched for a bot account.

## Prerequisites

- macOS, with the coordinator run from the `claudiothe` account and local
  accounts `bot1` through `bot8` available to `su`.
- Node.js 20 or later and npm.
- Codex CLI 0.146.0 with `codex app-server` available at the absolute path in
  `SWARM_CODEX_BIN`.
- ngrok only if scheduled public access is wanted. Configure its local token in
  `.env`; do not put it in source control.
- A completed Codex login in every account that will be connected.

Install the locked dependencies with `npm ci` from this directory.

## First-run configuration

Copy the example, then restrict the local secrets file before adding values:

```sh
cp .env.example .env
chmod 600 .env
```

Create the web-login password hash without placing a password in shell history.
In zsh, use this one line, then copy its output into
`SWARM_LOGIN_PASSWORD_HASH` in `.env`:

```sh
read -r -s 'SWARM_SETUP_PASSWORD?Swarm password: '; echo; printf '%s' "$SWARM_SETUP_PASSWORD" | npm run auth:hash; unset SWARM_SETUP_PASSWORD
```

TOTP (time-based one-time password) is the second login factor. An
authenticator app generates a short code from a private TOTP secret; the code
changes regularly. Generate a new secret and provisioning URI for the
coordinator email:

```sh
SWARM_LOGIN_EMAIL='operator@example.com' npm run auth:totp
```

Scan the provisioning URI with an authenticator app, then copy the generated
`SWARM_TOTP_SECRET` into `.env`. The session secret is a separate random,
server-only value that protects browser login sessions from forgery. Generate
one locally and copy the output into `SWARM_SESSION_SECRET`:

```sh
openssl rand -hex 32
```

Bot credentials use matching account slots such as `SWARM_USER1=bot1:password`
through `SWARM_USER8=bot8:password`. Password hashes, TOTP secrets, session
secrets, and bot credentials never belong in Git, a URL, browser state, or a
log. A missing slot does not prevent the dashboard from starting: that bot
displays its authentication remediation until you add the matching local
credential.

`SWARM_PORT` defaults to `4310`. The loopback-only terminal controller always
uses the next port (`4311` by default) for the local dashboard's **Open
Terminal** action. A signed-in browser session remains valid for 30 days of
inactivity before another password-and-TOTP login is required.

`manifests/mvp3.json` is the production default. It is the 32-task **Pass 1**
projection of the approved MVP3 Blueprint Masterplan: 26 ordinary planning
workers across six four-step paths plus six UI-design workers. Optional `pathId`
and `pathStep` metadata control graph layout only; `dependsOn` remains the
scheduling authority. A UI-design task becomes planning-ready from its Layer 2
worker's approved specification, implementation plan, authority/no-impact
finding, and planning status on `origin/main`; it does not wait for Layer 2
implementation. It writes a separate UI requirements contract and presentation
handoff with fixture/mock-backed presentation only. Each existing Layer 3 worker
plans against both documents in Pass 1 and performs the live wiring in Pass 2.

`docs/workers/2026-08-14-mvp3/PLANNING_GATE.md` is one coordinator-owned global
receipt, not a 33rd dispatchable task. No execution projection is imported or
launchable while that receipt is open. After it passes, later execution
projections keep the existing IDs and still require their hard implemented
predecessors; planned evidence never substitutes for runtime implementation.

Worker-owned specification, implementation-plan, UI requirements, and
presentation-handoff destinations may be absent before their owner authors
them. The blueprint, coordination root, and worker status files must already
exist, and all paths remain repository-contained. `manifests/example-ready.json`
is a fixture-only graph for tests; never select it as the production manifest.

## Run and verify

```sh
npm run dev
npm run build
npm run start
npm test
npm run typecheck
npm run test:e2e
```

For the live local service, build first and install the checked-in LaunchAgent.
It keeps Swarm running independently of a terminal and restarts it after an
unexpected exit:

```sh
npm run build
mkdir -p "$HOME/Library/LaunchAgents"
cp ops/com.edenmind.swarm.plist "$HOME/Library/LaunchAgents/com.edenmind.swarm.plist"
launchctl bootout "gui/$UID/com.edenmind.swarm" 2>/dev/null || true
launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/com.edenmind.swarm.plist"
launchctl enable "gui/$UID/com.edenmind.swarm"
launchctl kickstart -k "gui/$UID/com.edenmind.swarm"
```

Inspect it with `launchctl print "gui/$UID/com.edenmind.swarm"`. Runtime logs
are retained in `.data/swarm.stdout.log` and `.data/swarm.stderr.log`.

The normal browser harness uses deterministic fake app-server data for all
nine accounts. It does not need real bot passwords, a Codex network session,
a bot account, or ngrok. It requires the coordinator HTTP/WebSocket composition
runtime; until that runtime is present, the command stops with a clear Task 5
dependency message rather than substituting a test-only web application.

## Operating model

The default global active-turn concurrency is `3`. This controls dispatches,
not chat storage: every macOS account can own unlimited chats.

Each account runs one loopback-only Codex app-server. `claudiothe` starts the
CLI directly with its existing local Codex profile; each bot starts through
`su`, receives its password through Swarm's pseudo-terminal, and keeps its
per-launch capability token in memory. Use the CLI app-server path only; do
not open Codex Desktop under a bot account.

The first Accounts card is the full `claudiothe` Codex account. The local
workspace Git status remains a separate information card. Every hour Swarm
deterministically runs a fast-forward-only pull in that local checkout, then
pushes `origin/main` from each configured bot checkout in `bot1` through
`bot8` order. A failed pull shows a warning on the workspace card; a failed
push shows one on the affected bot card. Swarm leaves the failure for an
operator or the owning worker to resolve and tries again at the next hourly
interval.

If an account needs Codex authentication, sign in manually from the coordinator
account using the displayed account-specific command. For example, when the
configured CLI is at its default path:

```sh
/opt/homebrew/bin/codex login                    # claudiothe
/usr/bin/su - bot3 -c '/opt/homebrew/bin/codex login'
```

After that command succeeds, retry the account connection. Do not add a CLI or
desktop fallback to the coordinator.

**Open Terminal** works only from the dashboard opened on this Mac at
`127.0.0.1` or `localhost`; it intentionally is unavailable through ngrok.
The control endpoint itself is on the separate loopback-only terminal port, so
a public dashboard session cannot open a Terminal window on the host.

ngrok is optional. When enabled, the coordinator may run it only from 10:00
until 00:00 in `Asia/Singapore`; local access remains available outside that
window. Set `SWARM_NGROK_URL` to a reserved hostname without `https://` and
Swarm starts `ngrok http --url=<hostname> 127.0.0.1:4310`. If automatic region
selection is blocked by local routing, set `SWARM_NGROK_REGION` (for example,
`ap`) to pin the agent connection. The coordinator does
not offer an early or outside-window start.

On an open dashboard, Swarm refreshes authenticated account usage once a
minute. The Accounts sidebar also offers **Refresh usage** for an immediate
manual refresh.

Contained approvals that can be positively proven to stay inside the assigned
EdenMind clone auto-continue. Ambiguous, dangerous, destructive, or
cross-account requests wait for a method-compatible human decision. A dangerous
action never receives an approve-for-session option.

## Smoke check for a real account

The opt-in smoke check uses the real app-server, never Codex Desktop. Bots run
through `su`; `claudiothe` runs directly:

```sh
SWARM_SMOKE_ACCOUNT=bot3 npm run smoke:app-server
# or: SWARM_SMOKE_ACCOUNT=claudiothe npm run smoke:app-server
```

It clearly skips unless `SWARM_SMOKE_ACCOUNT` is set to `claudiothe` or one of
the bots; bot checks also require their matching `SWARM_USERn=botn:password`
local credential. The default metadata-only flow verifies that a missing
capability token is rejected, then runs `initialize`, `initialized`,
`account/read`, rate-limit metadata, and paginated thread listing. It starts no
turn and always closes the child process. If authentication is expired, it
reports `ACCOUNT_AUTH_REQUIRED` and prints the exact manual login command.

Only after the metadata check succeeds may an operator opt in to one disposable
no-tools turn:

```sh
SWARM_SMOKE_ACCOUNT=bot3 SWARM_SMOKE_START_TURN=true npm run smoke:app-server
```

That flow requires `SMOKE_OK`, archives the disposable thread, and does not
modify the repository.

## Local state, logs, and shutdown

Durable coordinator state and the last successful account-usage windows are
local under `.data/` and ignored by Git. The LaunchAgent retains structured
process output in `.data/swarm.stdout.log` and `.data/swarm.stderr.log`. On
`SIGINT` or `SIGTERM`, the
coordinator stops accepting launches, closes browser sockets, flushes state,
terminates managed ngrok and child app-servers, and exits within ten seconds.
