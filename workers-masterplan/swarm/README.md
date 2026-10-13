# EdenMind Swarm Coordinator

The coordinator is a local-first operations tool for supervising Codex
app-server chats across the local `claudiothe` account and logical bot profiles
such as `bot1/acc1` and `bot1/acc2`. Open it locally at
[http://localhost:4310](http://localhost:4310), or through this Mac's
Tailscale address. The development listener binds to all interfaces by default.
Codex app-server runs directly for `claudiothe`; each bot profile runs through
`su` with its own credential home and the bot's shared checkout. Automated bot operation remains
headless. Desktop compatibility is an operator-only, bot1-only canary step.

## Prerequisites

- macOS, with the coordinator run from the `claudiothe` account and local
  accounts `bot1` through `bot8` available to `su`.
- Node.js 20 or later and npm.
- Codex Desktop installed. `SWARM_CODEX_BIN` must point to its bundled Codex
  runtime (`/Applications/ChatGPT.app/Contents/Resources/codex`) so Desktop and
  Swarm use the same thread database, rollout format, and model cache schema.
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

`SWARM_HOST` defaults to `0.0.0.0` and `SWARM_PORT` defaults to `4310`. The
terminal controller uses the next port (`4311` by default) for the signed-in
dashboard's **Open Terminal** action. A browser session remains valid for 30 days of
inactivity before another password-and-TOTP login is required.

### Profile slots and sign-in

Swarm keeps a non-secret profile registry at `.data/account-profiles.json`.
The registry is the source of truth for logical IDs and contains no passwords,
OAuth tokens, `auth.json` contents, device codes, login IDs, or app-server
capability tokens. `botN/acc1` is the initial profile for each bot; later
profiles have isolated credential paths and share the bot's one main checkout:

```text
/Users/botN/.swarm/codex-profiles/accX
/Users/botN/Dev/EdenMind
```

In Accounts, select **Add account** for a bot. Swarm provisions the isolated
slot, then starts a ten-minute, in-memory device-code challenge. Open the
displayed verification page in the intended operator browser and enter the
displayed code. The fallback **Use browser sign-in** is available only from a
loopback dashboard request on the same Mac. Swarm exposes only a non-secret
email, workspace, or plan label after completion, and it rejects an identity
already connected to another profile.

Use the profile-aware repair command only for an existing secondary slot:

```sh
npm run profiles:setup -- --account bot1/acc2
```

It recreates only the owned, isolated paths and prints a profile-scoped manual
login command. It does not repair `acc1`, migrate a bot, or delete profiles.

**Primary** describes the profile selected by the managed `~/.codex` symlink
for a bot. **Make Primary** is an atomic symlink transaction: it refuses while
ChatGPT or Codex Desktop is running for that bot, refuses an unmanaged
`~/.codex`, verifies the replacement, and rolls back on failure. It affects
Desktop compatibility only; every app-server keeps using its profile's own
`CODEX_HOME`.

The only approved live migration sequence for this release is a separately
authorized bot1 canary. Its read-only preflight command is:

```sh
npm run profiles:migrate -- --bot bot1 --dry-run
```

Do not run `--apply`, sign in, or test Desktop until a new explicit canary
authorization has been recorded. `bot2` through `bot8` are outside that canary.

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

Completion is repository-authoritative under
`docs/workers/2026-08-14-mvp3/completion-manifest/`. Each worker owns one
lower-case task receipt and marks `planning` and `execution` independently.
The coordinator pulls these receipts and never infers completion from phrases
in a status document or chat response. Because receipts are split by task,
workers can finish concurrently without editing one shared state file.

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
or a bot account. It requires the coordinator HTTP/WebSocket composition
runtime; until that runtime is present, the command stops with a clear Task 5
dependency message rather than substituting a test-only web application.

## Operating model

There is no global active-turn limit. Every macOS account can own and run
multiple chats subject only to that account's own Codex usage limits.

### Dashboard routes

- `/home` is the launch and readiness dashboard.
- `/accounts` shows connection, authentication, Git, and usage state.
- `/flowchart` shows the active task graph and its auto-pilot switch.
- `/chats` is the multi-account chat workspace.
- `/chats?open=docs/path/file.md` opens a repository Markdown file in the
  Chats reader; the file path is URL encoded in links.

Browser Back, Forward, and refresh preserve the selected screen. The Markdown
reader is closed when a route no longer contains `open`.

### Auto-pilot and account moves

Auto-pilot dispatches only to connected, authenticated bot accounts with zero
unarchived chats. It refreshes task receipts and account thread lists before
each run, rechecks every candidate immediately before launch, and resumes a
rate-limited turn on its original account. Only completion receipts on
`origin/main` prove task completion. A receipt-proven auto-pilot chat is
archived after completion; an approval problem, a completion problem, or an
uncertain receipt leaves the chat unarchived for review.

**Move to another account** creates a new target chat with the exact source
rollout JSONL attached. It does not require the source account to be connected,
authenticated, under its usage limit, or able to push Git changes. The original
chat remains on its source account; its cached metadata and local rollout file
are sufficient for the continuation.

Each logical account runs one loopback-only Codex app-server. `claudiothe`
starts the CLI directly with its existing local Codex profile; each bot profile
starts through `su`, receives its password through Swarm's pseudo-terminal,
injects only that slot's `CODEX_HOME`, and keeps its per-launch capability token
in memory. The canary Desktop probe is manual and must be performed only after
the explicit authorization described above.

The first Accounts card is the full `claudiothe` Codex account. The local
workspace Git status remains a separate information card. Every minute Swarm
deterministically pulls `origin/main` in the local checkout and each configured
bot's shared checkout. A merge conflict raises one warning and steers the affected bot
once to resolve it. Before a usage-limit stop, Swarm attempts a Git checkpoint;
a failed checkpoint is surfaced for manual resolution but does not block a
JSONL-based account move.

If an account needs Codex authentication, sign in manually from the coordinator
account using the displayed account-specific command. For example, when the
configured CLI is at its default path:

```sh
/opt/homebrew/bin/codex login                    # claudiothe
/usr/bin/su - bot3 -c '/opt/homebrew/bin/codex login'
```

After that command succeeds, Swarm rechecks the account automatically with
bounded retry backoff. **Refresh usage** on Home or Accounts forces an immediate
recheck. Do not add a CLI or desktop fallback to the coordinator.

**Open Terminal** is available to a signed-in dashboard opened through
localhost or one of this Mac's local/Tailscale addresses. Its separate control
port accepts only those explicit origins.

### PTY diagnostic runbook

Use this after reconnects or a failed account launch to confirm that PTYs are
not accumulating:

```sh
SWARM_PID=$(lsof -nP -iTCP:4310 -sTCP:LISTEN -t | head -1)
lsof -nP -p "$SWARM_PID" | awk '/\/dev\/ptmx$/ { masters++ } /\/dev\/ttys[^ ]*$/ { slaves++ } /\(revoked\)$/ { revoked++ } END { print "masters:", masters + 0, "slaves:", slaves + 0, "revoked:", revoked + 0 }'
```

Masters should stay near the number of connected accounts. The parent should
retain no slaves or revoked descriptors, including after failed reconnects,
private rollout reads, and Git helpers. These helpers create temporary PTYs;
their count is unrelated to the number of chats. Chat archival uses Codex's
`thread/archive` request; the account connection remains available for other
chats. `npm install` patches and rebuilds node-pty to close temporary descriptors
and exit-monitor queues on macOS. Run `node scripts/prepare-node-pty.mjs` when
repairing an existing installation, then restart the service so it loads the
rebuilt native module. Rebuild and restart only the Swarm LaunchAgent before
rechecking if the deployed bundle predates the current source:

```sh
npm run build
launchctl kickstart -k "gui/$UID/com.edenmind.swarm"
```

On an open dashboard, Swarm refreshes authenticated account usage once a
minute. The Accounts sidebar also offers **Refresh usage** for an immediate
manual usage and authentication refresh.

Contained approvals that can be positively proven to stay inside the assigned
EdenMind clone auto-continue. Ambiguous, dangerous, destructive, or
cross-account requests wait for a method-compatible human decision. A dangerous
action never receives an approve-for-session option.

## Smoke check for a real account

The opt-in smoke check uses the real app-server, never Codex Desktop. Bots run
through `su`; `claudiothe` runs directly. A registered logical profile may be
selected explicitly:

```sh
SWARM_SMOKE_ACCOUNT=bot3 npm run smoke:app-server
# after the profile exists in the local registry:
SWARM_SMOKE_ACCOUNT=bot1/acc2 npm run smoke:app-server
# or: SWARM_SMOKE_ACCOUNT=claudiothe npm run smoke:app-server
```

It clearly skips unless `SWARM_SMOKE_ACCOUNT` is set to `claudiothe`, one of
the legacy bot IDs, or a registered logical profile; bot checks also require
their matching `SWARM_USERn=botn:password` local credential. The default
metadata-only flow verifies that a missing
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
terminates child app-servers, and exits within ten seconds.
