# {{PROJECT_NAME}}

Go REST API — Gin, contract-first via `oapi-codegen`, GORM + Postgres, JWT access
tokens with rotating refresh tokens.

## Quick start

```sh
cp .env.example .env                # then set JWT_SECRET: openssl rand -base64 48
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
make dev-setup                      # docker compose up -d db + apply migrations
make run                            # or: make dev  (hot reload via air)
```

The API listens on `:8090` under `/api/v1`. `GET /openapi.yaml` serves the
contract, `GET /healthz` is liveness, `GET /readyz` checks the database.

## Commands

| Purpose            | Command                                       |
|--------------------|-----------------------------------------------|
| run                | `make run`                                    |
| hot reload         | `make dev` (needs `air`)                      |
| build              | `make build`                                  |
| test               | `make test`                                   |
| vet                | `make vet`                                    |
| lint               | `make lint` (needs `staticcheck`)             |
| regenerate contract| `make generate`                               |
| new migration      | `make migrate-create name=add_widgets`        |
| apply migrations   | `make migrate-up` / `make migrate-down`       |

## Layout

```
openapi.yaml        ← the contract; single source of truth for routes and payloads
oapi-codegen.yaml   ← generator config
api/api.gen.go      ← GENERATED from openapi.yaml — never hand-edit
main.go             ← wiring: validators, CORS, health, generated route registration
handlers/           ← one method per operationId, implementing api.ServerInterface
middleware/         ← auth (JWT + RBAC), rate limiting, CORS, path selectors
models/             ← GORM models
config/             ← env loading + database handle
utils/              ← JWT, password policy, sanitisation, response helpers
migrations/         ← golang-migrate SQL (hand-written schema)
```

## Adding an endpoint

1. Add the path and schemas to `openapi.yaml` (give it an `operationId`, and a
   `tags` entry so it lands under the right prefix).
2. `make generate` — `api/api.gen.go` gains the new interface method.
3. Implement that method in `handlers/`. The build fails until you do; that's
   the contract being enforced.
4. If the route sits under a new path prefix that needs auth or a rate limit,
   add it to `middleware/selector.go` — routing is generated, **security is
   not**, and a missing selector case silently leaves the route public.

## Notes

- `api/api.gen.go` is generated. Change `openapi.yaml`, run `make generate`.
- Request validation happens at bind time via `binding` tags carried on the
  generated types through `x-oapi-codegen-extra-tags` in the contract.
- The rate limiter is in-memory and only correct for a single instance. Swap it
  for a shared store (e.g. Redis) before running more than one replica.
- Refresh tokens are opaque, stored hashed, and rotated on every use.
