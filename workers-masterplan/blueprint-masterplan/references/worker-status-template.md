# Worker Status Template

Use one unique file per worker at `docs/workers/<blueprint-id>/status/<worker-id>.md`. Only that worker edits it; publish it with meaningful coherent checkpoints and the final handoff. This repository artifact replaces worker-to-worker Codex chat.

```markdown
# <Worker ID> — <Task> Status

| Field | Value |
| --- | --- |
| Blueprint | `<relative path>` |
| Worker | `<worker-id>` |
| Phase | `ui-design` / `planning` / `execution` |
| State | not-ready / ready / in-progress / blocked / review |
| Worker planning state | pending / approved / reopened / not applicable |
| Global planning gate | open / passed / reopened; `<receipt path>`; pinned `origin/main` commit `<commit>` |
| Execution readiness | not assessed / blocked / ready; `<implemented-prerequisite evidence>` |
| UI-design live review | Not applicable — ordinary worker, or `<server command>`; `<reviewed URL>`; fixture/mock state; last reviewed app commit `<commit>`; user approval `<evidence or pending>`; UI requirements `<path or pending>`; handoff `<path or pending>` |
| Mutable ownership transfer | current owner `<worker-id>`; next owner `<worker-id or none>`; handoff commit `<commit or pending>`; state pending / integrated / transferred / not applicable |
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

## Planning and gate evidence

| Evidence | Path or commit | State | Verifier / next action |
| --- | --- | --- | --- |
| Worker specification | `<relative path and origin/main commit>` | pending / approved / reopened / not applicable | <owner or coordinator> |
| Implementation plan | `<relative path and origin/main commit>` | pending / approved / reopened / not applicable | <owner or coordinator> |
| Planned predecessor evidence | `<upstream specification, implementation plan, authority/no-impact result, and status at origin/main commit>` | pending / approved / not applicable | <worker or coordinator> |
| UI requirements contract | `<relative path and origin/main commit>` | pending / accepted / reconciled / not applicable | <UI worker, live-wiring planner, or coordinator> |
| UI requirements reconciliation | `<consumer plan task and producer mapping>` | pending / complete / reopened / not applicable | <live-wiring planner or coordinator> |
| Global planning-gate receipt | `docs/workers/<blueprint-id>/PLANNING_GATE.md` at `<origin/main commit>` | open / passed / reopened | <coordinator> |
| Cross-plan and authority reconciliation | `<receipt row or review artifact>` | pending / complete / reopened | <coordinator> |

Planning completion is not execution readiness. An ordinary worker remains
execution-blocked until the named global receipt is passed and its implemented
hard prerequisites are reachable from `origin/main`.

## UI-design review and ownership transfer

Complete this section for `Phase: ui-design`; mark every row `Not applicable — ordinary worker` otherwise.

| Evidence | Value | State / verifier |
| --- | --- | --- |
| Live development server | `<exact command>` | running / stopped; <owner> |
| Reviewed URL | `<URL>` | last reviewed `<timestamp>` |
| Last reviewed app state | `<origin/main-reachable commit>` | browser-verified / pending |
| User approval | `<approval evidence>` | approved / pending / superseded |
| UI requirements contract | `<relative path>` | pending / integrated / accepted / reconciled |
| Requirements-to-plan reconciliation | `<consumer plan task and producer mapping>` | pending / complete / reopened |
| Design handoff | `<relative path>` | pending / integrated / accepted |
| Mutable ownership | current `<worker-id>` → next `<implementation-worker-id>` | pending / integrated / transferred |

Record only accepted presentation work here. A material UI, scope, ownership,
contract, acceptance, dependency, or plan change reopens the global planning
gate and requires the coordinator to record its impact before execution resumes.

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

- Task specification: `<relative path>` for an ordinary worker; or `not applicable — UI-design worker` only when approved upstream planned-contract paths, accepted app-state commit, user approval evidence, UI requirements path, and design handoff path are all present above
- Implementation plan: `<relative path>`; or `not applicable — UI-design worker` only when the accepted app-state commit, user approval evidence, UI requirements path, and design handoff path are all present above
- Global planning-gate receipt: `docs/workers/<blueprint-id>/PLANNING_GATE.md`, state `<passed/reopened/open>`, pinned `origin/main` commit `<commit>`
- UI-design live review and ownership transfer: `<server command, reviewed URL, fixture/mock state, accepted app commit, approval evidence, UI requirements path, handoff path, current → next owner, transfer state; or not applicable — ordinary worker>`
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
