# Chats Polish Implementation Plan

> Execute inline using executing-plans; work on main as required by AGENTS.md.

**Goal:** Deliver the approved local [Chats contract](../../design/pages/chats.md).
**Architecture:** Preserve Express and the Next static export. Compose existing
Eden primitives; constrain grid/list sizing at the Swarm layout boundary.
**Tech stack:** Next.js, React, TypeScript, Eden/Radix, Vitest and Playwright.

## Constraints

Only this Swarm checkout changes. Preserve meaningful notification dots and
drafts. Do not change shared Eden sources. Browser fixtures use port 4340 only.

## Task 1: Composer and account controls

- [x] Add a ChatsPage regression proving account buttons omit counts but retain
  unread dots, and Turn options is a compact disclosure preceding Steer.
- [x] Run the regression and observe failure before implementing.
- [x] Remove count markup/CSS; use EdenTextArea autoResize/maxAutoHeight props in
  main and subagent composers; move TurnOptions to the footer before Steer.
- [x] Use EdenButton asChild with summary, retaining native details semantics.
- [x] Run focused ChatsPage tests; commit and pull/push verified changes.

## Task 2: Viewport and expanding drafts

- [x] Add fixture browser checks at 390px, 768px and 1440px with 80 returned threads.
  Assert bounded page/list heights, reachable final row and visible composer.
- [x] Prove textarea growth, capped internal scrolling, shrinking and reload size.
- [x] Build and run new checks against port 4340; inspect baseline failures.
- [x] Constrain the chat grid's automatic minimum sizing and list flex shrinking
  where the browser measurements identify overflow. Rebuild and rerun checks.
- [x] Verify existing chat journeys, typecheck/build, broader unit tests, and
  screenshots. Record limitations; commit, pull and push.

## Verification record

- Baseline regressions failed: count badge/compact trigger assertions, an 82-row
  desktop list expanding to 4734px, textarea staying at 80px for multiline input,
  and 336px of unused conversation width at the 768px compact-picker boundary.
- Production build/typecheck passed, followed by a fresh frontend build after the
  CSS-only tablet correction. All 12 chat browser journeys passed on port 4340.
  Screenshots were inspected at 390px, 768px and 1440px; no horizontal overflow.
- The full 700-test unit run passed 696 tests and failed four timing-sensitive
  chat tests (three timeouts and one scroll-restoration assertion). All four
  passed in isolation without increasing timeouts or weakening assertions.
  An earlier focused run also hit the long-transcript timing limit; that test
  passed in the broader run. This is not a claim of a clean single full-suite run.
- Scoped ESLint reports the same 12 existing errors and two warnings as the
  pre-change ChatsPage baseline; no clean full lint run is claimed.
- Shared Eden files and live Swarm processes were not changed or restarted.
