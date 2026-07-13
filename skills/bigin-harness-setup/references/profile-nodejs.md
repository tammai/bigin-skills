# Node.js Profile Templates

Stack: Node.js TypeScript REST API backend

---

## Commands

```
lint:       pnpm lint
typecheck:  pnpm type-check
test:       pnpm test --run
dev:        pnpm dev
build:      pnpm build
```

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Node.js TypeScript REST API
Node: ≥22 · pnpm only

## Commands
| Purpose   | Command            |
|-----------|--------------------|
| dev       | `pnpm dev`         |
| test      | `pnpm test --run`  |
| lint      | `pnpm lint`        |
| typecheck | `pnpm type-check`  |
| build     | `pnpm build`       |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- No `--no-verify`. No `eslint-disable` without a justifying comment. No weakening eslint config to pass checks.
- No `@ts-ignore` or `as any` without a justifying comment.
- No unauthenticated endpoints.
- Validate all inputs at handler boundaries using Zod.
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

Paths frontmatter scopes this file to src/ — only loaded when source files are in context.

```markdown
---
paths:
  - "src/**"
---
# Conventions

## Naming
- Files: kebab-case (`user-controller.ts`, `user-service.ts`)
- Classes, types, interfaces: PascalCase
- Functions, variables: camelCase
- Routes: kebab-case (`/users/:id/profile`)
- Zod schemas: camelCase with `Schema` suffix (`createUserSchema`)

## Request Handler Pattern

```ts
async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const result = createUserSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() })
    return
  }
  try {
    const user = await userService.create(result.data)
    res.status(201).json(user)
  } catch (err) {
    next(err)
  }
}
```

Validation at the handler boundary only. Services receive clean, typed data.

## OpenAPI First
Write `openapi.yaml` before implementing any new route. Generate types:
```sh
pnpm openapi-typescript openapi.yaml -o src/types/api.d.ts
```
Import: `import type { paths } from './types/api'`
Never define API shapes inline — always use generated types.

## Error Handling
- Never throw from route handlers without a try/catch that passes to `next()`.
- Centralized error middleware at the app level maps domain errors to HTTP codes.
- No `console.log` in production paths — use the configured logger.

## Project Layout
```
src/
  routes/         ← route registration + handler functions
  services/       ← business logic
  repositories/   ← data access
  middleware/     ← auth, error handling, validation helpers
  types/          ← generated API types + domain types
  lib/            ← shared utilities
```
```

---

## architecture addendum

Prepend `paths: ["src/**"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Node.js] Package Structure
- All domain logic in `src/`. Handler files: routing + input validation only.
- Business logic in `services/`. Data access in `repositories/`. Never reverse layers.
- Shared cross-cutting concerns (auth middleware, error handler) in `src/middleware/`.
- `src/lib/` for utilities with no domain knowledge.
```

---

## settings.json Template

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm dev:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm type-check:*)",
      "Bash(pnpm typecheck:*)",
      "Bash(pnpm add:*)",
      "Bash(pnpm remove:*)",
      "Bash(pnpm install:*)",
      "Bash(pnpm openapi-typescript:*)",
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
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/verify-gate.mjs"
          }
        ]
      }
    ]
  }
}
```
