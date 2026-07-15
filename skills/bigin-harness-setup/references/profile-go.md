# Go Profile Templates

Stack: Go REST API backend — contract-first (`oapi-codegen` + `sqlc`), chi router, Postgres

Empty repo → scaffolded by the **`go-scaffold`** skill (writes files, runs codegen, verifies build/vet/test, commits; no GitHub clone). See `skills/go-scaffold/`.

---

## Commands

```
lint:       make lint         # staticcheck ./...
typecheck:  go build ./...
test:       go test ./...
dev:        go run ./cmd/server
build:      go build -o bin/server ./cmd/server
generate:   make generate   # oapi-codegen (openapi.yaml) + sqlc (internal/store/queries/)
```

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Go REST API · contract-first (oapi-codegen + sqlc) · chi · Postgres
Go: ≥1.24

## Commands
| Purpose   | Command                              |
|-----------|---------------------------------------|
| dev       | `make run`                            |
| test      | `go test ./...`                       |
| vet       | `go vet ./...`                        |
| lint      | `make lint`                           |
| build     | `go build -o bin/server ./cmd/server` |
| generate  | `make generate`                       |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- `openapi.yaml` is the API contract, written first. `internal/api/` (server interface + models) is generated from it via `oapi-codegen` — never hand-edited.
- `internal/store/queries/*.sql` is the source of truth for data access. `internal/store/` (typed queries) is generated from it via `sqlc` — never hand-edited.
- After changing `openapi.yaml` or any file under `internal/store/queries/`, run `make generate` before touching `internal/server/handlers.go`.
- Business logic lives only in `internal/server/handlers.go` (implements the generated `StrictServerInterface`). No `//nolint` suppressions without a comment explaining the exception.
- No unauthenticated endpoints past the `authMiddleware` stub — replace it before production traffic.
- Never echo `err.Error()` (or any generated-tool error text) directly into an HTTP response body — log it server-side, respond with a generic `{code, message}`. See `internal/server/middleware.go`'s error handlers.
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

Paths frontmatter scopes this file to Go source — only loaded when Go files are in context.

```markdown
---
paths:
  - "**/*.go"
  - "internal/**"
  - "cmd/**"
---
# Conventions

## Editable surface
Only these are hand-written:
- `openapi.yaml` — the contract
- `internal/store/queries/*.sql` — domain SQL
- `db/migrations/` — schema
- `internal/server/*.go` — routing, middleware, business logic

`internal/api/` (from `openapi.yaml` via `oapi-codegen`) and `internal/store/` (from `internal/store/queries/*.sql` + `db/migrations/` via `sqlc`) are 100% generated — regenerate with `make generate`, never hand-edit. Both carry a `// Code generated ... DO NOT EDIT.` header; if you're about to edit a file with that header, stop and edit the source (the SQL, or `openapi.yaml`) instead.

## Naming
- Packages: lowercase, single word (`server`, `config`, `store`, `api`)
- Exported types: PascalCase. Unexported: camelCase.
- SQL query names (sqlc `-- name:` comments): PascalCase, matching the generated Go method (`GetUser`, `CreateUser`)
- Files: snake_case (`request_logger.go`)

## Handler Pattern (StrictServerInterface)

Handlers implement the generated `api.StrictServerInterface` in `internal/server/handlers.go` — one method per `openapi.yaml` `operationId`. Validate input, call `s.store` (the generated `store.Querier`), map domain results to typed response objects. Never write to `http.ResponseWriter` directly in a handler — return a typed `...JSONResponse` value.

```go
func (s *Server) CreateUser(ctx context.Context, request api.CreateUserRequestObject) (api.CreateUserResponseObject, error) {
    if request.Body == nil {
        return api.CreateUser400JSONResponse{Code: "invalid_request", Message: "request body is required"}, nil
    }
    user, err := s.store.CreateUser(ctx, store.CreateUserParams{Email: string(request.Body.Email), Name: request.Body.Name})
    if err != nil {
        return nil, err // -> handleResponseError: logged, generic 500, never err.Error() to the client
    }
    return api.CreateUser201JSONResponse(toAPIUser(user)), nil
}
```

A typed `4xxJSONResponse` returned with a `nil` error is a *handled* response (visited normally). A non-nil `error` return is an *unexpected* failure — the strict handler's `ResponseErrorHandlerFunc` (wired in `internal/server/routes.go`) logs it and writes a generic message. Never bypass this by writing to `w` inside a handler.

## OpenAPI First
Write `openapi.yaml` before implementing any new route, then `make generate` before writing the handler.

## Error Handling
- Domain errors (not found, validation) → typed response objects (`api.GetUser404JSONResponse{...}`), returned with a `nil` error.
- Unexpected errors (DB down, etc.) → `return nil, err`; the shared `ResponseErrorHandlerFunc`/`RequestErrorHandlerFunc` in `internal/server/middleware.go` handle logging + the generic client-facing message. Both the strict-handler layer (JSON body decode) and the chi `ServerInterfaceWrapper` layer (path/query param binding) route through the same handlers — see `internal/server/routes.go`'s `api.HandlerWithOptions` call. Don't add a second, un-wired error path.

## Project Layout
```
cmd/server/main.go       ← entry point, wiring, graceful shutdown
internal/
  config/                ← env-based config (caarlos0/env)
  server/                ← router, middleware, handlers — the only hand-written business logic
  api/                   ← GENERATED from openapi.yaml (oapi-codegen) — do not edit
  store/                 ← GENERATED from internal/store/queries/*.sql (sqlc) — do not edit
    queries/             ← hand-written SQL, sqlc's input
db/migrations/           ← hand-written schema SQL (golang-migrate format)
```

## Testing
- Co-located `_test.go` files (idiomatic Go), not a mirrored `tests/` tree.
- Unit-test handlers against a fake satisfying `store.Querier` — sqlc's generated interface is the seam; no hand-rolled interface and no real Postgres needed for handler-logic tests.
- Nil-guard tests (e.g. a readiness check against a nil pool) are worth keeping — they catch the class of bug that only shows up when a dependency is legitimately absent, not just the happy path with everything wired.
```

---

## architecture addendum

Prepend `paths: ["**/*.go"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Go] Contract-First Boundary
- `openapi.yaml` and `internal/store/queries/*.sql` are the only sources of truth for, respectively, the API surface and data access. `internal/api/` and `internal/store/` are generated — a PR touching either without a corresponding contract/query/migration change is a sign the contract was bypassed.
- All business logic lives in `internal/server/handlers.go`, implementing the generated `StrictServerInterface`. Nothing outside `internal/server/` calls `internal/store` directly.
- `internal/server/middleware.go` owns the only two places an HTTP response is written for an error (`handleRequestError`, `handleResponseError`) — both request-error paths (JSON body decode *and* chi param binding, wired via `api.HandlerWithOptions`) go through them. A new route or generated operation must not open a third, unwired error path that leaks `err.Error()`.

## [Go] Regeneration Discipline
- After editing `openapi.yaml` or `internal/store/queries/*.sql`: run `make generate` before writing handler code against the new shapes.
- `internal/server/handlers.go` may fail to compile immediately after a contract change — that's expected, it means the generated interface changed and handlers need updating, not that something is broken.
```

---

## settings.json Template

```json
{
  "permissions": {
    "allow": [
      "Bash(go build:*)",
      "Bash(go run:*)",
      "Bash(go test:*)",
      "Bash(go vet:*)",
      "Bash(go mod:*)",
      "Bash(go generate:*)",
      "Bash(go install:*)",
      "Bash(gofmt:*)",
      "Bash(staticcheck:*)",
      "Bash(golangci-lint:*)",
      "Bash(migrate:*)",
      "Bash(docker build:*)",
      "Bash(docker compose:*)",
      "Bash(make:*)",
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
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/spec-gate-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash|Write|Edit|mcp__.*",
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
            "command": "node .claude/guards/session-resume-check.mjs"
          }
        ]
      }
    ]
  }
}
```
