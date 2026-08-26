# EdenMind Swarm Coordinator

The coordinator is a local-first operations tool for supervising Codex
app-server chats across `bot1` through `bot8`. Open it locally at
[http://127.0.0.1:4310](http://127.0.0.1:4310). It is not a bot-account
desktop application: each app-server is launched through `su`, and Codex
Desktop must never be launched for a bot account.

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

Create the web-login password hash without placing a password in shell history:

```sh
read -r -s SWARM_SETUP_PASSWORD
printf '%s' "$SWARM_SETUP_PASSWORD" | npm run auth:hash
unset SWARM_SETUP_PASSWORD
```

Copy the command output into `SWARM_LOGIN_PASSWORD_HASH` in `.env`. Generate a
new TOTP secret and provisioning URI for the configured coordinator email:

```sh
SWARM_LOGIN_EMAIL='operator@example.com' npm run auth:totp
```

Copy the generated `SWARM_TOTP_SECRET` locally into `.env`, then add a strong
local `SWARM_SESSION_SECRET` and the required `BOT1_PASSWORD` through
`BOT8_PASSWORD` values. These values never belong in Git, a URL, browser state,
or a log.

`manifests/mvp3.json` is the production default. It intentionally maps no
workers until an authoritative MVP3 Blueprint Masterplan is imported, so the
coordinator reports `MASTERPLAN_NOT_READY` and offers no launch control.
`manifests/example-ready.json` is a fixture-only ready graph for tests; never
select it as the production manifest.

## Run and verify

```sh
npm run dev
npm run build
npm run start
npm test
npm run typecheck
npm run test:e2e
```

The normal browser harness uses deterministic fake app-server data for all
eight accounts. It does not need real bot passwords, a Codex network session,
a bot account, or ngrok. It requires the coordinator HTTP/WebSocket composition
runtime; until that runtime is present, the command stops with a clear Task 5
dependency message rather than substituting a test-only web application.

## Operating model

The default global active-turn concurrency is `3`. This controls dispatches,
not chat storage: every macOS account can own unlimited chats.

Each account runs one loopback-only Codex app-server through `su`. The
coordinator supplies the password through its pseudo-terminal and keeps the
per-launch capability token in memory. Use the CLI app-server path only; do
not open Codex Desktop under a bot account.

If an account needs Codex authentication, sign in manually from the coordinator
account using the displayed account-specific command. For example, when the
configured CLI is at its default path:

```sh
/usr/bin/su - bot3 -c '/opt/homebrew/bin/codex login'
```

After that command succeeds, retry the account connection. Do not add a CLI or
desktop fallback to the coordinator.

ngrok is optional. When enabled, the coordinator may run it only from 10:00
until 00:00 in `Asia/Singapore`; local access remains available outside that
window. The coordinator does not offer an early or outside-window start.

Contained approvals that can be positively proven to stay inside the assigned
EdenMind clone auto-continue. Ambiguous, dangerous, destructive, or
cross-account requests wait for a method-compatible human decision. A dangerous
action never receives an approve-for-session option.

## Smoke check for a real bot account

The opt-in smoke check uses `su` and the real app-server, never Codex Desktop:

```sh
SWARM_SMOKE_ACCOUNT=bot3 npm run smoke:app-server
```

It clearly skips unless `SWARM_SMOKE_ACCOUNT` and the matching local password
are available. The default metadata-only flow verifies that a missing
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

Durable coordinator state is local under `.data/` and is ignored by Git. The
structured logger writes to the process standard output; redirect output to a
local file under `.data/` if retention is needed. On `SIGINT` or `SIGTERM`, the
coordinator stops accepting launches, closes browser sockets, flushes state,
terminates managed ngrok and child app-servers, and exits within ten seconds.
