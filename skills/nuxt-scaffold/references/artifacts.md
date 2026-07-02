# Artifacts — files written into the scaffolded project

The `--template ui` init already provides a working Nuxt UI app: `nuxt.config.ts` (with `@nuxt/eslint` + `@nuxt/ui` modules and the stylistic eslint config), `app/app.vue` (landing page), `app/pages/index.vue`, `app/app.config.ts` (theme), `eslint.config.mjs`, `app/assets/css/main.css`, and `tsconfig.json`. **Do not overwrite those** — only *merge* the specific keys listed below and add new files.

The new code follows the **BFF proxy** convention: the Nuxt server (`server/api/`) is the sole caller of the backend; the browser calls same-origin `/api/*` only, never attaching auth headers or knowing the backend URL.

Substitute `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`, `{D1_DATABASE_ID}`, `{COMPAT_DATE}`. Merge — never overwrite — `nuxt.config.ts`, `app/app.config.ts`, `package.json`, `.claude/settings.json`, `.vscode/settings.json`.

---

## nuxt.config.ts (merge — add two keys)

The template's `nuxt.config.ts` already has `modules`, `devtools`, `css`, `routeRules`, `compatibilityDate`, and the `eslint` stylistic config. Add **only** the server-only backend URL and `compatibilityVersion: 4` (Nuxt 4 explicit opt-in):

```ts
  compatibilityVersion: 4,
  runtimeConfig: { backendUrl: '' }   // server-only; set via NUXT_BACKEND_URL env
```

> For SSR-safe Pinia Colada queries (server-rendered `useQuery` results hydrated to the client), add `'@pinia/colada/nuxt'` to the `modules` array. The sample `session.ts` store is client-fetched (auth-dependent), so the module is optional for the default BFF pattern.

---

## app/app.config.ts (merge — set theme colors)

The template ships `primary: 'green', neutral: 'slate'`. Set them to the user's choices (`{PRIMARY}` / `{NEUTRAL}`):

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: '{PRIMARY}',
      neutral: '{NEUTRAL}'
    }
  }
})
```

---

## server/api/me.get.ts (write)

Sample BFF proxy route. The backend access token lives in the session's `secure` data — a field `nuxt-auth-utils` never serializes into the `/api/_auth/session` response, so (unlike a plain field on `user`) it is actually enforced server-only, not just documented as such.

```ts
export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  const backendUrl = useRuntimeConfig().backendUrl
  if (!backendUrl) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_BACKEND_URL is not configured' })
  }
  try {
    return await $fetch(`${backendUrl}/me`, {
      headers: { Authorization: `Bearer ${secure.token}` }
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Backend unreachable' })
  }
})
```

> `secure.token` requires the session type augmentation below — without it `pnpm type-check` fails.

---

## tsconfig.json (merge — ensure shared/ is compiled)

The `--template ui` init ships a `tsconfig.json` that extends `.nuxt/tsconfig.json`. Ensure `shared/` is included so the `#auth-utils` type augmentation below is picked up by `pnpm type-check`:

```json
{
  "include": ["shared/**/*.ts"]
}
```

Merge this into the existing `tsconfig.json` — if it already has an `include` array, add `"shared/**/*.ts"` to it. If no `include` key exists, add the block above.

---

## shared/types/auth.d.ts (write)

Augments `nuxt-auth-utils`' `SecureSessionData` (not `User`) so `secure.token` type-checks. `secure` is the sealed-session field that `nuxt-auth-utils` keeps server-only — putting the token there instead of on `User` is what actually keeps it out of the browser (`User` fields ARE returned by `/api/_auth/session`). Lives at `shared/types/auth.d.ts` per Nuxt 4 conventions; ensure `tsconfig.json` includes this path.

```ts
declare module '#auth-utils' {
  interface SecureSessionData {
    /** Backend access token — sealed-session secure data; nuxt-auth-utils never sends this to the client. */
    token: string
  }
}
```

---

## server/api/login.post.ts (write)

The `/api/login` counterpart that `server/middleware/auth.ts` carves out as the unauthenticated entry point. Proxies credentials to the backend (BFF proxy — this server never validates passwords itself), then seals the returned token into the session's `secure` data.

```ts
import { z } from 'zod'

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: 'Invalid request body' })
  }
  const { email, password } = parsed.data
  const backendUrl = useRuntimeConfig().backendUrl
  if (!backendUrl) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_BACKEND_URL is not configured' })
  }
  let auth
  try {
    auth = await $fetch<{ id: number, email: string, token: string }>(
      `${backendUrl}/login`,
      { method: 'POST', body: { email, password } }
    )
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }
  await setUserSession(event, {
    user: { id: auth.id, email: auth.email },
    secure: { token: auth.token }
  })
  return { id: auth.id, email: auth.email }
})
```

---

## server/api/users.get.ts (write)

Sample BFF proxy for a list endpoint — same pattern as `me.get.ts`: backend token from `secure`, backend URL from runtime config.

```ts
export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  const backendUrl = useRuntimeConfig().backendUrl
  if (!backendUrl) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_BACKEND_URL is not configured' })
  }
  try {
    return await $fetch(`${backendUrl}/users`, {
      headers: { Authorization: `Bearer ${secure.token}` }
    })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Backend unreachable' })
  }
})
```

---

## app/stores/session.ts (write)

Sample Pinia store using Pinia Colada for async data against the same-origin BFF route.

```ts
import { useQuery } from '@pinia/colada'

export const useSessionStore = defineStore('session', () => {
  const { data: me, status, refresh } = useQuery({
    key: ['me'],
    query: () => $fetch('/api/me')
  })
  const isAuthenticated = computed(() => status.value === 'success' && me.value != null)
  return { me, status, refresh, isAuthenticated }
})
```

---

## vitest.config.ts (write)

Minimal Nuxt-aware Vitest config so `pnpm test` works.

```ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: { environment: 'nuxt' }
})
```

---

## app/stores/session.test.ts (write)

Sanity test that validates the Vitest + Nuxt environment + Pinia Colada chain.

```ts
import { describe, it, expect } from 'vitest'
import { useSessionStore } from './session'

describe('useSessionStore', () => {
  it('starts fetching immediately', () => {
    const store = useSessionStore()
    // Pinia Colada has no 'idle' status — useQuery fires eagerly, so a fresh store is 'pending'.
    expect(store.status).toBe('pending')
  })
})
```

---

## package.json — scripts + hooks (merge)

The template already provides `build`, `dev`, `preview`, `postinstall`, `lint` (`eslint .`), and `typecheck` (`nuxt typecheck`). **Keep those.** Merge in the entries below (add a `type-check` alias to match the BigIn convention `pnpm type-check`):

```json
{
  "scripts": {
    "lint:fix": "eslint . --fix",
    "type-check": "nuxt typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "openapi-types": "mkdir -p server/types && openapi-typescript openapi.yaml -o server/types/api.d.ts",
    "prepare": "simple-git-hooks"
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm exec lint-staged"
  },
  "lint-staged": {
    "*.{ts,vue,js,mjs}": "eslint --fix"
  }
}
```

---

## .claude/settings.json (write / merge)

Pre-approved commands + the auto-format hook. The **`PostToolUse` hook runs `pnpm lint --fix` after every `Write`/`Edit`/`MultiEdit`** — that is the Nuxt ESLint format command (`eslint . --fix`); Nuxt UI uses ESLint as the sole formatter (Prettier is disabled). **`PostToolUse` only — no `PreToolUse`**: the `bigin-harness-setup` skill adds the `PreToolUse` `bash-guard.py` hook (governance — including the `--no-verify`/force-push blocks) when it overlays later. Until then there is no gate on git commands, so `git push` is deliberately **not** pre-approved here — it stays a per-call confirmation prompt so nothing reaches a remote before governance is in place. Local, reversible git commands (`add`, `commit`, `stash`, etc.) are pre-approved.

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
      "Bash(npx nuxi:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git pull:*)",
      "Bash(git stash:*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "pnpm lint --fix --cache" }
        ]
      }
    ]
  }
}
```

---

## .vscode/settings.json (write / merge)

ESLint is the only formatter; Prettier is disabled. Merge into an existing file rather than overwriting. (The template ships no `.vscode/`.)

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

## .prettierignore (write)

ESLint is the only formatter; Prettier is disabled project-wide.

```
*
```

---

## app/composables/useUsers.ts (write)

Demonstrates `useFetch` with the same-origin BFF API — no auth headers, no backend URL.

```ts
export function useUsers() {
  return useFetch('/api/users')
}
```

---

## app/middleware/auth.global.ts (write)

Client-side route guard, applied to every route (the `.global.ts` suffix is what makes Nuxt run it without opt-in per page — a plain `auth.ts` only runs on pages that set `definePageMeta({ middleware: 'auth' })`, which nothing here does). Uses `nuxt-auth-utils`' own `useUserSession()` rather than the `useSessionStore` Pinia Colada store: `useUserSession()`'s state is seeded during SSR/app-init before route middleware runs, so `loggedIn` is reliable on the very first navigation — reading an async `useQuery` status here instead would race and false-redirect authenticated users while their query is still pending.

```ts
export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) return navigateTo('/login')
})
```

---

## server/middleware/auth.ts (write)

Server-side API guard — return 401 for unauthenticated requests. Matches on `pathname` (not raw `event.path`, which includes the query string) so `/api/login?foo=bar` still hits the carve-out instead of being incorrectly gated.

```ts
export default defineEventHandler(async (event) => {
  const { pathname } = getRequestURL(event)
  if (pathname.startsWith('/api/') && pathname !== '/api/login') {
    await requireUserSession(event)
  }
})
```

---

## openapi.yaml (write — stub)

Minimal stub so `pnpm openapi-types` works before the real backend contract lands. **Replace with the real spec.**

```yaml
# STUB — replace with the real backend contract.
openapi: 3.1.0
info:
  title: {PROJECT_NAME} backend API
  version: 0.0.0
paths:
  /me:
    get:
      responses:
        '200':
          description: current user
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: integer }
                  email: { type: string }
                required: [id, email]
  /users:
    get:
      responses:
        '200':
          description: user list
  /login:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email: { type: string }
                password: { type: string }
              required: [email, password]
      responses:
        '200':
          description: credentials valid — returns the backend access token
          content:
            application/json:
              schema:
                type: object
                properties:
                  id: { type: integer }
                  email: { type: string }
                  token: { type: string }
                required: [id, email, token]
```

---

## .env.example (write)

Documents required env vars. Copy to `.env` and fill in.

> After writing, verify `.env` is in `.gitignore` — append it if missing:
> ```sh
> grep -qxF '.env' .gitignore 2>/dev/null || echo '.env' >> .gitignore
> ```

```sh
# nuxt-auth-utils sealed-session secret (generate one: openssl rand -base64 32)
NUXT_SESSION_PASSWORD=
# Backend REST API base URL (server-only; never exposed to the browser)
NUXT_BACKEND_URL=
```

---

# Drizzle opt-in (only when `WANT_DRIZZLE = yes`)

Default is BFF proxy with **no direct DB access**. Write these only if the user opted in (Stage 2c also installs `drizzle-orm` + `drizzle-kit` + `@cloudflare/workers-types`).

## Drizzle opt-in — wrangler.toml (write)

```toml
name = "{PROJECT_NAME}"
compatibility_date = "{COMPAT_DATE}"   # today's date (generated at scaffold time); update before deploying
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "{PROJECT_NAME}-db"
database_id = "{D1_DATABASE_ID}"
```

> Replace `{D1_DATABASE_ID}` with the real ID from `wrangler d1 list` before deploying.

## Drizzle opt-in — server/db/schema.ts (write)

```ts
import { drizzle } from 'drizzle-orm/d1'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { D1Database } from '@cloudflare/workers-types'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique()
})

// Pass the D1 binding — e.g. `useDrizzle(event.context.cloudflare.env.DB)` on Cloudflare.
export function useDrizzle(d1: D1Database) {
  return drizzle(d1, { schema: { users } })
}
```

## Drizzle opt-in — drizzle.config.ts (write)

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './server/db/migrations',
  schema: './server/db/schema.ts',
  dialect: 'sqlite'
})
```

## Drizzle opt-in — package.json db scripts (merge)

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "wrangler d1 execute {PROJECT_NAME}-db --local --file=./server/db/migrations/0000_init.sql",
    "db:migrate:remote": "wrangler d1 execute {PROJECT_NAME}-db --remote --file=./server/db/migrations/0000_init.sql",
    "db:studio": "drizzle-kit studio"
  }
}
```

> `db:migrate` uses `wrangler d1 execute` (not `drizzle-kit migrate`) because D1 migrations must go through the Cloudflare Workers CDN — `drizzle-kit migrate` only works against a local SQLite file. Update the migration file path to match the actual generated migration filename. `db:migrate:remote` applies against the production D1 database (requires `wrangler` auth).
