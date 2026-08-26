# EdenMind Swarm Coordinator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure local-first web coordinator that supervises Codex app-server chats across macOS accounts `bot1`–`bot8`, schedules ready MVP3 workers, renders the approved responsive UI, and exposes the app through ngrok only from 10:00 until midnight Asia/Singapore.

**Architecture:** A Node/TypeScript server owns authentication, atomic state, authoritative task readiness, a crash-safe dispatch outbox, account scheduling, a PTY-backed `su` launcher, capability-token-protected loopback Codex app-server WebSocket adapters, fail-closed approval policy, browser WebSocket events, and the ngrok schedule. A React/Vite client consumes normalized coordinator contracts and implements Home, one shared pan/zoom Flowchart, and account-grouped exact Chats. The foundation is integrated first. Because this agent harness exposes one shared checkout and the Blueprint Masterplan requires an exclusive mutation lock, Terra implementation lanes run sequentially on canonical `main`; read-only protocol probes and reviews may run in parallel.

**Tech Stack:** Node.js 20+, TypeScript, Express, `ws`, React 19, Vite, `@xyflow/react`, React Markdown with GFM and sanitization, Vitest, Testing Library, Supertest, Playwright, npm.

**Spec:** `workers-masterplan/docs/superpowers/specs/2026-08-26-swarm-coordinator/2026-08-26-swarm-coordinator-design.md`

## Global Constraints

- Run from the `claudiothe` macOS account and connect to `bot1`–`bot8` only through `su - <account>` and Codex app-server; do not launch Codex desktop for bot accounts.
- Target installed `codex-cli 0.146.0` app-server v2 through loopback-only,
  per-launch capability-token-authenticated WebSockets.
- Keep all passwords, TOTP/session secrets, ngrok tokens, and Codex credentials out of Git, URLs, browser payloads, durable state, and logs.
- Use one app-server per macOS account; chats are unlimited and the default global active-turn concurrency is exactly `3`.
- Rank accounts by the lowest known remaining percentage across primary and secondary rate-limit windows; known reset timestamps beat fallback heartbeats, whose interval is always 40–80 minutes.
- ngrok may run only from `10:00` through `00:00` in `Asia/Singapore`; local access remains available outside that window.
- Auto-approve only positively proven clone-contained requests. Ambiguous,
  unknown, destructive home/system, or cross-account requests fail closed to a
  method-compatible human decision. Never provide approve-for-session for a
  dangerous action.
- Use the approved Cordial dark responsive shell: desktop left rail, tablet icon rail, mobile bottom navigation; one graph surface at every size; mobile node overlay; hidden selected-account chat dropdown; Markdown opens only from a transcript file link into a closable viewer.
- Maintain exact app-server transcript items and do not synthesize successful Git, rate-limit, approval, or worker state.
- All implementation follows red-green-refactor. Run focused tests for coherent checkpoints and one full suite after the complete owned scope.
- Work directly on canonical `main` as the user requested. Exactly one
  implementation agent may hold the shared-checkout mutation lock. The
  controller reviews and releases each lane, stages explicit paths, commits,
  pulls/reconciles, pushes, and proves ancestry before the next implementation
  lane begins. Parallel agents are limited to read-only probes/reviews.
- Preserve unrelated `.superpowers/` and `claude-design-system-prompt/` working-tree content; never clean, stash, reset, stage, or overwrite it.

## File and ownership map

| Surface | Responsibility | Execution owner |
| --- | --- | --- |
| `workers-masterplan/swarm/package.json`, lockfile, all TypeScript/Vite/Vitest/Playwright configs, `src/shared/**`, `src/test/setup.ts`, `templates/**`, package scripts | Build/test foundation, canonical prompts, and normalized contracts | Task 1 foundation |
| `src/server/config/**`, `auth/**`, `state/**`, `tasks/**`, `scheduler/**`, `dispatch/**`, `ngrok/**`, `logging/**`, focused tests | Server core without Codex transport | Task 2 Terra High |
| `src/server/codex/**`, `src/server/safety/**`, focused tests | `su`, app-server JSON-RPC, transcript, approvals, safe files | Task 3 Terra Xhigh |
| `src/client/**`, component tests | Accepted responsive presentation and client state | Task 4 Terra High |
| `src/server/http/**`, `src/server/realtime/**`, `src/server/app.ts`, `src/server/index.ts`, integration tests | Server composition and browser API | Task 5 Terra Xhigh |
| `workers-masterplan/blueprint-masterplan/**`, `workers-masterplan/evals/**` | Reusable skill reference, parity verifier, and pressure evidence | Task 6 Terra High |
| `tests/e2e/**`, `scripts/**`, README, `.env.example`, `manifests/**`, assets/licenses | End-to-end acceptance and operator handoff | Task 7 Terra Xhigh |

Sequential tasks never modify another row. `package.json`,
test setup, configs, and shared contracts are frozen after Task 1; later
dependency or script needs are reported to the controller and integrated
serially as a separate foundation amendment before the lane continues.

## Execution waves and model routing

| Wave | Tasks | Parallel rule | Model |
| --- | --- | --- | --- |
| Foundation | 1 | Sequential; freezes contracts/config | Terra High |
| Independent trades | 2, 3, 4 | Sequential mutation lock; read-only review may overlap | Task 2 Terra High, Task 3 Terra Xhigh, Task 4 Terra High |
| Composition | 5 and 6 | Sequential mutation lock | Task 5 Terra Xhigh, Task 6 Terra High |
| Acceptance | 7 | Sequential after Tasks 2–6 | Terra Xhigh |
| Unexpected planning | Only when implementation exposes a contract not settled by the spec | Produce a bounded ruling/plan amendment, then return execution | Sol High |
| Final review | Whole implementation and security/requirements audit | Independent reviewer | Sol High |

For every implementation lane the controller verifies canonical `main` and
`origin/main` ancestry, records the owned file list, grants the exclusive
mutation lock, and waits for the lane's RED/GREEN report. The lane makes no Git
or index mutations. The controller reviews the exact diff, reruns the focused
suite, commits, pulls/reconciles, pushes, proves ancestry, and only then grants
the lock to the next lane. Failed or overlapping work returns to its lane; it is
never force-applied.

### Task 1: Freeze project foundation and shared contracts

**Files:**
- Create: `workers-masterplan/swarm/package.json`
- Create: `workers-masterplan/swarm/package-lock.json`
- Create: `workers-masterplan/swarm/tsconfig.json`
- Create: `workers-masterplan/swarm/tsconfig.server.json`
- Create: `workers-masterplan/swarm/vite.config.ts`
- Create: `workers-masterplan/swarm/vitest.config.ts`
- Create: `workers-masterplan/swarm/playwright.config.ts`
- Create: `workers-masterplan/swarm/index.html`
- Create: `workers-masterplan/swarm/src/shared/contracts.ts`
- Create: `workers-masterplan/swarm/src/shared/errors.ts`
- Create: `workers-masterplan/swarm/src/shared/manifest.ts`
- Create: `workers-masterplan/swarm/src/test/setup.ts`
- Create: `workers-masterplan/swarm/src/shared/contracts.test.ts`
- Create: `workers-masterplan/swarm/templates/planning.md`
- Create: `workers-masterplan/swarm/templates/execution.md`
- Create: `workers-masterplan/swarm/templates/ui.md`

**Interfaces:**
- Produces: `AccountId`, `AccountSnapshot`, `RateLimitWindow`, `TaskManifest`, `TaskNode`, `TaskReadiness`, `ReadinessEvidence`, `DispatchRecord`, `DispatchState`, `ThreadSummary`, `TranscriptItem`, `PendingApproval`, `CoordinatorSnapshot`, `CoordinatorEvent`, `HealthSnapshot`, `ApiResult<T>`, and `validateTaskManifest(value)`.
- Consumes: only the approved spec; later tasks must not redefine these names.

- [ ] **Step 1: Write failing manifest and contract tests**

Create tests that hand-derive valid and invalid manifests:

```ts
it("rejects a dependency cycle", () => {
  const result = validateTaskManifest({
    blueprintId: "2026-08-14-mvp3",
    title: "MVP3",
    masterplanPath: "docs/mvp3.md",
    coordinationRoot: "docs/workers/2026-08-14-mvp3",
    tasks: [
      { id: "T0", title: "Taxonomy", kind: "planning", dependsOn: ["U0"], promptTemplate: "planning" },
      { id: "U0", title: "Shell", kind: "planning", dependsOn: ["T0"], promptTemplate: "planning" },
    ],
  });
  expect(result).toEqual({ ok: false, error: { code: "MANIFEST_CYCLE", cycle: ["T0", "U0", "T0"] } });
});

it("accepts a gate with known dependencies", () => {
  expect(validateTaskManifest(validManifest).ok).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd workers-masterplan/swarm && npm test -- src/shared/contracts.test.ts`

Expected: FAIL because the project and `validateTaskManifest` do not exist.

- [ ] **Step 3: Add the exact dependency set and build scripts**

Use scripts:

```json
{
  "dev": "tsx watch src/server/index.ts",
  "dev:client": "vite",
  "build": "npm run typecheck && vite build && tsc -p tsconfig.server.json",
  "start": "node dist-server/server/index.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "smoke:app-server": "tsx scripts/smoke-app-server.ts",
  "auth:hash": "tsx scripts/hash-password.ts",
  "auth:totp": "tsx scripts/generate-totp-secret.ts",
  "typecheck": "tsc --noEmit && tsc -p tsconfig.server.json --noEmit"
}
```

Install runtime dependencies `express`, `ws`, `dotenv`, `react`, `react-dom`,
`@xyflow/react`, `lucide-react`, `react-markdown`, `remark-gfm`, and
`rehype-sanitize`. Install TypeScript/Vite/Vitest/Testing Library/Supertest/
Playwright/tsx type packages as development dependencies.

Configure Playwright's owned web server here and freeze its command, port, and
environment as `tsx tests/e2e/fixtureServer.ts` on an OS-assigned test port
communicated through Playwright configuration. Task 7 implements the referenced
fixture server and scripts but must not alter
`package.json`, test setup, or configuration without a reviewed foundation
amendment.

- [ ] **Step 4: Implement normalized contracts and literal DAG validation**

Implement a deterministic DFS that reports unknown dependencies, duplicate IDs,
empty required fields, and the first stable cycle. Do not read files or infer
status in this function. Commit Claudio's three approved draft prompts as the
canonical planning/execution/UI templates, adding only named placeholders and
the settled terminology/model/cadence/phase boundaries from the design.

- [ ] **Step 5: Verify GREEN and project typecheck**

Run:

```bash
cd workers-masterplan/swarm
npm test -- src/shared/contracts.test.ts
npm run typecheck
```

Expected: contract tests pass and both TypeScript programs exit 0.

- [ ] **Step 6: Controller review and checkpoint**

Review exact staged files, commit `feat(swarm): establish coordinator contracts`,
pull/reconcile `origin/main`, rerun the two focused commands, push, and prove:

```bash
git merge-base --is-ancestor HEAD origin/main
```

### Task 2: Implement server configuration, authentication, state, scheduling, and ngrok window

**Files:**
- Create: `workers-masterplan/swarm/src/server/config/config.ts`
- Create: `workers-masterplan/swarm/src/server/config/config.test.ts`
- Create: `workers-masterplan/swarm/src/server/auth/password.ts`
- Create: `workers-masterplan/swarm/src/server/auth/totp.ts`
- Create: `workers-masterplan/swarm/src/server/auth/sessionStore.ts`
- Create: `workers-masterplan/swarm/src/server/auth/auth.test.ts`
- Create: `workers-masterplan/swarm/src/server/state/atomicStateStore.ts`
- Create: `workers-masterplan/swarm/src/server/state/atomicStateStore.test.ts`
- Create: `workers-masterplan/swarm/src/server/logging/logger.ts`
- Create: `workers-masterplan/swarm/src/server/logging/logger.test.ts`
- Create: `workers-masterplan/swarm/src/server/tasks/manifestLoader.ts`
- Create: `workers-masterplan/swarm/src/server/tasks/blueprintEvidence.ts`
- Create: `workers-masterplan/swarm/src/server/tasks/blueprintEvidence.test.ts`
- Create: `workers-masterplan/swarm/src/server/tasks/promptTemplates.ts`
- Create: `workers-masterplan/swarm/src/server/tasks/tasks.test.ts`
- Create: `workers-masterplan/swarm/src/server/dispatch/outbox.ts`
- Create: `workers-masterplan/swarm/src/server/dispatch/outbox.test.ts`
- Create: `workers-masterplan/swarm/src/server/scheduler/accountScheduler.ts`
- Create: `workers-masterplan/swarm/src/server/scheduler/accountScheduler.test.ts`
- Create: `workers-masterplan/swarm/src/server/ngrok/window.ts`
- Create: `workers-masterplan/swarm/src/server/ngrok/controller.ts`
- Create: `workers-masterplan/swarm/src/server/ngrok/ngrok.test.ts`

**Interfaces:**
- Consumes: shared contract names from Task 1.
- Produces: `loadConfig(env)`, `verifyPassword`, `verifyTotp`, `LoginThrottle`, `SessionStore`, `AtomicStateStore`, `createLogger`, `loadManifest`, `loadBlueprintEvidence`, `evaluateTaskReadiness`, `renderWorkerPrompt`, `DispatchOutbox`, `rankAccounts`, `mergeRateLimits`, `nextRateLimitCheck`, `isNgrokWindowOpen`, `nextNgrokBoundary`, and `NgrokController`.

- [ ] **Step 1: Write RED authentication and secret-validation tests**

Tests must catch wrong scrypt hashes, ±1 TOTP time-step acceptance, replay of the
same TOTP within one login challenge, expired/single-use challenges, generic
login failures, independent email/source throttling, twelve-hour idle expiry,
session survival across restart, untrusted forwarded addresses, missing account
passwords, group/world-readable `.env`, and secret-like values in serialized
state.

```ts
it("accepts one adjacent TOTP step and rejects replay", () => {
  const verifier = createTotpVerifier("JBSWY3DPEHPK3PXP");
  const code = totpAt("JBSWY3DPEHPK3PXP", 1_800_000);
  expect(verifier.verify(code, 1_830_000)).toBe(true);
  expect(verifier.verify(code, 1_830_000)).toBe(false);
});
```

Run: `npm test -- src/server/auth src/server/config`

Expected: FAIL because the authentication/config modules are absent.

- [ ] **Step 2: Implement config, scrypt, TOTP, signed sessions, and login throttling primitives**

Use Node `crypto.scrypt`, `timingSafeEqual`, HMAC-SHA1 TOTP with a 30-second
step, and HMAC-SHA256 signed random session IDs. Persist only signed session
records, challenge digests, expiry/replay metadata, and throttle counters.
Trust `Forwarded`/`X-Forwarded-For` only when the direct peer is loopback and
managed-proxy trust is enabled. Do not add a general auth framework. Return one
generic `AUTH_INVALID` failure.

- [ ] **Step 3: Write RED atomic-store and manifest-loader tests**

Use a temporary directory. Prove atomic rename preserves the prior good file on
write failure, corrupt JSON is quarantined, secrets are rejected, and manifest
paths resolve relative to the repository root. Add frozen blueprint, worker
status, gate-receipt, and remote-ref fixtures. Prove planning/execution/terminal
phase predicates, hard prerequisite handling, blueprint-ID matching, remote SHA
evidence, and `MASTERPLAN_NOT_READY` with zero launches when no authority exists.

Run: `npm test -- src/server/state src/server/tasks`

Expected: FAIL because store/loader/template functions are absent.

- [ ] **Step 4: Implement state and exact prompt rendering**

`loadBlueprintEvidence` fetches and reads `origin/main` without altering the
working tree. It parses the actual Blueprint Masterplan/status/receipt formats
from fixtures, rejects local-only evidence, and never infers tasks from prose.
`renderWorkerPrompt` must replace worker ID, task title, blueprint/spec/plan/
status paths, phase, and selected account without changing Claudio's approved
planning, execution, or UI prompt substance. Execution prompts include Terra
High/Xhigh implementation routing and Sol High only for unexpected planning.

- [ ] **Step 5: Write RED scheduler and ngrok boundary tests**

Include literal cases:

```ts
it.each([
  ["2026-08-26T01:59:59.000Z", false], // 09:59:59 Singapore
  ["2026-08-26T02:00:00.000Z", true],
  ["2026-08-26T15:59:59.000Z", true],
  ["2026-08-26T16:00:00.000Z", false],
])("applies the 10:00 to midnight window at %s", (iso, open) => {
  expect(isNgrokWindowOpen(new Date(iso), "Asia/Singapore")).toBe(open);
});

it("prefers the account with the strongest weakest window", () => {
  expect(rankAccounts([bot3Primary97Weekly20, bot5Primary80Weekly70])[0]?.id).toBe("bot5");
});
```

Also assert sparse updates merge by limit ID, all buckets affect the weakest
score, nullable data makes an account ineligible, reset timestamps use Unix
seconds, concurrency overrides are explicit, and unknown reset jitter is within
40–80 minutes and stable for the same job/attempt seed.

Run: `npm test -- src/server/scheduler src/server/ngrok`

Expected: FAIL because scheduler/window/controller functions are absent.

- [ ] **Step 6: Implement scheduler and managed ngrok controller**

Inject clock, timer, process launcher, and tunnel-discovery dependencies. A
manual early stop records suppression until the next 10:00 boundary. A
one-minute heartbeat reconciles missed boundaries and unexpected process exits.
Persist the suppression boundary so restart cannot reopen an intentionally
stopped tunnel. Use the shared redactor for process output and public URL state.

- [ ] **Step 7: Write RED crash-window outbox tests, then implement**

Cover crash before send, after send, before acknowledgement, after
acknowledgement, reconnect with a matching stable `clientUserMessageId`, no
match, ambiguous history, rate-limit waiting, and restart timer recovery. The
fake adapter must expose `thread/read(includeTurns: true)` reconciliation.
Persist `queued` before dispatch and `submitting` before network send; never
automatically retry any recovered `submitting` record without a match: delayed
materialization remains possible, so it becomes `attention_required`. Implement
the literal state transitions in the design and prove no test produces two
`turn/start` calls for one dispatch ID.

- [ ] **Step 8: Run the Task 2 focused suite**

Run:

```bash
npm test -- src/server/config src/server/auth src/server/state src/server/logging src/server/tasks src/server/dispatch src/server/scheduler src/server/ngrok
npm run typecheck
```

Expected: all Task 2 tests pass; typecheck exits 0.

### Task 3: Implement `su` launcher, app-server adapter, transcript reducer, safe files, and approvals

**Files:**
- Create: `workers-masterplan/swarm/src/server/codex/protocol.ts`
- Create: `workers-masterplan/swarm/src/server/codex/jsonRpcClient.ts`
- Create: `workers-masterplan/swarm/src/server/codex/jsonRpcClient.test.ts`
- Create: `workers-masterplan/swarm/src/server/codex/suLauncher.ts`
- Create: `workers-masterplan/swarm/src/server/codex/suLauncher.test.ts`
- Create: `workers-masterplan/swarm/src/server/codex/appServerClient.ts`
- Create: `workers-masterplan/swarm/src/server/codex/appServerClient.test.ts`
- Create: `workers-masterplan/swarm/src/server/codex/accountManager.ts`
- Create: `workers-masterplan/swarm/src/server/codex/transcriptReducer.ts`
- Create: `workers-masterplan/swarm/src/server/codex/transcriptReducer.test.ts`
- Create: `workers-masterplan/swarm/src/server/codex/safeFileReader.ts`
- Create: `workers-masterplan/swarm/src/server/codex/safeFileReader.test.ts`
- Create: `workers-masterplan/swarm/src/server/safety/approvalPolicy.ts`
- Create: `workers-masterplan/swarm/src/server/safety/approvalPolicy.test.ts`
- Create: `workers-masterplan/swarm/src/test/fakeAppServer.ts`

**Interfaces:**
- Consumes: shared snapshots/items/errors from Task 1.
- Produces: `JsonRpcClient`, `SuLauncher`, `AppServerClient`, `AccountManager`, `reduceTranscriptEvent`, `readWorkspaceMarkdown`, and `classifyApproval`.

- [ ] **Step 1: Write RED authenticated JSON-RPC lifecycle tests**

Use a real local fake `ws` server. Prove unique IDs, response correlation,
notification delivery, method-specific server-request response, safe handling
of unknown server requests, timeouts, and rejection of all pending calls on
disconnect. Reject a missing/wrong capability token. Prove the client sends
`initialize`, waits for its response, emits `initialized`, calls `account/read`,
and only then becomes ready.

The real-handshake fixture must assert HTTP 401 for missing and wrong
`Authorization: Bearer` values and 101 only for the plaintext token matching the
SHA-256 digest supplied to the app-server process.

Run: `npm test -- src/server/codex/jsonRpcClient.test.ts`

Expected: FAIL because `JsonRpcClient` is absent.

- [ ] **Step 2: Implement the minimal JSON-RPC client and app-server v2 methods**

Expose typed methods only for the protocol methods named in the spec. Preserve
unknown notification payloads in a redacted diagnostic event rather than
crashing. Unknown server requests must receive a safe refusal when the method
supports one or enter the human queue with a timeout response; never leave the
request pending. Implement the generated v2 method-specific approval response
shapes for `item/commandExecution/requestApproval`,
`item/fileChange/requestApproval`, `item/permissions/requestApproval`, and the
legacy `execCommandApproval`/`applyPatchApproval` families rather than a generic
`accept` string. Permission results contain `permissions`, `scope`, and optional
`strictAutoReview`.

Pin and test the safe execution envelope on every path. `thread/start` and
`thread/resume` send canonical bot clone `cwd`, `approvalPolicy: "untrusted"`,
`approvalsReviewer: "user"`, and `sandbox: "workspace-write"`, then validate the
echoed cwd/policy/reviewer/sandbox before work. Every `turn/start` repeats cwd,
approval policy, and reviewer and sets:

```ts
{
  type: "workspaceWrite",
  writableRoots: [`/Users/${account}/Dev/EdenMind`],
  networkAccess: true,
  excludeTmpdirEnvVar: true,
  excludeSlashTmp: true,
}
```

Reject `never`, `danger-full-access`, a mismatched cwd, or any extra writable
root. Network remains enabled solely because worker Git pull/push is required.

- [ ] **Step 3: Write RED `su` process tests against an injected fake spawn**

Assert `/usr/bin/script`, `/dev/null`, `/usr/bin/su`, `-`, account, and `-c` are
separate spawn arguments; only `bot1`–`bot8` are accepted; the password is
written only after a password prompt; it never appears in args or logs; the
Codex binary and Codex home are verified; the OS allocates the port; a fresh
token digest appears in `--ws-auth capability-token --ws-token-sha256` while
the token never appears in args/logs; loopback is enforced; readiness waits for
initialize/initialized and authenticated `account/read`; the child process
group is terminated on timeout/shutdown; and exit/auth timeout becomes
`ACCOUNT_AUTH_REQUIRED`.

Run: `npm test -- src/server/codex/suLauncher.test.ts`

Expected: FAIL because the launcher is absent.

- [ ] **Step 4: Implement `SuLauncher` and `AccountManager`**

Use `/usr/bin/script -q /dev/null /usr/bin/su - <account> -c <command>`. Build
the command from a numeric OS-allocated port, configured verified Codex binary,
fixed auth flags, allowlisted account, and random digest; never concatenate
browser input. Keep the plaintext capability token in memory only and present
it on the WebSocket handshake. Redact terminal output before emitting
diagnostics.

- [ ] **Step 5: Write RED transcript and safe-file tests**

Use generated v2 fixtures for every `ThreadItem` variant. Prove paginated
`thread/list`, `thread/read(includeTurns: true)` ordering, item updates are
idempotent, sparse deltas append once, reconnect replay does not duplicate,
completed items replace their in-progress form, unknown items remain as opaque
safe records, exact command output is retained, Markdown links are detected,
`../`, symlink escapes, non-Markdown extensions, and another account's home are
rejected, and valid base64 content decodes.

Run: `npm test -- src/server/codex/transcriptReducer.test.ts src/server/codex/safeFileReader.test.ts`

Expected: FAIL because reducer/reader are absent.

- [ ] **Step 6: Implement transcript normalization and app-server file reads**

Resolve the requested path against `/Users/<account>/Dev/EdenMind`, validate
realpath containment, require `.md` or `.markdown`, call `fs/readFile`, cap the
decoded file at 2 MiB, and return UTF-8 text.

- [ ] **Step 7: Write RED dangerous-approval matrix tests**

Literal human-required cases include `rm -rf /`, `rm -rf /Users/bot4`, overwriting
`~/.ssh/config`, deleting `~/.codex`, `diskutil eraseDisk`, `dscl . -delete
/Users/bot2`, grants outside the assigned clone, compound commands, unresolved
globs, interpreter strings, symlink-ambiguous targets, `find -delete`, unknown
request methods, and decisions absent from `availableDecisions`. Literal
auto-accept cases include deleting a realpath-proven `dist/`, removing a proven
test fixture inside the clone, exact-argv `git pull`/`git push` with clone cwd
under the enforced sandbox, and Apply Patch changes inside owned paths. Package
installation, global flags, lifecycle scripts, and shell-wrapped Git remain
human-required unless their complete effects are positively proven confined.

Run: `npm test -- src/server/safety/approvalPolicy.test.ts`

Expected: FAIL because `classifyApproval` is absent.

- [ ] **Step 8: Implement approval classification and response routing**

Return `auto_accept`, `human_required`, or `decline` plus target evidence and a
method-specific response builder. Auto responses choose only an offered safe
decision. Human requests persist the full journal fields from the design and
offer only method-compatible decisions plus Cancel turn when supported.

- [ ] **Step 9: Run the Task 3 focused suite**

Run:

```bash
npm test -- src/server/codex src/server/safety
npm run typecheck
```

Expected: all Task 3 tests pass; typecheck exits 0.

### Task 4: Implement the approved responsive React interface

**Files:**
- Create: `workers-masterplan/swarm/src/client/main.tsx`
- Create: `workers-masterplan/swarm/src/client/App.tsx`
- Create: `workers-masterplan/swarm/src/client/styles.css`
- Create: `workers-masterplan/swarm/src/client/api.ts`
- Create: `workers-masterplan/swarm/src/client/store/coordinatorStore.tsx`
- Create: `workers-masterplan/swarm/src/client/components/AppShell.tsx`
- Create: `workers-masterplan/swarm/src/client/components/StatusBadge.tsx`
- Create: `workers-masterplan/swarm/src/client/components/RateLimitBar.tsx`
- Create: `workers-masterplan/swarm/src/client/components/MarkdownViewer.tsx`
- Create: `workers-masterplan/swarm/src/client/components/TranscriptItemView.tsx`
- Create: `workers-masterplan/swarm/src/client/pages/LoginPage.tsx`
- Create: `workers-masterplan/swarm/src/client/pages/HomePage.tsx`
- Create: `workers-masterplan/swarm/src/client/pages/FlowchartPage.tsx`
- Create: `workers-masterplan/swarm/src/client/pages/ChatsPage.tsx`
- Create: `workers-masterplan/swarm/src/client/**/*.test.tsx`

**Interfaces:**
- Consumes: Task 1 shared contracts and an injected `CoordinatorApi`.
- Produces: accessible screens and interactions only; no server or domain logic.

- [ ] **Step 1: Write RED shell/navigation and authentication tests**

Assert Home/Flowchart/Chats labels, desktop rail semantics, mobile bottom nav,
tablet icon rail at exactly 768px, dark default appearance,
email/password/TOTP phases, generic auth errors, and computed primary control
sizes of at least 44 by 44 CSS pixels.

Run: `npm test -- src/client/App.test.tsx src/client/components/AppShell.test.tsx src/client/pages/LoginPage.test.tsx`

Expected: FAIL because the client does not exist.

- [ ] **Step 2: Implement shell, visual tokens, login, and normalized store**

Reuse the approved Cordial values from the accepted mockup: `#15191b` canvas,
`#1c2224` surfaces, `#3daa4b` action green, Giphurs/Avenir/system fallback, 10–20
px radii, compact density, desktop rail, tablet icon rail, and mobile bottom
navigation. Bundle only fonts/assets whose license is committed and permits it;
otherwise use the fallback stack. Use Lucide icons; no ellipsis placeholders.

- [ ] **Step 3: Write RED Home behavior tests**

Assert active/ready/queue metrics, account primary/secondary remaining values,
next-ready suggestion, action-required auth, pending dangerous approval,
scheduled ngrok copy, and launch-preview interaction.

Run: `npm test -- src/client/pages/HomePage.test.tsx`

Expected: FAIL because Home is absent.

- [ ] **Step 4: Implement compact Home cockpit**

Render only normalized state. Never infer “clear,” “ready,” or “online” from
missing data.

- [ ] **Step 5: Write RED shared-graph and node-overlay tests**

Assert desktop, 768px tablet, and mobile all render React Flow; ready/blocked/
running/complete filters work; blocked nodes cannot launch; nodes have
accessible names and keyboard selection; selecting a mobile node opens the
overlay; Close returns to the same pan/zoom state; and Open chat selects Chats
plus the mapped thread.

Run: `npm test -- src/client/pages/FlowchartPage.test.tsx`

Expected: FAIL because Flowchart is absent.

- [ ] **Step 6: Implement one pan/zoom graph surface**

Use `@xyflow/react` with fit-view, pan, wheel/pinch zoom, status styling, and
mobile overlay. Do not create a mobile list or expand mode.

- [ ] **Step 7: Write RED Chats and Markdown interaction tests**

Assert chats group by macOS account, selecting active bot3 initially hides
`T0 · Graph planning`, re-clicking bot3 reveals it, re-clicking closes it,
exact transcript item types render, a Markdown path is a link, selecting it
opens a viewer, Close restores the exact chat scroll position, and no
`Markdown preview` tab exists. Cover send, new chat, archive, steer, interrupt,
open-terminal copy, and disabled states when their capabilities are absent.

Run: `npm test -- src/client/pages/ChatsPage.test.tsx src/client/components/MarkdownViewer.test.tsx`

Expected: FAIL because Chats/viewer are absent.

- [ ] **Step 8: Implement exact Chats and closable Markdown viewer**

Sanitize rendered Markdown with `rehype-sanitize`. Keep viewer state separate
from top-level navigation and preserve message scroll position.

- [ ] **Step 9: Run Task 4 focused tests and accessibility checks**

Run:

```bash
npm test -- src/client
npm run typecheck
```

Expected: all client tests pass; no React act warnings; typecheck exits 0.

### Task 5: Compose authenticated HTTP/WebSocket APIs and runtime lifecycle

**Files:**
- Create: `workers-masterplan/swarm/src/server/http/authMiddleware.ts`
- Create: `workers-masterplan/swarm/src/server/http/routes.ts`
- Create: `workers-masterplan/swarm/src/server/http/routes.test.ts`
- Create: `workers-masterplan/swarm/src/server/realtime/browserHub.ts`
- Create: `workers-masterplan/swarm/src/server/realtime/browserHub.test.ts`
- Create: `workers-masterplan/swarm/src/server/app.ts`
- Create: `workers-masterplan/swarm/src/server/app.integration.test.ts`
- Create: `workers-masterplan/swarm/src/server/index.ts`

**Interfaces:**
- Consumes: Task 2 services, Task 3 account manager, Task 1 contracts.
- Produces: `createCoordinatorApp(deps)`, `/api/v1/*`, authenticated `/ws`, static client serving, graceful start/stop.

- [ ] **Step 1: Write RED authorization and response-envelope tests**

With Supertest, assert unauthenticated reads/mutations fail, login is two-step,
wrong origins fail state changes, cookies are HTTP-only/SameSite Strict, all
responses use `{ data }` or `{ error }`, and `/api/v1/health` matches the exact
shared `HealthSnapshot` while revealing no email, paths,
passwords, secrets, transcript, or ngrok token.

Run: `npm test -- src/server/http/routes.test.ts`

Expected: FAIL because routes are absent.

- [ ] **Step 2: Implement auth/session/account/task/thread/turn/file/ngrok routes**

Map expected service failures to the stable error codes from the spec. Route
Markdown through `readWorkspaceMarkdown`; never accept arbitrary server paths.

- [ ] **Step 3: Write RED browser WebSocket sequence-gap tests**

Use a real HTTP server and `ws` client. Assert cookie authentication, initial
snapshot, monotonic sequence numbers, ordered transcript/rate-limit/task/ngrok
events, and snapshot resync after a reported gap.

Run: `npm test -- src/server/realtime/browserHub.test.ts`

Expected: FAIL because the browser hub is absent.

- [ ] **Step 4: Implement realtime hub and coordinator event wiring**

Disconnect unauthorized upgrades. Broadcast normalized events only. A new
connection always receives `snapshot` before incremental events.

- [ ] **Step 5: Write RED integration tests with fake app-servers**

Cover account connect, capacity refresh, best-account launch, explicit
concurrency override, durable outbox state transitions, all four crash-window
reconciliations, thread pagination/creation/history, turn deltas/completion,
known and unknown rate-limit wait, sparse bucket updates, proven-contained
approval auto-accept, ambiguous/dangerous method-specific approval UI
queue/decision, Markdown read, disconnect, component health, and graceful
shutdown.

Run: `npm test -- src/server/app.integration.test.ts`

Expected: FAIL until the full composition is wired.

- [ ] **Step 6: Implement runtime composition and graceful shutdown**

Start local HTTP, state, schedule heartbeat, configured accounts, and static
client. On SIGINT/SIGTERM stop launches, close sockets, flush state, stop ngrok
and child launchers, and enforce a ten-second hard deadline.

- [ ] **Step 7: Run Task 5 focused verification**

Run:

```bash
npm test -- src/server/http src/server/realtime src/server/app.integration.test.ts
npm run typecheck
npm run build
```

Expected: all Task 5 tests pass, typecheck/build exit 0.

### Task 6: Update the reusable Workers Masterplan launch contract test-first

**Files:**
- Modify: `workers-masterplan/evals/blueprint-masterplan-scenarios.md`
- Create: `workers-masterplan/evals/verify-swarm-prompt-parity.mjs`
- Modify: `workers-masterplan/blueprint-masterplan/SKILL.md`
- Modify: `workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md`
- Modify: `workers-masterplan/blueprint-masterplan/agents/openai.yaml`
- Verify symlink mirror: `.agents/skills/blueprint-masterplan/**`

**Interfaces:**
- Consumes: approved coordinator spec sections 7.2 and Global Constraints.
- Produces: reusable planning/execution/UI prompt requirements compatible with the coordinator's templates.

- [ ] **Step 1: Add RED pressure scenarios before editing the skill**

Add scenarios that tempt a coordinator to conflate accounts with workers, cap
one account to one chat, start execution from one approved plan, omit model
routing, use Codex desktop, or expose ngrok continuously. The Critical rubric
requires:

- macOS account and worker remain distinct;
- app-server through `su`, not Codex desktop;
- unlimited chats per account and default global concurrency three;
- planning prompt stops before execution;
- execution prompt uses Terra High/Xhigh and Sol High only for unexpected
  planning;
- frequent safe main synchronization and remote proof;
- fail-closed, containment-proven auto approvals; and
- ngrok 10:00–00:00 Asia/Singapore.

Run a fresh Sol High reviewer against the unmodified skill and save its failing
finding in the Task 6 report.

Expected: baseline misses the coordinator-specific account/app-server/schedule
contract.

- [ ] **Step 2: Add the minimal coordinator launch-packet contract**

Keep `blueprint-masterplan` generic. Add a conditional section used only when a
blueprint declares the EdenMind swarm coordinator. It points to the single
canonical source under `workers-masterplan/swarm/templates`, requires
account/worker distinction, model routing, app-server transport, schedule,
approval policy, and phase terminal conditions. Do not duplicate the full
application design in the skill.

- [ ] **Step 3: Update ordinary prompt templates and metadata**

Keep the ordinary generic templates generic, and add explicit coordinator slots
for selected macOS account, worker ID, model routing, coordinator chat name, and
terminal condition by reference to the canonical swarm templates. The skill
must not copy their phase or shared-main prose. Add a parity verifier that
resolves the skill references, renders all three coordinator templates through
both entry points, and compares normalized output byte for byte.

- [ ] **Step 4: Re-run pressure scenarios with the edited skill**

Dispatch a fresh Sol High reviewer with the scenario paths and require a row-by-
row pass/fail table. Address every Critical/Important miss before continuing.

- [ ] **Step 5: Verify source/mirror identity and documentation hygiene**

Run:

```bash
cmp workers-masterplan/blueprint-masterplan/SKILL.md .agents/skills/blueprint-masterplan/SKILL.md
cmp workers-masterplan/blueprint-masterplan/references/worker-prompt-templates.md .agents/skills/blueprint-masterplan/references/worker-prompt-templates.md
node workers-masterplan/evals/verify-swarm-prompt-parity.mjs
rg -n "TBD|TODO|PLACEHOLDER" workers-masterplan/blueprint-masterplan workers-masterplan/evals/blueprint-masterplan-scenarios.md
```

Expected: both `cmp` commands exit 0 because `.agents/skills` is the repository
symlink; placeholder scan finds only intentional literal template discussion,
not incomplete requirements.

### Task 7: Complete end-to-end behavior, operator setup, and real macOS smoke test

**Files:**
- Create: `workers-masterplan/swarm/tests/e2e/auth.spec.ts`
- Create: `workers-masterplan/swarm/tests/e2e/dashboard.spec.ts`
- Create: `workers-masterplan/swarm/tests/e2e/flowchart.spec.ts`
- Create: `workers-masterplan/swarm/tests/e2e/chats.spec.ts`
- Create: `workers-masterplan/swarm/tests/e2e/ngrok-window.spec.ts`
- Create: `workers-masterplan/swarm/tests/e2e/fixtureServer.ts`
- Create: `workers-masterplan/swarm/tests/e2e/fixtureData.ts`
- Create: `workers-masterplan/swarm/tests/e2e/fixtureServer.test.ts`
- Create: `workers-masterplan/swarm/scripts/hash-password.ts`
- Create: `workers-masterplan/swarm/scripts/generate-totp-secret.ts`
- Create: `workers-masterplan/swarm/scripts/smoke-app-server.ts`
- Create: `workers-masterplan/swarm/.env.example`
- Create: `workers-masterplan/swarm/manifests/mvp3.json`
- Create: `workers-masterplan/swarm/manifests/example-ready.json`
- Create: `workers-masterplan/swarm/assets/LICENSES.md`
- Create: `workers-masterplan/swarm/README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: complete server/client application.
- Produces: `startE2eFixtureServer(options)`, deterministic eight-account
  snapshots/fake app-servers, repeatable acceptance evidence, and Claudio's
  launch instructions.

- [ ] **Step 1: Write RED Playwright tests against fake eight-account state**

At 1440×900, exactly 768×1024, and 390×844, assert login/TOTP, compact Home,
`MASTERPLAN_NOT_READY` with no launch control for the MVP3 seed, schedule text,
suggested account, desktop/tablet/mobile navigation, shared graph pan/zoom,
mobile node overlay/Open chat, bot3 re-click picker, exact tool output,
Markdown link/viewer/Close with scroll restoration, graph filters/accessibility,
send/new/archive/steer/interrupt capability gating, computed 44px targets, and
method-compatible human approval controls.

Run: `npm run test:e2e`

Expected: tests fail until fixtures/server hooks and final client integration are complete.

- [ ] **Step 2: Add deterministic E2E fixture startup and make tests GREEN**

Use fake app-server WebSockets and a temporary data directory. Do not require
real bot passwords, Codex network use, or ngrok in ordinary tests.

- [ ] **Step 3: Add setup and smoke scripts test-first**

Unit-test password hash format, TOTP provisioning URI encoding, smoke-test
environment gating, and secret redaction. The smoke script exits with a clear
skip unless `SWARM_SMOKE_ACCOUNT` and its password are present. The committed
MVP3 manifest is intentionally blocked with `MASTERPLAN_NOT_READY`; the separate
ready example uses only fixtures and is never the production default.

- [ ] **Step 4: Write the operator README and examples**

Document Node/Codex/ngrok prerequisites, password-hash and TOTP setup, local
`.env`, account login remediation, install/dev/build/start/test commands,
`http://127.0.0.1:4310`, daily ngrok behavior, manifest format, dangerous
approval semantics, real smoke-test opt-in, logs/state locations, and graceful
shutdown. Never include a real password, token, TOTP secret, or public URL.

- [ ] **Step 5: Run full automated acceptance once**

Run:

```bash
cd workers-masterplan/swarm
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Expected: zero failed tests, zero type errors, production build exit 0, all
desktop/mobile Playwright tests pass, and no console error/warning attributable
to the application.

- [ ] **Step 6: Run the opt-in bot3 app-server smoke test**

With the local ignored `.env` containing the user-provided bot3 password:

```bash
cd workers-masterplan/swarm
SWARM_SMOKE_ACCOUNT=bot3 npm run smoke:app-server
```

Expected: `su` launch succeeds; a handshake without the capability token is
rejected; an authenticated handshake completes `initialize`, `initialized`,
`account/read`, `account/rateLimits/read`, and paginated `thread/list`; no Codex
desktop process is launched; no turn is started; and the app-server child exits
cleanly. If bot3 authentication
has expired, record `ACCOUNT_AUTH_REQUIRED` and the exact manual login command;
do not weaken the adapter or add a fallback.

Only after the metadata smoke passes, an operator may explicitly run with
`SWARM_SMOKE_START_TURN=true`. It starts one disposable thread with the prompt
`Reply with SMOKE_OK. Do not use tools or modify files.`, verifies the terminal
answer, archives the thread, and proves no repository change. This flag is never
enabled by default or in CI.

- [ ] **Step 7: Browser-review the real built application**

Start the production server with fake accounts, inspect desktop and mobile in
the in-app browser, exercise every accepted interaction, check keyboard focus,
reduced motion, horizontal overflow (except intentional graph pan), network
errors, and browser console.

- [ ] **Step 8: Run independent final reviews and one fix wave**

Dispatch Sol High for whole-implementation requirements/security review. If it
finds issues, dispatch one Terra Xhigh fixer with the complete list, rerun
covering focused tests, then one scoped Sol High re-review.

- [ ] **Step 9: Final controller commit, reconcile, push, and ancestry proof**

Stage only the swarm implementation, dated spec/plan, worker-masterplan skill/
eval updates, and intended `.gitignore` change. Preserve unrelated untracked
content. Commit a bounded final checkpoint, fetch and merge newer `origin/main`
without rebasing published main, rerun every affected command, push, then prove:

```bash
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
git status --short
```

Expected: ancestry exits 0; only the preserved unrelated untracked paths remain.

## Plan self-review record

- **Spec coverage:** Tasks 1–7 cover every acceptance requirement and explicit
  subsystem in the approved design. Product-spec impact remains evidence-backed
  no-impact; the reusable skill change is owned by Task 6.
- **Mutation collision scan:** Tasks 1–7 acquire the exclusive shared-checkout
  mutation lock sequentially. Parallel agents are read-only protocol or review
  lanes. Only the controller edits Git/index state and shared package/config
  files after Task 1.
- **Type consistency:** `AccountSnapshot`, `TaskManifest`, `CoordinatorSnapshot`,
  `TranscriptItem`, and `CoordinatorEvent` are defined once in Task 1 and
  consumed unchanged by later tasks.
- **Placeholder scan:** The plan contains no unfinished `TBD`, `TODO`, or
  implementation placeholder. Template language is explicit and testable.
