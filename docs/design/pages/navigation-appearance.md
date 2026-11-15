# Navigation and appearance

Swarm copies Eden's navigation chrome into its own SwarmNavigation component;
Eden navigation remains unchanged and is not shared. There is no top bar or
upload action. The tablet (768–1279px) and desktop (1280px+) rail is 88px wide,
icon-only, with native accessible links and the Settings utility at the bottom.
Rail links retain Eden's stationary 48px surfaces and accent selected state.
Selected navigation foregrounds use Eden's `--accent-strong` token so labels
meet normal-text contrast in both themes; Eden's own navigation is unchanged.

Mobile uses Eden's floating 72px bottom bar, 8px side insets and safe-area-aware
14px bottom spacing. Home, Accounts and Todos are direct destinations;
More exposes Chats and Settings, dismisses outside/on Escape/after navigation,
and restores trigger focus on Escape. Notification dots also reach More.
Reserve 100px plus safe-area below content. Chat typing hides navigation and
reclaims that space without losing drafts or moving an in-flight click target.

Settings has only Appearance at `/settings/appearance`; `/settings` canonicalizes
there. Reuse the actual Eden SettingsLayout through a relative symlink, injecting
Swarm's route-aware navigation without changing Eden's navigation components.
The appearance content has only the Color theme heading and Dark/Light choices,
using EdenCard/EdenCardButton and the established appearance previews.

Theme changes apply immediately to the document and Radix Theme. Save a validated
`dark`/`light` value at browser-local `swarm.appearance.v1`, defaulting to dark.
An early validated bootstrap restores the saved theme; blocked storage falls
back to the current mounted session. No server preference or extra settings page.
