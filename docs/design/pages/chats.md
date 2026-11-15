# Chats composition

Approved 15 November 2026. Retain the linked Eden Swarm chat contract for drafts,
transcripts, accessibility and mobile navigation. These local refinements apply
to the independent Swarm repository without changing the shared design system.

- Account choices show identity, status and meaningful unread/attention dots,
  without a chat-count badge. The selected account's chat-list total remains.
- Main and subagent composers use EdenTextArea with “Work with Swarm...” for idle
  prompts; retain “Steer this turn…” while working. Grow with content up to 200px,
  also constrained to 30dvh on short viewports, then scroll internally. Shrink
  after deletion and restore a persisted draft's size on mount.
- Turn options uses a non-floating compact EdenButton as the native disclosure
  trigger, immediately before Steer in the same footer group. Keep settings
  reachable by pointer/keyboard and bounded above the composer.
- Chats occupies the available dynamic viewport, minus mobile navigation and
  safe areas when visible. Account/chat lists and transcript scroll within their
  own regions; long lists must not expand the page or clip its header/composer.
- At the existing 768px compact-picker breakpoint, retain the navigation rail
  and account column, let the conversation fill the remaining width, and overlay
  the chat picker only while open. Do not reserve an empty third column.

Fixture browser checks may use port 4340. Never alter live processes or ports.
