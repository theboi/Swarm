## Separate live UI design from implementation

UI design exists when work introduces or changes visual hierarchy, layout, component treatment, responsive behavior, motion, interaction states, or interface copy. Create a separate UI-design worker for each coherent affected surface. Pure implementation of an already accepted design is ordinary implementation and does not create another design worker.

Whenever an output instantiates a UI-design worker—a brief, worker package,
lifecycle, or launch prompt—it includes this reference map:

**Design-method reference map:**

- Repository instructions: `claude-design/codex/AGENTS.md`
- Design-system prompt: `claude-design/codex/system-prompt.md`
- Relevant design procedures: `claude-design/codex/skills/`
- UI polish guidance: `.agents/skills/better-ui/SKILL.md`

Tell the worker to consult the relevant source and linked supporting reference
when the current design or implementation decision needs it. Do not require the
worker to read every source end-to-end before its first useful task action.

The UI-design worker has no
implementation plan. During presentation design it may produce only a fixture/mock-backed,
presentation-and-contents design; it must write both an accepted presentation
handoff and a separate UI requirements contract using
`references/ui-requirements-template.md`. Those two artifacts, together with
approval evidence, are consumed by the coordinator before completing the
live-wiring implementation plan. The UI designer does not write that plan.

The UI-design worker may edit composition, hierarchy, spacing, responsive arrangement, visual component variants, motion, interface copy, and interaction-state presentation in the actual application, but must make those states deterministic with fixtures/mock data. It may not create or change live API calls, authorization, persistence, migrations, domain rules, scoring, background processing, or other business behavior. A discovered functional need returns to the coordinator and is captured in the UI requirements contract for the coordinator-authored live-wiring plan.

Before editing, inventory and reuse the repository's existing components, tokens, typography, spacing, icons, motion, and interaction patterns. Do not create a competing component library or token system. Start the established live development server, publish its command and localhost URL, keep it available through iterative user feedback, and verify the rendered application in a browser. Show a working skeleton early, incorporate user feedback in the real app, and repeat until approval or a material product decision blocks design. When alternatives make feedback cheaper, use a small set of substantively different options in one temporary toggleable comparison surface backed by shared components. Remove rejected comparison-only code after approval unless the user explicitly accepts a development-only comparison control.

The primary product surface starts with its real task controls, navigation, or
content inside the established application shell. When that shell already
identifies the route, retain one accessible page heading as visually hidden and
give the visible space to the task. The default rendered shape contains no
extra workspace eyebrow, repeated page title, descriptive introduction, welcome
banner, or summary-card strip above the actual content. A visible task header is
included only when an approved surface contract assigns it distinct changing
state, context, or actions that cannot live with the content controls. Treat
this as a presentation acceptance check for every UI-design worker.

Apply the same necessity test to visible copy across the entire surface, not
only above the primary content. Every visible copy block must do at least one
of these jobs: label an operable control or destination; expose changing
context, state, or value; state an actionable consequence, blocker, error, or
recovery; or provide a required legal, safety, privacy, or mock-data
disclosure. If it does none of them, omit it. Do not fill open layout space with
explanatory headings, subtitles, welcome or reassurance copy, tips, helper
cards, summary prose, or restatements of controls and values already visible
nearby. Preserve useful whitespace and solve hierarchy with composition and
spacing. Audit every visible copy block against this test before presentation
review.

A localhost presentation is review-ready only when the application and every runtime dependency required to enter the presentation are running against one coherent, account-owned endpoint set. Follow the repository's local setup and runtime-isolation authorities: use an account-isolated helper when present, otherwise execute the deterministic account-local procedure directly with the pinned tools, assigned ports, generated workdir, and exact namespace. A missing convenience wrapper alone is not a blocker. Prove that each listener and local container belongs to the current worker account, and treat an occupied assigned port or an inability to express the required isolation contract as a blocker instead of silently reusing another account's healthy process. Start required authentication emulators or services, local Supabase, APIs, seeds, or other access prerequisites even when the presentation data itself uses fixtures. Verify that the client's public Supabase origin and the API's Supabase origin, issuer, JWKS endpoint, and session store identify the same local project; a successful password grant against one project is not proof that the API will accept that session. Diagnose a `431` before auth: prove a no-cookie request reaches application handling, then use secret-free synthetic request-header sizes to find the accepted/rejected boundary and inspect the exact host's cookie accumulation. Distinct cookie names prevent session overwrite but do not stop a browser from sending every matching cookie for the same host. Prefer an account-specific review hostname and exact cookie cleanup; a bounded client-only header-ceiling increase may preserve an existing compatibility ingress, but is not isolation and requires accepted/rejected canaries plus a rollback. Publish the review port on loopback only. A containerized client may internally listen on `0.0.0.0`, and a framework may canonicalize that internal bind, only when the external host publication stays loopback-only and the development-fixture guard proves the public Supabase origin is loopback; never hand off a wildcard URL. Prove dependency health and authenticate one documented local fixture identity without publishing secrets. The login canary must exercise the application sign-in form, confirm that the API accepts the resulting session, enter the protected presentation route, and sign out; when a browser is available, perform that journey there. For a protected fixture presentation, the exact launch also starts from `edenmind-client`, exports matching account-specific `EDENMIND_AUTH_COOKIE_NAME` and browser cookie values, and uses `--fixture --review-as <identity>`; generic `--fixture` is insufficient. Run sign-out evidence before final no-cookie and stale-cookie protected-route checks that prove automatic review bootstrap, matching API `/v1/me`, visible presentation content, the runtime-specific cookie namespace, and no `431`, then leave the review route authenticated. Keep the application and access dependencies alive through user review. A `431`, protected-route redirect, sign-in-page `200`, generic error page, Supabase-only password grant, or final canary that leaves the route signed out is never login proof or a valid presentation handoff. If browser integration is unavailable, record that visual limitation, but still run the same endpoint-consistent login canary through an approved non-visual interface before asking the user to review.

Keep those review processes under a named account-owned holder independent of
the worker's interactive command or chat session. End the launching command
session, inspect the holder and exact listeners from a separate command, and
record redacted inspection and restart instructions. A temporary foreground or
yielded tool process is not evidence that the URL will survive handoff.

The reviewer-entry canary is separate from the worker's login canary. Launch the repository's approved fixture-review mode when it exists, using the assigned loopback hostname and account-local cookie name. Navigate directly to the exact handed-off protected URL from both (1) a fresh context with no cookies and (2) a fresh context carrying a stale default or other-runtime auth-cookie name. In both cases, the final URL must be the protected presentation, its content must render, the API must accept the real local Supabase identity, and only the assigned account-local auth-cookie namespace may be issued. When fixture-review mode exists, the user must not need to enter credentials or inherit the worker's browser session. Without this proof, hand off the sign-in entry point and access instructions instead of calling the protected URL review-ready. Keep the application and access dependencies alive through user review. A worker-authenticated browser, protected-route redirect, sign-in-page `200`, Supabase-only password grant, or “the reviewer may need to sign in” caveat is never proof that the handed URL is review-ready. If browser integration is unavailable, record that visual limitation, but still run both endpoint-consistent reviewer-entry cases through an approved non-visual interface before asking the user to review.

The UI-design handoff records the accepted app-state commit reachable from `origin/main`, user approval evidence, affected routes/components and reused design-system foundations, verified applicable wide, narrow, interaction, keyboard/focus, and reduced-motion states, the development-server command and reviewed localhost URL, required access-runtime commands and endpoint health, the source of the documented fixture identity without secret values, fresh/no-cookie and stale-cookie reviewer-entry proof with the effective account-local cookie name, retained limitations and functional decisions returned to the coordinator, and the implementation worker that receives mutable ownership. The separate UI requirements contract records required reads, commands, actor capabilities, lifecycle/error states, navigation/client state, files/exports, accessibility, fixtures, planned-contract traceability, implementation acceptance and unresolved decisions. The coordinator consumes it while authoring the live-wiring plan; it is not live wiring and does not start an ordinary worker planning pass.

The design worker owns the named presentation files until its accepted handoff is integrated into `origin/main`. Transfer mutable ownership to the implementation worker only afterward; the two workers never edit the same mutable UI surface concurrently.
