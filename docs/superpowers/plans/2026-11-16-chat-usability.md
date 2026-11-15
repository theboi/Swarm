# Chat usability implementation plan

**Goal:** Reliable message copy, monospace source, meaningful thinking disclosures, shared chat lists with mobile back navigation, and the /todos route.

**Architecture:** Keep the accounts picker and Express API intact. Reuse EdenListCard/EdenListCardItem for chat summaries; retain the existing chat draft and transcript owners. Handle browser clipboard differences in a private copy helper, with explicit failure and transient success feedback.

## Tasks

- [x] Add failing clipboard tests for missing/rejected browser API, failed fallback and repeated copying after streamed updates; implement copy fallback with selection/focus restoration and no false success.
- [x] Add failing reasoning tests for empty payloads, separate summary/content and content-only payloads. Render summary as preview, content on expansion, and Thinking... for both empty; source uses monospace.
- [x] Add list/back regression tests, replace bespoke chat rows with shared list controls and make New chat compact/primary. Keep account presentation intact and constrain internal scroll areas.
- [x] Rename frontend /queued-tasks to /todos, including navigation, generated static route and list-selection URLs. Preserve /api/v1/queued-tasks and manifests/queued-tasks.json.
- [ ] Run focused tests, typecheck/build, responsive browser checks and read-only review. Update contracts, pull, commit and push verified changes without restarting live Swarm.

## Verification checkpoint

- 135 focused tests passed before the final unread guard, plus the new unread regression passed after observing its expected failure.
- Production build and client/server typechecks pass.
- Read-only review caught hidden mobile details clearing unread notifications. Detail visibility now gates reads, read marking, polling and late-response acceptance; the follow-up review found no remaining issue.
- Static frontend tests observed /todos returning a directory redirect before the fix; /todos, /todos/ and selected-list HTML now serve without redirects. Frontend parsing canonicalizes the trailing slash.
