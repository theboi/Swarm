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

- [ ] Add a ChatsPage regression proving account buttons omit counts but retain
  unread dots, and Turn options is a compact disclosure preceding Steer.
- [ ] Run the regression and observe failure before implementing.
- [ ] Remove count markup/CSS; use EdenTextArea autoResize/maxAutoHeight props in
  main and subagent composers; move TurnOptions to the footer before Steer.
- [ ] Use EdenButton asChild with summary, retaining native details semantics.
- [ ] Run focused ChatsPage tests; commit and pull/push verified changes.

## Task 2: Viewport and expanding drafts

- [ ] Add fixture browser checks at 390px and 1440px with 80 returned threads.
  Assert bounded page/list heights, reachable final row and visible composer.
- [ ] Prove textarea growth, capped internal scrolling, shrinking and reload size.
- [ ] Build and run new checks against port 4340; inspect baseline failures.
- [ ] Constrain the chat grid's automatic minimum sizing and list flex shrinking
  where the browser measurements identify overflow. Rebuild and rerun checks.
- [ ] Verify existing chat journeys, typecheck/build, broader unit tests, and
  screenshots. Record limitations; commit, pull and push.
