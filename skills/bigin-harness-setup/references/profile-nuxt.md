# Nuxt Profile Templates

Stack: Nuxt 4 fullstack (Cloudflare Pages), Nuxt ESLint, Pinia + Pinia Colada, VueUse, Nuxt UI, nuxt-auth-utils, Zod, Vitest — BFF proxy layer (no Drizzle/D1/KV/R2; the backend owns data persistence)

Empty repo → scaffolded by the **`nuxt-scaffold`** skill (non-interactive `npm create nuxt@latest` + BFF preset; no GitHub clone). See `skills/nuxt-scaffold/`.

---

## Commands

```
lint:       pnpm lint
format:     pnpm lint --fix
typecheck:  pnpm type-check
test:       pnpm test --run
build:      pnpm build
dev:        pnpm dev
```

Every file created or edited is auto-formatted by the Nuxt ESLint module: the `PostToolUse` hook in `.claude/settings.json` runs `.claude/guards/lint-fix-file.py`, which ESLint-`--fix`es only the touched file. Scoped deliberately — a blanket `pnpm lint --fix` across the whole repo would rewrite every pre-existing lint violation on the first edit, which matters here since this profile also onboards existing nuxt repos (Phase 5-3) that can already carry lint debt. `pnpm lint --fix` above is still the manual, whole-repo command a human runs on demand.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Nuxt 4 fullstack · Cloudflare Pages
Auth: nuxt-auth-utils (sealed session cookie)
Runtime: Node ≥22 · pnpm only

## Commands
| Purpose   | Command            |
|-----------|--------------------|
| dev       | `pnpm dev`         |
| test      | `pnpm test --run`  |
| lint      | `pnpm lint`        |
| format    | `pnpm lint --fix`  |
| typecheck | `pnpm type-check`  |
| build     | `pnpm build`       |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- Files are auto-formatted with Nuxt ESLint on every create/edit (PostToolUse hook). Never disable the hook.
- No `--no-verify`. No `eslint-disable` without a justifying comment. No weakening eslint config to pass checks.
- No `@ts-ignore` or `as any` without a justifying comment.
- No unauthenticated endpoints.
- Auth/session via `nuxt-auth-utils` only — never roll your own session or token store.
- `openapi.yaml` is the API contract. Types generated from it (server-side) — never hardcoded.
- All backend calls via the Nuxt BFF layer (`server/api/`). Backend access token lives in the `nuxt-auth-utils` sealed session — never in the browser.
- Client-side code calls same-origin `/api/*` only. Never attach auth headers or call the backend URL from the browser.

## Task workflow
Non-trivial features: /task-workflow (or read AI_TASK_GUIDE.md).

## Compact instructions
Preserve: code changes, key decisions, blockers.
Drop from context: tool output, file reads, search results.
Run /clear between unrelated tasks. Pipe long output: `cmd | head -50`.
```

---

## conventions-frontend.md Template

Paths frontmatter scopes this file to app/ — only loaded when frontend files are in context.

```markdown
---
paths:
  - "app/**"
  - "pages/**"
  - "components/**"
  - "composables/**"
  - "stores/**"
  - "layouts/**"
---
# Frontend Conventions

## Naming
- Components: PascalCase (`UserCard.vue`)
- Composables: camelCase with `use` prefix (`useUserList.ts`)
- Pinia stores: camelCase with `Store` suffix (`useUserStore.ts`)
- Types/interfaces: PascalCase

## State
- Global state: Pinia stores (`stores/`)
- Async data: Pinia Colada queries (`useQuery`, `useMutation`)
- Local UI state: composables or `ref` in the component

## Components
- No business logic in components — move to a composable or store.
- Props typed with `defineProps<{}>()`. Events with `defineEmits<{}>()`.

## Auth (client)
- Read session: `const { loggedIn, user } = useUserSession()`
- Session secret via `NUXT_SESSION_PASSWORD` (env only — never committed).

## Formatting
ESLint via `@nuxt/eslint` only. Prettier disabled. Auto-fixed on save via PostToolUse hook.
```

---

## conventions-server.md Template

Paths frontmatter scopes this file to server/ — only loaded when server files are in context.

```markdown
---
paths:
  - "server/**"
  - "shared/**"
---
# Server Conventions

## Naming
- API routes: kebab-case (`/api/users/[id].ts`)

## BFF Proxy
`server/api/` is the sole caller of the backend REST API. Client-side code calls same-origin `/api/*` — no auth headers, no backend URL in the browser.

```ts
// server/api/users/index.get.ts
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const config = useRuntimeConfig()
  return $fetch(`${config.backendUrl}/users`, {
    headers: { Authorization: `Bearer ${user.token}` },
  })
})
```

## OpenAPI Types
Generate before consuming any new API surface:
```sh
pnpm openapi-typescript openapi.yaml -o server/types/api.d.ts
```
Import only in server routes: `import type { paths } from '~/server/types/api'`
Never define API response shapes inline — always use generated types.

## Auth (server)
- Protect routes: `const { user } = await requireUserSession(event)`
- Set session: `await setUserSession(event, { user })`
- Backend access token stored in sealed session — never reaches the browser.
```

---

## architecture addendum

Prepend `paths: ["server/**", "app/**"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Nuxt] BFF Boundary
- `server/api/` is the **sole caller** of the external backend REST API. Client-side code never calls the backend directly.
- Backend access token lives in the `nuxt-auth-utils` sealed session (server-side only). It never reaches the browser.
- `openapi.yaml` types are generated and consumed **server-side** (`server/types/api.d.ts`). Client components receive data already shaped by server routes — no raw API types on the client.

## [Nuxt] Layers & Boundaries
- Use Nuxt Layers (`layers/`) for hard domain separation when the app grows beyond 3 domains.
- No business logic in components — composables or Pinia stores only.
- Composables in `composables/`. Shared utilities in `utils/`.
- Pages in `pages/` — routing only, delegate to composables for data/logic.
```

---

## settings.json Template

Governance superset: `permissions` + `PostToolUse` lint-fix (the `nuxt-scaffold` baseline) **plus** the `PreToolUse` `bash-guard.py` hook (governance). Used when onboarding an existing nuxt repo (Phase 5-3) — also write `.claude/guards/lint-fix-file.py` if it's missing (script body: `skills/nuxt-scaffold/references/artifacts.md` → `## .claude/guards/lint-fix-file.py (write)`, single source of truth). Keep the `permissions` / `PostToolUse` keys in sync with `skills/nuxt-scaffold/references/artifacts.md`.

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
      "Bash(npx nuxi:*)",
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
  "statusline": {
    "items": ["tokenUsage"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/guards/bash-guard.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 .claude/guards/lint-fix-file.py"
          }
        ]
      }
    ]
  }
}
```

Note: the `"statusline"` key enables the token-usage display in the Claude Code status bar. If the exact key name differs in your Claude Code version, check the `update-config` skill or Claude Code docs.

---

## .vscode/settings.json Template

Editor format-on-save through the ESLint extension (matches the `nuxt-scaffold` skill's baseline). Merge into an existing `.vscode/settings.json` rather than overwriting. Keep in sync with `skills/nuxt-scaffold/references/artifacts.md`.

```json
{
  "prettier.enable": false,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "dbaeumer.vscode-eslint",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```
