# Chat transcript implementation plan

**Goal:** Plain assistant replies, unboxed activity disclosures and borderless superCompact chat buttons.

**Architecture:** Keep transcript normalization, Markdown sanitization and turn grouping unchanged. Update the existing transcript renderer and its styles; reuse shared EdenButton without changing Eden itself.

## Constraints

Work on main; preserve concurrent changes. Never restart live services. Browser verification uses the disposable 4340 fixture only.

## Steps

- [x] Add regression assertions for icon-and-content activity disclosures and links hidden until expansion; run the transcript tests and observe failure (7 expected failures).
- [x] Remove assistant/activity card shells, use first nonempty content line as disclosure preview, keep active indicators and accessible disclosure labels.
- [x] Apply borderless superCompact EdenButton props to chat, subagent, turn and composer controls; remove conflicting local sizing.
- [x] Update the chats contract, run focused tests, typecheck and build; verify the fixture in a browser.
- [x] Review the diff, pull, commit and push verified changes.

## Verification

- 104 focused transcript, turn and chat-page tests pass.
- Production build and complete client/server typecheck pass.
- Scoped ESLint has no new diagnostics versus HEAD; existing hook diagnostics remain unchanged.
- Read-only review caught an action accessible-name omission, now fixed by including the visible preview. Regression tests cover it.
- 16 browser journeys pass at widths from 280px to 1440px. Desktop and narrow-mobile screenshots inspected directly.
- Browser regression exposed an intrinsic-width grid column that pushed Send outside the viewport; an explicit minmax(0, 1fr) chat column fixes the cause. Mobile turn-history tests now open the existing More menu.
- Implementation pushed in 5e7f489 and dea3fd4. Live Swarm processes were not restarted.
- Full suite: 719/720 passed across 83 files. The unchanged macOS PTY descriptor test exceeded its 5-second timeout (5639ms). Isolated rerun passed all 3 PTY resource tests; the previously timed-out test completed in 572ms. No backend or test-timeout changes were made.
