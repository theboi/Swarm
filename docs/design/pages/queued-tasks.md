# Queued tasks

Eden's linked design authority owns shared geometry, typography, tokens and states.

- No page title, eyebrow or explanatory paragraph. Create List sits above one EdenListCard section named Lists.
- Desktop: a list column beside flexible, unboxed todo rows. Mobile: Lists first, then selected todos with a Lists back action. URL selection supports reload and browser navigation.
- Rows show exact description, creation date, EdenDropdown/EdenBadge state choices and a three-dot menu: Send to..., Move to List..., Delete.
- States: Todo, Todo (priority), In Progress, Complete. Sending does not change state automatically.
- Plus below rows opens a description-only editor; clicking a description edits it. Shared parent-owned modals handle forms and actions.
- No todo title. Whitespace is preserved through storage and model dispatch. List names are separate metadata.
- Data stays in Git-tracked `manifests/queued-tasks.json`; discard the owner-approved test todo. Change schema in place, without a legacy reader.
- Independent list and selected-todo queries own server data. Failures retain drafts and retry controls. Long descriptions wrap; many rows scroll without horizontal overflow.
