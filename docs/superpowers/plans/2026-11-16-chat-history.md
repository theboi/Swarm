# Chat history and user surfaces implementation plan

**Goal:** Centre green-tinted user cards, stretch New chat, and replace manual history loading with automatic rendering/offloading.

**Architecture:** Keep the existing transcript API and completed-turn disclosure. Memoized turns split their visible items into small, stable blocks. IntersectionObserver mounts nearby blocks and replaces distant blocks with their measured height. Native scroll anchoring retains position; focused/selected content is never offloaded. The same renderer serves main and subagent conversations.

**Constraints:** Work on main, preserve concurrent changes, use shared EdenCard without editing Eden primitives, never restart live services. No backend or storage changes. Windowing offloads DOM, not the normalized transcript data.

## Tasks

- [x] Add failing tests for automatic history entry/exit, measured placeholders, focus preservation and user-card semantics; browser checks cover tint, centring, full-width New chat and real scrolling.
- [x] Implement private memoized TranscriptBlock; remove Show earlier messages and retain full-history turn grouping. Memoize unchanged turns independently of streaming updates.
- [x] Restore EdenCard only for user messages, using accent-soft and centred alignment. Stretch New chat through its layout class.
- [x] Update Swarm design authority and Chats contract with approved composition/windowing behavior.
- [x] Run affected unit tests, typechecks, production build and disposable port-4340 browser journeys. Inspect screenshots, request read-only code review and resolve findings.

Delivery follows the repository's commit, pull and push workflow on main.

## Review refinements

Read-only review identified focus/selection pins that could outlive the interaction.
Temporary focusout/selectionchange listeners now release those blocks, with regression
coverage. Transcript-local presentation preferences retain source/activity choices
across offload. A real browser regression exposed the existing 150ms startup scroll
timer overriding early upward navigation; user interaction now cancels settling.

## Verification

- 119 affected unit tests pass together (ChatsPage, TranscriptTurns, TranscriptItemView, clipboard helper).
- Production build and client/server typechecks pass.
- 23 combined chat/transcript browser journeys pass; four separate mobile/desktop
  theme checks also pass using the actual stored light/dark preference.
- Main agent inspected mobile/desktop and light/dark screenshots.
- Scoped lint reports no errors in the transcript components. ChatsPage's 12
  errors and two warnings are identical to HEAD; the existing unused-variable
  warnings in TranscriptItemView and ChatsPage tests remain outside this change.
