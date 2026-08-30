# Account-Local Runtime Isolation

Read this reference completely when a worker will start, configure, stop,
reset, seed, or present an EdenMind client, API, Supabase, Docker, or Colima
runtime on the shared Mac.

## Trigger

`account_runtime_required` is true when a worker's planning, execution, test,
or presentation path needs any account-local application runtime. Separate
macOS accounts, clones, and Colima VMs do not isolate host-published TCP ports
or browser cookies.

When true, the blueprint brief and every applicable planning, execution, and
UI-design launch packet contain one substituted **Account-local runtime
isolation** block. Existing compatibility previews remain untouched until the
coordinator explicitly authorizes their cutover.

## Launcher availability and bootstrap authority

“Launcher” names the deterministic procedure in this document. It does not
mean that a repository wrapper script must already exist.

- Use a repository-provided account-isolated helper when one exists and
  satisfies this contract.
- If no helper exists, a worker whose brief already authorizes starting the
  account-local runtime may execute the procedure directly with explicit
  pinned-tool commands after completing the identity, path, namespace, and
  full-port preflight. This is an authorized deterministic bootstrap, not an
  ad hoc manual launch.
- A UI-design worker may start its required isolated review dependencies under
  that authority. It does not acquire ownership of shared launcher
  infrastructure merely because a convenience wrapper is absent.
- Record the exact redacted commands and effective names, paths, ports, and
  origins in the handoff so the procedure is reproducible.

A missing convenience wrapper alone is not a blocker. Block only when the
procedure cannot satisfy this contract—for example, the identity is unknown or
mismatched, an assigned port is occupied, the complete port inventory cannot
be derived, the pinned tool cannot scope the generated workdir/network, or an
operation would mutate tracked configuration or another runtime.

## Protected fixture-review client launch

Use this contract whenever a UI worker gives the user a protected fixture route
to review. A generic `npm run dev -- --fixture` launch is not review-ready: it
requires manual authentication and can consume a stale cookie issued by another
account's localhost runtime.

Before launch, verify that the current `origin/main` client supports
`--review-as` and configurable Supabase cookie names. Load the documented local
fixture password into the client server process from its ignored server-only
source without printing, persisting, or recording it. Then start from the
`edenmind-client` package directory with the fully substituted equivalent of:

```bash
export EDENMIND_AUTH_COOKIE_NAME=edenmind-auth-u<UID>
export NEXT_PUBLIC_EDENMIND_AUTH_COOKIE_NAME=edenmind-auth-u<UID>
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:<SUPABASE_API_PORT>
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<ACCOUNT_LOCAL_PUBLISHABLE_KEY>
export EDENMIND_SUPABASE_URL=http://127.0.0.1:<SUPABASE_API_PORT>
export EDENMIND_API_URL=http://127.0.0.1:<API_PORT>
npm run dev -- --fixture --review-as <FIXTURE_IDENTITY> \
  --hostname 127.0.0.1 --port <CLIENT_PORT>
```

Set the publishable-key value from the ignored account-local Supabase status
output without printing or recording it. The server and browser cookie variables
must be identical; for example, account UID `506` uses
`edenmind-auth-u506` for both. Do not fall back to `edenmind-auth-token` for an
account-local presentation.

Run sign-out evidence in an isolated canary context before the final
review-readiness canary. Do not globally revoke the shared review identity after
that final check. The final review-readiness canary starts with a cookie-free
browser context, opens the exact protected presentation URL, follows the local
fixture-review bootstrap back to that URL, proves visible presentation content
and API `/v1/me` success, and confirms that only the runtime-specific cookie
namespace was issued. Leave that authenticated review path and every required
process running. A final redirect to sign-in, a generic error page, or a canary
that signs out after this check is not a presentation handoff.

## Locked EdenMind allocation

Runtime identity follows the macOS account UID, not the worker ID:

```text
slot = UID - 500
offset = slot * 100
runtime ID = u<UID>
```

Only UIDs `502` through `510` are currently supported. Unknown accounts and
UID/account mismatches fail closed; never wrap, search for a free port, or pick
an ad hoc replacement.

| Account | UID | Slot | Client | API | Supabase API–Mailpit POP3 |
| --- | ---: | ---: | ---: | ---: | --- |
| `claudiothe` | 502 | 2 | 3200 | 8200 | 15631–15636 |
| `bot1` | 503 | 3 | 3300 | 8300 | 15731–15736 |
| `bot2` | 504 | 4 | 3400 | 8400 | 15831–15836 |
| `bot3` | 505 | 5 | 3500 | 8500 | 15931–15936 |
| `bot4` | 506 | 6 | 3600 | 8600 | 16031–16036 |
| `bot5` | 507 | 7 | 3700 | 8700 | 16131–16136 |
| `bot6` | 508 | 8 | 3800 | 8800 | 16231–16236 |
| `bot7` | 509 | 9 | 3900 | 8900 | 16331–16336 |
| `bot8` | 510 | 10 | 4000 | 9000 | 16431–16436 |

Apply the same offset to every host-exposed or locally invoked numeric port in
the tracked runtime templates. This includes the current Supabase database
shadow port `54320`, optional pooler port `54329`, and any enabled Realtime,
analytics, inspector, SMTP, test, or future service port. The six-port summary
does not authorize leaving another port shared.

## Required substituted block

**Account-local runtime isolation**

| Item | Required fact |
| --- | --- |
| Identity | Account `<ACCOUNT>` has validated UID `<UID>`, slot `<SLOT>`, offset `<OFFSET>`, and runtime ID `u<UID>`; the worker ID is not a runtime identity. |
| Ports | Client `<CLIENT_PORT>`, API `<API_PORT>`, Supabase `<SUPABASE_PORTS>`, and every other enabled numeric port equal the tracked template value plus `<OFFSET>`; no dynamic/free-port fallback is allowed. |
| Namespaces | Supabase project `edenmind-u<UID>`, Docker network `supabase_network_edenmind-u<UID>`, container/volume/cache names, ignored generated workdir, and auth cookie `edenmind-auth-u<UID>` are distinct for this runtime. |
| Configuration | Use an existing account-isolated helper or direct explicit pinned-tool commands; render the tracked `supabase/config.toml` into the ignored account-local workdir; use explicit workdir/network ID; propagate one coherent public Supabase origin, private server/API origin, API origin, Auth site/redirect allowlist, and cookie name. |
| Safety | Validate identity, paths, and every assigned port before mutation. A conflict fails before Docker/Supabase changes. Start, stop, seed, reset, and clean only the exact `u<UID>` namespace; never alter another account's runtime or an existing compatibility preview. |
| Readiness | Prove health at the exact Supabase/API/client endpoints, real fixture sign-in through this runtime's public Auth origin, matching API `/v1/me`, the matching protected route, same-runtime browser/server/proxy cookie equality, cross-runtime cookie inequality, and redacted sign-out evidence. For a protected fixture presentation, also pass the final cookie-free protected-route check above and leave it authenticated. A redirect or sign-in-page `200` is not readiness. |

Replace every placeholder with an exact value. A missing wrapper is not failure
to satisfy a row: use the authorized direct procedure above. If neither an
existing helper nor explicit pinned-tool commands can satisfy one row, mark the
runtime `blocked` and return the missing capability or contract to the
coordinator. Do not weaken the row or use another account's healthy service as
a substitute.

## Configuration and ownership rules

- Keep `supabase/config.toml` as the tracked source template. Generated config,
  keys, state, logs, and locks stay ignored and account-local.
- Use one effective value per environment setting. Do not rely on duplicate
  entries whose last value happens to win.
- Browser traffic uses the assigned public Supabase origin. Server,
  middleware, API, and worker traffic use the matching private Docker-network
  origin where available.
- Browser cookies are keyed by host/domain and path, not TCP port. Every runtime
  therefore needs a distinct cookie namespace, while browser, server, and
  middleware inside that runtime use the same name.
- Port `3000` is coordinator presentation ingress. Future workers bind their
  assigned client port. Do not move, stop, or reconfigure an existing direct
  port-`3000` compatibility preview until the coordinator authorizes cutover.
- A reset or shutdown command names only the validated runtime project,
  network, workdir, containers, and volumes. Broad Docker/Colima cleanup is
  outside worker ownership.

## Brief and launch-packet evidence

An affected worker brief names the validated account/UID, complete port and
namespace allocation, owned runtime resources, excluded current runtimes,
generated-workdir rule, exact canary, and failure owner. Applicable launch
packets reproduce the substituted block once before runtime commands.

The handoff records redacted effective origins, names, ports, health, canary
results, and the exact resources left running. It never records passwords,
keys, JWTs, refresh tokens, or cookie values.

## Common mistakes

| Mistake | Correction |
| --- | --- |
| Choose any currently free port | Derive the fixed UID allocation and fail on conflict. |
| Offset only `15431`–`15436` | Inventory and offset every enabled numeric runtime port, including shadow and optional services. |
| Reuse `edenmind-local` or one Docker network | Namespace project, network, containers, volumes, caches, and workdir with `u<UID>`. |
| Assume ports isolate cookies | Use a distinct runtime cookie name and prove same-runtime equality/cross-runtime inequality. |
| Launch protected review with generic `--fixture` | From `edenmind-client`, export both matching account cookie variables and use `--fixture --review-as <identity>`, then pass the final cookie-free protected-route check. |
| Edit tracked Supabase config locally | Render it into the ignored account-local workdir. |
| Treat a missing wrapper as a review blocker | Execute the deterministic procedure directly when the brief authorizes runtime operation; record the redacted commands. |
| Stop another stack to free a port | Report the collision; never mutate another account's runtime. |
| Treat health or a redirect as readiness | Run the real Auth → matching `/v1/me` → protected-route → sign-out canary, then run the final cookie-free protected-route check without signing out afterward. |
