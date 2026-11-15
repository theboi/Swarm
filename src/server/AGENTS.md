# EdenMind API instructions

Applies to every file under `edenmind-api/`.

## Tech stack context

- Python 3.12, FastAPI, Uvicorn, Pydantic 2, and Pydantic Settings.
- PostgreSQL through async SQLAlchemy 2 and Psycopg 3; Alembic owns schema migrations.
- Supabase JWT/JWKS authentication, Structlog, Prometheus, HTTPX, and Typer.
- Pytest, pytest-asyncio, Hypothesis, Testcontainers, RESPX, Ruff, and strict MyPy.
- Domain-specific integrations include pgvector, Playwright, PyPDF, Pillow, SMTP, and Telegram.

## Working rules

- Inspect the target, callers, dependencies, tests, migrations, and relevant commands before
  editing.
- Preserve behavior, generated files, migration history, and unrelated working-tree changes.
- Apply these conventions to new files and the active review batch; do not migrate unrelated code.
- Keep units short, explicit, and single-purpose. Add abstractions only when they reduce complexity
  or enforce a meaningful boundary.
- Before editing, check the file's first-line review tag (line 2 after a shebang)
  and follow the root `AGENTS.md` file review tag policy.
- Treat `pyproject.toml`, `uv.lock`, the final-MVP3 registry, and the root migration as
  authoritative. Do not add legacy aliases, fallback routes, compatibility mappers, dual writes, or
  backfills.

## Repository map

- `src/edenmind/main.py` — ASGI entry point; application construction belongs in `api/app.py`.
- `src/edenmind/api/` — application composition, publication, middleware, health, and HTTP errors.
- `src/edenmind/<domain>/` — domain-owned named business operations, values, HTTP schemas,
  routes, and the private implementation/adapters those operations require.
- `src/edenmind/foundation/` — shared primitives such as identifiers, ownership, and lifecycle.
- `src/edenmind/infrastructure/` — database engines, unit of work, storage, and persistence.
- `src/edenmind/auth/` — authentication principals, token verification, JWKS, and dependencies.
- `src/edenmind/observability/` — structured logging, redaction, metrics, exporters, and sinks.
- `src/edenmind/outbox/` — transactional outbox persistence and worker execution.
- `migrations/` — Alembic configuration, immutable revisions, and migration-only SQL.
- `tests/unit/`, `tests/integration/`, and `tests/contract/` — isolated behavior, infrastructure
  behavior, and public-interface contracts respectively.
- `scripts/` — bounded operations; reusable application behavior belongs in `src/edenmind`.

## Architecture and boundaries

- Keep `main.py` declarative. Build runtime state through factories and inject the smallest required
  capability at composition boundaries.
- Publish route families through `api/publication`; do not register domain routers through hidden
  import side effects or bypass publication validation.
- Organize code by business domain, not HTTP path. Keep domain rules independent of FastAPI and
  persistence where practical.
- Name modules, symbols, tests, comments and active reading docs for product behavior or domain
  responsibility, never for a worker, delivery lane, task number or implementation milestone.
  Historical delivery evidence and immutable migration/release identifiers retain their original
  identity; they are not vocabulary for current application behavior.
- Use the approved operation-first organization: callers should find a business operation by name
  and read its complete workflow behind a small explicit interface. Prefer a module such as
  `deliver_notification.py` over hiding unrelated workflows in a generic `service.py` class.
  Keep the operation's validation, authorization/scoping, transaction rules and result contract
  discoverable together; routers adapt HTTP to those operations.
- Avoid mandatory service/repository forwarding chains, facade classes, re-export barrels and
  one-file-per-helper fragmentation. Small related helpers may stay beside their owner. Private
  SQL/cursor helpers and genuine shared storage/provider adapters remain appropriate when they
  hide meaningful complexity or implement an existing capability; do not mechanically flatten
  them or create a new protocol/framework just to move methods between files.
- Operations accept the active session/UnitOfWork or already-injected capabilities they need.
  A feature with several real capabilities may use a small immutable dependency record; it holds
  dependencies, never fetched entities, and performs no hidden I/O. Keep secrets out of its repr.
  Prefer immutable Python results at backend interfaces; HTTP response models belong to transport.
- Apply this organization feature by feature, updating callers and tests atomically. Preserve
  external HTTP, storage, authorization, idempotency, audit and transaction behavior. Do not add
  compatibility aliases or keep a generic facade merely to preserve an obsolete import path.
- Express cross-domain dependencies through explicit values, protocols, or narrow service ports.
  Avoid reaching into another domain's repository or transport layer when an owned boundary exists.
- Keep external providers behind adapters. Domain services must not resolve process settings, create
  database engines, or instantiate network clients implicitly.
- Fail closed when authentication, authorization, tenant scope, or a required dependency is absent.
  Never disclose resource existence across an authorization boundary.

## FastAPI and transport

- Build routers with factory functions and explicit dependencies. Keep route functions limited to
  transport validation, authentication/context resolution, workflow invocation, and error mapping.
- Use Pydantic models for JSON transport and settings, not for core domain values. For closed
  request objects, forbid extra fields and prefer immutable models.
- Convert transport objects into domain commands or values at the boundary. Do not pass loosely
  typed request dictionaries through services.
- Give published routes stable explicit operation IDs and preserve the standard error envelope.
- Validate all untrusted input, bound collection and text sizes, and return stable safe errors.
  Never expose exception details, credentials, internal topology, or raw private content.
- Keep application lifespan ownership explicit and close process-scoped clients and engines.

## Python and domain modeling

- Use complete type annotations and keep strict MyPy clean. Prefer precise unions, `Protocol`, and
  modern Python 3.12 type aliases over `Any`, unchecked casts, or broad object-shaped interfaces.
- Prefer immutable `@dataclass(frozen=True, slots=True)` values for domain commands, facts, and
  results. Enforce invariants when invalid states can otherwise be constructed.
- Use `StrEnum` for closed string vocabularies and tuples for immutable ordered collections.
- Represent identifiers with `UUID`, timestamps as timezone-aware UTC `datetime` values, and secrets
  with `SecretStr` or an equally non-revealing boundary type.
- Name true module constants in `UPPER_SNAKE_CASE`. Prefix genuinely private implementation details
  with `_`; do not use `__all__` as a substitute for a clear module boundary.
- Prefer guard clauses and small helpers over deep nesting. Use `async` only across genuinely async
  boundaries and never perform blocking I/O on the event loop.
- Keep package `__init__.py` files minimal. Do not create convenience barrels that obscure
  ownership.

## Persistence and transactions

- Seed files are the source of truth for seeded data. Do not directly modify SQL
  or database rows to change seed data, including demo accounts and roles. Edit
  the selected seed files and, when needed, their schemas/compiler, then run
  `npm run seed:database -- --seed <demo-seed|live-seed>` from the repository root.
  Verify the resulting data after reseeding; a database-only change is not a
  completed seed change.

- The caller-owned `UnitOfWork` is the explicit transaction boundary. Services, repositories, ports,
  and routers must not silently open, commit, or roll back independent transactions.
- Pass the active `AsyncSession` or `UnitOfWork` explicitly. Named operations own workflow policy
  and orchestration; private persistence helpers or real storage adapters own reusable SQL.
  An operation may own its scoped SQL directly, as in the approved notifications organization;
  a separate repository class is not required.
- Preserve institution scope and database capability roles on every query and write. Authorization
  checks and row-level database constraints are complementary, not interchangeable.
- Keep side effects outside successful transactions or register them with `after_commit`. Use the
  transactional outbox when delivery must survive process failure.
- Avoid lazy loading and unbounded queries. Make locking, ordering, pagination, and query budgets
  explicit where correctness depends on them.
- Shape read endpoints for the consuming view: list summaries, selected-resource
  details/graphs, and on-demand form options. Do not return or resolve every graph
  and editor document merely to render a list. Scope database reads as well as
  response payloads; filtering a complete page snapshot after loading it is not
  an on-demand read. Mutation responses return the identifiers/version needed to
  continue, and consumers refresh affected queries through invalidation.
- Add a new Alembic revision for schema changes; never rewrite an applied revision. Inspect all
  heads before choosing `down_revision`, and create an explicit merge revision for independent
  heads.
- Make migrations deterministic, reversible when safe, and compatible with the runtime rollout.
  Verify both `upgrade head` and `alembic check` against PostgreSQL.

## DB design

- Use plural names for database tables.
- Name every junction table `<plural>_<plural>_links`, using the plural names
  of the two entities it connects (for example, `papers_nodes_links`).

## Security and observability

- Authenticate at the boundary and authorize the concrete institution, owner, and action before
  reading or mutating protected data. Reauthorize external search or provider hints before returning
  them.
- Treat uploaded files, URLs, provider payloads, cursors, and model output as untrusted input.
- Keep secrets out of source, logs, metrics, errors, fixtures, snapshots, and object
  representations. Configuration must come through the validated `EDENMIND_` settings boundary.
- Log structured bounded facts through the observability layer. Redact private content and avoid
  unbounded or high-cardinality metric labels.
- Preserve request IDs, security headers, audit facts, idempotency behavior, and timeout boundaries.

## Testing

- Test observable behavior at the largest useful unit. Do not mechanically mirror implementation or
  split one behavior into microscopic tests.
- Put pure policy and service behavior in `tests/unit`; use `tests/integration` for real PostgreSQL,
  transaction, concurrency, migration, and adapter behavior; use `tests/contract` for HTTP and
  stable public-interface guarantees.
- Prefer factories and explicit fakes over oversized fixtures. Mock only external or impractical
  effect boundaries; do not mock the behavior under test.
- Cover failure, authorization, privacy, idempotency, concurrency, and transaction outcomes when
  they are part of the contract. Use Hypothesis for rule-heavy or input-space-heavy behavior.
- Remove redundant tests only when stronger coverage remains; never delete sole behavior coverage.

## Reference files

- No backend reference file is approved yet. Add references here only after the product owner marks
  their current contents `done`.
- Approval of an architectural organization does not itself add or change file completion tags.

## File review tags

- File header comments are the source of truth. Use one bare tag ID: `done`,
  `human-review`, or `agent-to-fix`, on line 1 (line 2 after a shebang).
- Editing any file with a pre-existing tag must change that tag to `human-review`.
  Untagged files stay untagged unless the product owner requests a tag.
- `agent-to-fix` requires modification; inspect the file for `TODO` comments and
  address the requested fixes and relevant TODOs before handing it back for review.
- Keep changes to `done` files minimal and make them only when required. Change
  their tag to `human-review` and report the path, reason, and change summary under
  `Review required`; renames and deletions count.
- Only explicit product-owner approval may mark current contents `done`. Follow
  the full file review tag policy in the root `AGENTS.md`.

## Commands and verification

Run from `edenmind-api/`; `pyproject.toml` is authoritative.

- Runtime: `uv run alembic upgrade head`, then
  `uv run edenmind serve --host 127.0.0.1 --port 8000`.
- Worker: `uv run edenmind worker --once` or `uv run edenmind worker`.
- Static: `uv run ruff format --check .`, `uv run ruff check .`, and
  `uv run mypy src tests`.
- Tests: `uv run pytest`; use a focused path or `-m unit`, `-m integration`, or `-m contract` while
  developing.
- Migrations: `uv run alembic upgrade head` and `uv run alembic check`.
- After each Python update, run Ruff formatting and lint checks on the changed file plus the
  narrowest meaningful tests. Before handoff, run affected broader checks and report skipped checks.
