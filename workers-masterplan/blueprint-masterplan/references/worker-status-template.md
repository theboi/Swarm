# Worker Status Template

Use one unique file per worker at `docs/workers/<blueprint-id>/status/<worker-id>.md`. Only that worker edits it; publish it with meaningful coherent checkpoints and the final handoff. This repository artifact replaces worker-to-worker Codex chat.

```markdown
# <Worker ID> — <Task> Status

| Field | Value |
| --- | --- |
| Blueprint | `<relative path>` |
| Worker | `<worker-id>` |
| State | not-ready / ready / in-progress / blocked / review |
| Checked-out branch | `main` |
| Main checkout or clone | `<absolute path or machine identifier>` |
| Linked worktree check | `No` |
| Integration authority | `origin/main` |
| Latest local `main` commit | `<commit>` |
| Latest integrated `origin/main` commit | `<commit>` |
| Last `main` reconciliation | `<date, origin/main commit>` |
| Last update | `<timestamp and timezone>` |

## Owned scope

- <paths, contracts, records, migrations, generated artifacts>

## Current work checkpoint

**Completed:** <last coherent checkpoint, local main commit, and reachable origin/main commit>.

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

Record contract questions or cross-owner coordination evidence that does not itself block progress. Workers do not message one another through Codex chats; the coordinator and document owners consume this section from the repository. Do not use it to weaken a hard dependency.

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
- Final local `main` commit and reachable `origin/main` commit: `<commits>`
- Final full-suite run after all owned tasks: `<command and result>`
- Continuous-main integration or migration actions: <actions or none>
- Downstream document propagation: <affected IDs, documents, approvals, and origin/main commits; or evidence-backed none>
- Resolved conflicts: <summary or none>
- Known limitations: <bounded list or none>
- Expected unblock: <worker/gate IDs>
- Main checkout cleanliness: <clean evidence or blocker>
```

The coordinator records final `complete` state only after `origin/main` ancestry, verification, handoff, and clean-checkout evidence are current.
