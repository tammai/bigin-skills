# Artifacts — rationale & merge semantics

**File bodies live in `../scripts/templates/` — that directory is the source of truth**, consumed by `../scripts/scaffold.mjs` (`applyArtifacts()`). This doc keeps only the *why* and the merge rules; don't duplicate content here. Placeholders substituted by the script: `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`.

> Template-content assumptions (files/keys provided, default theme colors, key order, `tsconfig.json` shape) were last verified against `create-nuxt@3.36.1`'s `ui` template. Stage 1 runs `create-nuxt@latest` (unpinned) — re-verify if a future release changes the template and something starts failing lint/typecheck.

The `--template ui` init already provides a working Nuxt UI app (`nuxt.config.ts`, `app/app.vue`, `app/pages/index.vue`, `app/app.config.ts`, `eslint.config.mjs`, `app/assets/css/main.css`, `tsconfig.json`). **Never overwrite those** — the script only merges specific keys and adds new files. New code follows the **BFF proxy** convention: `server/api/` is the sole caller of the backend; the browser calls same-origin `/api/*` only.

---

## Merged files (never overwritten)

**`nuxt.config.ts`** — insert `runtimeConfig: { backendUrl: '' }` **between `css` and `routeRules`** (key order enforced by `nuxt/nuxt-config-keys-order`; the comment goes on its own line — a trailing comment trips `@stylistic/no-multi-spaces`). Do **not** add `compatibilityVersion: 4` (stale Nuxt 3→4 migration flag). The `ui` template ships this file *without* a trailing newline — `@stylistic/eol-last` fails lint unless fixed; the script appends one. `'@pinia/colada-nuxt'` is registered into `modules` by Stage 2 (`ensureModuleRegistered`) — **required**, not optional; per the [official Nuxt guide](https://pinia-colada.esm.dev/nuxt.html) `useQuery`/`useMutation` don't work without it, and the module auto-installs `PiniaColadaSSRNoGc` for SSR-safe caching with no extra `await`.

**`app/app.config.ts`** — the script regex-replaces the template's `primary: 'green', neutral: 'slate'` with the chosen colors in place.

**`package.json`** (`templates/merge/package.json`) — template already provides `build`/`dev`/`preview`/`postinstall`/`lint`/`typecheck`; kept (existing keys win). Adds `type-check` (BigIn convention alias), test scripts, `openapi-types`, `prepare`, plus `simple-git-hooks` + `lint-staged` blocks.

**`.claude/settings.json`** (`templates/merge/claude-settings.json`) — pre-approved commands + a `PostToolUse` hook running `lint-fix-file.mjs` after every Write/Edit/MultiEdit. **`PostToolUse` only — no `PreToolUse`**: `bigin-harness-setup` adds the `bash-guard.mjs` `PreToolUse` hook when it overlays governance later. Until then nothing gates git commands, so `git push` is deliberately **not** pre-approved (stays a per-call prompt); local reversible git commands are.

**`.vscode/settings.json`** (`templates/merge/vscode-settings.json`) — ESLint is the only formatter; Prettier disabled.

**`.gitignore`** — the script appends `.env` if missing.

**`tsconfig.json` — do not touch.** The `ui` template ships a solution-style tsconfig (`"files": []` + `"references"`, no `extends`); adding an `include` key breaks `pnpm type-check` outright (`TS6306`/`TS6310`). It's also unnecessary: Nuxt 4 auto-generates `.nuxt/tsconfig.shared.json` covering `shared/**/*`.

---

## Written-fresh files (`templates/files/`, safe to overwrite on resume — applied for every template)

- **`server/api/users.get.ts`** — sample **unauthenticated** BFF proxy route (no template wires auth unconditionally anymore — see the `saas` opt-in below for the one that does). Demonstrates the proxy pattern: the browser only ever calls same-origin `/api/*`.
- **`app/composables/queries/users.ts`** — sample Colada query composable (`userQueries.list` via `defineQueryOptions`, wrapped in `useUsers` via `defineQuery` since it's the kind of query multiple components share — never a Pinia store, per `conventions-frontend.md`'s Server State: Pinia Colada rule) against the same-origin BFF API, per the `composables/queries/<domain>.ts` convention.
- **`app/composables/queries/users.test.ts`** — validates the whole Vitest + Nuxt env + Pinia Colada chain (fresh query is `'pending'` — Colada has no `'idle'`, `useQuery` fires eagerly). This is the *only* test file the base preset ships — without it `pnpm test` fails with "no test files found", so don't drop it without adding a replacement.
- **`vitest.config.ts`** — minimal Nuxt-aware config (`environment: 'nuxt'`; requires `happy-dom`, installed in Stage 2).
- **`.claude/guards/lint-fix-file.mjs`** — backs the PostToolUse hook. Deliberately scoped to the single touched file, **not** repo-wide `eslint . --fix`: onboarding an existing repo with pre-existing violations, a blanket fix silently rewrote 10 unrelated files (848 lines in one) on a single edit. Node (`.mjs`) matches `bash-guard.mjs`'s convention — dependency-free harness tooling that runs on macOS, Linux, and Windows.
- **`.prettierignore`** (`*`) — ESLint is the sole formatter.
- **`.env.example`** — documents `NUXT_SESSION_PASSWORD` + `NUXT_BACKEND_URL` (the latter only actually used by `users.get.ts` above; harmless if unused by a template that doesn't have a backend).

## `starter` opt-in (`templates/starter/`, only when `template === 'starter'`)

- **`openapi.yaml`** — stub so `pnpm openapi-types` works before the real contract lands; replace it. Only describes `/users` (the one endpoint the base preset actually ships) — extend it alongside whatever real backend routes get added.
- **`merge/package.json`** — adds just the `openapi-types` script (merged, same `mergeJsonFile` mechanism as the base `merge/package.json`). Not applied to other templates — a cloned template has no backend contract to describe by default.

## `saas` opt-in (`templates/saas/`, only when `template === 'saas'`)

The cloned `nuxt-ui-templates/saas` repo ships public marketing pages plus **non-functional** `login.vue`/`signup.vue` mockups (their `onSubmit` just does `console.log`) and no private area at all. This overlay wires a demo auth flow and a private `/dashboard` on top — **no real backend**, per explicit request; swap the two demo endpoints for real ones before shipping:

- **`app/pages/login.vue`**, **`app/pages/signup.vue`** — overwrite the template's mockups; same `UAuthForm` markup, `onSubmit` now calls `/api/login` / `/api/signup` and redirects to `/dashboard`.
- **`app/middleware/auth.global.ts`** — scoped, unlike a typical BFF auth guard: only `/dashboard/**` requires a session (redirects to `/login`); an already-logged-in user hitting `/login` or `/signup` is redirected to `/dashboard`. Every other route (the marketing site) stays public.
- **`app/pages/dashboard/index.vue`** — the private page itself. Deliberately built from plain `@nuxt/ui` components (`UContainer`, `UPageCard`, `UButton`) rather than the framework's `UDashboard*` components — those exist in `@nuxt/ui` v4 (confirmed via the `saas` template's own `package.json`, `@nuxt/ui@^4.9.0`) but their exact API wasn't verified during authoring; swap them in once verified if a richer shell is wanted.
- **`server/api/login.post.ts`**, **`server/api/signup.post.ts`** — zod-validate the body, then `setUserSession(event, { user: { email } })` directly — **no backend call**. This is the one deliberate deviation from the BFF-proxy convention everywhere else in this skill; both files carry a comment marking it as a stand-in.
- **`server/api/me.get.ts`** — `requireUserSession(event)` then returns `user` directly (no backend proxy, unlike the `starter` template's sample route).
- **`server/middleware/auth.ts`** — 401s `/api/me` and any future `/api/dashboard/*` when unauthenticated; `/api/login` and `/api/signup` stay open.
- **`shared/types/auth.d.ts`** — augments `User` (not `SecureSessionData` — there's no backend token to seal here) with `email`/optional `name` so `pnpm type-check` passes.
