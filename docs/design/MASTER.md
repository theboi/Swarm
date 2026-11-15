# Swarm design authority

Eden's linked `edenmind/docs/design/design-system/MASTER.md` owns tokens, typography,
shared controls and interaction states. Shared component changes belong in the
actual EdenMind checkout. Swarm owns its copied navigation, not Eden's navigation.
Swarm-specific composition refinements live in [Chats](pages/chats.md) and
[Todos](pages/queued-tasks.md) and [Navigation and appearance](pages/navigation-appearance.md).

Chats uses a plain transcript: assistant replies and expandable activities are
unboxed, with borderless superCompact EdenButton controls. Activity previews show
their first content line; extracted file badges belong inside expanded details.
The Chats contract records the approved composition and responsive behavior.
Chat lists use EdenListCard with list/detail mobile navigation; New chat is the
compact primary action. Source is monospace; thinking separates summary/content.
