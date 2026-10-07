# Artifacts — rationale & merge semantics

**File bodies live in `../scripts/templates/` — that directory is the source of truth**, consumed by `../scripts/scaffold.mjs` (`applyArtifacts()`). This doc keeps only the *why* and the merge rules; don't duplicate content here. Placeholders substituted by the script: `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`.

> Template-content assumptions (files/keys provided, default theme colors, key order, `tsconfig.json` shape) were last verified against `create-nuxt@3.36.1`'s `ui` template. Stage 1 runs `create-nuxt@latest` (unpinned) — re-verify if a future release changes the template and something starts failing lint/typecheck.

The `--template ui` init already provides a working Nuxt UI app (`nuxt.config.ts`, `app/app.vue`, `app/pages/index.vue`, `app/app.config.ts`, `eslint.config.mjs`, `app/assets/css/main.css`, `tsconfig.json`). **Never overwrite those** — the script only merges specific keys and adds new files. New code follows the **pass-through** convention: the browser calls same-origin `/api/v<N>/**` only, the pass-through forwards it to the API untouched, and nothing in the app holds a token.

---

## Merged files (never overwritten)

**`nuxt.config.ts`** — `mergeNuxtConfig()` sets three things, each at the position `nuxt/nuxt-config-keys-order` demands: `ssr: false` (no SSR, ever), `nitro: { preset: 'cloudflare_module' }`, and `runtimeConfig: { apiOrigin: '' }` (server-only, filled from `NUXT_API_ORIGIN`). `insertTopLevelKey()` scans top-level keys in file order and inserts before the first key the rule ranks *after* the new one (a comment block directly above that key stays with it; the inserted comment goes on its own line — a trailing comment trips `@stylistic/no-multi-spaces`). It does **not** anchor on one fixed key: 5 of the 8 cloned templates (`landing`, `docs`, `portfolio`, `chat`, `editor`) ship no `routeRules`, and `css` is the wrong anchor too — the client-module keys `content`/`mdc`/`ui` sit between `css` and `runtimeConfig` in the rule's order. `NUXT_KEY_ORDER` in `scaffold.mjs` mirrors that rule's `ORDER_KEYS`; keys the rule doesn't know (`eslint`, `ogImage`, `llms`, `mcp`) sort last, so they count as "after". A template that already sets `ssr`, a `nitro` block (`docs`) or a `runtimeConfig` (`editor`: `public.partykitHost`) is merged into rather than given a second key — a plain `includes()` skip would leave the pass-through with no origin. Re-running it is a no-op. `pnpm lint` at Stage 5 runs without `--fix`, so a misplacement fails the scaffold instead of self-healing. Do **not** add `compatibilityVersion: 4` (stale Nuxt 3→4 migration flag). The `ui` template ships this file *without* a trailing newline — `@stylistic/eol-last` fails lint unless fixed; the script appends one. `'@pinia/colada-nuxt'` is registered into `modules` by Stage 2 (`ensureModuleRegistered`) — **required**, not optional; per the [official Nuxt guide](https://pinia-colada.esm.dev/nuxt.html) `useQuery`/`useMutation` don't work without it, and the module auto-installs `PiniaColadaSSRNoGc` for SSR-safe caching with no extra `await`. The template ships `devtools: { enabled: true }` — the script flips it to `enabled: false` in place (preset convention: devtools off by default); fails loudly if that literal isn't found rather than guessing an insertion point.

**Cloned `saas`, `docs`, `portfolio` — `nuxt-og-image` is removed.** `dropOgImage()` deletes the dependency, the `modules` entry, the `ogImage` config key and every `defineOgImage(...)` call under `app/` (a trailing `else { defineOgImage(...) }` goes whole; any call it can't parse fails the scaffold), and `docs`' `const site = useSiteConfig()` — which only existed through the module's `nuxt-site-config` — becomes `{ url: useRequestURL().origin }`. Under `ssr: false` the module registers no `defineOgImage` auto-import, so `pnpm type-check` fails and the call throws in the browser; OG images are rendered on the server. `useSeoMeta({ ogImage })` tags are kept. The other five clones don't ship the module.

**`app/app.config.ts`** — the script regex-replaces the template's `primary: 'green', neutral: 'slate'` with the chosen colors in place.

**`app/assets/css/main.css`** — the script regex-replaces whatever's quoted after `--font-sans:` with `'Google Sans'` (BigIn brand default, applies to every template regardless of upstream font — most `ui-templates` repos ship `'Public Sans'`, `landing` ships `'Instrument Sans'`). Fails loudly if `--font-sans` isn't found rather than guessing.

**`package.json`** (`templates/merge/package.json`) — template already provides `build`/`dev`/`preview`/`postinstall`/`lint`/`typecheck`; kept (existing keys win). Adds `type-check` (BigIn convention alias), test scripts, `openapi-types`, `prepare`, plus `simple-git-hooks` + `lint-staged` blocks.

**`.claude/settings.json`** (`templates/merge/claude-settings.json`) — pre-approved commands + a `PostToolUse` hook running `lint-fix-file.mjs` after every Write/Edit/MultiEdit. **`PostToolUse` only — no `PreToolUse`**: `bigin-harness-setup` adds the `bash-guard.mjs` `PreToolUse` hook when it overlays governance later. Until then nothing gates git commands, so `git push` is deliberately **not** pre-approved (stays a per-call prompt); local reversible git commands are.

**`.vscode/settings.json`** (`templates/merge/vscode-settings.json`) — ESLint is the only formatter; Prettier disabled.

**`.gitignore`** — the script appends `.env` if missing.

**`tsconfig.json` — do not touch.** The `ui` template ships a solution-style tsconfig (`"files": []` + `"references"`, no `extends`); adding an `include` key breaks `pnpm type-check` outright (`TS6306`/`TS6310`). It's also unnecessary: Nuxt 4 auto-generates `.nuxt/tsconfig.shared.json` covering `shared/**/*`.

---

## Written-fresh files (`templates/files/`, safe to overwrite on resume — applied for every template)

The pass-through wiring is **universal** — every template ships the same tokenless `/api` pass-through, the typed client, and the committed contract placeholder. The browser only ever calls same-origin `/api/*`; the API sets and reads its own HttpOnly session cookie, so nothing here holds a token.

- **`server/routes/api/[...path].ts`** — the catch-all (not `routeRules`: Nitro's proxy buffers streamed responses and can't express the `v<digits>` allowlist). One line: `passThrough(toWebRequest(event), useRuntimeConfig(event).apiOrigin)`.
- **`server/utils/pass-through.ts`** — the h3-free core (a web `Request` and the origin in, a `Response` out; unit-testable by stubbing `fetch`). Forwards only paths whose decoded form matches `^/api/v\d+(/|$)` with no dot segment (a JSON 404 `not_found` otherwise); builds the upstream URL from the origin, that path and the client's query string only; forwards every request header except `host` and the hop-by-hop ones; sends the body as a stream (`duplex: 'half'`) and returns the upstream `Response` unbuffered with `redirect: 'manual'`. An unset or invalid `NUXT_API_ORIGIN` is a JSON 502 `upstream_not_configured`; an upstream 5xx or a network error is a JSON 502 `bad_gateway` that carries neither the upstream body nor its URL.
- **`shared/api-client/index.ts`** + **`schema.d.ts`** — `apiClient`, a `$fetch` instance (Nuxt's global ofetch — no HTTP-client dependency) with `baseURL: '/api'` and `credentials: 'include'`, plus the `Ok<Path>` helper that pulls a 200 response body out of the generated `paths`. `schema.d.ts` is generated from `openapi.yaml` by `pnpm openapi-types` (do not hand-edit).
- **`openapi.yaml`** — a **placeholder** contract (the file's header says so), shipped so the typed client has something to compile against; it is deliberately not go-scaffold's. Universal — the input to `pnpm openapi-types`. Replace it with the backend's `openapi.yaml` and regenerate; go-scaffold's declares `/api/v1` as its server URL and omits `/v1` from its paths, so set `apiClient`'s `baseURL` to `'/api/v1'` afterwards.
- **`app/composables/queries/users.ts`** — sample Colada query composable: `userQueries.list` is a plain query object (`{ key, query }`) wrapped in `useUsers` via `defineQuery` (shared across consumers — never a Pinia store, per `conventions-frontend.md`'s Server State rule), calling the API through `apiClient` (the same-origin pass-through).
- **`tests/server/pass-through.test.ts`** — covers `passThrough`: the allowlist and every traversal/edge path (all JSON 404, never reaching the API), header passthrough (`Set-Cookie` intact, `host` dropped, nothing added), unbuffered streaming both ways, no redirect following, the 502 cases and an unset origin.
- **`tests/app/composables/queries/users.test.ts`** — validates the whole Vitest + Nuxt env + Pinia Colada chain (fresh query is `'pending'` — Colada has no `'idle'`, `useQuery` fires eagerly). Lives under `tests/`, mirroring `app/`, imports via the `~~/` root alias — per the centralized-tests convention in `.claude/rules/testing.md` (added by `bigin-harness-setup`).
- **`vitest.config.ts`** — minimal Nuxt-aware config (`environment: 'nuxt'`; requires `happy-dom`, installed in Stage 2). `test.include` is scoped to `tests/**/*.test.ts` so a stray co-located `*.test.ts` won't silently run.
- **`.claude/guards/lint-fix-file.mjs`** — backs the PostToolUse hook. Deliberately scoped to the single touched file, **not** repo-wide `eslint . --fix`: onboarding an existing repo with pre-existing violations, a blanket fix silently rewrote 10 unrelated files (848 lines in one) on a single edit. Node (`.mjs`) matches `bash-guard.mjs`'s convention — dependency-free harness tooling that runs on macOS, Linux, and Windows.
- **`.prettierignore`** (`*`) — ESLint is the sole formatter.
- **`.env.example`** — documents `NUXT_API_ORIGIN` (server-only; never `NUXT_PUBLIC_`) and the client-IP caveat: the API sees the app's egress address, so every browser user shares one rate-limit bucket, and `TRUSTED_PROXY` stays unset on the API.

## `starter` opt-in (`templates/starter/`, only when `template === 'starter'`)

`starter` is the one template restructured into Nuxt **Layers** (ADR §5.1/5.3). This overlay ships only the Layers scaffolding; `restructureStarterLayers()` in `scaffold.mjs` then relocates the universal `shared/api-client` + `app/composables/queries/users.ts` into `layers/`, fixes their import paths, wires `extends`, and repoints the `openapi-types` output path to `layers/shared/api-client/schema.d.ts`.

- **`layers/shared/nuxt.config.ts`**, **`layers/users/nuxt.config.ts`** — per-layer configs (feature layers use `imports: { scan: false }`, the precondition for the boundary lint to see real imports).
- **`eslint.boundaries.mjs`** — the `eslint-plugin-boundaries` config appended to `eslint.config.mjs` by `patchEslintConfig()`; it fails `pnpm lint` on an illegal cross-layer import (what makes the `layers/` shape a real boundary).

The universal `merge/package.json` already carries the `openapi-types` script for every template — there is no `starter`-only `merge/`.

## `saas` opt-in (`templates/saas/`, only when `template === 'saas'`)

The cloned `nuxt-ui-templates/saas` repo ships public marketing pages plus **non-functional** `login.vue`/`signup.vue` mockups (their `onSubmit` just does `console.log`) and no private area. This overlay wires **real** cookie-session auth and a private `/dashboard` on top. The API owns the session: login is `POST /api/v1/auth/session`, sign-out is `DELETE /api/v1/auth/session`, sign-up is `POST /api/v1/auth/signup` followed by a login, and the current user is `GET /api/v1/user/profile` (go-scaffold ships no GET on `/auth/session`):

- **`app/composables/useAuth.ts`** — `useAuth()`: `login`, `signup`, `logout`, `fetchUser` and the `user` state, all through `apiClient`. `fetchUser` answers `null` on a 401 and rethrows anything else, so an API outage is not mistaken for a signed-out visitor.
- **`app/pages/login.vue`**, **`app/pages/signup.vue`** — overwrite the template's mockups; same `UAuthForm` markup, `onSubmit` now calls `useAuth()` and redirects to `/dashboard`.
- **`app/middleware/auth.global.ts`** + **`app/utils/auth-redirect.ts`** — scoped: only `/dashboard/**` asks the API for the current user and redirects to `/login` on a 401; a user already known to be signed in hitting `/login` or `/signup` is redirected to `/dashboard`. Every other route (the marketing site) stays public and makes no API call. The rules are a pure function in the util so they test without a Nuxt runtime (`@nuxt/test-utils/runtime`'s `mockNuxtImport` needs `@vue/test-utils`, which the scaffold doesn't install).
- **`app/pages/dashboard/index.vue`** — the private page itself. Deliberately built from plain `@nuxt/ui` components (`UContainer`, `UPageCard`, `UButton`) rather than the framework's `UDashboard*` components — those exist in `@nuxt/ui` v4 (confirmed via the `saas` template's own `package.json`, `@nuxt/ui@^4.9.0`) but their exact API wasn't verified during authoring; swap them in once verified if a richer shell is wanted.
- **`shared/types/auth.d.ts`** — the `AuthUser` type (go-scaffold's `User`).
- **`tests/app/composables/useAuth.test.ts`**, **`tests/app/utils/auth-redirect.test.ts`** — pin the method, path and body of every session call (`apiClient` mocked) and the redirect rules.

