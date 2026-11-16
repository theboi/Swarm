# Todos

The canonical frontend route is `/todos`; list selection uses `/todos?list=<id>`.

Eden's linked design authority owns shared geometry, typography, tokens and states.

- No page title, eyebrow or explanatory paragraph. A full-width compact primary Create List button sits above one EdenListCard section named Lists.
- Desktop: a list column beside flexible, unboxed todo rows. Open the first list by default when no list is supplied; preserve explicit URL selection. Mobile opens selected todos with a Lists back action, which must not auto-select the first list again. URL selection supports reload and browser navigation.
- Rows show exact description, creation date, EdenDropdown/EdenBadge state choices and a three-dot menu: Send to..., Move to List..., Delete.
- States: Todo, Todo (priority), In Progress, Complete. Sending does not change state automatically.
- Plus below rows opens a description-only editor; clicking a description edits it. Shared parent-owned modals handle forms and actions.
- No todo title. Whitespace is preserved through storage and model dispatch. List names are separate metadata.
- Data stays in Git-tracked `manifests/queued-tasks.json`; discard the owner-approved test todo. Change schema in place, without a legacy reader.
- Independent list and selected-todo queries own server data. Failures retain drafts and retry controls. Long descriptions wrap; many rows scroll without horizontal overflow.

- The former Home Accounts summary occupies a separate right-hand column on wide
  screens and stacks below Todos on narrower screens. Keep usage refresh, status,
  unread indicators, open-chat rows and View more accounts fully functional.
- List changes retain current details with aria-busy while loading replacements.
  Make retained details inert so actions cannot consume a stale list. Default
  selection replaces the current URL rather than adding a browser-history entry.
