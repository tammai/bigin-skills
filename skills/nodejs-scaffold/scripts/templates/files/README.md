# {{PROJECT_NAME}}

Node.js TypeScript REST API — a **modular monolith** matching the org-default
architecture ADR (Fastify alternate stack).

- **Code-first OpenAPI.** TypeBox schemas in each module's `api/*.schemas.ts` are
  both the runtime validator and the spec source. `@fastify/swagger` dumps
  `src/api/openapi.json` from the live route schemas — you never hand-write it,
  and CI fails if it drifts (`pnpm openapi:export` + `git diff --exit-code`).
- **Two example modules.** `users` (with auth) and `posts` (with a real
  cross-module read-composition dependency on `users`).
- **Per-module Postgres schemas.** `pgSchema('users')`, `pgSchema('posts')`,
  `pgSchema('shared')` — a real namespace per module, not just a folder split.
  There are no cross-schema foreign keys.

## Module layout

```
src/
  modules/<name>/
    domain/          # pure entities — imports nothing local
    application/     # use-cases (RBAC checks live here, not in api/)
    infrastructure/  # Drizzle schema + repositories
    api/             # TypeBox schemas + Fastify routes
    index.ts         # the ONLY file other modules may import
    outbox.ts        # re-exports the outbox table for the job-queue relay
  shared/            # auth, event-bus, job-queue, idempotency, db, errors, pagination, config, schema
  api/               # composition root (app.ts), health routes, generated openapi.json
  server.ts          # boots the app + in-process Graphile Worker job runner
```

### Module boundaries are enforced, not just documented

`eslint-plugin-boundaries` runs as part of `pnpm lint` and **fails the build** on
an illegal import (a module reaching into another module's `infrastructure`,
`domain` importing anything, `shared` reaching past a module's `index`/`outbox`,
etc.). Fastify plugin encapsulation enforces none of this by itself — the lint
rule is what makes the directory shape a real boundary. Cross-module reads go
through the target module's `index.ts` only.

> **Setup gotcha (spike-confirmed):** boundary enforcement depends on
> `eslint-import-resolver-typescript` being installed and
> `settings['import/resolver'].typescript` being set (both already wired in
> `eslint.config.mjs`). Without the resolver, `.js`-extension imports resolve to
> *unknown* elements and violations pass lint **silently**. If a deliberately
> broken cross-module import ever passes `pnpm lint`, check the resolver first.

## Editable surface

- `src/modules/<name>/` — add domain/use-cases/repos/routes within a module
- `src/shared/` — cross-cutting concerns
- Add a module: create the folder tree, register its `api` plugin in
  `src/api/app.ts`, add its `infrastructure/*.schema.ts` (the drizzle glob picks
  it up), and — if it produces events — its `outbox.ts` to the relay.

`src/api/openapi.json` and `drizzle/*.sql` are **generated** — never hand-edited.

## First run

```sh
cp .env.example .env          # set JWT_SECRET; DATABASE_URL is preset for compose
pnpm install
docker compose up -d db
pnpm db:generate              # drizzle-kit: schema files -> drizzle/*.sql
pnpm db:migrate               # apply migrations
pnpm openapi:export           # regenerate src/api/openapi.json (no DB needed)
pnpm dev                      # API + in-process job runner
```

## Verify

```sh
pnpm lint          # includes module-boundary enforcement
pnpm type-check
pnpm build
pnpm test --run
```

## Endpoints

| Route | Auth | Purpose |
|---|---|---|
| `GET /healthz` | — | liveness |
| `GET /readyz` | — | readiness (real DB query) |
| `GET /docs` | — | Swagger UI (from the live route schemas) |
| `POST /v1/users` | — | sign up (Idempotency-Key supported) |
| `GET /v1/users` | JWT | cursor-paginated list |
| `GET /v1/users/:id` | JWT | fetch one |
| `POST /v1/auth/login` | — | issue access + refresh tokens |
| `POST /v1/auth/refresh` | — | rotate refresh token (reuse-detection) |
| `POST /v1/auth/logout` | JWT | revoke refresh token |
| `DELETE /v1/users/:id` | JWT | self-erase (emits `user.erased`) |
| `POST /v1/posts` | JWT | create (Idempotency-Key supported) |
| `GET /v1/posts` | JWT | list, with `author_name` composed from `users` |

## Key patterns

- **Auth.** JWT (HS256) access tokens + rotating sha256-hashed refresh tokens
  with family-based reuse detection. Passwords are argon2id. The BFF /
  sealed-cookie half of this pattern belongs to the *frontend* scaffold — this
  backend only issues/validates/revokes tokens. RBAC is a static in-code map
  (`shared/auth/rbac.ts`), checked inside use-cases — a documented extension
  point, not a DB table.
- **Events (outbox → relay → inbox).** `DELETE /v1/users/:id` hard-deletes the
  user and inserts a `user.erased` outbox row in one transaction. The in-process
  Graphile Worker relay (`FOR UPDATE SKIP LOCKED`) publishes it to the event bus;
  `posts` subscribes and anonymizes that author's posts, deduped via a
  `processed_events` inbox table so at-least-once delivery can't double-process.
  The relay and API run in the **same process** because the event bus is
  in-process — a future worker split would re-run the same subscription
  registration.
- **Idempotency-Key.** Opt-in per route (`config: { idempotent: true }`).
  Insert-first-as-lock (no TOCTOU); replays the stored response on a duplicate,
  `409` while in-flight, `422` on key reuse with a different body. A 24h TTL
  cleanup runs as the job queue's second task.
- **Cursor pagination.** `?cursor=&limit=&sort=` → `{ data, next_cursor }`.
  Keyset WHERE with a per-column OR-chain (correct for mixed asc/desc) plus an
  `id` tiebreaker. Sort allowlists contain **non-nullable columns only** — a
  nullable sort column silently drops NULL rows past page 1.
- **Error contract.** Every error is `{ error: { code, message, request_id,
  details? } }`. `request_id` echoes the `x-request-id` header (or a minted uuid).

## Known constraints

- One shared migration history across both modules (the drizzle glob covers all
  schema files) — not a per-module-independent-deploy story.
- Graphile Worker (Postgres-backed) instead of BullMQ/Redis — the scaffold ships
  zero infra beyond Postgres. Add Redis "the moment there's a second instance."
- `argon2`'s alpine (musl) prebuild is bundled in the pinned range — re-verify on
  any argon2 major bump; `node:22-alpine` has no C++ toolchain to compile from
  source.

## Deployment note

`@fastify/rate-limit` runs with the default `trustProxy: false`. Behind a proxy
(ALB, nginx, Cloudflare), set `trustProxy` so rate limiting keys off the real
client IP, not the proxy's.
