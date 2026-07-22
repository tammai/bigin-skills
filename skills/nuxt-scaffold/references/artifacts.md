# Artifacts — rationale & merge semantics

**File bodies live in `../scripts/templates/` — that directory is the source of truth**, consumed by `../scripts/scaffold.mjs` (`applyArtifacts()`). This doc keeps only the *why* and the merge rules; don't duplicate content here. Placeholders substituted by the script: `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`.

> Template-content assumptions (files/keys provided, default theme colors, key order, `tsconfig.json` shape) were last verified against `create-nuxt@3.36.1`'s `ui` template. Stage 1 runs `create-nuxt@latest` (unpinned) — re-verify if a future release changes the template and something starts failing lint/typecheck.

The `--template ui` init already provides a working Nuxt UI app (`nuxt.config.ts`, `app/app.vue`, `app/pages/index.vue`, `app/app.config.ts`, `eslint.config.mjs`, `app/assets/css/main.css`, `tsconfig.json`). **Never overwrite those** — the script only merges specific keys and adds new files. New code follows the **BFF proxy** convention: `server/api/` is the sole caller of the backend; the browser calls same-origin `/api/*` only.

---

## Merged files (never overwritten)

**`nuxt.config.ts`** — insert `runtimeConfig: { backendUrl: '' }` **between `css` and `routeRules`** (key order enforced by `nuxt/nuxt-config-keys-order`; the comment goes on its own line — a trailing comment trips `@stylistic/no-multi-spaces`). Do **not** add `compatibilityVersion: 4` (stale Nuxt 3→4 migration flag). The `ui` template ships this file *without* a trailing newline — `@stylistic/eol-last` fails lint unless fixed; the script appends one. `'@pinia/colada-nuxt'` is registered into `modules` by Stage 2 (`ensureModuleRegistered`) — **required**, not optional; per the [official Nuxt guide](https://pinia-colada.esm.dev/nuxt.html) `useQuery`/`useMutation` don't work without it, and the module auto-installs `PiniaColadaSSRNoGc` for SSR-safe caching with no extra `await`. The template ships `devtools: { enabled: true }` — the script flips it to `enabled: false` in place (BFF preset convention: devtools off by default); fails loudly if that literal isn't found rather than guessing an insertion point.

**`app/app.config.ts`** — the script regex-replaces the template's `primary: 'green', neutral: 'slate'` with the chosen colors in place.

**`app/assets/css/main.css`** — the script regex-replaces whatever's quoted after `--font-sans:` with `'Google Sans'` (BigIn brand default, applies to every template regardless of upstream font — most `ui-templates` repos ship `'Public Sans'`, `landing` ships `'Instrument Sans'`). Fails loudly if `--font-sans` isn't found rather than guessing.

**`package.json`** (`templates/merge/package.json`) — template already provides `build`/`dev`/`preview`/`postinstall`/`lint`/`typecheck`; kept (existing keys win). Adds `type-check` (BigIn convention alias), test scripts, `openapi-types`, `prepare`, plus `simple-git-hooks` + `lint-staged` blocks.

**`.claude/settings.json`** (`templates/merge/claude-settings.json`) — pre-approved commands + a `PostToolUse` hook running `lint-fix-file.mjs` after every Write/Edit/MultiEdit. **`PostToolUse` only — no `PreToolUse`**: `bigin-harness-setup` adds the `bash-guard.mjs` `PreToolUse` hook when it overlays governance later. Until then nothing gates git commands, so `git push` is deliberately **not** pre-approved (stays a per-call prompt); local reversible git commands are.

**`.vscode/settings.json`** (`templates/merge/vscode-settings.json`) — ESLint is the only formatter; Prettier disabled.

**`.gitignore`** — the script appends `.env` if missing.

**`tsconfig.json` — do not touch.** The `ui` template ships a solution-style tsconfig (`"files": []` + `"references"`, no `extends`); adding an `include` key breaks `pnpm type-check` outright (`TS6306`/`TS6310`). It's also unnecessary: Nuxt 4 auto-generates `.nuxt/tsconfig.shared.json` covering `shared/**/*`.

---

## Written-fresh files (`templates/files/`, safe to overwrite on resume — applied for every template)

The BFF backend wiring is **universal** — every template ships the same-origin proxy, the typed client, and the committed contract snapshot. The browser only ever calls same-origin `/api/*`; the token pair lives only in the session's server-only `secure` key.

- **`server/api/backend/[...path].ts`** — the single BFF proxy: a method-agnostic catch-all that unseals the `nuxt-auth-utils` session, attaches `Authorization: Bearer`, forwards to `NUXT_BACKEND_URL`, and runs the 401→refresh→retry-once flow. Reads the H3 session; delegates all logic to `server/utils/proxy.ts`.
- **`server/utils/proxy.ts`** — the h3-free proxy core (unit-testable by stubbing `fetch` + a fake `ProxySession`): `proxyToBackend()` (forward + refresh-retry, with a re-read on refresh failure to survive a concurrent-refresh race), `isCrossSiteMutation()` (the CSRF predicate), and the exported `SAFE_METHODS` / `BFF_PREFIX` / `API_PREFIX` constants.
- **`server/utils/backend.ts`** — server-only calls to the Go backend (`backendLogin`/`backendSignup`/`backendRefresh`/`backendLogout`), `BackendError`, and `resolveBackendUrl()`. Deliberately h3-free; the browser never reaches these.
- **`server/middleware/csrf.ts`** — rejects cross-site mutations to **every** `/api/` route (not just the proxy) via `isCrossSiteMutation`, so the saas auth routes are covered too (login-CSRF defense). Safe methods pass through.
- **`shared/api-client/index.ts`** + **`schema.d.ts`** — the `openapi-fetch` client bound to the same-origin `/api/backend` proxy; `schema.d.ts` is generated from `openapi.yaml` by `pnpm openapi-types` (do not hand-edit).
- **`shared/types/session.d.ts`** — `SessionTokens` plus the `#auth-utils` augmentation storing the pair under the server-only `secure` session key.
- **`openapi.yaml`** — the **committed snapshot** of the paired backend's contract (the ADR default Go pairing). Universal — the input to `pnpm openapi-types`. Not authored here: after a backend change, copy its `api/openapi.yaml` over this file and regenerate.
- **`app/composables/queries/users.ts`** — sample Colada query composable: `userQueries.list` is a plain query object (`{ key, query }`) wrapped in `useUsers` via `defineQuery` (shared across consumers — never a Pinia store, per `conventions-frontend.md`'s Server State rule), calling the backend through `apiClient` (the same-origin proxy).
- **`tests/server/proxy.test.ts`** — covers `proxyToBackend` (auth forwarding, 401→refresh→retry, refresh-failure clear, concurrent-refresh race), `isCrossSiteMutation`, and the `server/middleware/csrf.ts` handler itself.
- **`tests/app/composables/queries/users.test.ts`** — validates the whole Vitest + Nuxt env + Pinia Colada chain (fresh query is `'pending'` — Colada has no `'idle'`, `useQuery` fires eagerly). Lives under `tests/`, mirroring `app/`, imports via the `~~/` root alias — per the centralized-tests convention in `.claude/rules/testing.md` (added by `bigin-harness-setup`).
- **`vitest.config.ts`** — minimal Nuxt-aware config (`environment: 'nuxt'`; requires `happy-dom`, installed in Stage 2). `test.include` is scoped to `tests/**/*.test.ts` so a stray co-located `*.test.ts` won't silently run.
- **`.claude/guards/lint-fix-file.mjs`** — backs the PostToolUse hook. Deliberately scoped to the single touched file, **not** repo-wide `eslint . --fix`: onboarding an existing repo with pre-existing violations, a blanket fix silently rewrote 10 unrelated files (848 lines in one) on a single edit. Node (`.mjs`) matches `bash-guard.mjs`'s convention — dependency-free harness tooling that runs on macOS, Linux, and Windows.
- **`.prettierignore`** (`*`) — ESLint is the sole formatter.
- **`.env.example`** — documents `NUXT_SESSION_PASSWORD` + `NUXT_BACKEND_URL` (the latter is used by the universal proxy on every template).

## `starter` opt-in (`templates/starter/`, only when `template === 'starter'`)

`starter` is the one template restructured into Nuxt **Layers** (ADR §5.1/5.3). This overlay ships only the Layers scaffolding; `restructureStarterLayers()` in `scaffold.mjs` then relocates the universal `shared/api-client` + `app/composables/queries/users.ts` into `layers/`, fixes their import paths, wires `extends`, and repoints the `openapi-types` output path to `layers/shared/api-client/schema.d.ts`.

- **`layers/shared/nuxt.config.ts`**, **`layers/users/nuxt.config.ts`** — per-layer configs (feature layers use `imports: { scan: false }`, the precondition for the boundary lint to see real imports).
- **`eslint.boundaries.mjs`** — the `eslint-plugin-boundaries` config appended to `eslint.config.mjs` by `patchEslintConfig()`; it fails `pnpm lint` on an illegal cross-layer import (what makes the `layers/` shape a real boundary).

The universal `merge/package.json` already carries the `openapi-types` script for every template — there is no `starter`-only `merge/`.

## `saas` opt-in (`templates/saas/`, only when `template === 'saas'`)

The cloned `nuxt-ui-templates/saas` repo ships public marketing pages plus **non-functional** `login.vue`/`signup.vue` mockups (their `onSubmit` just does `console.log`) and no private area. This overlay wires **real backend-calling** auth and a private `/dashboard` on top — login/signup/logout call the paired backend and seal the token pair in the session's server-only `secure` key:

- **`app/pages/login.vue`**, **`app/pages/signup.vue`** — overwrite the template's mockups; same `UAuthForm` markup, `onSubmit` now calls `/api/login` / `/api/signup` and redirects to `/dashboard`.
- **`app/middleware/auth.global.ts`** — scoped, unlike a typical BFF auth guard: only `/dashboard/**` requires a session (redirects to `/login`); an already-logged-in user hitting `/login` or `/signup` is redirected to `/dashboard`. Every other route (the marketing site) stays public.
- **`app/pages/dashboard/index.vue`** — the private page itself. Deliberately built from plain `@nuxt/ui` components (`UContainer`, `UPageCard`, `UButton`) rather than the framework's `UDashboard*` components — those exist in `@nuxt/ui` v4 (confirmed via the `saas` template's own `package.json`, `@nuxt/ui@^4.9.0`) but their exact API wasn't verified during authoring; swap them in once verified if a richer shell is wanted.
- **`server/api/login.post.ts`**, **`server/api/signup.post.ts`** — zod-validate the body, resolve the backend URL in a guard (clean 500 if `NUXT_BACKEND_URL` is unset), then delegate to `performLogin`/`performSignup` in `auth-flow.ts` (which call the real backend and seal the token pair). Map backend failures to clean client error envelopes (401/409/422/502) — the raw backend body is never forwarded.
- **`server/api/logout.post.ts`** — best-effort backend revocation, then always tears down the local session (logout must succeed even if the backend is down/unconfigured).
- **`server/utils/auth-flow.ts`** — the h3-free `performLogin`/`performSignup`/`performLogout` flows behind those routes (unit-testable by stubbing `fetch` + a fake `SessionWriter`).
- **`server/api/me.get.ts`** — `requireUserSession(event)` then returns `user` directly (identity for the UI, not a backend proxy).
- **`server/middleware/auth.ts`** — 401s `/api/me` and any future `/api/dashboard/*` when unauthenticated; `/api/login`, `/api/signup`, `/api/logout` stay open.
- **`shared/types/auth.d.ts`** — augments `User` (the client-visible session data) with `email`/optional `name` so `pnpm type-check` passes.
- **`tests/server/auth-flow.test.ts`** — unit tests for the h3-free flows. **`tests/server/auth-routes.test.ts`** — drives the actual `login.post`/`signup.post` handlers, covering the 422/500/401/409/502 error-envelope branches.
