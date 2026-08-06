# Worker Status Template

Use one unique file per worker at `docs/workers/<blueprint-id>/status/<worker-id>.md`. Only that worker edits it until its final merge; afterward it is an archival handoff record.

```markdown
# <Worker ID> — <Task> Status

| Field | Value |
| --- | --- |
| Blueprint | `<relative path>` |
| Worker | `<worker-id>` |
| State | not-ready / ready / in-progress / blocked / review |
| Branch | `<feature-branch>` |
| Worktree or clone | `<absolute path or machine identifier>` |
| Base | `<remote>/<base-branch>` |
| Latest pushed commit | `<commit>` |
| Last base sync | `<date, base commit>` |
| Last update | `<timestamp and timezone>` |

## Owned scope

- <paths, contracts, records, migrations, generated artifacts>

## Current plan substep

**Completed:** <last completed substep and commit>.

**Next:** <one concrete next action>.

## Verification evidence

| Scope | Command or artifact | Result | Commit |
| --- | --- | --- | --- |
| <focused/full/review> | `<exact command or relative artifact>` | Pass / Fail / Pending | `<commit>` |

## Hard blockers

| Blocker | Type | Owner | Unblock criterion | Blocks since |
| --- | --- | --- | --- | --- |
| <specific condition> | Dependency / Decision / Conflict / External | <worker, gate, or person> | <observable resolution> | <timestamp> |

Use `None` only after checking remote prerequisites and current evidence.

## Coordination notes

Record contract questions or cross-owner coordination that does not itself block progress. Do not use this section to weaken a hard dependency.

## Downstream unblock

| Worker or gate | Supplied contract or evidence | State after this worker integrates |
| --- | --- | --- |
| <ID> | <artifact> | ready / still blocked by <IDs> |

## Final handoff

Complete before merge:

- Task specification: `<relative path>`
- Implementation plan: `<relative path>`
- Living-authority updates: `<relative paths and commits>`
- Final commit: `<commit>`
- Full verification: `<commands and results>`
- Integration or migration actions: <actions or none>
- Resolved conflicts: <summary or none>
- Known limitations: <bounded list or none>
- Expected unblock: <worker/gate IDs>
- Teardown owner: <worker or coordinator>
```

The feature-branch file cannot truthfully record post-merge branch deletion. The coordinator records final `complete` state and cleanup evidence in the aggregate status after integration.
