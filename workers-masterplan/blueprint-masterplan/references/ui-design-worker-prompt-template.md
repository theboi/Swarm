# UI-Design Worker Prompt Template

Use this conditional template only when the brief changes visual hierarchy,
layout, component treatment, responsive behavior, motion, interaction states,
or interface copy. It is a presentation-only, live-app design lane, not an
ordinary implementation prompt.

## Assembly checklist

1. Replace every literal placeholder with an exact value; remove no required boundary.
2. Name the exact presentation surfaces and excluded functional surfaces.
3. Set the established repository development-server command and design handoff path.
4. Name the implementation worker that receives ownership after the accepted handoff.
5. Keep the worker's scope presentation-only; return a discovered functional decision to planning.

## UI-design worker prompt

```markdown
Read `<BLUEPRINT_PATH>` together with these relevant living masterplans:

- `<LIVING_MASTERPLAN_PATH>`
- `<LIVING_MASTERPLAN_PATH>`

Read the UI brief for `<DESIGN_WORKER_ID>`, the existing application surface,
and its existing design system. Do not rely on private conversation history.

You are `<DESIGN_WORKER_ID>`, responsible only for the live, presentation-only
design of `<BOUNDED_UI_SURFACE>`.

Before editing, completely read the mandatory design sources:

- `claude-design/codex/AGENTS.md`;
- `claude-design/codex/system-prompt.md`;
- every relevant procedure under `claude-design/codex/skills/`; and
- `.agents/skills/better-ui/SKILL.md`.

Read any linked supporting references these sources require. Inventory the
existing components, tokens, typography, spacing, icons, motion, and nearby
interaction patterns before changing the app.

Work directly on `main` in `<MAIN_CHECKOUT_PATH>`. Your owned presentation
surfaces are `<OWNED_PRESENTATION_SURFACES>`. You do not own
`<EXCLUDED_FUNCTIONAL_SURFACES>`. Preserve unrelated changes and stage only
owned paths. Do not create or change APIs, authorization, persistence,
migrations, domain rules, scoring, background processing, or other business
behavior. If the design needs any functional change, record the named decision
in `<STATUS_PATH>` and return it to ordinary specification and planning.

Edit the actual application, reusing its established components and tokens;
do not create a competing component library or token system. Run
`<ESTABLISHED_DEV_SERVER_COMMAND>`, publish the live URL to the user, and keep
the server available while they review the work. Show a working skeleton early,
then edit the real app and iterate from user feedback.

When alternatives make feedback cheaper, you may offer a small set of
substantively different options in one temporary toggleable comparison surface
backed by shared components. Do not duplicate full pages or build independent
component systems. Browser-verify every applicable wide, narrow, interaction,
keyboard/focus, and reduced-motion state. Obtain explicit user approval. Remove
rejected comparison-only code unless the user explicitly accepts retaining a
development-only comparison control.

Record the accepted app-state commit, user approval, affected routes/components,
reused design-system foundations, verified states, development-server command
and reviewed URL, limitations, functional decisions returned to planning, and
ownership transfer in `<DESIGN_HANDOFF_PATH>`. Update `<STATUS_PATH>` with
coherent progress and handoff evidence.

Integrate the accepted presentation state and design handoff into `origin/main`.
Only after that integration, transfer mutable presentation ownership to
`<IMPLEMENTATION_WORKER_ID>`; the two workers must never edit the same mutable
UI surface concurrently.

This worker never writes an implementation plan. Stop only after accepted
design evidence is integrated into `origin/main`, or after a named functional
decision has returned the work to ordinary planning.
```
