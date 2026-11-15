# Queued task lists implementation plan

> **For agentic workers:** Execute inline using executing-plans; remain on main under repository instructions.

**Goal:** Replace title/prompt tasks with lists of description-only todos.

**Architecture:** The atomic JSON store owns lists, dates and todo states. Authenticated list summaries and selected-list reads feed consumer-owned TanStack queries. Eden controls supply the list card, badge dropdowns and parent-owned dialogs.

**Tech Stack:** Express/TypeScript, Next.js/React, TanStack Query, Eden/Radix, Vitest, Playwright.

## Constraints

Keep `manifests/queued-tasks.json` Git-tracked and discard the sole test todo with owner approval. No todo title field, no explanatory page copy, no edits to linked EdenMind. Description whitespace survives persistence and dispatch unchanged. States are manually controlled: Todo, Todo (priority), In Progress, Complete.

## Execution

- [x] Write persistence tests for concurrent additions, scoped lists, exact descriptions, stable dates, edit/status/move/delete and rejected commands. Run `npm test -- src/server/tasks/queuedTasks.test.ts`; confirm missing list methods fail.
- [x] Implement schema 2: `QueuedTaskList {id,name,createdAt}` and `QueuedTask {id,listId,description,createdAt,status}`. Serialize mutations and atomically rename JSON. Rerun persistence tests.
- [x] Add HTTP tests for auth/origin, closed requests, list-scoped reads, exact descriptions and missing resources. Implement GET/POST `/queued-task-lists`, scoped GET/POST `/queued-tasks`, PUT description, PATCH status/listId, DELETE. Reuse this router in browser fixtures.
- [x] Update typed browser API; test list/create/description/status/move/delete/send/retry through public UI. Add page-lifetime QueryClient; consumers own queries, local state owns only selection, drafts and dialogs.
- [x] Compose Create List over a one-section EdenListCard beside plain todo rows. Status uses EdenDropdown/EdenBadge; three-dot menu has Send to..., Move to List..., Delete. Plus below rows opens description editor. Shared modal presentation remains parent-owned.
- [x] Mobile displays Lists before a selected list; URL query selection supports reload and Back. No auto-dispatch or automatic status changes.
- [x] Run affected Vitest suites, typecheck and build sequentially. Exercise mobile/desktop browser flows on fixture port 4340 and inspect screenshots, overflow, keyboard Escape and focus return.
- [x] Update design contract and README. Review diff, commit only scoped files, pull and push main.
