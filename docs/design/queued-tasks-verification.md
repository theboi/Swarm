# Queued tasks verification — 2026-11-15

## Checks

- `npm test -- --maxWorkers=1`: 703 tests passed across 80 files on the final implementation.
- `npm run build`: Next static export and TypeScript backend build passed. After the final safe-error-envelope change, `npx tsc -p tsconfig.server.json` passed again.
- Final `npm run typecheck`: passed.
- Scoped ESLint using Eden's configuration: no errors; three existing unused-symbol warnings in `src/server/http/routes.ts`. The inherited Next lint configuration also notes Swarm's nonstandard Pages location.
- `SWARM_E2E_PORT=4340 npm run test:e2e -- tests/e2e/queuedTasks.spec.ts --workers=1`: six journeys passed. All fixture servers were closed afterward; live Swarm ports were untouched.

Browser coverage includes create/select/reload, description editing, every status, move/delete, mobile browser Back, missing-list recovery, shared modal Escape/focus restoration, and exact-description sends at 390/1440px. Twelve long, unbroken descriptions were checked for row containment and horizontal overflow at 320/768/1440px, including access to the bottom add button. Screenshots were inspected locally under `/tmp/swarm-queued-*.png` and are not committed.

Regression checks cover whitespace-preserving storage/dispatch, stable creation dates, concurrent atomic writes, invalid commands, authenticated/origin-protected routes, safe JSON failures, retained unsaved drafts, and send retry chat/message identity. Pending sends cannot dismiss their modal; late completions cannot navigate an unmounted page. Move dialogs survive removal of their source row during query refresh.

An earlier overlapping build/test run encountered a UI timeout and an HTTP parse error. The final sequential full run passed without weakening assertions or changing timeouts.

## Design review

The claude-design polish pass retained Eden's typography, tokens and stationary controls. Lists use EdenListCard/EdenListCardItem; variable-height todo content reuses EdenListCardItem. States use EdenDropdown/EdenBadge, actions use compact EdenButton controls, and consuming parents own Eden modal presentation. No new shared visual primitive was required and no linked EdenMind files were modified.

There is no page title, eyebrow or explanatory paragraph. List names, dates, form labels and actionable errors remain. Desktop split panels become list/detail navigation on mobile. Todos have no title; their description is passed verbatim to the model. States remain manual.

Measured dark-theme contrast: description `#f0f4f4` against `#15191b` is 15.97:1; creation date `#bbc4c4` against the same background is 9.95:1.

### Shared Eden follow-up

Selected EdenListCardItem text uses `#3daa4b` on `#203628`, measured in the browser at 4.35:1, below the 4.5:1 normal-text target. This existing shared style was left unchanged because the linked EdenMind checkout is read-only for this task. Fix it in Eden's design authority/component rather than overriding it in Swarm.

### Existing dependency findings

`npm audit --omit=dev` reported existing advisories in body-parser, proxy-addr, qs and source-map-js. These packages were not changed by this work; dependency remediation was not included in the queue redesign. The only added runtime dependency is TanStack Query for consumer-owned server state.

## Storage and rollout

Lists and todos remain in Git-tracked `manifests/queued-tasks.json`, atomically written using schema version 2. The sole test todo was discarded with owner approval and remains recoverable from Git history. No compatibility reader or alternate `.data` store was added.

Pull and restart the remote Swarm backend to use the changed schema/API and rebuilt Next frontend. This task did not restart or replace a live process.
