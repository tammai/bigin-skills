# {{PROJECT_NAME}}

Node.js TypeScript REST API. Contract-first: `openapi.yaml` generates API
types (`openapi-typescript`); `src/db/schema.ts` generates migrations
(`drizzle-kit`) — the reverse of a SQL-first generator like sqlc: you
hand-write the TypeScript schema, and migration SQL is generated from it.
Neither `src/types/api.d.ts` nor `drizzle/*.sql` is hand-edited.

## Editable surface

- `openapi.yaml` — the API contract
- `src/db/schema.ts` — the DB schema
- `src/routes/`, `src/services/`, `src/repositories/`, `src/middleware/` — business logic

Everything else regenerates from those. After changing `openapi.yaml`:

```sh
pnpm openapi-types
```

After changing `src/db/schema.ts`:

```sh
pnpm db:generate
pnpm db:migrate
```

## First run

```sh
cp .env.example .env
pnpm install
pnpm openapi-types
pnpm db:generate
docker compose up -d db
pnpm db:migrate
pnpm dev
```

## Verify

```sh
pnpm lint
pnpm type-check
pnpm build
pnpm test --run
```

## Endpoints

| Route | Purpose |
|---|---|
| `GET /healthz` | liveness |
| `GET /readyz` | readiness (checks DB) |
| `GET /openapi.yaml` | the contract |
| `GET /docs` | Swagger UI |
| `POST /api/v1/users`, `GET /api/v1/users/{id}` | example resource |

## Deployment note

`src/app.ts` registers `@fastify/rate-limit` with the default `trustProxy:
false` (no reverse proxy assumed). If this deploys behind one (ALB, nginx,
Cloudflare), set `trustProxy: true` (or a trusted CIDR list) — otherwise rate
limiting keys off the proxy's IP, not the client's.
