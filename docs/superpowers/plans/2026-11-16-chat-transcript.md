# Chat transcript implementation plan

**Goal:** Plain assistant replies, unboxed activity disclosures and borderless superCompact chat buttons.

**Architecture:** Keep transcript normalization, Markdown sanitization and turn grouping unchanged. Update the existing transcript renderer and its styles; reuse shared EdenButton without changing Eden itself.

## Constraints

Work on main; preserve concurrent changes. Never restart live services. Browser verification uses the disposable 4340 fixture only.

## Steps

- [x] Add regression assertions for icon-and-content activity disclosures and links hidden until expansion; run the transcript tests and observe failure (7 expected failures).
- [x] Remove assistant/activity card shells, use first nonempty content line as disclosure preview, keep active indicators and accessible disclosure labels.
- [x] Apply borderless superCompact EdenButton props to chat, subagent, turn and composer controls; remove conflicting local sizing.
- [ ] Update the chats contract, run focused tests, typecheck and build; verify the fixture in a browser.
- [ ] Review the diff, pull, commit and push verified changes.

## Verification

- 104 focused transcript, turn and chat-page tests pass.
- Production build and complete client/server typecheck pass.
- Scoped ESLint has no new diagnostics versus HEAD; existing hook diagnostics remain unchanged.
- Read-only review caught an action accessible-name omission, now fixed by including the visible preview. Regression tests cover it.
