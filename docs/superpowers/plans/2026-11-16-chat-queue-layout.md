# Chat queue and compact workspace implementation plan

**Goal:** Per-chat queued follow-ups and a compact two-column Chats workspace with reliable mobile navigation.

**Architecture:** Browser-owned queued messages persist independently of composer drafts. One authenticated-app delivery hook observes existing coordinator activity and starts one FIFO message per idle chat through startTurn, retaining failed/uncertain deliveries for explicit retry. No backend/runtime migration. Chats owns its list outside the desktop account tabs; mobile composes the same list inside the tabs while choosing a conversation.

**Constraints:** Work on main; preserve concurrent changes. Shared controls retain their geometry. Use port 4340 only for disposable browser checks. No live process restart. Browser queue delivery requires an open signed-in Swarm tab; navigation within Swarm does not stop it.

- [x] Queue: failing tests for FIFO, active/unknown/unauthenticated/limit/approval gating, failure retention, removal, persistence and one-at-a-time delivery. Implement a local queue hook and visible rows above the composer, with Queue immediately after Steer. Capture text/settings on enqueue, keep new typing independent, and reuse a stable client message ID on explicit retries.
- [x] Layout: move desktop list outside EdenTabs; keep mobile account selection and Back. Add tab margins without the shared default content gap, tighten toolbar/composer spacing, use secondary subagent pills and compact mobile textarea. Suppress mobile list selection through the selected prop, not local paint overrides. Add compact RateLimitBar density for the usage footer without changing Accounts.
- [x] Mobile navigation: reproduce automatic focus/unmounted textarea and pointer-cancel cases in AppShell tests. Suppress automatic mobile composer focus; reconcile navigation after focused controls disappear and on route/window lifecycle, preserving click targets while explicitly typing.
- [x] Update page/design contracts. Verify affected unit tests, scoped lint against baseline, typechecks, production build and responsive browser checks including queue completion, focus/Back/navigation and small usage typography. Inspect screenshots and obtain read-only review; pull, commit and push.

## Verification

- Production build/typechecks passed. New queue/UI files pass scoped lint; existing App, ChatsPage and coordinator store diagnostics are unchanged from HEAD.
- 32 responsive Chromium journeys passed, including queue delivery after navigation, two-tab in-flight ownership, repeated mobile focus/Back, compact usage, transcript copy/source/history and composer bounds. Desktop/mobile screenshots inspected.
- Queue regression tests cover terminal events before acknowledgment and completion without an intermediate active render. Web Locks select one browser delivery owner; uncertain submissions remain visible for explicit retry.
- All 115 affected unit tests passed together after the Markdown reader test modeled actual user scrolling rather than assigning scrollTop during initial settling. An additional queue regression covers unavailable secure browser APIs; queued text is retained with an HTTPS/localhost requirement instead of crashing.
