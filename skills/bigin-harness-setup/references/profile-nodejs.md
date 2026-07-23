# Node.js Profile Templates

Stack: Node.js TypeScript REST API backend — modular monolith, **code-first OpenAPI** (TypeBox route schemas ARE the spec; `src/api/openapi.json` is generated from them via `@fastify/swagger`), Fastify, per-module Drizzle (`drizzle-orm` + `drizzle-kit`) schemas over Postgres, JWT + argon2id auth, outbox/inbox events on a Postgres-backed job queue (Graphile Worker).

Empty repo → scaffolded by the **`nodejs-scaffold`** skill (writes files, runs codegen, verifies lint/typecheck/build/test, commits; no GitHub clone). See `skills/nodejs-scaffold/`.

---

## Commands

```
lint:       pnpm lint
typecheck:  pnpm type-check
test:       pnpm test --run          # unit only — mocked repositories, no DB
test:int:   pnpm test:integration    # needs Docker — testcontainers Postgres
dev:        pnpm dev
build:      pnpm build
generate:   pnpm openapi:export && pnpm db:generate   # openapi.json from TypeBox route schemas + drizzle-kit migration from infrastructure/*.schema.ts
migrate:    pnpm db:migrate
seed:       pnpm seed
dev:setup:  pnpm dev:setup           # docker compose up -d db && migrate && seed
```

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Node.js TypeScript REST API · modular monolith · code-first OpenAPI (TypeBox) · Drizzle · Fastify · Postgres
Node: ≥22 · pnpm only

## Commands
| Purpose      | Command            |
|--------------|--------------------|
| dev          | `pnpm dev`         |
| test         | `pnpm test --run`  |
| test (int.)  | `pnpm test:integration` (needs Docker) |
| lint         | `pnpm lint`        |
| typecheck    | `pnpm type-check`  |
| build        | `pnpm build`       |
| generate     | `pnpm openapi:export && pnpm db:generate` |
| migrate      | `pnpm db:migrate`  |
| seed         | `pnpm seed`        |
| dev:setup    | `pnpm dev:setup`   |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- Each module's `api/*.schemas.ts` (TypeBox) is BOTH the runtime request/response validator and the OpenAPI spec source — one declaration, no separate contract file. `src/api/openapi.json` is GENERATED from them via `pnpm openapi:export` — never hand-edit it; CI diff-checks it against a fresh export.
- Each module's `infrastructure/*.schema.ts` (hand-written Drizzle table schema) is the source of truth for that module's DB tables. After changing one: `pnpm db:generate` (produces a migration under `drizzle/`), then `pnpm db:migrate` to apply. Never hand-edit a migration under `drizzle/` already applied to a shared environment — add a new one instead.
- Business logic lives only in `application/*.use-case.ts`. Only `infrastructure/*.repository.ts` uses the Drizzle query builder — the repository function *is* the query, there's no separate generated typed-queries layer. Route handlers (`api/*.routes.ts`) declare the TypeBox schema and wire the call only.
- A module's `index.ts` is the only file other modules may import from it — enforced by `eslint-plugin-boundaries`; `pnpm lint` fails on a cross-module import that reaches past it.
- No `--no-verify`. No `eslint-disable` without a justifying comment. No weakening eslint config (especially `boundaries/dependencies`) to pass checks.
- No `@ts-ignore` or `as any` without a justifying comment.
- No unauthenticated endpoints past a stubbed auth check — replace it before production traffic.
- Request/response validation is TypeBox route schemas, not Zod — Zod is reserved for one job only: fail-closed process-env validation at boot (`shared/config/env.ts`).
- Never echo raw driver/internal error text into a response body — the centralized `shared/errors/error-handler.ts` owns this; respond with the fixed `{ error: { code, message, request_id, details? } }` contract. (Fastify's own schema-validation `details` are the intentional exception — that's client-actionable feedback, not an internals leak.)
- Backend leads with additive changes. Breaking API change = version bump (`/v2/`).

## Task workflow
Non-trivial features: /task-workflow (or read AI_TASK_GUIDE.md).

## Compact instructions
Preserve: code changes, key decisions, blockers.
Drop from context: tool output, file reads, search results.
Run /clear between unrelated tasks. Pipe long output: `cmd | head -50`.
```

---

## conventions.md Template

Paths frontmatter scopes this file to src/ — only loaded when source files are in context.

```markdown
---
paths:
  - "src/**"
---
# Conventions

## Editable surface
Only these are hand-written:
- `modules/<name>/api/*.routes.ts` — Fastify plugin: TypeBox schema + wiring only
- `modules/<name>/api/*.schemas.ts` — TypeBox request/response shapes (the contract)
- `modules/<name>/application/*.use-case.ts` — business logic
- `modules/<name>/infrastructure/*.repository.ts` — data access (Drizzle query builder)
- `modules/<name>/infrastructure/*.schema.ts` — the module's DB table schema (Drizzle, hand-written)
- `modules/<name>/domain/*.entity.ts` — domain types
- `modules/<name>/index.ts` — the module's only public surface
- `shared/**` — cross-cutting: auth, config, db, errors, event-bus, idempotency, job-queue, pagination, schema

`src/api/openapi.json` (from every module's `api/*.schemas.ts` via `pnpm openapi:export`) and `drizzle/*.sql` (from every module's `infrastructure/*.schema.ts` via `pnpm db:generate`) are GENERATED. Regenerate with `pnpm openapi:export` / `pnpm db:generate` — never hand-edit either. A migration under `drizzle/` may be tweaked before it's ever applied anywhere, but never after — add a new one instead.

## Naming
- Files: kebab-case with a role suffix (`create-user.use-case.ts`, `users.repository.ts`, `users.schema.ts`, `users.routes.ts`, `user.entity.ts`)
- Classes, types, interfaces: PascalCase
- Functions, variables: camelCase
- Routes: kebab-case, versioned per module (`/v1/users/:id`)
- TypeBox schema constants: PascalCase (`CreateUserBody`, `UserResponse`, `IdParam`) — not Zod's camelCase+`Schema`-suffix convention
- Drizzle columns: snake_case DB column strings, camelCase TS property names (`createdAt: timestamp('created_at')`)

## Handler Pattern

```ts
export const usersRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.post(
    '/',
    {
      config: { idempotent: true },
      schema: {
        body: CreateUserBody,
        response: { 201: UserResponse, 409: ErrorResponseSchema, 422: ErrorResponseSchema }
      }
    },
    async (request, reply) => {
      const user = await createUser(request.body)
      return reply.code(201).send(toResponse(user))
    }
  )
}
```

Fastify validates `request.body` against the TypeBox `schema` before the handler runs — no manual `safeParse` inside the handler. A validation failure never reaches the handler; it's caught by the centralized error handler (`fastifyErr.validation`). Handlers only call an application-layer use-case and shape the response.

## OpenAPI (code-first)
Add or change a route's request/response shape in that module's `api/*.schemas.ts` first — that TypeBox declaration is both the Fastify validator and the OpenAPI source. Then regenerate the spec:
```sh
pnpm openapi:export
```
This overwrites `src/api/openapi.json` from the live app's route schemas. CI re-exports and `git diff --exit-code`s it — a stale committed `openapi.json` fails CI. Never hand-write or hand-edit `openapi.json`.

## Error Handling
- Route handlers never write an error response directly — either throw an `AppError` (`shared/errors/app-error.ts`) from the application/domain layer, or let a thrown error reach the centralized handler.
- `shared/errors/error-handler.ts`, registered via `app.setErrorHandler`, is the only place an HTTP error response is written. It covers `AppError`, Fastify's own schema-validation failures (`fastifyErr.validation`), other Fastify framework errors (e.g. malformed JSON), and unhandled errors (500) — all through the same fixed contract: `{ error: { code, message, request_id, details? } }`.
- A new route must not open a second, unwired error path that leaks raw parser/driver text.
- No `console.log` in production paths — use the request/app logger (`request.log` / `app.log`, pino).

## Project Layout
```
src/
  api/              ← composition root: app.ts (Fastify instance, error handler, plugin wiring), health.routes.ts
  api/openapi.json  ← GENERATED via `pnpm openapi:export` — do not hand-edit
  modules/<name>/
    api/            ← <name>.routes.ts (Fastify plugin), <name>.schemas.ts (TypeBox — validator + spec source)
    application/    ← *.use-case.ts — business logic
    domain/         ← *.entity.ts — domain types
    infrastructure/ ← *.repository.ts (Drizzle query builder against *.schema.ts), *.schema.ts (hand-written table schema)
    index.ts        ← the ONLY file other modules may import from this module (enforced by eslint-plugin-boundaries)
  shared/
    auth/           ← jwt.ts, guard.ts, rbac.ts, password.ts (argon2id), tokens.ts
    config/         ← env.ts — Zod, boot-time env validation ONLY (route validation is TypeBox's job)
    db/             ← client.ts (postgres.js + drizzle), soft-delete.ts
    errors/         ← app-error.ts, codes.ts, error-handler.ts
    event-bus/      ← in-process pub/sub backing the outbox/inbox pattern
    idempotency/    ← Idempotency-Key plugin
    job-queue/      ← Graphile Worker tasks (outbox relay, dead-letter cleanup)
    pagination/     ← cursor.ts — keyset pagination
    schema/         ← nullable.ts — OpenAPI-3.0.3-safe nullable TypeBox helper
  server.ts         ← entrypoint
  subscriptions.ts  ← registers every module's event-bus subscriptions
drizzle/            ← GENERATED migration SQL (`pnpm db:generate` from every module's infrastructure/*.schema.ts) — do not edit an already-applied one
```

## Testing
- Co-located `*.test.ts` files next to the module under test (domain/application layers, mocked repositories) — no mirrored `tests/` tree. This is the default `pnpm test`, no DB required.
- Co-located `*.integration.test.ts` (infrastructure repositories + a full `app.inject` HTTP round trip) run against a real Postgres via testcontainers — `pnpm test:integration`, needs Docker.
- Unit-test routes/use-cases against a mocked repository module — the repository is the seam.
```

---

## architecture addendum

Prepend `paths: ["src/**"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Node.js] Code-First API Boundary
- Each module's `api/*.schemas.ts` (TypeBox) is the only source of truth for that module's API surface — both the Fastify runtime validator and the OpenAPI spec source. `src/api/openapi.json` is GENERATED from them via `pnpm openapi:export`; CI diff-checks it. A PR touching request/response shapes without a matching `openapi.json` diff is a sign the export wasn't run.
- Route handlers (`api/*.routes.ts`) declare the schema and wire the call only — Fastify validates before the handler runs. Business logic lives in `application/*.use-case.ts`; DB access lives in `infrastructure/*.repository.ts`.

## [Node.js] Module Boundary
- Each module (`src/modules/<name>/`) exposes exactly one public surface: its `index.ts`. No other module may import past it — enforced by `eslint-plugin-boundaries` (`pnpm lint` fails on a violation).
- Cross-module reads go through the target module's exported functions (e.g. `posts` reading `users` via `getManyByIds`), never a direct repository or DB call into another module.

## [Node.js] Schema-First DB Boundary (Drizzle)
- Each module's `infrastructure/*.schema.ts` is hand-written and is the source of truth for that module's DB tables — the reverse of a SQL-first generator like sqlc (which generates code from hand-written SQL; Drizzle generates SQL migrations from hand-written TypeScript).
- After editing a `*.schema.ts`: run `pnpm db:generate` (produces a migration under `drizzle/`) then `pnpm db:migrate` before writing repository code against the new shape.
- Never hand-edit a migration under `drizzle/` already applied to a shared environment — add a new one.
- `infrastructure/*.repository.ts` uses Drizzle's query builder directly against its module's schema — the repository function *is* the query, there's no separate generated "typed queries" layer to keep in sync.

## [Node.js] Error Boundary
- `shared/errors/error-handler.ts`, registered via `app.setErrorHandler`, is the only place an HTTP error response is written — `AppError` throws, Fastify's own schema-validation failures, and other framework errors all route through it, onto the same fixed `{ error: { code, message, request_id, details? } }` contract.
- A new route must not open a second, unwired error path that could leak raw parser/driver text.
```

---

## settings.json Template

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm dev:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm type-check:*)",
      "Bash(pnpm typecheck:*)",
      "Bash(pnpm add:*)",
      "Bash(pnpm remove:*)",
      "Bash(pnpm install:*)",
      "Bash(pnpm openapi:export:*)",
      "Bash(pnpm db:generate:*)",
      "Bash(pnpm db:migrate:*)",
      "Bash(pnpm seed:*)",
      "Bash(pnpm dev:setup:*)",
      "Bash(pnpm drizzle-kit:*)",
      "Bash(docker build:*)",
      "Bash(docker compose:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git pull:*)",
      "Bash(git stash:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bash-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bugfix-test-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/spec-gate-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash|Write|Edit|WebFetch|mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-gate-guard.mjs"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "WebFetch|mcp__.*|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-scan-guard.mjs"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/canary-seed.mjs"
          },
          {
            "type": "command",
            "command": "node .claude/guards/session-resume-check.mjs"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/precompact-snapshot.mjs"
          }
        ]
      }
    ]
  }
}
```
