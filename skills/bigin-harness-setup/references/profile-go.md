# Go Profile Templates

Stack: Go REST API backend — Gin, contract-first (`oapi-codegen`), GORM + Postgres

Empty repo → scaffolded by the **`go-scaffold`** skill (writes files, runs codegen, verifies build/vet/test, commits; no GitHub clone). See `skills/go-scaffold/`.

---

## Commands

```
lint:       make lint         # staticcheck, excluding generated api/
typecheck:  go build ./...
test:       go test ./... -count=1
dev:        make dev          # air hot reload; make run for plain `go run .`
build:      go build -o bin/server .
generate:   make generate     # oapi-codegen: openapi.yaml -> api/api.gen.go
```

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Go REST API · Gin · contract-first (oapi-codegen) · GORM · Postgres
Go: ≥1.24

## Commands
| Purpose   | Command                    |
|-----------|----------------------------|
| dev       | `make run` (`make dev` = hot reload) |
| test      | `go test ./... -count=1`   |
| vet       | `go vet ./...`             |
| lint      | `make lint`                |
| build     | `make build`               |
| generate  | `make generate`            |
| migrate   | `make migrate-up`          |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- `api/api.gen.go` is 100% generated — never hand-edit. Change `openapi.yaml`, run `make generate`, *then* write the handler.
- Routing is generated; **security is not**. A route under a new path prefix needing auth or a rate limit must be added to `middleware/selector.go`, or it is public and nothing fails loudly.
- No `--no-verify`. No `//nolint` without a comment explaining the exception.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- Never echo `err.Error()` from a database or internal failure into a response body — return a fixed message via `utils.Error`. Handler + error rules: `.claude/rules/conventions.md`.

## Task workflow
Non-trivial features: /task-workflow.
```

---

## conventions.md Template

Paths frontmatter scopes this file to Go source — only loaded when Go files are in context.

```markdown
---
paths:
  - "**/*.go"
  - "openapi.yaml"
  - "migrations/**"
---
# Conventions

## Editable surface
Only these are hand-written:
- `openapi.yaml` — the contract
- `migrations/` — schema (golang-migrate; `make migrate-create name=x`)
- `models/`, `handlers/`, `middleware/`, `utils/`, `config/`, `main.go`

`api/api.gen.go` is generated from `openapi.yaml` by `oapi-codegen` — regenerate with `make generate`, never hand-edit. It carries a `// Code generated ... DO NOT EDIT.` header; if you're about to edit a file with that header, stop and edit `openapi.yaml` instead.

## Naming
- Packages: lowercase, single word (`handlers`, `models`, `middleware`, `utils`, `config`)
- Exported types: PascalCase. Unexported: camelCase.
- Files: snake_case, named after the resource (`refresh_token.go`)
- One handler file per resource (`auth.go`, `profile.go`, `admin.go`); all methods hang off the single `handlers.Server`.

## Handler Pattern (api.ServerInterface)

Handlers implement the generated `api.ServerInterface` — one method per `openapi.yaml` `operationId`, asserted at compile time by `var _ api.ServerInterface = (*Server)(nil)` in `handlers/server.go`. Bind into the generated request type, validate, query `config.DB`, map the GORM model to the contract's response type via `toAPIUser`-style helpers, and always return through `utils.Success` / `utils.Error`.

```go
func (s *Server) UpdateProfile(c *gin.Context) {
    var body api.UpdateProfileRequest
    if err := c.ShouldBindJSON(&body); err != nil {
        utils.Error(c, http.StatusBadRequest, err.Error()) // binding errors are safe to surface
        return
    }
    userID, ok := c.Get("userID")
    if !ok {
        utils.Error(c, http.StatusUnauthorized, "Unauthorized")
        return
    }
    var user models.User
    if err := config.DB.First(&user, userID).Error; err != nil {
        utils.Error(c, http.StatusNotFound, "User not found")
        return
    }
    if body.FullName != nil {
        user.FullName = utils.SanitizeText(*body.FullName)
    }
    if err := config.DB.Save(&user).Error; err != nil {
        utils.Error(c, http.StatusInternalServerError, "Failed to update profile") // fixed message, never err.Error()
        return
    }
    utils.Success(c, http.StatusOK, toAPIUser(user))
}
```

A `c.ShouldBindJSON` error is the one error text safe to return — it describes the client's own payload. Every database or internal failure gets a **fixed** message; the driver's error can name tables, columns, and the DSN.

## OpenAPI First
Write `openapi.yaml` before implementing any new route, then `make generate` before writing the handler. Request validation rides on the contract: put `binding` tags on the schema via `x-oapi-codegen-extra-tags` (`required`, `email`, `min=8`, `notags`) rather than re-validating by hand in the handler.

## Security wiring
- `middleware/selector.go` maps route prefixes to roles and rate limits by matching `c.FullPath()`. Those literals include the `GinServerOptions.BaseURL` prefix set in `main.go` — change one without the other and every case falls through to `default: c.Next()`, silently making protected routes public. `main_test.go` asserts both directions; keep it passing.
- Free-text fields get two layers: the `notags` binding tag rejects markup at bind time, `utils.SanitizeText` cleans at write time. Add both to any new free-text field.
- Refresh tokens are opaque, stored only as a SHA-256 hash, and rotated on use. Never store or log a raw refresh token.
- Never trust a client-supplied `role`; it is set server-side.

## Project Layout
```
main.go            ← wiring: validators, CORS, health probes, generated route registration
openapi.yaml       ← the contract
oapi-codegen.yaml  ← generator config
api/               ← GENERATED from openapi.yaml — do not edit
handlers/          ← one method per operationId, implementing api.ServerInterface
middleware/        ← auth (JWT + RBAC), rate limit, CORS, path selectors
models/            ← GORM models
config/            ← env loading + the DB handle
utils/             ← JWT, password policy, sanitisation, response helpers
migrations/        ← hand-written schema SQL (golang-migrate)
```

## Testing
- Co-located `_test.go` files (idiomatic Go), not a mirrored `tests/` tree.
- Router-level tests build the real `newRouter` — a test that rebuilds its own router proves nothing about the wiring that ships.
- `utils/` and `middleware/` are pure and DB-free; test them directly (`t.Setenv` for `JWT_SECRET`), including the negative cases: expired token, foreign signing secret, `alg=none`, unlisted CORS origin.
- Nil-guard tests (e.g. `/readyz` with no DB connected) are worth keeping — they catch the class of bug that only shows up when a dependency is legitimately absent.
```

---

## architecture addendum

Prepend `paths: ["**/*.go"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Go] Contract-First Boundary
- `openapi.yaml` is the only source of truth for the API surface. `api/api.gen.go` is generated — a PR touching it without a corresponding contract change is a sign the contract was bypassed.
- Handlers implement the generated `api.ServerInterface` and are the only place business logic lives. `handlers/server.go`'s `var _ api.ServerInterface = (*Server)(nil)` is what makes a contract change fail the build instead of drifting silently.
- Every response goes through `utils.Success` / `utils.Error`, so the API has exactly one error shape (`{"error": "..."}`) — including the generated router's own param-binding failures, remapped by the `ErrorHandler` in `main.go`. A new route must not open a second, unwired error path that leaks `err.Error()`.

## [Go] Generated Routing, Hand-Wired Security
- `oapi-codegen` does not enforce the contract's `security:` schemes. Authorization and rate limiting come from the prefix selectors in `middleware/selector.go`, which match on `c.FullPath()` — i.e. `GinServerOptions.BaseURL` + the spec path.
- A new protected prefix that isn't added there is public, compiles fine, and returns 200. Treat any change to `BaseURL`, to a path prefix in `openapi.yaml`, or to `selector.go` as touching all three.

## [Go] Regeneration Discipline
- After editing `openapi.yaml`: run `make generate` before writing handler code against the new shapes.
- `handlers/` may fail to compile immediately after a contract change — that's expected, it means the generated interface changed and handlers need updating, not that something is broken.
- Schema changes are migrations (`make migrate-create name=x`), never GORM `AutoMigrate` — the SQL in `migrations/` is the reviewable record.
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
      "Bash(air:*)",
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
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bugfix-test-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/commit-msg-guard.mjs"
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
