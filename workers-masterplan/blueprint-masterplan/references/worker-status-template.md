# Worker Status Template

Use one unique file per worker at `docs/workers/<blueprint-id>/status/<worker-id>.md`. Only that worker edits it; every completed substep integrates the update into `origin/main`, and the final version becomes an archival handoff record.

```markdown
# <Worker ID> — <Task> Status

| Field | Value |
| --- | --- |
| Blueprint | `<relative path>` |
| Worker | `<worker-id>` |
| State | not-ready / ready / in-progress / blocked / review |
| Branch | `<feature-branch>` |
| Worktree or clone | `<absolute path or machine identifier>` |
| Integration authority | `origin/main` |
| Latest feature commit | `<commit>` |
| Latest integrated `origin/main` commit | `<commit>` |
| Last `main` pull | `<date, origin/main commit>` |
| Last update | `<timestamp and timezone>` |

## Owned scope

- <paths, contracts, records, migrations, generated artifacts>

## Current plan substep

**Completed:** <last completed substep, feature commit, and containing origin/main commit>.

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

## Living-authority downstream propagation

| Authority change | Affected downstream workers/gates | Relevant documents | Owner/approval | Integrated `origin/main` commit |
| --- | --- | --- | --- | --- |
| <change or explicit no-impact assessment> | <IDs or none with evidence> | <briefs/specs/plans/prompts/statuses or none> | <owners and state> | <commit or pending> |

Mark affected downstream work blocked or not-ready until every required document update is approved and integrated into `origin/main`.

## Downstream unblock

| Worker or gate | Supplied contract or evidence | State after this worker integrates |
| --- | --- | --- |
| <ID> | <artifact> | ready / still blocked by <IDs> |

## Final handoff

Complete before final handoff:

- Task specification: `<relative path>`
- Implementation plan: `<relative path>`
- Living-authority updates: `<relative paths and commits>`
- Final feature commit and containing `origin/main` commit: `<commits>`
- Full verification: `<commands and results>`
- Continuous-main integration or migration actions: <actions or none>
- Downstream document propagation: <affected IDs, documents, approvals, and origin/main commits; or evidence-backed none>
- Resolved conflicts: <summary or none>
- Known limitations: <bounded list or none>
- Expected unblock: <worker/gate IDs>
- Teardown owner: <worker or coordinator>
```

The worker status cannot truthfully record its own post-teardown branch deletion. The coordinator records final `complete` state and cleanup evidence in the aggregate status after final integration.
