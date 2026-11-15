# Muday

Local-first Telegram voice expense tracker for Amharic and English.

Use the short [`documentation index`](./docs/index.md) to find the right guide. Local commands,
testing, and troubleshooting are in [`docs/project-handbook.md`](./docs/project-handbook.md).

Current phase status, acceptance checklists, and unfinished work are tracked in
[`docs/plans/MUDAY_MASTER_IMPLEMENTATION_PLAN.md`](./docs/plans/MUDAY_MASTER_IMPLEMENTATION_PLAN.md).
The original product requirements are preserved in
[`docs/product-requirements.md`](./docs/product-requirements.md).

## Documentation sources of truth

| Topic                                      | Document                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Product requirements and MVP scope         | [`docs/product-requirements.md`](./docs/product-requirements.md)                                     |
| Current phase status and unfinished work   | [`docs/plans/MUDAY_MASTER_IMPLEMENTATION_PLAN.md`](./docs/plans/MUDAY_MASTER_IMPLEMENTATION_PLAN.md) |
| Documentation map                          | [`docs/index.md`](./docs/index.md)                                                                   |
| Commands, local operation, and testing     | [`docs/project-handbook.md`](./docs/project-handbook.md)                                             |
| Gemini text and voice extraction           | [`docs/gemini-extraction.md`](./docs/gemini-extraction.md)                                           |
| Receipt photo logging                      | [`docs/receipt-scanning.md`](./docs/receipt-scanning.md)                                             |
| Flutter integration and mobile API         | [`docs/flutter-integration.md`](./docs/flutter-integration.md)                                       |
| Deployment, release, rollback, and reviews | [`docs/deployment-and-operations.md`](./docs/deployment-and-operations.md)                           |
| Admin Analytics & Security Portal          | [`docs/admin-portal.md`](./docs/admin-portal.md)                                                     |

Superseded plans and early status snapshots are retained under [`docs/archive`](./docs/archive) for
history and must not be treated as current instructions.

## Prerequisites

- Node.js 24 or newer
- npm 11 or newer
- Docker with Docker Compose
- ffmpeg

## First local setup

```bash
cp .env.example .env
npm install
npm run setup:local
npm run local:check
```

## Start development

Start the API, worker, and Mini App together:

```bash
npm run dev
```

Open <http://localhost:5173>. Stop all three processes with `Ctrl+C`.

You can still run `dev:api`, `dev:worker`, and `dev:miniapp` separately when debugging. Tests use a
recording Telegram transport and require no token. To run the real bot locally, put a development
BotFather token in the untracked `.env`, then run:

```bash
npm run dev:bot
```

Long polling works directly from the laptop without a public URL or hosting. Automated tests use
fake providers and require no paid credentials. The experimental Gemini configuration requires a
development API key and must use synthetic financial data while it is on the free tier.

## Run the complete local system in Docker

The full local stack includes PostgreSQL, Redis, a one-shot migration job, API, worker, Telegram
long-polling bot, and the Nginx-served Mini App. First create `.env` as described above. A real bot
requires `TELEGRAM_BOT_TOKEN`. Gemini text/direct-audio extraction requires `GEMINI_API_KEY`; the
legacy Hasab fallback requires `HASAB_API_KEY` only when selected.

```bash
npm run docker:local:build
npm run docker:local:up
docker compose ps -a
```

Open the Mini App at <http://localhost:8080>. The API is at <http://localhost:3001>, readiness is at
<http://localhost:3001/health/ready>, and local Swagger is at <http://localhost:3001/docs>.

| Compose service   | Container name            | Image                  |
| ----------------- | ------------------------- | ---------------------- |
| `mezgeb-postgres` | `mezgeb-local-postgres`   | `postgres:16-alpine`   |
| `mezgeb-redis`    | `mezgeb-local-redis`      | `redis:7-alpine`       |
| `mezgeb-migrate`  | `mezgeb-local-migrate`    | `mezgeb/backend:local` |
| `mezgeb-api`      | `mezgeb-local-api`        | `mezgeb/backend:local` |
| `mezgeb-worker`   | `mezgeb-local-worker`     | `mezgeb/backend:local` |
| `mezgeb-bot`      | `mezgeb-local-bot`        | `mezgeb/backend:local` |
| `mezgeb-miniapp`  | `mezgeb-local-miniapp`    | `mezgeb/miniapp:local` |
| `mezgeb-test`     | disposable test container | `mezgeb/test:local`    |

`mezgeb-local-migrate` showing `Exited (0)` is expected: it applies migrations once and exits. Only
one long-polling bot may use a token, and that token cannot simultaneously use a production webhook.
Use a separate development bot or remove its webhook before starting `mezgeb-bot`.

```bash
npm run docker:local:logs
npm run docker:local:test
npm run docker:local:down
```

`docker:local:down` preserves the named PostgreSQL and Redis volumes. Do not add `--volumes` unless
you intentionally want to permanently erase the local database and queues.

## Quality checks

Run everything:

```bash
npm run verify
```

Or run checks separately:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run test:run
npm run build
```

## CI-equivalent local check

With PostgreSQL and Redis running:

```bash
npm run ci
```

GitHub runs the same checks for pushes to `main` and pull requests using
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml). CI uses fake STT/extraction providers and
requires no Telegram token or paid API.

The error, correlation-ID, logging, redaction, and repository rules are documented in the
[`project handbook`](./docs/project-handbook.md#11-engineering-and-failure-safety).

## Internal analytics report

Phase 11 provides a read-only, PostgreSQL-only internal report for signups, consent conversion,
text/voice transaction counts, DAU/WAU/MAU, notification opt-outs, clarification rates, dashboard
opens, and exact-day D7/D30 retention. Start PostgreSQL, then run:

```bash
npm run analytics:report
```

Generate a report as of the end of a specific EAT calendar day with:

```bash
npm run analytics:report -- --as-of=2026-08-04
```

The command outputs JSON, does not expose an HTTP or Telegram admin interface, does not modify data,
and does not select financial amounts, notes, transcripts, Telegram identifiers, tokens, or
`initData`. The stable definitions, privacy contract, interpretation rules, and query-plan review are
documented in [`docs/admin-portal.md`](./docs/admin-portal.md#4-business--operational-metrics-specification).

## Local services

- API: <http://localhost:3001>
- API liveness: <http://localhost:3001/health/live>
- API readiness: <http://localhost:3001/health/ready>
- Swagger UI: <http://localhost:3001/docs>
- OpenAPI JSON: <http://localhost:3001/docs/openapi.json>
- Mini App: <http://localhost:5173>
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
