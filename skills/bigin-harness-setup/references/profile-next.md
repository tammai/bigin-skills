# Next Profile Templates

Stack: Next.js App Router (`next` pinned to 16.3.8, OpenNext on Cloudflare Workers), TypeScript, Tailwind CSS v4, shadcn/ui, Zustand, TanStack Query, Zod, Vitest + Testing Library — a tokenless `/api` pass-through to the API, no BFF (no ORM/DB driver; the backend owns data persistence and the web session)

Empty repo → scaffolded by the **`next-scaffold`** skill (non-interactive `create-next-app@16.3.8` + the `/api` pass-through preset + OpenNext/Cloudflare + shadcn/ui; no GitHub clone). See `skills/next-scaffold/`.

---

## Commands

```
lint:       pnpm lint
format:     pnpm lint --fix
typecheck:  pnpm type-check
test:       pnpm test --run
build:      pnpm build
dev:        pnpm dev
preview:    pnpm preview
```

Every file created or edited is auto-formatted by ESLint: the `PostToolUse` hook in `.claude/settings.json` runs `.claude/guards/lint-fix-file.mjs`, which ESLint-`--fix`es only the touched file. Scoped deliberately — a blanket `pnpm lint --fix` across the whole repo would rewrite every pre-existing lint violation on the first edit, which matters here since this profile also onboards existing Next.js repos (Phase 5-3) that can already carry lint debt. `pnpm lint --fix` above is still the manual, whole-repo command a human runs on demand.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Next.js App Router · OpenNext on Cloudflare Workers
Auth: the API's HttpOnly session cookie, reached through the `/api` pass-through
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
| preview   | `pnpm preview`     |

## Rules
See `.claude/rules/` — path-scoped conventions, security, architecture.

## Hard Rules (non-negotiable)
- ESLint auto-formats every file you create or edit (PostToolUse hook). Never disable it.
- No `--no-verify`. No `eslint-disable`, `@ts-ignore`, or `as any` without a justifying comment. Never weaken eslint config to pass a check.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- No token in the browser, ever: the API owns the session as an HttpOnly cookie — never store a token in `localStorage`, a cookie you set, or a Zustand store, and never add a server-side session store.
- The browser reaches the API only through the same-origin `/api/v<N>/**` pass-through (the `rewrites()` in `next.config.ts`), which holds no token and no logic beyond a path allowlist. `openapi.json` generates the client types. Rules: `.claude/rules/conventions-server.md`.

## Task workflow
Non-trivial features: /task-workflow.
```

---

## conventions-frontend.md Template

Paths frontmatter scopes this file to the App Router tree — only loaded when frontend files are in context.

```markdown
---
paths:
  - "src/app/**"
  - "src/features/**"
  - "src/shared/**"
  - "src/components/**"
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
- One file per domain, inside its feature: `src/features/<feature>/hooks/use-<domain>.ts`. Define query keys/options grouped in a per-domain object (`userQueries.profile`, `userQueries.detail`) — never hand-written inline in components. Key format: `['<domain>', '<scope>', ...params]`.
- If a domain file grows unwieldy, split into `src/features/<feature>/hooks/<domain>/` with an `index.ts` re-export. Never split by type (`queries/` vs `mutations/`) across domains — the domain stays the unit of grouping.
- `eslint-plugin-boundaries` enforces the feature/shared/lib/app edges (`eslint.boundaries.mjs`); a cross-feature import fails `pnpm lint`. Reach for `src/shared/` when two features need the same thing.
- Mutations colocate with their domain as `use<Action><Domain>()` (e.g. `useUpdateUser`). Cache invalidation happens inside the mutation hook via `queryClient.invalidateQueries()` — never in components.
- Components consume query hooks only — no direct `fetch`/`api.*` calls, no inline keys.
- Types come from the generated contract (`@/shared/api-client/schema`) — the query layer is the only place raw API types are imported. A non-2xx answer becomes an `ApiError(status)` (`@/shared/api-client/errors`); branch on its status, never on a response body.

```ts
// bad — TanStack Query wrapped inside a Zustand store
const useUserStore = create((set) => ({
  users: [],
  fetchUsers: async () => set({ users: await fetch('/api/users').then(r => r.json()) }),
}))

// good — query hook; store reserved for client state
const { data } = useProfile()
```

```ts
// src/features/users/hooks/use-profile.ts
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/shared/api-client'
import { ApiError } from '@/shared/api-client/errors'
import type { components } from '@/shared/api-client/schema'

export type User = components['schemas']['User']

export const userQueries = {
  profile: {
    queryKey: ['users', 'profile'] as const,
    // Goes through the same-origin /api pass-through (apiClient's baseUrl is
    // '/api/v1'); the session cookie authenticates it — this hook never sees a token.
    queryFn: async (): Promise<User> => {
      const { data, response } = await apiClient.GET('/user/profile')
      if (!data) throw new ApiError(response.status)
      return data
    },
  },
}

export function useProfile() {
  return useQuery(userQueries.profile)
}
```

## Components
- No business logic in components — move to a hook or store.
- Props typed via the function's parameter type, not `React.FC`.

## Auth (client)
- The session is an HttpOnly cookie the browser can't read. "Signed in" is whatever the API says: ask `GET /api/v1/user/profile` through `useProfile()` and treat a 401 as signed out (the `saas` template's `AuthGate` redirects to `/login` on one, and shows a retry on a 5xx instead of signing the visitor out).
- Sign in with `POST /api/v1/auth/session`, out with `DELETE /api/v1/auth/session`; the API sets and clears the cookie. A request that changes state must come from an origin in the API's `WEB_ORIGINS`, or it answers 403.
- `apiClient` is `createClient<paths>({ baseUrl: '/api/v1', credentials: 'include' })` — keep `credentials: 'include'`, and never add an `Authorization` header from the browser.
- Route protection is client-side UX only (no server-side session, no middleware): the API enforces the session on every call.

## Formatting
ESLint only. Prettier disabled. Auto-fixed on save via PostToolUse hook.
```

---

## conventions-server.md Template

Paths frontmatter scopes this file to the pass-through config and the Cloudflare files — only loaded when they are in context.

```markdown
---
paths:
  - "next.config.ts"
  - "open-next.config.ts"
  - "wrangler.jsonc"
  - "src/lib/**"
---
# Server Conventions

## Naming
- Route handlers of your own: Next Route Handlers, kebab-case segments (`src/app/<segment>/route.ts`), outside `/api/v<N>/`

## API Pass-through
The `rewrites()` in `next.config.ts` is the **whole pass-through** and the browser's only way to the backend REST API: `/api/v:ver(\\d+)/:path*` → `${API_ORIGIN}/api/v:ver/:path*`. `Cookie` and `Set-Cookie` cross it unchanged — the API sets the session cookie, which makes it first-party to the app — and any other `/api/*` path matches nothing and is Next's 404. The pattern is the only access control it has: keep the digits-only `\d+`, which is what keeps `/api/v1x`, `/api/v/…` and encoded traversal out. CSRF is the API's job (SameSite=Lax plus its `WEB_ORIGINS` check).

Do **not** add a token, a refresh flow, a session store, a per-domain route handler or a body transform — a new API endpoint needs no new route file, only a regenerated contract. `API_ORIGIN` is server-only (never `NEXT_PUBLIC_`: it would ship to the browser) and **build-time** — Next bakes a rewrite's destination into the build, so it must be set where `pnpm build`, `pnpm preview` and `pnpm run deploy` run; unset, `next.config.ts` fails with a message naming it. Route handlers of your own are for work that is genuinely Next-side (webhooks, server-only integrations) and must not sit at `/api/v<N>/…`, where the filesystem would shadow the rewrite. Behind the pass-through the API sees the app's egress address as the client, so every browser user shares one rate-limit bucket; do not forward `X-Forwarded-For`/`CF-Connecting-IP` or set the API's `TRUSTED_PROXY` to work around it.

```ts
// A feature hook reaches the API through the pass-through — not through a new route.
const { data, response } = await apiClient.GET('/user/profile')
```

## OpenAPI Types
The committed contract snapshot is `openapi.json`. Regenerate the typed client before consuming any new API surface:
```sh
pnpm openapi:generate   # openapi-typescript openapi.json -o src/shared/api-client/schema.d.ts
```
Import from `@/shared/api-client/schema`: `import type { paths } from '@/shared/api-client/schema'`
Never define API response shapes inline — always use generated types.

## Auth (server)
- There is none in this app: no session module, no token store, no middleware. The API authenticates the cookie on every `/api/v<N>/**` call.
- A Next-side handler that needs the user calls the API with the request's `cookie` header; it never mints or stores a credential of its own.

## Runtime
- `next` is pinned exactly (16.3.8) because `@opennextjs/cloudflare@1.20.9` is only verified against it: a newer `next` builds but can 500 every request that is not a rewrite. Bump both together, after a `pnpm preview` check.
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
  - "e2e/**"
  - "playwright.config.ts"
---
# Testing Conventions

## Location
Tests live co-located with source under `src/`, not in a separate mirrored tree:
- `src/features/users/hooks/use-profile.ts` → `src/features/users/hooks/use-profile.test.tsx`
- `next.config.ts` → `src/next-config.test.ts`

`vitest.config.ts`'s `test.include` is scoped to `src/**/*.test.{ts,tsx}`.

## Imports
Import the module under test via the `@/*` alias or a relative path consistently within a file — prefer `@/*` for anything outside the immediate directory, since a co-located test's relative path is already short (`./use-profile`).

```ts
// src/features/users/hooks/use-profile.test.tsx
import { useProfile } from './use-profile'
```

## Rendering hooks/components
`@testing-library/react`'s `renderHook`/`render` run in a real `jsdom` environment — no auto-import shims needed the way Nuxt's Nitro context needs stubbing. Wrap any hook that depends on React context (TanStack Query, future providers) in the matching `Provider` inside the test itself; don't reach for a global test harness for one provider.

Mock only the true I/O boundary (`fetch`, or `@/shared/api-client` where a test pins the calls a page makes). Wire real implementations of internal collaborators (your own hooks, utils) instead of mocking them — mocking internals couples tests to implementation and hides real breakage.
```

---

## architecture addendum

Prepend `paths: ["src/app/**", "src/features/**", "src/shared/**", "src/components/**"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Next] Pass-through Boundary
- The browser reaches the backend REST API only through the same-origin `/api/v<N>/**` pass-through (the `rewrites()` in `next.config.ts`). It holds no token and no logic beyond the path allowlist; the API owns the web session (HttpOnly cookie) and CSRF.
- Data fetching and auth are client-side (TanStack Query hooks, `credentials: 'include'`); there is no server-side session or token store and no server-side route protection.
- `openapi.json` is the committed contract; types are generated into `src/shared/api-client/schema.d.ts` and consumed through `src/shared/api-client`. No hand-written API response shapes anywhere.

## [Next] App Router Boundaries
- No business logic in components — hooks or Zustand stores only.
- Pages that read API data or auth state are client components (`'use client'`); keep server components for static composition.
- Feature code in `src/features/<feature>/`; cross-feature code in `src/shared/`; low-level helpers in `src/lib/`. The edges are lint-enforced by `eslint.boundaries.mjs`.
- Route segments in `src/app/` — routing + composition only, delegate to hooks for data/logic.
```

---

## settings.json Template

Governance superset: `permissions` + `PostToolUse` lint-fix (the `next-scaffold` baseline) **plus** the `PreToolUse` `bash-guard.mjs`, `bugfix-test-guard.mjs`, `commit-msg-guard.mjs`, `spec-gate-guard.mjs`, and `injection-gate-guard.mjs` hooks, and a second `PostToolUse` entry for `injection-scan-guard.mjs` (governance). Used when onboarding an existing Next.js repo (Phase 5-3) — also write `.claude/guards/lint-fix-file.mjs` if it's missing (script body: `${CLAUDE_PLUGIN_ROOT}/skills/next-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs`, single source of truth). Keep the `permissions` / lint-fix `PostToolUse` keys in sync with `skills/next-scaffold/scripts/templates/merge/claude-settings.json`.

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
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/bash-guard.mjs\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/bugfix-test-guard.mjs\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/commit-msg-guard.mjs\""
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/spec-gate-guard.mjs\""
          }
        ]
      },
      {
        "matcher": "Bash|Write|Edit|MultiEdit|WebFetch|mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/injection-gate-guard.mjs\""
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
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/lint-fix-file.mjs\""
          }
        ]
      },
      {
        "matcher": "WebFetch|mcp__.*|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/injection-scan-guard.mjs\""
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/canary-seed.mjs\""
          },
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/session-resume-check.mjs\""
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/precompact-snapshot.mjs\""
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/precompact-snapshot.mjs\""
          }
        ]
      }
    ],
    "Setup": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PROJECT_DIR}/.claude/guards/install-hooks.mjs\""
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
