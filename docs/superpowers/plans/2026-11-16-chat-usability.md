# Chat usability implementation plan

**Goal:** Reliable message copy, monospace source, meaningful thinking disclosures, shared chat lists with mobile back navigation, and the /todos route.

**Architecture:** Keep the accounts picker and Express API intact. Reuse EdenListCard/EdenListCardItem for chat summaries; retain the existing chat draft and transcript owners. Handle browser clipboard differences in a private copy helper, with explicit failure and transient success feedback.

## Tasks

- [x] Add failing clipboard tests for missing/rejected browser API, failed fallback and repeated copying after streamed updates; implement copy fallback with selection/focus restoration and no false success.
- [x] Add failing reasoning tests for empty payloads, separate summary/content and content-only payloads. Render summary as preview, content on expansion, and Thinking... for both empty; source uses monospace.
- [x] Add list/back regression tests, replace bespoke chat rows with shared list controls and make New chat compact/primary. Keep account presentation intact and constrain internal scroll areas.
- [x] Rename frontend /queued-tasks to /todos, including navigation, generated static route and list-selection URLs. Preserve /api/v1/queued-tasks and manifests/queued-tasks.json.
- [x] Run focused tests, typecheck/build, responsive browser checks and read-only review. Update contracts, pull, commit and push verified changes without restarting live Swarm.

## Verification checkpoint

- 172 affected unit/integration tests pass across chat, transcript, clipboard, route, navigation, Todos, API and static-asset suites.
- Production build and client/server typechecks pass.
- Read-only review caught hidden mobile details clearing unread notifications. Detail visibility now gates reads, read marking, polling and late-response acceptance; the follow-up review found no remaining issue.
- Static frontend tests observed /todos returning a directory redirect before the fix; /todos, /todos/ and selected-list HTML now serve without redirects. Frontend parsing canonicalizes the trailing slash.
- Final production browser run: 20 chat, turn-history and transcript-usability journeys pass, including real clipboard reads after available, missing and rejected Clipboard API writes; monospace source; separate thinking content; mobile Back/draft restoration; and viewport containment from 280px to 1440px.
- Four dashboard and six Todos browser journeys also passed in the earlier combined run. Main agent directly inspected desktop, mobile-list, mobile-conversation and source/thinking screenshots.
- Browser regression found an autosizing textarea measured while its detail stage was hidden. Mounting only the textarea when visible fixes baseline sizing without losing its parent-owned persisted draft. Clipboard browser cases now isolate their read-only fixture state from other journeys that archive chats.
- Scoped ESLint diagnostic categories/counts match the pre-existing baseline; no new diagnostics. Actual Eden shared components and live processes were not changed or restarted.

## Concurrent integration verification

- Preserved incoming e295e97 (simplified toolbar and always-visible conversation messages) during the required pre-push pull. No incoming implementation changes were reverted.
- Rechecked all 117 chat/transcript/clipboard unit tests after integration; all pass. Production build and complete client/server typechecks pass on the combined version.
- Updated browser turn-history expectations to keep the opening user message visible while activity/commentary remains collapsed. All 30 browser journeys pass in one final combined run: chats, turn history, real clipboard/source/thinking, dashboard and Todos.
- Inspected final desktop and mobile conversation screenshots directly. The copy fallback remains Swarm-local; a reusable Eden clipboard hook is a potential shared follow-up.
