# {{PROJECT_NAME}}

Go REST API — a modular monolith. Contract-first: `api/openapi.yaml` (tagged
per module) generates each module's chi-server interface + models (`oapi-codegen`);
each module's `internal/infrastructure/queries/*.sql` generates its typed queries
(`sqlc`). Generated code (`internal/<module>/internal/gen/`, `.../infrastructure/db/`)
is never hand-edited.

## Layout

```
api/openapi.yaml            the single API contract (operations tagged users|posts)
db/migrations/              schema (golang-migrate); one .up/.down per module
cmd/server, cmd/seed        entrypoints
internal/app/               composition root — wires modules, mounts routes + middleware
internal/shared/            shared kernel: auth (JWT, argon2id, RBAC), apierror, config, pgconv
internal/<module>/          public surface only (Register, cross-module methods)
  internal/domain/          entities + pure mapping (no framework/DB)
  internal/application/     use-cases + repository interfaces (RBAC lives here)
  internal/infrastructure/  pgx/sqlc repositories + queries/*.sql
  internal/api/             thin HTTP handlers (implement the generated strict server)
  internal/gen/             generated server interface + models (do not edit)
```

Module boundaries are compiler-enforced by Go's nested `internal/`: one module
cannot import another's internals — cross-module calls go through the narrow
public surface (`users.GetManyByIDs`, `posts.AnonymizeAuthor`).

## Editable surface

- `api/openapi.yaml` — the API contract
- `internal/<module>/internal/infrastructure/queries/*.sql` — domain SQL
- `db/migrations/` — schema
- `internal/<module>/internal/{domain,application,api}/` — module code

After changing the contract, any `queries/*.sql`, or a migration:

```sh
make generate
```

## First run

```sh
cp .env.example .env          # set JWT_SECRET (openssl rand -base64 48) — required, no default
go mod tidy
make generate
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest   # one-time
make dev-setup                # docker compose up -d db + migrate + seed
make run
```

## Verify

```sh
go build -o bin/server ./cmd/server
go vet ./...
go test ./...                 # unit tests (Docker-free)
make test-integration         # golden-path suite against real Postgres (needs Docker)
```

## Endpoints

| Route | Purpose |
|---|---|
| `GET /healthz` | liveness |
| `GET /readyz` | readiness (pings DB) |
| `GET /openapi.yaml` | the contract (when served) |
| `GET /docs` | Swagger UI (when served) |
| `POST /v1/users` | sign up (public) |
| `GET /v1/users`, `GET /v1/users/{id}` | list / fetch (auth + `users:read`) |
| `DELETE /v1/users/{id}` | erase — soft-delete + anonymize posts (self, or `users:erase`) |
| `POST /v1/auth/login` | issue access + refresh tokens |
| `POST /v1/auth/refresh` | rotate the refresh token (reuse detection) |
| `POST /v1/auth/logout` | revoke the caller's refresh token |
| `GET /v1/posts`, `POST /v1/posts` | list / create (auth; create needs `posts:write`) |
| `PATCH /v1/posts/{id}` | update with optimistic concurrency (author-only) |

## Auth

Access is a short-lived HS256 JWT (subject + roles); refresh is a rotating,
sha256-stored token with family-based reuse detection. Passwords are hashed with
argon2id. `auth.Middleware` only parses a bearer token into the request context —
it never rejects — so public routes stay reachable; protected handlers call
`auth.Require`, and authorization (RBAC) is an explicit `auth.Can` check inside
each use-case, never in the route. `JWT_SECRET` has no default: a missing signing
key crashes the process rather than signing with a placeholder.

## Deployment note

The composition root resolves the client IP via `middleware.ClientIPFromRemoteAddr`
(no trusted reverse proxy assumed). Behind an ALB/nginx/Cloudflare, switch to
`middleware.ClientIPFromXFF("<trusted-proxy-CIDR>")` — otherwise rate limiting and
request logging key off the proxy's IP, not the client's.
