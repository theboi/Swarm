# Chats composition

Approved 15 November 2026. Retain the linked Eden Swarm chat contract for drafts,
transcripts, accessibility and mobile navigation. These local refinements apply
to the independent Swarm repository without changing the shared design system.

- Account choices use horizontal scrollable EdenTabs at the top of the right conversation column, not above the desktop chat list. Give tabs 8px outer space and no gap before their content. On mobile, show the list/detail stage below those same tabs.
- Account choices retain identity/status and unread/attention dots at every width. Omit the
  Accounts/count heading. The selected account's chat-list total remains.
- Main and subagent composers use EdenTextArea with “Work with Swarm...” for idle
  prompts; retain “Steer this turn…” while working. Grow with content up to 200px,
  also constrained to 30dvh on short viewports, then scroll internally. Shrink
  after deletion and restore a persisted draft's size on mount.
  Mobile composers use EdenTextArea compact density, including subagent composers.
  Shared compact textarea text uses the 16px body role on coarse-pointer touch devices to avoid iOS focus zoom; compact spacing remains unchanged. Keep native pinch zoom enabled.
- Queue sits immediately after Steer. It captures exact draft text and current turn settings in a per-account/thread FIFO, displayed above the textarea with remove and failed-delivery retry actions. Do not steer queued text or combine entries. Send one entry when its chat becomes idle; wait for that response before the next. Persist browser-owned entries across reload/navigation and run delivery at the authenticated app boundary. An open signed-in Swarm tab is required; this is not a server scheduler. Unknown/archived chats, disconnected accounts, approvals and limit handoffs pause delivery. Retain failures/uncertain submissions for explicit retry with the same client message ID; never loop retries or discard new typing. Manual Send cannot overtake pending queued messages.
- A browser Web Lock elects one delivery tab; other tabs display the same persisted queue without resubmitting in-flight entries. Automatic delivery requires HTTPS or localhost and Web Locks support. Other browsers/origins retain messages with an actionable failure rather than risking duplicate delivery. Terminal turn events release the next message even when completion precedes acknowledgment or React never renders the intermediate active state.
- Turn options uses a non-floating borderless superCompact EdenButton as the
  native disclosure trigger, immediately before Steer in the same footer group. Keep settings
  reachable by pointer/keyboard and bounded above the composer.
- Chats occupies the available dynamic viewport, minus mobile navigation and
  safe areas when visible. Account/chat lists and transcript scroll within their
  own regions; long lists must not expand the page or clip its header/composer.
- Use one EdenListCard Chats section and EdenListCardItem rows, retaining activity,
  attention/unread indicators and the pinned account usage footer. New chat is a
  non-floating primary EdenButton with compact density above the list.
- At widths up to 768px, show the chat list first and open the conversation on
  selection. Back to chats restores the list without losing drafts. Keep the
  horizontal account tabs visible; at 768px retain the navigation rail. The
  list and conversation occupy the same content area, without an overlay or an
  empty third column. Hidden conversations must not fetch or clear unread replies.
  Mount the autosizing textarea only in the visible detail stage, retaining its
  persisted draft above that boundary so initial measurements and restoration agree.
  Mobile chat rows do not show selected UI. Opening mobile detail does not focus the composer automatically. Hide navigation only during explicit textarea focus, and reconcile it when a focused control is removed without blur; Back must always restore navigation.

- Assistant replies and activity items have no card shell, border, shadow or
  surface fill. User messages use stationary EdenCard surfaces with accent-soft
  green tint and canonical default radius. Centre them in the conversation,
  capped at 620px and available width. New chat fills the list column.
- Render history automatically near the viewport; offload distant message bodies
  into measured normal-flow placeholders. Memoize blocks and unchanged turns;
  retain full-history grouping and turn disclosure state. Preserve native scroll
  anchoring and focused/selected content. This windows DOM, not backend data.
  Do not show a Show earlier messages button. Main/subagent renderers share this
  behavior, including within very long active or expanded turns.
- Activity disclosures show an icon and the first nonempty content line, not a
  category heading. Keep accessible category labels and a running indicator.
  Activity details and extracted green file links appear only when expanded.
- Thinking previews use the summary and reveal separate content on expansion.
  If only content exists, preview its first line. If both are blank, show
  Thinking... instead of JSON. Summary-only activities remain readable on expand.
- Plain/source view uses the canonical monospace font and preserves whitespace.
  Copy takes exact raw source, handles missing/denied clipboard APIs with native
  selection fallback, restores focus/selection, and reports failure truthfully.
  Copied feedback expires after two seconds and does not apply to changed source.
- Chat-view EdenButtons use superCompact density. Composer, transcript, turn
  history controls retain borderless appearance. Subagent pills use secondary appearance. Auto-resume is a
  secondary cycle icon toggle with `aria-pressed`; archive and transfer are
  secondary icon buttons. Preserve descriptive accessible names and tooltips.
  Scroll to bottom is a floating secondary icon button. There is no latest-user-
  message jump button. Shared primitive geometry is not overridden locally.
  New chat remains the compact/primary action above the list.
- Remove the account/chat-title header. Keep a compact action toolbar and the
  mobile Back to chats action; the conversation region retains its accessible name.
- Completed turns keep ALL user messages (opening prompts and steers), final
  replies and earlier non-commentary assistant questions visible in source order.
  Only intermediate commentary, reasoning and tool activity belong under Show
  turn details. Expanding restores those steps without duplicating messages.
  These rules supersede the linked Eden chat contract's opening-prompt collapse
  rule and apply to main and subagent transcripts.

Fixture browser checks may use port 4340. Never alter live processes or ports.

- EdenListCard/EdenListCardItem use only their original shared surfaces and hover
  states. Do not add inherited button hover overrides or vertical column dividers.
- The pinned compact usage footer expands by pointer/keyboard into the same
  five-hour/weekly RateLimitBars as Accounts, including percentages, reset times,
  unknown capacity and weekly exhaustion. Collapse returns the overlaid summary.
  Expanded labels, percentages and reset times retain the collapsed summary's 13px size, without changing Accounts typography.
- Page/content uses workspace-bg; account tabs and navigation retain shared bg.
  Keyboard account changes retain tab focus rather than focusing the composer.

- File links may open absolute paths, home-relative paths and paths outside the
  checkout, including symlink targets, subject to the selected account's OS read
  permissions. Resolve ordinary relative links from that account's configured
  checkout; the checkout is a base path, not an access boundary. Read bot-owned
  files through that bot's app-server instead of traversing as the coordinator.
- Markdown previews retain sanitized rendering and the shared file modal. Source
  files use extension-aware syntax highlighting with escaped React token spans,
  the canonical monospace font, preserved indentation and horizontal scrolling.
  Unknown formats and source over 256 KiB use complete plain text. Keep the two
  MiB read limit; reject binary/non-UTF-8 files rather than garbling their contents.
