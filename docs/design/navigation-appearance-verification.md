# Navigation and appearance verification — 15 November 2026

Implementation commits: Swarm `19ff33c`, `e947e72`; actual Eden SettingsLayout
`b57cb3e03`. Dropdown changes were already checkpointed in Eden `c8cc2c715`.
Both checkouts remain on main. No Eden navigation source was modified.

## Checks

- `npm test -- --maxWorkers=1`: 82 files / 715 tests passed.
- `npm run build`: root/client/server typechecks and Next static export passed.
  Includes direct `/settings` and `/settings/appearance` output.
- Eden targeted Vitest: 29 Dropdown + 3 SettingsLayout tests passed.
- Eden client `npm run typecheck`: passed.
- Scoped ESLint passed for new/changed frontend code except the confirmed
  pre-existing App.tsx error below; `git diff --check` passed.
- Fixture browser checks on approved port4340, one worker: 14 tests passed
  (`appearance`, `dashboard`, `queuedTasks`); final 16 passed (`appearance`,
  `chats`). These cover 26 distinct journeys, with appearance run twice.

## Browser and design evidence

Inspected light/dark appearance screenshots at 320px and 1440px; automated fit,
route, persisted theme and chrome checks also cover 768px and 1024px.
Mobile has no upload or top bar, and More is keyboard reachable, dismisses with
Escape and restores trigger focus. Tablet/desktop rail stays 88px and icon-only.
Only Appearance is offered inside the shared SettingsLayout.

The browser contrast regression first failed at 2.67975:1 for copied selected
navigation text in light mode. Swarm's copied navigation now uses the existing
strong-accent token (5.17:1 light / 6.40:1 dark), without changing Eden navigation.
Theme screenshots wait for the actual dark surface, not just the theme attribute.
The page has a Radix visually-hidden h1 without adding visible explainer copy.

Chat journeys confirmed mobile navigation suppression/restoration, 44px Send,
long-list viewport containment, capped composer growth, draft restoration after
page navigation/reload, account switching and turn controls. Queue journeys
confirmed rich single-select badge options, status persistence, editing/moving/
deleting descriptions, narrow-width fit and verbatim dispatch to a selected bot.

No additional reusable primitive was needed. Navigation is deliberately copied
and Swarm-owned, as requested; shared component edits live in actual EdenMind.

## Known unrelated failures and limits

- Running Eden's ESLint config on the unchanged HEAD version of Swarm App.tsx
  reproduces `react-hooks/set-state-in-effect` in its existing route
  synchronization, plus the existing unused `onOpenThread` warning. This task
  did not rewrite routing to silence that baseline error. The config also emits
  its existing Pages-directory warning for this custom workspace layout.
- A broader Eden primitive run passed 85 tests and failed existing
  EdenPagination/browser.test.tsx: button height32px versus expected44px.
  Pagination was not edited. The full Eden suite was not run.
- Eden's own selected-navigation contrast and the previously recorded shared
  list selection contrast remain unchanged; the former navigation is explicitly
  outside this task's edit authority.
- Node's existing localStorage experimental warning and fixture color-env
  warnings remain. Dependency advisories reported by GitHub were not remediated.
- No real-machine deployment or live restart was performed. Ports4310/4311 were
  untouched; tests used only the disposable fixture on4340.

## Review required

Actual Eden `edenmind-client/src/features/settings/components/SettingsLayout/index.tsx`
was `done` and is now `human-review`, with an adjacent REVIEW comment: verify the
optional host navigation slot while the existing default section behavior stays
unchanged. Three layout tests cover the custom and existing paths.
