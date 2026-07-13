# {{PROJECT_NAME}}

Go REST API. Contract-first: `openapi.yaml` generates the server interface and
models (`oapi-codegen`); `internal/store/queries/*.sql` generates typed queries
(`sqlc`). Neither `internal/api/` nor `internal/store/` is hand-edited.

## Editable surface

- `openapi.yaml` — the API contract
- `internal/store/queries/*.sql` — domain SQL
- `db/migrations/` — schema
- `internal/server/handlers.go` — business logic (implements the generated `StrictServerInterface`)

Everything else regenerates from those. After changing any of them:

```sh
make generate
```

## First run

```sh
cp .env.example .env
go mod tidy
make generate
docker compose up -d db
```

One-time tool installs (only `migrate` — `sqlc`/`oapi-codegen` run via `go run`, no install needed):

```sh
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest
```

```sh
make migrate-up
make run
```

## Verify

```sh
go build -o bin/server ./cmd/server
go vet ./...
go test ./...
```

## Endpoints

| Route | Purpose |
|---|---|
| `GET /healthz` | liveness |
| `GET /readyz` | readiness (checks DB) |
| `GET /metrics` | Prometheus metrics |
| `GET /openapi.yaml` | the contract |
| `GET /docs` | Swagger UI |
| `POST /api/v1/users`, `GET /api/v1/users/{id}` | example resource |

## Deployment note

`internal/server/routes.go` resolves the client IP via `middleware.ClientIPFromRemoteAddr`
(no trusted reverse proxy assumed). If this deploys behind one (ALB, nginx,
Cloudflare), switch to `middleware.ClientIPFromXFF("<trusted-proxy-CIDR>")` —
otherwise rate limiting and request logging key off the proxy's IP, not the
client's.
