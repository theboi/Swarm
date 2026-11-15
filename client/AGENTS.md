# EdenMind client instructions

Stack: Next.js App Router, React, TypeScript, Zod, TanStack Query, Radix Themes, SCSS Modules, Supabase, Vitest, Playwright.
Applies to `edenmind-client/`; paths are client-relative unless prefixed with `../`.

## Working rules

- Follow root `AGENTS.md`: work on `main`, preserve unrelated changes and obey
  review tags. Read targets, callers, dependencies and tests before editing.
- Apply conventions to new code and the active review boundary only. Preserve
  intended behavior, generated files and owner deletions; avoid unrelated migrations.
- Frontend entities: `teacher`, `cohort`, `class`, `student`, `learning`; IDs:
  `learningId` / route `learning_id`, never `learningRecordId` / `learning_record_id`.
  Backend `_record` names belong only in generated/native fixture contracts and
  explicit API decoding/serialization. Map at boundaries; no dual-vocabulary parsers.
- Pre-live: change contracts in place/reseed; no legacy aliases, compatibility layers, migration fallbacks or repair paths.
- One responsibility per function; group related functions, document unclear ownership; no one-file-per-function fragmentation.

## Folders and exports

- Under `src/features/<feature>/`, agents may add only `components/` and `data/`.
  New features need explicit owner authorization and coherent responsibility; no unrelated umbrella features.
- No new feature-root files or sibling folders (`contracts`, `actions`, `hooks`,
  `utils`, `testing`, `report`, `document`, `statistics`, etc.). Keep types, hooks,
  helpers and test support beside their owning component or data operation.
  Generic infrastructure stays in its existing shared owner; exceptions authorize no new ones. Co-locate tests.
- UI: `components/<Component>/index.tsx`, adjacent `index.test.tsx` and, when styled,
  `styles.module.scss`. Private children live under parents; shared UI at its nearest shared owner.
- Dashboard `components/widgets/`: exactly `ticker`, `quick_action`, `core`, `sticky`; subtypes/private children stay inside.
- Data: `data/<httpMethod><Resource>/index.ts` + `index.test.ts`; lowercase HTTP
  prefix matches the actual method. Each scope owns types, private Zod schemas,
  a private fetcher and exported `{ key, fn }` operation. Export only the operation
  and relevant types; no separate feature contracts, clients or schema files.
- `data/domain.ts` composes queries/mutations and extends `EdenMindDomainRegistry`;
  it needs no HTTP prefix. `features/app/domains.ts` assembles runtime domains for
  client EdenMindProvider loading; no import-side-effect registration. Tests may
  inject domains. No general re-export barrels. Generic provider types stay under
  `features/app`, without feature names/types; new features must not change provider internals.
- Primitives: `src/components/ui`; unavoidable shared business UI: `src/components/shared`;
  reusable business-agnostic hooks: `src/hooks`; other helpers/hooks stay with their owner.
- Named exports except Next.js-required defaults; `@/` across folders, local relative imports, explicit type-only imports.
- Operation examples: [getLayout](src/features/dashboard/data/getLayout/index.ts),
  [putLayout](src/features/dashboard/data/putLayout/index.ts), [domain](src/features/dashboard/data/domain.ts).

## Providers and server data

- EdenMindProvider supplies feature domains via `useEdenMindProvider`.
  WorkspaceProvider owns authenticated scope, authorization gates, TanStack hooks,
  scoped cache, aborts, departed-workspace suppression and its QueryClientProvider:
  one query client per workspace lifetime, never at the app root. Required accessors throw if absent.
- Consumers call `useWorkspaceQuery(domain, { resource, ...input })` /
  `useWorkspaceMutation(domain, { resource, ...input })` themselves. Reads precede
  local state/effects; name results `query` (descriptive `...Query` for multiple reads) and `mutation`.
- Finite reads use `useSuspenseQuery`; the consuming component owns a
  `WorkspaceQueryBoundary` for loading and query-error reset/retry. Do not wrap
  TanStack components directly in React `Suspense`, including in pages/layouts;
  configure the component's `WorkspaceQueryBoundary` fallback instead and remove
  redundant caller boundaries. Never render query states via `isLoading`, `isPending` or `isError`.
  Keep mutation feedback local; preserve empty, denied and domain-result states.
- Follow [DashboardHeader](src/features/dashboard/components/DashboardHeader/index.tsx):
  exported `ComponentName` returns `WorkspaceQueryBoundary` with its loading/error
  UI and renders `_ComponentName`, which owns queries, logic and content in the
  same `index.tsx`. Share `ComponentNameProps`; never default the props object to `= {}`.
  Remove redundant caller/page boundaries; preserve gating, reset keys and lifecycle
  boundaries. Test the public component's loading/errors without an outer boundary.
- Components define neither fetchers nor cache keys. Scopes key every response-changing
  ID, date, filter, cursor and version; WorkspaceProvider adds session/viewer scope.
- Send commands to `mutation.mutateAsync(command)`. Operations declare invalidation
  by reusing affected read-key functions; workspace lifecycle guards invalidation.
  Component callbacks own UI effects.
- TanStack owns shared server state: no local copies, page snapshots, long prop
  chains or context containing entities, datasets, graphs, query/mutation results
  or server-service callbacks. Query deduplicates subscriptions; a minor private child may take immediate-parent data.
  Feature context: local selection IDs, views, dialogs, dirty guards only; drafts/gestures/derived presentation stay local.
- Read summaries for lists; fetch selected details/graphs and form choices on demand.
  Gate authorization and optional dependencies (including hidden mobile stages and
  unopened dialogs) before requests. Gated queries stay idle without data or fetching.
  Never fetch aggregate pages and select slices in the browser, even with separate subscriptions.
- One data scope per HTTP operation; no unrelated requests or hidden workflows in
  fetchers. BFF owns transactions; client orchestration stays explicit beside its component.
  Mirror upstream HTTP methods: read-only POSTs use queries and `post...` filenames.
- Pagination/filter inputs belong in scope/key. Dependent reads wait for valid
  inputs, never empty/fabricated IDs; extend dependency gating explicitly if needed.
  Infinite reads require a guarded workspace hook with cursor semantics, not component
  `useQuery`. Preserve abort, authorization and cache isolation for imperative/polling/infinite reads.
- Add focused transport/lifecycle support when uploads, polling or optimistic writes
  need it; basic hooks do not imply progress, infinite pagination or optimistic rollback support.

## API routes and fixtures

- For seed data changes, edit the seed files and then reseed with the root
  `npm run seed:database -- --seed <demo-seed|live-seed>` command. Never directly
  modify SQL or database rows to edit seed data; follow the API seed rules.

- Browser scopes always call the same `/api/v1` routes, never external backends,
  Supabase, files or fixture/live clients; no browser mode switches. Both modes
  use the same edenmind-api and Supabase read path.
- Dev overrides live in `app/api/dev/`, mirror normal `/api` paths minus `/dev`,
  match method + path, and fall through to the real proxy when unregistered.
  Regenerate `_routes.generated.ts` via `scripts/fixture/generate-dev-routes.mjs`
  after adding/removing overrides; the launcher also does this at startup.
- Fixture JSON is authoritative. TS dev handlers edit source JSON and await launcher
  coordinator acknowledgment of that exact imported seed revision before success.
  No application snapshots or Python mutation subprocesses. The Python seed
  compiler/importer remains provisioning tooling; fixture startup owns an ordinary API on local Supabase.
- Thin handlers: backend/auth integration in `lib/api`; fixture lifecycle/JSON edits
  in `app/api/dev/`; authoring helpers in `app/api/dev/_fixture/`; isolated test
  dependencies in `src/tests/support/fixtures/`. Reuse these; no application read providers.
- Validate untrusted inputs/responses; authorize every request from verified server
  identity. Browser permissions/user-supplied IDs confer no authority. Preserve meaningful statuses/conflicts.

## Routes, UI and styling

- Pages named `SomePage` own `<main>` and the page structure. Large pages with
  multiple sections/regions define that structure in `page.tsx` and import a
  concrete component for each substantial region/segment.
- Simple pages define their content and behavior directly in `page.tsx`; do not
  create a single-use feature component for the entire page and make `page.tsx`
  merely import/render it (for example, `AppearanceSettingsPage` must define the
  appearance page directly, not just render `SettingsAppearance`). Extract a
  whole-page component only when it is actually reused by other routes. A required
  client/Suspense boundary may justify a focused child, not an extra page wrapper.
  Keep pages server components where possible; a simple interactive page may use
  `"use client"` directly. Multi-region server pages compose focused client regions.
- Server layouts guard authenticated groups and share chrome. Omit explanatory
  page headers/descriptions and sample/mock labels.
- Smallest interactive `"use client"` boundary; Next navigation/images/fonts, Eden/Radix primitives, `.next` only.
- Function declarations for components, `React.*` types, destructured props; prefer
  derived values, guards, async/await, `type` and local state; `interface` for merging.
  No `any`, unsafe assertions or unnecessary effects. True constants: UPPER_SNAKE_CASE.
- Before UI work read [design authority](../docs/design/design-system/MASTER.md)
  and the applicable `../docs/design/design-system/pages/` contract; inspect shared
  controls and the class dashboard/relevant screen. Approved style changes update
  authority + affected contracts together; never override geometry to match stale prose.
- Mobile-first SCSS Modules; each component owns styles, no parent overrides or
  `:global`. Tokens: `src/app/theme.scss`; breakpoints: `src/app/_theme.scss`;
  Radix controls: `src/app/radix.scss`. Reset/theme/Radix styles stay global;
  raw colors belong in foundations.
- Global styles own focus rings: no local `:focus-visible` rules. Use React `tabIndex`,
  never `indexTab`: `0` for appropriate tab stops, `-1` for programmatic focus.
  Neither suppresses focus rings; passive containers get no tab stop just for styling.
- Direct `:hover`, no hover/pointer media gates or `:not(:disabled):not(:active)`
  guards. Scope/order active and disabled styles to override hover. Cards/control
  containers stay stationary: no lift or local scaling. Preserve visible keyboard focus and reduced motion.
- Icons always use [EdenIcon](src/components/ui/primitives/EdenIcon/EdenIcon.tsx);
  no `lucide-react` icon/type imports outside EdenIcon. Registry names use Lucide lower-camel
  spelling (`waypoints: Waypoints`), never semantic aliases (`graph: Waypoints`).
  No `appearance` glyph selection or `compactOverrides`; callers choose explicit names/sizes.
- Preserve accessible names (including dynamic titles), keyboard behavior and status
  messages. Use `aria-label`, never `aria-labelledby`; Radix `VisuallyHidden` from
  `@radix-ui/themes` with `asChild` for semantics, never custom hidden-text CSS.
  Keep implementation jargon out of product UI.

## Shared surfaces and interactions

- Reuse EdenButton, EdenField, EdenSelectDropdown, EdenSegmentedControl and Eden
  overlay provider; preserve density, radius, focus, borders and gradients.
  No superseded 52/46px control tiers or feature overrides of shared geometry.
- Every card-like content surface uses [EdenCard](src/components/ui/primitives/EdenCard/index.tsx);
  whole-card actions use [EdenCardButton](src/components/ui/primitives/EdenCardButton/index.tsx).
  Defaults: `radius="lg"`, `isFloating={false}`; other radii via canonical prop;
  `asChild` preserves semantics/links. Callers own content, headings, padding/layout,
  not duplicate baseline borders/radius/fills/shadows; preserve intentional tints.
  Inputs, chips, navigation, menus, dialogs and chart graphics are separate controls.
- EdenCardButton owns `cardAccent` and stationary hover/pressed/disabled treatments:
  semantic accent border + inset highlight, stable size/position/border width.
  Ordinary cards have no elevation; passive cards have no interactive hover.
- Cards have one clear title, quieter metadata, one native action target, a clear
  action cue and no nested buttons. Compact dashboard actions retain existing labels.
- Paper previews: worksheet screenshot → supplied stock worksheet photo → text-only;
  same fallbacks on failure; no fake worksheet repeating the title. Next Image with appropriate alt text.
- Subject color: `stringToAccentColor(subjectId)` in `src/lib/utils/colors/index.ts`,
  never display name/order. Accessible source icons; paper-category badges:
  Topical paper, Yearly paper, Mixed paper, Curated for you.
- Shelves own overflow and keyboard/arrow controls, disabled at scroll edges;
  no horizontal page overflow; preserve offered vertical-list alternatives.
- Card previews use Eden modal lifecycle. Verify pointer/keyboard opening, Escape,
  focus restoration and repeated opening under Strict Mode (required for Next dev lifecycle).

## Dashboard widgets

- Design for an immediate decision: one clear purpose per widget, a readable
  hierarchy, quiet supporting metadata and a useful next action. Avoid repeated
  summaries, unexplained metrics, decorative numbers and filler copy. Preserve
  approved designs when wiring data; use Cordial tokens and shared primitives.
- Use the shared Core row, Core item or Sticky base. Labels are optional; omit
  absent headings and do not repeat a title inside the body. Put trailing header
  controls in `actionButton`. Settings use a ghost EdenButton with
  `density="superCompact"` and EdenSelectDropdown; options are groups shaped
  `{ title?: string, items: [{ label, value }] }`, with direct choices, no nested
  dropdowns and no section heading when `title` is absent.
- Every settings-driven server read must follow the CurrentSkillsStickyWidget
  pattern: wrap the setting update in React `useTransition`/`startTransition`,
  keep the existing result visible through Suspense, and bind transition pending
  state to `aria-busy` on the affected content region. This is React transition
  state, not TanStack Query loading flags. The pattern also applies to components
  outside the dashboard. Let the shared busy styles grey the
  content; do not add local opacity overlays or fake loading timers. Retain the
  settings trigger and its focus; guard actions that would consume stale results.
  Initial loading and failed reads still use the normal query boundaries.
- Core row item cards are fixed at and capped to 300px. Specify width through
  DashboardCoreRowItemBase rather than overriding shared geometry. Full-row and
  Sticky widgets follow their own base contracts. When local settings require a
  widget to own its card, declare that ownership in the registry so the renderer
  does not add a second card/header. Keep registry eligibility, zone placement,
  default layouts and API layout contracts aligned when moving widgets.
- Widgets subscribe directly to the scoped `/data` functions they consume. Fetch
  only the summaries needed; globally rank on the server before limiting results,
  and do not fetch an entire graph just to label a few rows. Keep unavailable
  values distinct from zero and label date/time boundaries accurately. Requested
  hardcoded design previews stay separate from live data; replace examples when
  wiring is authorized. Report the `/data` functions and endpoints used, and
  explicitly say whether any were created or extended.
- Verify settings changes with a delayed response: old content remains visible,
  `aria-busy` turns on and then clears, replacement results are correct, and
  keyboard focus survives menu dismissal. Also verify initial loading, errors,
  empty/unavailable states, narrow-width fit, and the applicable height contract.

## Nivo charts

- Follow [NodeSunburst](src/features/reports/components/ReportPage/PreviewToolbar/CurriculumComparison/NodeSunburst/index.tsx)
  and [TopicHistory](src/features/reports/components/ReportPage/PreviewToolbar/CurriculumComparison/TopicHistory/index.tsx).
  Inherit font family, 11px SVG labels, semantic foreground; `animate={false}` unless motion has a product purpose.
- Reuse [scoreColor](src/features/reports/components/ReportPage/scoreColor.ts) with
  0–100 percentages and `low: "var(--red-500)"`, `middle: "var(--yellow-500)"`,
  `high: "var(--accent)"`. Preserve continuous OKLCH interpolation and opaque fills;
  no accent buckets/categorical palettes. Neutral structural parents; unavailable
  scores use `var(--border)`, never 0%. Include percentage labels or accessible summaries.
- Where geometry supports: 3px segment/cell corners, 2px `var(--surface-raised)` separators.
- Tooltips: `var(--surface-raised)`, `var(--fg)`, 1px `var(--border)`, `var(--radius-md)`,
  `var(--shadow-float)`, 10px 14px padding, 5px gap, 12px text. Non-intercepting
  (`pointer-events: none`); show hovered datum/value, clear on leave. Let Nivo position
  tooltips; chart-relative positioning only for custom layers owning their lifecycle.
- `ResizeObserver` + explicit dimensions, as in examples; responsive wrappers can
  yield zero-width SVGs under `svg { max-inline-size: 100% }`. Verify browser dimensions
  with app reset/theme, including narrow cards and tooltips.

## Verification

- Run tools from `edenmind-client/`. TS/JS edits: scoped ESLint + narrowest meaningful
  tests; before handoff, affected broader checks. Report skips/limitations; never weaken tests.
- Unit tests live beside their implementation, including tests of test-only helpers.
  Multi-page UI integration/visual tests live in `src/tests/ui`; Playwright journeys,
  fixtures and descriptively named configs live in `src/tests/e2e`. Shared test-only
  helpers/simulations live in `src/tests/support`, with their own unit tests adjacent.
  Do not recreate `src/test`, root `e2e`, root Playwright configs or worker-named
  suites/configs. Mock only external/impractical boundaries.
- `package.json` is authoritative: `npm run dev -- --live|--fixture`, `npm run build`,
  `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`,
  `npm run test:e2e`, `npm run check:theme`, `npm run check:publication`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
