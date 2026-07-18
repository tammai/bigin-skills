# Next Profile Templates

Stack: Next.js App Router (Vercel), TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query, iron-session, Zod, Vitest + Testing Library — BFF proxy layer (no ORM/DB driver; the backend owns data persistence)

Empty repo → scaffolded by the **`next-scaffold`** skill (non-interactive `create-next-app` + BFF preset + shadcn/ui; no GitHub clone). See `skills/next-scaffold/`.

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

Every file created or edited is auto-formatted by ESLint: the `PostToolUse` hook in `.claude/settings.json` runs `.claude/guards/lint-fix-file.mjs`, which ESLint-`--fix`es only the touched file. Scoped deliberately — a blanket `pnpm lint --fix` across the whole repo would rewrite every pre-existing lint violation on the first edit, which matters here since this profile also onboards existing Next.js repos (Phase 5-3) that can already carry lint debt. `pnpm lint --fix` above is still the manual, whole-repo command a human runs on demand.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Next.js App Router · Vercel
Auth: iron-session (sealed session cookie)
Runtime: Node ≥20 · pnpm only

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
- Files are auto-formatted with ESLint on every create/edit (PostToolUse hook). Never disable the hook.
- No `--no-verify`. No `eslint-disable` without a justifying comment. No weakening eslint config to pass checks.
- No `@ts-ignore` or `as any` without a justifying comment.
- No unauthenticated endpoints.
- Auth/session via `iron-session` only — never roll your own session or token store.
- `openapi.yaml` is the API contract. Types generated from it (server-side) — never hardcoded.
- All backend calls via the Next.js BFF layer (`src/app/api/**/route.ts`). Backend access token lives in the `iron-session` sealed session — never in the browser.
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

Paths frontmatter scopes this file to the App Router tree — only loaded when frontend files are in context.

```markdown
---
paths:
  - "src/app/**"
  - "src/components/**"
  - "src/hooks/**"
  - "src/stores/**"
---
# Frontend Conventions

## Naming
- Components: PascalCase (`UserCard.tsx`)
- Hooks: camelCase with `use` prefix (`useUserList.ts`)
- Zustand stores: camelCase with `Store` suffix (`useUserStore.ts`)
- Types/interfaces: PascalCase

## State
- Global client state: Zustand stores (`src/stores/`)
- Async server state: TanStack Query hooks (`useQuery`, `useMutation`)
- Local UI state: `useState`/`useReducer` in the component

## Server State: TanStack Query
- Server data → TanStack Query hooks only. Client state (auth, UI, filters, drafts) → Zustand stores. Never wrap `useQuery`/`useMutation` inside a Zustand store — Query's cache already manages its own lifecycle; wrapping it duplicates state and breaks invalidation.
- One file per domain: `src/hooks/queries/use-<domain>.ts`. Define query keys/options grouped in a per-domain object (`userQueries.list`, `userQueries.detail`) — never hand-written inline in components. Key format: `['<domain>', '<scope>', ...params]`.
- If a domain file grows unwieldy, split into `src/hooks/queries/<domain>/` with an `index.ts` re-export. Never split by type (`queries/` vs `mutations/`) across domains — the domain stays the unit of grouping.
- Mutations colocate with their domain as `use<Action><Domain>()` (e.g. `useUpdateUser`). Cache invalidation happens inside the mutation hook via `queryClient.invalidateQueries()` — never in components.
- Components consume query hooks only — no direct `fetch`/`api.*` calls, no inline keys.
- Types come from openapi-typescript generated types — the query layer is the only place raw API types are imported.

```ts
// bad — TanStack Query wrapped inside a Zustand store
const useUserStore = create((set) => ({
  users: [],
  fetchUsers: async () => set({ users: await fetch('/api/users').then(r => r.json()) }),
}))

// good — query hook; store reserved for client state
const { data } = useUsers()
```

```ts
// src/hooks/queries/use-users.ts
export const userQueries = {
  list: {
    queryKey: ['users', 'list'] as const,
    queryFn: () => fetch('/api/users').then(r => r.json() as Promise<User[]>),
  },
  detail: (id: string) => ({
    queryKey: ['users', 'detail', id] as const,
    queryFn: () => fetch(`/api/users/${id}`).then(r => r.json() as Promise<User>),
  }),
}

export function useUsers() {
  return useQuery(userQueries.list)
}
```

## Components
- No business logic in components — move to a hook or store.
- Props typed via the function's parameter type, not `React.FC`.

## Auth (client)
- Read session: call `/api/me` through a query hook — the session itself is server-only (`iron-session`'s sealed cookie is never parsed client-side).
- Session secret via `SESSION_PASSWORD` (env only — never committed).

## Formatting
ESLint only. Prettier disabled. Auto-fixed on save via PostToolUse hook.
```

---

## conventions-server.md Template

Paths frontmatter scopes this file to the API route tree — only loaded when server files are in context.

```markdown
---
paths:
  - "src/app/api/**"
  - "src/lib/**"
  - "src/proxy.ts"
---
# Server Conventions

## Naming
- API routes: Next Route Handlers, kebab-case segments (`src/app/api/users/[id]/route.ts`)

## BFF Proxy
`src/app/api/**/route.ts` is the sole caller of the backend REST API. Client-side code calls same-origin `/api/*` — no auth headers, no backend URL in the browser.

```ts
// src/app/api/users/route.ts
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const res = await fetch(`${process.env.BACKEND_URL}/users`, {
    headers: { Authorization: `Bearer ${session.user.token}` },
  })
  return Response.json(await res.json())
}
```

## OpenAPI Types
Generate before consuming any new API surface:
```sh
pnpm openapi-typescript openapi.yaml -o src/types/api.d.ts
```
Import only in route handlers: `import type { paths } from '@/types/api'`
Never define API response shapes inline — always use generated types.

## Auth (server)
- Protect routes: `const session = await getSession(); if (!session.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })`
- Set session: `session.user = { ... }; await session.save()`
- Backend access token stored in the sealed session — never reaches the browser.
```

---

## testing.md Template

Paths frontmatter scopes this file to test files + vitest.config.ts — only loaded when test files are in context.

```markdown
---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "vitest.config.ts"
---
# Testing Conventions

## Location
Tests live co-located with source under `src/`, not in a separate mirrored tree:
- `src/hooks/queries/use-users.ts` → `src/hooks/queries/use-users.test.tsx`
- `src/app/api/users/route.ts` → `src/app/api/users/route.test.ts`

`vitest.config.ts`'s `test.include` is scoped to `src/**/*.test.{ts,tsx}`.

## Imports
Import the module under test via the `@/*` alias or a relative path consistently within a file — prefer `@/*` for anything outside the immediate directory, since a co-located test's relative path is already short (`./use-users`).

```ts
// src/hooks/queries/use-users.test.tsx
import { useUsers } from './use-users'
```

## Rendering hooks/components
`@testing-library/react`'s `renderHook`/`render` run in a real `jsdom` environment — no auto-import shims needed the way Nuxt's Nitro context needs stubbing. Wrap any hook that depends on React context (TanStack Query, future providers) in the matching `Provider` inside the test itself; don't reach for a global test harness for one provider.

Mock only the true I/O boundary — `fetch`, session read/write. Wire real implementations of internal collaborators (your own hooks, utils) instead of mocking them — mocking internals couples tests to implementation and hides real breakage.
```

---

## architecture addendum

Prepend `paths: ["src/app/**", "src/components/**", "src/hooks/**"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Next] BFF Boundary
- `src/app/api/**/route.ts` is the **sole caller** of the external backend REST API. Client-side code never calls the backend directly.
- Backend access token lives in the `iron-session` sealed session (server-side only). It never reaches the browser.
- `openapi.yaml` types are generated and consumed **server-side** (`src/types/api.d.ts`). Client components receive data already shaped by route handlers — no raw API types on the client.

## [Next] App Router Boundaries
- No business logic in components — hooks or Zustand stores only.
- Server Components by default; add `'use client'` only where interactivity/hooks require it.
- Shared hooks in `src/hooks/`. Shared utilities in `src/lib/`.
- Route segments in `src/app/` — routing + composition only, delegate to hooks for data/logic.
```

---

## settings.json Template

Governance superset: `permissions` + `PostToolUse` lint-fix (the `next-scaffold` baseline) **plus** the `PreToolUse` `bash-guard.mjs`, `bugfix-test-guard.mjs`, `spec-gate-guard.mjs`, and `injection-gate-guard.mjs` hooks, and a second `PostToolUse` entry for `injection-scan-guard.mjs` (governance). Used when onboarding an existing Next.js repo (Phase 5-3) — also write `.claude/guards/lint-fix-file.mjs` if it's missing (script body: `skills/next-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs`, single source of truth). Keep the `permissions` / lint-fix `PostToolUse` keys in sync with `skills/next-scaffold/scripts/templates/merge/claude-settings.json`.

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
      "Bash(npx shadcn:*)",
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
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bugfix-test-guard.mjs"
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
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/lint-fix-file.mjs"
          }
        ]
      },
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
    ]
  }
}
```

---

## .vscode/settings.json Template

Editor format-on-save through the ESLint extension (matches the `next-scaffold` skill's baseline). Merge into an existing `.vscode/settings.json` rather than overwriting. Keep in sync with `skills/next-scaffold/scripts/templates/merge/vscode-settings.json`.

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
