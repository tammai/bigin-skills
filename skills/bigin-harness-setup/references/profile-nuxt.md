# Nuxt Profile Templates

Stack: Nuxt 4 SPA (`ssr: false`, Cloudflare Workers), Nuxt ESLint, Pinia + Pinia Colada, VueUse, Nuxt UI, Zod, Vitest — a tokenless `/api` pass-through to the API, no BFF (no Drizzle/D1/KV/R2; the backend owns data persistence and the web session)

Empty repo → scaffolded by the **`nuxt-scaffold`** skill (non-interactive `npm create nuxt@latest` + the `/api` pass-through preset; no GitHub clone). See `skills/nuxt-scaffold/`.

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

Every file created or edited is auto-formatted by the Nuxt ESLint module: the `PostToolUse` hook in `.claude/settings.json` runs `.claude/guards/lint-fix-file.mjs`, which ESLint-`--fix`es only the touched file. Scoped deliberately — a blanket `pnpm lint --fix` across the whole repo would rewrite every pre-existing lint violation on the first edit, which matters here since this profile also onboards existing nuxt repos (Phase 5-3) that can already carry lint debt. `pnpm lint --fix` above is still the manual, whole-repo command a human runs on demand.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Nuxt 4 SPA (`ssr: false`) · Cloudflare Workers
Auth: the API's HttpOnly session cookie, reached through the `/api` pass-through
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
- Nuxt ESLint auto-formats every file you create or edit (PostToolUse hook). Never disable it.
- No `--no-verify`. No `eslint-disable`, `@ts-ignore`, or `as any` without a justifying comment. Never weaken eslint config to pass a check.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- No token in the browser, ever: the API owns the session as an HttpOnly cookie — never store a token in `localStorage`, a cookie you set, or Pinia, and never add a server-side session store.
- The browser reaches the API only through the same-origin `/api/v<N>/**` pass-through (`server/routes/api/[...path].ts`), which holds no token and no logic beyond a path allowlist. `openapi.yaml` generates the client types. Rules: `.claude/rules/conventions-server.md`.

## Task workflow
Non-trivial features: /task-workflow.
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

## Server State: Pinia Colada
- Server data → Colada query/mutation composables only. Client state (auth, UI, filters, drafts) → Pinia stores. Never wrap `useQuery`/`useMutation` inside a Pinia store — Colada's cache already lives in Pinia; wrapping it duplicates state and breaks lifecycle tracking.
- One file per domain: `app/composables/queries/<domain>.ts`. Group the query options in a per-domain object (`userQueries.list`, `userQueries.detail`) — a plain `{ key, query }` object for a fixed query, `defineQueryOptions()` when the options depend on a parameter. Keys are defined once there, never hand-written inline in pages/components. Format: `['<domain>', '<scope>', ...params]`.
- If a domain file grows unwieldy, split into `app/composables/queries/<domain>/` with an `index.ts` re-export. Never split by type (`queries/` vs `mutations/`) across domains — the domain stays the unit of grouping.
- Mutations colocate with their domain as `use<Action><Domain>()` (e.g. `useUpdateUser`). Cache invalidation happens inside the mutation composable via `useQueryCache()` — never in components.
- Components/pages consume query composables only — no direct `api.*` calls, no inline keys. Export the composable via `defineQuery()` so every consumer shares one cache entry.
- Types come from the generated contract (`~~/shared/api-client/schema`) — the query layer is the only place raw API types are imported.

```ts
// bad — Colada wrapped inside a Pinia store
const useUserStore = defineStore('user', () => {
  const { data } = useQuery({ key: ['users'], query: fetchUsers })
  return { data }
})

// good — query composable; store reserved for client state
const { data } = useUsers()
```

```ts
// app/composables/queries/users.ts
import { defineQuery, useQuery } from '@pinia/colada'
import { apiClient } from '~~/shared/api-client'
import type { Ok } from '~~/shared/api-client'
import type { components } from '~~/shared/api-client/schema'

export type User = components['schemas']['User']

export const userQueries = {
  list: {
    key: ['users', 'list'],
    // Goes through the same-origin /api pass-through (apiClient's baseURL is
    // '/api'); the session cookie authenticates it — this query never sees a token.
    query: async (): Promise<User[]> => {
      const { data } = await apiClient<Ok<'/v1/users'>>('/v1/users')
      return data
    },
  },
}

export const useUsers = defineQuery(() => useQuery(userQueries.list))
```

## Components
- No business logic in components — move to a composable or store.
- Props typed with `defineProps<{}>()`. Events with `defineEmits<{}>()`.

## Auth (client)
- The session is an HttpOnly cookie the browser can't read. "Signed in" is whatever the API says: ask `GET /api/v1/user/profile` and treat a 401 as signed out (a `useAuth()` composable, as the `saas` template ships).
- Sign in with `POST /api/v1/auth/session`, out with `DELETE /api/v1/auth/session`; the API sets and clears the cookie. A request that changes state must come from an origin in the API's `WEB_ORIGINS`, or it answers 403.
- `apiClient` is `$fetch.create({ baseURL: '/api', credentials: 'include' })` — keep `credentials: 'include'`, and never add an `Authorization` header from the browser.

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
- API routes: kebab-case (`/api/<segment>/[id].ts`)

## API Pass-through
`server/routes/api/[...path].ts` is a **tokenless catch-all** (logic in `server/utils/pass-through.ts`). It forwards `/api/v<digits>/**` — and nothing else — to the server-only `NUXT_API_ORIGIN` (`runtimeConfig.apiOrigin`), streaming the body both ways and not following redirects, with `Set-Cookie`, `Cookie` and `x-request-id` passing through unchanged; any other `/api/*` path is a JSON 404. The path allowlist is the only access control it has. The session cookie is set by the API, which makes it first-party to the app; CSRF is the API's job (SameSite=Lax plus its `WEB_ORIGINS` check). Browser code calls `/api/v1/*` through `shared/api-client`.

Do **not** add a token, a refresh flow, a session store, a per-domain handler or a body transform to the pass-through — a new API endpoint needs no new route file, only a regenerated contract. Never put the API origin in a `NUXT_PUBLIC_*` variable (it would ship to the browser). Handlers of your own under `server/` are for work that is genuinely Nuxt-side (webhooks, form posts, server-only integrations), outside `/api/v<N>/`. Behind the pass-through the API sees the app's egress address as the client, so every browser user shares one rate-limit bucket; do not forward `X-Forwarded-For`/`CF-Connecting-IP` or set the API's `TRUSTED_PROXY` to work around it.

```ts
// A query composable reaches the API through the pass-through — not through a new route.
const { data } = await apiClient<Ok<'/v1/users'>>('/v1/users')
```

## OpenAPI Types
**How `openapi.yaml` arrives depends on the repo's mode — see the profile's `## Contract ownership` section.** The committed contract snapshot is `openapi.yaml`. Regenerate the typed client before consuming any new API surface:
```sh
pnpm openapi-types   # openapi-typescript openapi.yaml -o shared/api-client/schema.d.ts
```
Import from `~~/shared/api-client/schema`: `import type { components } from '~~/shared/api-client/schema'`
(On the `starter` template the kernel lives under `layers/shared/` — import `~~/layers/shared/api-client` there, and the `openapi-types` script already points at that path.)
Never define API response shapes inline — always use generated types.

## Auth (server)
- There is none in this app: no session module, no token store, no `requireUserSession`. The API authenticates the cookie on every `/api/v<N>/**` call.
- A Nuxt-side handler that needs the user calls the API with the request's `cookie` header; it never mints or stores a credential of its own.
```

---

## testing.md Template

Paths frontmatter scopes this file to tests/, e2e/ and the two runner configs — only loaded when test files are in context.

```markdown
---
paths:
  - "tests/**"
  - "vitest.config.ts"
  - "e2e/**"
  - "playwright.config.ts"
---
# Testing Conventions

## Location
Tests live under `tests/`, mirroring the source tree — never co-located with source.
- `app/utils/foo.ts` → `tests/app/utils/foo.test.ts`
- `server/utils/pass-through.ts` → `tests/server/pass-through.test.ts`

`vitest.config.ts`'s `test.include` is scoped to `tests/**/*.test.ts` — a stray `*.test.ts` next to source silently won't run.

## Imports
Cross-tree imports (test → source) use the `~~/` root alias, never relative paths — a test's directory depth mirrors source depth, so `../../../app/...` is fragile and breaks on any tree reshuffle.

```ts
// tests/app/utils/foo.test.ts
import { foo } from '~~/app/utils/foo'
```

## Nitro auto-imports
Server tests run outside Nitro's auto-import context — `defineEventHandler`, `useRuntimeConfig`, etc. aren't globally available. Stub them via a shared `tests/support/` helper, not per-test.

Mock only the true I/O boundary — `$fetch` / global `fetch` (the pass-through core takes a web `Request` and the origin and is tested by stubbing `fetch`). Wire real implementations of internal collaborators (your own composables, utils, server helpers) as globals instead of mocking them — mocking internals couples tests to implementation and hides real breakage.

## Workers
`vitest.config.ts` caps `maxWorkers` at 4. Vitest's default is one fork per core, and each fork boots a Nuxt environment: at 12 workers one repo pegged its machine at load 25–48 and ran slower, not faster. Raise the cap only with a measurement that says more workers finished sooner.

## E2E (when the repo has Playwright)
The suite is only as fast as its slowest shared resource, and behind an API that rate-limits, that is almost never the browser.

- **Arrange state without the UI, and without the rate limiter.** A fixture that signs up a user and creates a workspace through the app for every test spends the backend's rate-limit budget on setup. One repo's backend allowed 100 requests a minute from one address; with a fresh user per test, a second worker failed 24 of 43 specs on HTTP 429 pages, so the suite ran at one worker for ~25 minutes. Seed through a path the limiter does not count (a test-only seeding endpoint, direct database seeding, or a raised limit in the backend's E2E environment), and derive `workers` from that budget rather than hard-coding it.
- **Log in once per worker, not once per test.** Save the session with `storageState` in a worker-scoped fixture; specs that only read share it. A spec that mutates what others read gets its own user.
- **Run one spec while building** (`playwright test <spec>` or `--grep`). The full suite runs once, when the task or slice is done — a green single spec is the loop, not a re-run of everything.
- **A timeout in fixture setup, or a red that passes on rerun, is a harness finding, not a flake to retry.** Fix the fixture or the budget; re-running until green hides the one real failure the next time it happens.
```

---

## architecture addendum

Prepend `paths: ["server/**", "app/**"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Nuxt] Pass-through Boundary
- The browser reaches the backend REST API only through the same-origin `/api/v<N>/**` pass-through. It holds no token and no logic beyond the path allowlist; the API owns the web session (HttpOnly cookie) and CSRF.
- No SSR (`ssr: false`) and no server-side session or token store. `server/` is the pass-through plus genuinely Nuxt-side handlers outside `/api/v<N>/`.
- `openapi.yaml` types are generated into `shared/api-client/schema.d.ts` and consumed by the query composables only (`app/composables/queries/`); components receive shaped data from them, not raw API types.

## [Nuxt] Layers & Boundaries
- Use Nuxt Layers (`layers/`) for hard domain separation when the app grows beyond 3 domains.
- No business logic in components — composables or Pinia stores only.
- Composables in `composables/`. Shared utilities in `utils/`.
- Pages in `pages/` — routing only, delegate to composables for data/logic.
```

---

## settings.json Template

Governance superset: `permissions` + `PostToolUse` lint-fix (the `nuxt-scaffold` baseline) **plus** the `PreToolUse` `bash-guard.mjs`, `bugfix-test-guard.mjs`, `commit-msg-guard.mjs`, `spec-gate-guard.mjs`, and `injection-gate-guard.mjs` hooks, and a second `PostToolUse` entry for `injection-scan-guard.mjs` (governance). Used when onboarding an existing nuxt repo (Phase 5-3) — also write `.claude/guards/lint-fix-file.mjs` if it's missing (script body: `${CLAUDE_PLUGIN_ROOT}/skills/nuxt-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs`, single source of truth). Keep the `permissions` / lint-fix `PostToolUse` keys in sync with `skills/nuxt-scaffold/scripts/templates/merge/claude-settings.json`.

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
      "Bash(pnpm openapi-types:*)",
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

Editor format-on-save through the ESLint extension (matches the `nuxt-scaffold` skill's baseline). Merge into an existing `.vscode/settings.json` rather than overwriting. Keep in sync with `skills/nuxt-scaffold/scripts/templates/merge/vscode-settings.json`.

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

---

## Contract ownership

Nuxt never authors a contract — `openapi.yaml` is always a snapshot of the paired backend's. What differs is **how the snapshot arrives**, and Phase 0a decides. Write one mode, never both.

| `REPO_TYPE` | Mode | How the snapshot arrives |
|---|---|---|
| `none` — a standalone Nuxt app | **hand-copied** | a developer copies the backend's contract over it and runs `pnpm openapi-types`. This is what `nuxt-scaffold`'s next-steps describes; with go-scaffold's contract, set `apiClient`'s `baseURL` to `'/api/v1'` |
| `web` — the web repo of a polyrepo project | **vendored** | `contract_sync.mjs` writes it from the contracts repo at a pinned commit. Hand-copying is blocked in-session and caught by the CI drift job |

In **vendored** mode: `## OpenAPI Types` gains the line *"This file is vendored — see `.claude/rules/vendored-contract.md`. Do not copy a new one over it by hand,"* and `.claude/rules/vendored-contract.md` is written from `files-shared.md` → `## vendored-contract.md` with `{CODEGEN_OUT}` = `shared/api-client/schema.d.ts` (`layers/shared/api-client/schema.d.ts` on the `starter` template) and `{SPEC_PATH}` resolved per that section — a Nuxt repo vendoring to `api/openapi.yaml` is as common as one at the root.

`pnpm openapi-types` is the codegen command in both modes.
