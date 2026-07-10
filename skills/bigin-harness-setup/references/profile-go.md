# Go Profile Templates

Stack: Go REST API backend (Gin router)

---

## Commands

```
lint:       staticcheck ./...
typecheck:  go build ./...
test:       go test ./...
dev:        go run ./cmd/...
build:      go build -o bin/server ./cmd/...
```

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Go REST API · Gin
Go: ≥1.22

## Commands
| Purpose   | Command                          |
|-----------|----------------------------------|
| dev       | `go run ./cmd/...`               |
| test      | `go test ./...`                  |
| vet       | `go vet ./...`                   |
| lint      | `staticcheck ./...`              |
| build     | `go build -o bin/server ./cmd/...` |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- No `//nolint` suppressions without a comment explaining the exception.
- No unauthenticated endpoints.
- Validate all inputs at handler boundaries — never in service or repo layer.
- `openapi.yaml` is written first; handlers implement it.
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
  - "pkg/**"
---
# Conventions

## Naming
- Packages: lowercase, single word (`handler`, `service`, `repository`)
- Exported types: PascalCase. Unexported: camelCase.
- HTTP handlers: `Handle{Resource}{Action}` (e.g. `HandleUserCreate`)
- Errors: package-level vars — `var ErrNotFound = errors.New("not found")`
- Files: snake_case (`user_handler.go`)

## HTTP Handler Pattern (Gin)

```go
func HandleUserCreate(svc *service.UserService) gin.HandlerFunc {
    return func(c *gin.Context) {
        var req CreateUserRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
            return
        }
        user, err := svc.Create(c.Request.Context(), req)
        if err != nil {
            respondError(c, err)
            return
        }
        c.JSON(http.StatusCreated, user)
    }
}
```

Validation at the handler boundary only. Services receive clean, validated data.

## OpenAPI First
Write `openapi.yaml` before implementing any new route.

## Error Handling
- Return errors up the call stack — never panic in handlers.
- Use a shared `respondError(c, err)` helper mapping domain errors to HTTP codes.
- Log errors at the handler boundary, not in services.

## Project Layout
```
cmd/server/main.go    ← entry point
internal/
  handler/            ← Gin handlers + route registration
  service/            ← business logic
  repository/         ← data access
  model/              ← domain models / DTOs
pkg/                  ← reusable public packages
```
```

---

## architecture addendum

Prepend `paths: ["**/*.go"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Go] Package Structure
- All domain logic lives in `internal/`. Nothing in `pkg/` depends on `internal/`.
- Handler files: routing + input binding/validation only. No business logic.
- Business logic in `service/`. Data access in `repository/`. Never reverse these layers.
- Shared cross-cutting concerns (auth middleware, response helpers) in `internal/middleware/` or `pkg/`.
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
      "Bash(staticcheck:*)",
      "Bash(golangci-lint:*)",
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
    ]
  }
}
```
