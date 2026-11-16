# Chat account tabs implementation plan

**Goal:** Horizontal account tabs, original EdenListCard styling, expandable usage and Eden workspace colours.

**Architecture:** Extend the actual EdenMind EdenTabs with rich keyed labels, accessible text and opt-in scrolling. Tabs wrap Swarm's existing account-scoped list/detail workspace. Preserve its draft/read/unread lifecycle. A private ChatAccountUsage footer reuses AccountUsageBar and Accounts' RateLimitBar; no server/API changes. Page content uses workspace-bg while navigation remains bg.

**Constraints:** Main checkouts only; shared changes belong in EdenMind. Preserve concurrent edits and all review tags. No live process restart. Use fixture port 4340 for browser checks.

- [x] Add failing rich-tab, account keyboard/status, usage expansion and responsive/hover/background tests.
- [x] Implement and verify shared EdenTabs; update Eden design authority and Swarm contract. Commit and push only its scoped EdenMind files.
- [x] Move account selection to top tabs; remove the account heading/column and list hover/divider overrides. Keep two desktop columns and mobile list/detail navigation.
- [x] Add expandable usage with two existing RateLimitBar controls, percentages, reset times, unknown values and weekly-exhaustion handling.
- [x] Verify affected tests, scoped lint, typechecks, build and fixture browser flows; inspect screenshots and read-only review. Pull/commit/push Swarm changes.

## Additive owner requirements

Set title to Swarm. Remove Home; default root/unknown navigation to Chats. Order
primary navigation Chats, Todos, Accounts, with Settings utility. Move the existing
AccountSummaryPanel into a right column beside Todos, stacked below on smaller
viewports. Default Todos to the first list only once per page entry, replacing
history; explicit list URLs and mobile Lists back remain authoritative. Make
Create List primary/full width. Retain content with busy/inert detail while lists
change. Move Home account coverage to AccountSummaryPanel tests; retire only the
removed attention-queue screen coverage. Keep storage and dispatch contracts intact.

## Verification evidence

- EdenMind shared commit `cf66f2e62` pushed; EdenTabs 3 tests, client typecheck, scoped lint and theme contract passed.
- Swarm affected unit suites: 128 tests passed. Typechecks passed.
- Scoped new-component lint passed; App, Accounts and Chats diagnostics match HEAD exactly (17 existing diagnostics total), with no new diagnostics in Todos.
- Read-only review found no blocking regressions. Main-agent screenshots checked responsive Todos layouts; browser coverage includes drafts, clipboard fallbacks, source/thinking and lazy history.
- Browser setup waits for first-list selection before navigating back to Lists; shared hover assertions finish selection animation before comparing settled colours.
- Production build/typechecks passed again against EdenMind `74c13f581`; all 44 browser checks passed on the disposable port 4340 fixture. Main-agent inspection confirmed account tabs/expanded usage at 320px and 1440px and the Todos Accounts column at desktop width.
