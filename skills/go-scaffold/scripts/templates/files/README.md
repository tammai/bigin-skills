# {{PROJECT_NAME}}

Go REST API — a **modular monolith**. Gin, contract-first via `oapi-codegen`,
GORM + Postgres, JWT access tokens with rotating refresh tokens.

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

| Purpose             | Command                                       |
|---------------------|-----------------------------------------------|
| run                 | `make run`                                    |
| hot reload          | `make dev` (needs `air`)                      |
| build               | `make build`                                  |
| test                | `make test`                                   |
| vet                 | `make vet`                                    |
| lint                | `make lint` (needs `staticcheck`)             |
| regenerate contract | `make generate`                               |
| new migration       | `make migrate-create name=add_widgets`        |
| apply migrations    | `make migrate-up` / `make migrate-down`       |

## Layout

```
openapi.yaml                    ← the contract; source of truth for routes and payloads
oapi-codegen.yaml               ← generator config
migrations/                     ← golang-migrate SQL (hand-written schema)
cmd/server/                     ← entrypoint + composition root: reads env, opens the DB, lists the modules
internal/
  openapi/openapi.gen.go        ← GENERATED from openapi.yaml — never hand-edit
  api/                          ← HTTP composition: router, health probes, module assembly
    middleware/                 ← auth guard, CORS, rate limit, path selectors
  modules/
    users/                      ← module.go IS the module's public API; everything below is private
      domain/                   ← entity + invariants. No gin, no gorm, no generated types
      application/              ← use cases + the repository ports they depend on
      infrastructure/           ← GORM records and repositories implementing those ports
      api/                      ← gin handlers: bind, call a use case, map the result
  shared/                       ← apperr, auth, config, db, httpx, validate
  arch/                         ← the boundary rules, enforced as a test
```

Dependencies point inward: `api → application → domain`, with `infrastructure`
implementing ports that `application` declares. `shared` sits at the bottom and
imports no module.

## Module boundaries are enforced

`internal/arch` reads every import under `internal/` and fails `go test ./...`
on one that crosses a line:

- another module's subpackages (only its `module.go` is importable from outside)
- `domain` importing `application`, `infrastructure`, `api`, or the generated types
- `application` importing `infrastructure` or `api`
- `domain` or `application` importing gin or gorm
- `shared` importing any module

A layout nothing enforces decays one "just this once" import at a time, so this
is a test rather than a note in a README.

## Adding an endpoint

1. Add the path and schemas to `openapi.yaml` (give it an `operationId`, and a
   `tags` entry so it lands under the right prefix).
2. `make generate` — the generated `ServerInterface` gains the new method, and
   `internal/api/server.go` stops compiling until a module implements it.
3. Implement it in the owning module: a use case in `application/`, then a thin
   handler method in that module's `api/` package.
4. If the route sits under a new path prefix that needs auth or a rate limit,
   add a case in `internal/api/middleware/selector.go` — routing is generated,
   **security is not**, and a missing case leaves the route public.

## Adding a module

```
internal/modules/<name>/
  domain/          entity + rules
  application/     use cases + ports
  infrastructure/  repositories implementing the ports
  api/             handlers
  module.go        the public contract: New(), the Handlers alias, cross-module methods
```

Then embed its `Handlers` in `internal/api/server.go` and construct it in
`cmd/server/main.go`.

When one module needs another's data, add a method to that module's `module.go`
returning a plain struct — never import its `domain` or `infrastructure`, and
prefer a batch method (`ByIDs`) over a per-row one, or decorating a list becomes
an N+1 the boundary hides.

## Notes

- `internal/openapi/openapi.gen.go` is generated. Change `openapi.yaml`, run
  `make generate`. CI fails if the committed file has drifted from the contract.
- Request validation happens at bind time via `binding` tags carried on the
  generated types through `x-oapi-codegen-extra-tags` in the contract.
- Every response goes through `httpx.OK` or `httpx.Fail`, so there is one error
  shape and exactly one place that maps a failure to a status code.
- The rate limiter is in-memory and per-process. With more than one replica the
  effective limit multiplies by the replica count — swap in a shared store
  (Redis) before scaling out.
- Refresh tokens are opaque, stored only as a SHA-256 hash, and rotated on every
  use, so a replayed token is detected instead of silently accepted.
