# Navigation and appearance implementation plan

> **For agentic workers:** Use executing-plans task-by-task. Work directly on main; preserve concurrent edits.

**Goal:** Copy Eden chrome into Swarm, reuse the shared settings shell and support persisted light/dark appearance with rich queue status options.

**Architecture:** Swarm owns navigation and legacy-history route adapters. Actual Eden owns dropdown labels and SettingsLayout's optional navigation slot. Relative symlinks reuse those sources. AppearanceProvider owns only browser-local appearance.

**Tech Stack:** Next static export, React, Express/TypeScript, Eden/Radix, SCSS Modules, Vitest and Playwright.

## Global constraints

- Never modify Eden navigation or introduce a shared navigation component.
- No top bar, upload action, rail labels, explanatory eyebrows or paragraphs.
- Retain chat drafts, typing-nav suppression, safe-area space, keyboard and native modified links.
- Shared changes go into actual Eden; tagged edits require human review comments.
- Verify before commits; pull before pushing both repositories. Do not touch live ports4310/4311.

## Task 1: Rich shared dropdown options

Files: actual Eden `EdenDropdown/{index.tsx,index.test.tsx,styles.module.scss}`, authority and dashboard contract; Swarm `QueuedTasksPage/TodoRow/index.tsx` and parent tests.

- [x] Write failing tests for badge labels and readable summaries/accessibility.
- [x] Add ReactNode labels, optional textValue, derived readable summaries and label-only action insets.
- [x] Run dropdown tests/lint/typecheck; integrate queue single-select badges and verify keyboard mutation.
- [ ] Commit verified integration.

## Task 2: Appearance and shared settings shell

Files: `AppearanceProvider/`, `app/layout.tsx`, `app/SwarmApp/index.tsx`, `App.tsx`, `navigation.ts`, catchall static params, server staticAssets; actual Eden `SettingsLayout/index.tsx` and tests; Swarm linked settings shell and content.

- [x] Test saved-light, blocked storage, theme application and canonical settings routing before implementation.
- [x] Implement provider API `useAppearance(): {theme: 'dark'|'light', setTheme(theme): void}` and early bootstrap.
- [x] Add optional ReactNode navigation slot preserving default Eden behavior; link layout and breakpoints.
- [ ] Verify focused tests, direct exported routes and appearance navigation/reload in browser; commit.

## Task 3: Swarm-owned chrome

Files: `AppShell.tsx`, `AppShell.test.tsx`, new `SwarmNavigation/{index.tsx,styles.module.scss}`, coordinator global shell styles.

- [x] Write failing tests for Settings links, tablet range, More dismissal/focus and modified links.
- [x] Copy Eden rail/bottom composition without upload/topbar; icon-only rails and local More disclosure.
- [ ] Run focused tests, full typecheck/build and viewport browser checks; fix observable regressions.
- [ ] Review diff against scope, update verification evidence, pull/commit/push only relevant files.
