# Go Profile Templates

Stack: Go modular-monolith REST API backend — Gin, contract-first (`oapi-codegen`), GORM + Postgres

Empty repo → scaffolded by the **`go-scaffold`** skill (writes files, runs codegen, verifies build/vet/test, commits; no GitHub clone). See `skills/go-scaffold/`.

---

## Commands

```
lint:       make lint         # staticcheck, excluding generated internal/openapi/
typecheck:  go build ./...
test:       go test ./... -count=1   # includes internal/arch, the boundary test
dev:        make dev          # air hot reload; make run for plain `go run ./cmd/server`
build:      go build -o bin/server ./cmd/server
generate:   make generate     # oapi-codegen: openapi.yaml -> internal/openapi/openapi.gen.go
```

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Go modular-monolith REST API · Gin · contract-first (oapi-codegen) · GORM · Postgres
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
- `internal/openapi/openapi.gen.go` is 100% generated — never hand-edit. Change `openapi.yaml`, run `make generate`, *then* write the handler.
- Module boundaries are enforced by `internal/arch` as a test. Only `internal/modules/<m>/module.go` is importable from outside that module; `domain`/`application` import neither gin nor gorm. `go test ./...` fails on a violation — don't work around it, the layout is the point.
- Routing is generated; **security is not**. A route under a new path prefix needing auth or a rate limit must be added to `internal/api/middleware/selector.go`, or it is public and nothing fails loudly.
- No `--no-verify`. No `//nolint` without a comment explaining the exception.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- Never echo `err.Error()` from a database or internal failure into a response body — return a typed `apperr` and let `httpx.Fail` map it. Layering + error rules: `.claude/rules/conventions.md`.

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
- `cmd/server/` — the composition root
- `internal/modules/<mod>/{domain,application,infrastructure,api}` + `module.go`
- `internal/shared/`, `internal/api/`, `internal/arch/`

`internal/openapi/openapi.gen.go` is generated from `openapi.yaml` by `oapi-codegen` — regenerate with `make generate`, never hand-edit. It carries a `// Code generated ... DO NOT EDIT.` header; if you're about to edit a file with that header, stop and edit `openapi.yaml` instead.

## Layering

Dependencies point inward. Each arrow is enforced by `internal/arch`, not by convention:

```
api ──▶ application ──▶ domain
         ▲
infrastructure (implements ports declared in application)
```

- **domain** — entities and the rules that hold regardless of caller. No gin, no gorm, no generated types.
- **application** — use cases. Declares repository *ports* as interfaces; never imports `infrastructure`. This is what makes every use-case test run against an in-memory fake with no database.
- **infrastructure** — GORM records (unexported) and repositories implementing those ports. Translates storage errors into `apperr` so `gorm.ErrRecordNotFound` never escapes.
- **api** — gin handlers. Bind, call a use case, map the result. Nothing else.
- **module.go** — the module's public contract, and the only package importable from outside the module.

Put a rule in `domain` if it's always true of the entity, in `application` if it involves the requester or orchestration (e.g. "an admin may not demote themselves"), and in `api` only if it's about the wire format.

## Naming
- Packages: lowercase, single word, named for the layer (`domain`, `application`, `infrastructure`, `api`) or the capability (`apperr`, `httpx`, `validate`).
- Exported types: PascalCase. Unexported: camelCase.
- Files: snake_case, named after the use case or resource (`refresh_token.go`, `signup.go`).
- Persistence structs are unexported and suffixed `Record` (`userRecord`), with an explicit `TableName()` — GORM would otherwise pluralise the struct name and miss the migrated table.

## Handler Pattern

Handlers implement the generated `openapi.ServerInterface`, which `internal/api/server.go` assembles from each module's embedded `Handlers`; `var _ openapi.ServerInterface = (*server)(nil)` asserts it at compile time. A handler translates and nothing else:

```go
func (h *Handlers) UpdateProfile(c *gin.Context) {
    var body openapi.UpdateProfileRequest
    if err := c.ShouldBindJSON(&body); err != nil {
        httpx.Error(c, http.StatusBadRequest, err.Error()) // binding errors are safe to surface
        return
    }
    userID, ok := callerID(c) // from verified token claims, never from the body
    if !ok {
        return
    }
    user, err := h.svc.UpdateProfile(c.Request.Context(), userID, body.FullName)
    if err != nil {
        httpx.Fail(c, err) // one place maps a Kind to a status
        return
    }
    httpx.OK(c, http.StatusOK, toAPIUser(*user))
}
```

A `c.ShouldBindJSON` error is the one error text safe to return — it describes the client's own payload. Everything else travels as a typed `apperr` and reaches the client through `httpx.Fail`, which maps `Kind` to a status once. An error that never passed through `apperr` becomes a fixed-message 500, so a driver error naming tables, columns, or the DSN cannot leak.

If you find yourself writing an `if` in a handler that isn't about the wire format, it belongs in `application` or `domain` — a rule in a handler is one no other caller reaches and no DB-free test covers.

## OpenAPI First
Write `openapi.yaml` before implementing any new route, then `make generate` before writing the handler. Request validation rides on the contract: put `binding` tags on the schema via `x-oapi-codegen-extra-tags` (`required`, `email`, `min=8`, `notags`) rather than re-validating by hand in the handler.

## Security wiring
- `internal/api/middleware/selector.go` maps route prefixes to roles and rate limits by matching `c.FullPath()`. Those prefixes are built from `middleware.BaseURL`, the same constant the router registers with — so the two can't drift. What still bites: a **new** path prefix with no case falls through to `default: c.Next()` and is public, compiling, answering 200. `internal/api/router_test.go` asserts both directions; keep it passing.
- Free-text fields get two layers: the `notags` binding tag rejects markup at bind time, `validate.SanitizeText` cleans at write time — call it from the domain constructor/mutator, not the handler, so every caller gets it.
- Refresh tokens are opaque, stored only as a SHA-256 hash, and rotated on use. Never store or log a raw refresh token.
- Never trust a client-supplied `role`; it is set server-side.
- The caller's identity comes from `httpx.ClaimsFrom(c)`, populated by the auth middleware. Never take a user ID from a body or query parameter.
- Nothing below `cmd/server` reads `os.Getenv` — config is resolved once and passed down. Add a field to `shared/config.Config` rather than reaching for the environment.

## Project Layout
```
openapi.yaml                  ← the contract
oapi-codegen.yaml             ← generator config
migrations/                   ← hand-written schema SQL (golang-migrate)
cmd/server/                   ← entrypoint + composition root
internal/
  openapi/                    ← GENERATED from openapi.yaml — do not edit
  api/                        ← router, health probes, module assembly
    middleware/               ← auth guard, CORS, rate limit, path selectors
  modules/<mod>/
    module.go                 ← the module's public contract
    domain/                   ← entity + invariants
    application/              ← use cases + repository ports
    infrastructure/           ← GORM records + repositories
    api/                      ← gin handlers
  shared/                     ← apperr, auth, config, db, httpx, validate
  arch/                       ← boundary rules, enforced as a test
```

## Adding a module
Create the four layers plus `module.go`, embed its `Handlers` in `internal/api/server.go`, construct it in `cmd/server/main.go`. When one module needs another's data, add a method to that module's `module.go` returning a plain struct — never import its `domain` or `infrastructure` — and prefer a batch method (`ByIDs`) over a per-row one, or decorating a list becomes an N+1 the boundary hides.

## Testing
- Co-located `_test.go` files (idiomatic Go), not a mirrored `tests/` tree.
- `domain` and `application` tests use the in-memory fakes in `application/fakes_test.go` — no database, no Docker. If a new use case can't be tested that way, the dependency direction is wrong.
- Router-level tests build the real `api.NewRouter` — a test that rebuilds its own router proves nothing about the wiring that ships.
- Cover the negative cases directly: expired token, foreign signing secret, `alg=none`, unlisted CORS origin, replayed refresh token, and an unclassified error not leaking its text.
- Nil-guard tests (e.g. `/readyz` with no DB connected) are worth keeping — they catch the class of bug that only shows up when a dependency is legitimately absent.
- `internal/arch` tests the checker as well as the repo. If you add a boundary rule, add both fixtures: the illegal import it catches and the legal shape it must not.
```

---

## architecture addendum

Prepend `paths: ["**/*.go"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Go] Modular Monolith
- A module owns its data. `internal/modules/<m>/module.go` is its entire public surface; everything under it is private, including to the composition root. `internal/arch` fails `go test ./...` on an import that reaches deeper — a review comment is not the mechanism, the test is.
- Dependencies point inward: `api → application → domain`, with `infrastructure` implementing ports `application` declares. `application` importing `infrastructure` is the violation to watch for; it's the one that quietly makes every use case require a database to test.
- `domain` and `application` import neither gin nor gorm. That constraint is what keeps the rules movable when the framework or the ORM changes.
- Cross-module reads go through a batch method on the other module's `module.go`, returning a plain struct. Never its entity, never its repository.

## [Go] Contract-First Boundary
- `openapi.yaml` is the only source of truth for the API surface. `internal/openapi/openapi.gen.go` is generated — a PR touching it without a corresponding contract change is a sign the contract was bypassed.
- `internal/api/server.go` assembles the modules into the generated `openapi.ServerInterface`; its `var _ openapi.ServerInterface = (*server)(nil)` is what makes a contract change fail the build instead of drifting silently.
- Every response goes through `httpx.OK` / `httpx.Fail`, so the API has exactly one error shape (`{"error": "..."}`) and exactly one place mapping a failure to a status — including the generated router's own param-binding failures, remapped by the `ErrorHandler` in `internal/api/router.go`. A new route must not open a second, unwired error path that leaks `err.Error()`.

## [Go] Generated Routing, Hand-Wired Security
- `oapi-codegen` does not enforce the contract's `security:` schemes. Authorization and rate limiting come from the prefix selectors in `internal/api/middleware/selector.go`, which match on `c.FullPath()` — i.e. `middleware.BaseURL` + the spec path.
- A new protected prefix with no case there is public, compiles fine, and returns 200. Treat adding a path prefix in `openapi.yaml` and adding its selector case as one change.

## [Go] Regeneration Discipline
- After editing `openapi.yaml`: run `make generate` before writing handler code against the new shapes.
- `internal/api/server.go` may fail to compile immediately after a contract change — that's expected, it means the generated interface gained an operation no module implements yet, not that something is broken.
- Schema changes are migrations (`make migrate-create name=x`), never GORM `AutoMigrate` — the SQL in `migrations/` is the reviewable record. A migration that adds a column also needs the field on the module's `*Record` struct and its `toDomain`/`...RecordOf` mapping; the round-trip test in `infrastructure` catches a forgotten one.
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
