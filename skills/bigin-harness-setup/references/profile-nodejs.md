# Node.js Profile Templates

Stack: Node.js TypeScript REST API backend — contract-first (`openapi-typescript` + Drizzle/`drizzle-kit`), Fastify, Postgres

Empty repo → scaffolded by the **`nodejs-scaffold`** skill (writes files, runs codegen, verifies lint/typecheck/build/test, commits; no GitHub clone). See `skills/nodejs-scaffold/`.

---

## Commands

```
lint:       pnpm lint
typecheck:  pnpm type-check
test:       pnpm test --run
dev:        pnpm dev
build:      pnpm build
generate:   pnpm openapi-types && pnpm db:generate   # openapi-typescript (openapi.yaml) + drizzle-kit (src/db/schema.ts)
migrate:    pnpm db:migrate
```

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Node.js TypeScript REST API · contract-first (openapi-typescript + Drizzle) · Fastify · Postgres
Node: ≥22 · pnpm only

## Commands
| Purpose   | Command            |
|-----------|--------------------|
| dev       | `pnpm dev`         |
| test      | `pnpm test --run`  |
| lint      | `pnpm lint`        |
| typecheck | `pnpm type-check`  |
| build     | `pnpm build`       |
| generate  | `pnpm openapi-types && pnpm db:generate` |
| migrate   | `pnpm db:migrate`  |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- `openapi.yaml` is the API contract, written first. `src/types/api.d.ts` is generated from it via `openapi-typescript` — never hand-edited.
- `src/db/schema.ts` is the source of truth for the DB schema. After changing it: `pnpm db:generate` (produces a migration under `drizzle/`), then `pnpm db:migrate` to apply. Never hand-edit a migration already applied to a shared environment — add a new one instead.
- Business logic lives only in `src/services/`. Only `src/repositories/` uses the Drizzle query builder. Route handlers (`src/routes/`) do Zod validation + wiring only.
- No `--no-verify`. No `eslint-disable` without a justifying comment. No weakening eslint config to pass checks.
- No `@ts-ignore` or `as any` without a justifying comment.
- No unauthenticated endpoints past a stubbed auth check — replace it before production traffic.
- Validate all inputs at handler boundaries using Zod.
- Never echo raw driver/internal error text into a response body — log it server-side, respond with a generic `{code, message}`. (Zod's flattened validation errors are the intentional exception — that's client-actionable feedback, not an internals leak.)
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
- `openapi.yaml` — the contract
- `src/db/schema.ts` — the DB schema
- `src/routes/`, `src/services/`, `src/repositories/`, `src/middleware/` — routing, business logic, data access

`src/types/api.d.ts` (from `openapi.yaml` via `openapi-typescript`) and `drizzle/*.sql` (from `src/db/schema.ts` via `drizzle-kit generate`) are generated. Regenerate with `pnpm openapi-types` / `pnpm db:generate` — never hand-edit `src/types/api.d.ts`. A migration under `drizzle/` may be tweaked before it's ever applied anywhere, but never after — add a new one instead.

## Naming
- Files: kebab-case (`user-controller.ts`, `user-service.ts`)
- Classes, types, interfaces: PascalCase
- Functions, variables: camelCase
- Routes: kebab-case (`/users/:id/profile`)
- Zod schemas: camelCase with `Schema` suffix (`createUserSchema`)
- Drizzle columns: snake_case DB column strings, camelCase TS property names (`createdAt: timestamp('created_at')`)

## Handler Pattern

```ts
async function createUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const result = createUserSchema.safeParse(request.body)
  if (!result.success) {
    reply.code(400).send({ code: 'invalid_request', message: 'validation failed', details: result.error.flatten() })
    return
  }
  const user = await userService.create(result.data)
  reply.code(201).send(user)
}
```

Validation at the handler boundary only. Services receive clean, typed data.

## OpenAPI First
Write `openapi.yaml` before implementing any new route. Generate types:
```sh
pnpm openapi-types
```
Import: `import type { paths } from '../types/api.js'`
Never define API shapes inline — always use generated types.

## Error Handling
- Route handlers never write an error response directly — either `safeParse` + an explicit 400, or let a thrown error reach the centralized `setErrorHandler` (`src/middleware/error-handler.ts`).
- `setErrorHandler` covers both Fastify's own body-parse errors (malformed JSON) and handler-thrown errors through the same path — a new route must not open a second, unwired error path that leaks raw parser/driver text.
- Zod validation errors return flattened field detail (client-actionable, intentional); anything else returns a generic `{code, message}`.
- No `console.log` in production paths — use the request/app logger (`request.log` / `app.log`).

## Project Layout
```
src/
  config/         ← env parsing (Zod)
  routes/         ← route registration + handler functions
  services/       ← business logic
  repositories/   ← data access (Drizzle query builder against db/schema.ts)
  middleware/      ← auth, error handling
  db/             ← schema.ts (hand-written), client.ts, migrate.ts
  types/          ← GENERATED from openapi.yaml (openapi-typescript) — do not edit
  lib/            ← shared utilities
drizzle/          ← GENERATED from src/db/schema.ts (drizzle-kit) — do not edit
```

## Testing
- Co-located `*.test.ts` files next to the module under test — no mirrored `tests/` tree.
- Unit-test routes/services against a mocked repository module (`vi.mock('../repositories/user-repository.js')`) — the repository is the seam; no live Postgres needed.
- Keep `/readyz`-against-unreachable-DB tests — they catch the class of bug that only shows up when a dependency is legitimately absent, not just the happy path with everything wired.
```

---

## architecture addendum

Prepend `paths: ["src/**"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Node.js] Contract-First API Boundary
- `openapi.yaml` is the only source of truth for the API surface. `src/types/api.d.ts` is generated from it — a PR touching request/response shapes without a corresponding `openapi.yaml` change is a sign the contract was bypassed.
- Route handlers (`src/routes/`) validate input and wire the call only. Business logic lives in `src/services/`; DB access lives in `src/repositories/`. Nothing outside `src/repositories/` imports `src/db/client.ts` directly.
- `src/middleware/error-handler.ts` (registered via `app.setErrorHandler`) owns the only place an HTTP error response is written — both Fastify's own body-parse errors and handler-thrown errors go through it. A new route must not open a second, unwired error path.

## [Node.js] Schema-First DB Boundary (Drizzle)
- `src/db/schema.ts` is hand-written and is the source of truth for the DB schema — the reverse of a SQL-first generator like sqlc (which generates code from hand-written SQL; Drizzle generates SQL migrations from hand-written TypeScript).
- After editing `src/db/schema.ts`: run `pnpm db:generate` (produces a migration under `drizzle/`) then `pnpm db:migrate` before writing repository code against the new shape.
- Never hand-edit a migration under `drizzle/` already applied to a shared environment — add a new one.
- `src/repositories/` uses Drizzle's query builder directly against `schema.ts` — unlike sqlc, there is no separate generated "typed queries" layer to keep in sync; the repository function *is* the query.
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
      "Bash(pnpm openapi-types:*)",
      "Bash(pnpm openapi-typescript:*)",
      "Bash(pnpm db:generate:*)",
      "Bash(pnpm db:migrate:*)",
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
