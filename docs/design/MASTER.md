# Swarm design authority

Eden's linked `edenmind/docs/design/design-system/MASTER.md` owns tokens, typography,
shared controls and interaction states. Shared component changes belong in the
actual EdenMind checkout. Swarm owns its copied navigation, not Eden's navigation.
Swarm-specific composition refinements live in [Chats](pages/chats.md) and
[Todos](pages/queued-tasks.md) and [Navigation and appearance](pages/navigation-appearance.md).

Chats uses a plain transcript: assistant replies and expandable activities are
unboxed, with superCompact EdenButton controls. Auto-resume, archive and transfer
use secondary icon buttons; scroll-to-bottom uses a floating secondary button.
Other transcript/composer actions retain borderless controls. Activity previews show
their first content line; extracted file badges belong inside expanded details.
The Chats contract records the approved composition and responsive behavior.
Chat lists use EdenListCard with list/detail mobile navigation; New chat is the
compact primary action. Source is monospace; thinking separates summary/content.

Chat turns keep every user message and non-commentary assistant response visible,
including earlier questions awaiting an answer. Only intermediate activity is
collapsed under turn details. The conversation omits the account/title header.

User messages use centred green-tinted EdenCard surfaces; assistant/activity
remain unboxed. New chat fills the list column. History automatically mounts
near the viewport and offloads distant content into measured placeholders,
with memoized blocks/turns and no manual earlier-messages action.

Accounts use horizontal scrollable EdenTabs above Chats, preserving status and unread
indicators. The chat list retains EdenListCard interaction states without local
hover overrides or vertical column dividers. Its usage footer expands into the
Accounts five-hour and weekly bars. Page stages use workspace-bg, navigation bg.

The browser title is Swarm. Chats is the default and first destination, followed
by Todos and Accounts, with Settings as a utility. Home is removed. Todos opens
its first list by default and hosts the Accounts summary in a right-hand column.
