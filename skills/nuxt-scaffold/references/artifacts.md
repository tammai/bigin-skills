# Artifacts — rationale & merge semantics

**File bodies live in `../scripts/templates/` — that directory is the source of truth**, consumed by `../scripts/scaffold.mjs` (`applyArtifacts()`). This doc keeps only the *why* and the merge rules; don't duplicate content here. Placeholders substituted by the script: `{PROJECT_NAME}`, `{PRIMARY}`, `{NEUTRAL}`, `{D1_DATABASE_ID}`, `{COMPAT_DATE}`.

> Template-content assumptions (files/keys provided, default theme colors, key order, `tsconfig.json` shape) were last verified against `create-nuxt@3.36.1`'s `ui` template. Stage 1 runs `create-nuxt@latest` (unpinned) — re-verify if a future release changes the template and something starts failing lint/typecheck.

The `--template ui` init already provides a working Nuxt UI app (`nuxt.config.ts`, `app/app.vue`, `app/pages/index.vue`, `app/app.config.ts`, `eslint.config.mjs`, `app/assets/css/main.css`, `tsconfig.json`). **Never overwrite those** — the script only merges specific keys and adds new files. New code follows the **BFF proxy** convention: `server/api/` is the sole caller of the backend; the browser calls same-origin `/api/*` only.

---

## Merged files (never overwritten)

**`nuxt.config.ts`** — insert `runtimeConfig: { backendUrl: '' }` **between `css` and `routeRules`** (key order enforced by `nuxt/nuxt-config-keys-order`; the comment goes on its own line — a trailing comment trips `@stylistic/no-multi-spaces`). Do **not** add `compatibilityVersion: 4` (stale Nuxt 3→4 migration flag). The `ui` template ships this file *without* a trailing newline — `@stylistic/eol-last` fails lint unless fixed; the script appends one. For SSR-safe Pinia Colada queries add `'@pinia/colada/nuxt'` to `modules` — optional for the default BFF pattern (the sample store is client-fetched).

**`app/app.config.ts`** — the script regex-replaces the template's `primary: 'green', neutral: 'slate'` with the chosen colors in place.

**`package.json`** (`templates/merge/package.json`) — template already provides `build`/`dev`/`preview`/`postinstall`/`lint`/`typecheck`; kept (existing keys win). Adds `type-check` (BigIn convention alias), test scripts, `openapi-types`, `prepare`, plus `simple-git-hooks` + `lint-staged` blocks. Drizzle opt-in adds the `db:*` scripts (`templates/merge/drizzle-package.json`) — `db:migrate` uses `wrangler d1 execute`, not `drizzle-kit migrate`, because D1 migrations must go through Cloudflare (drizzle-kit only works against a local SQLite file); update the migration file path to the actual generated filename.

**`.claude/settings.json`** (`templates/merge/claude-settings.json`) — pre-approved commands + a `PostToolUse` hook running `lint-fix-file.py` after every Write/Edit/MultiEdit. **`PostToolUse` only — no `PreToolUse`**: `bigin-harness-setup` adds the `bash-guard.py` `PreToolUse` hook when it overlays governance later. Until then nothing gates git commands, so `git push` is deliberately **not** pre-approved (stays a per-call prompt); local reversible git commands are.

**`.vscode/settings.json`** (`templates/merge/vscode-settings.json`) — ESLint is the only formatter; Prettier disabled.

**`.gitignore`** — the script appends `.env` if missing.

**`tsconfig.json` — do not touch.** The `ui` template ships a solution-style tsconfig (`"files": []` + `"references"`, no `extends`); adding an `include` key breaks `pnpm type-check` outright (`TS6306`/`TS6310`). It's also unnecessary: Nuxt 4 auto-generates `.nuxt/tsconfig.shared.json` covering `shared/**/*`.

---

## Written-fresh files (`templates/files/`, safe to overwrite on resume)

- **`server/api/me.get.ts`**, **`server/api/users.get.ts`** — sample BFF proxy routes. The backend token lives in the session's `secure` data — a field `nuxt-auth-utils` never serializes into `/api/_auth/session`, so it's actually enforced server-only (unlike a field on `user`).
- **`shared/types/auth.d.ts`** — augments `SecureSessionData` (not `User`) so `secure.token` type-checks; without it `pnpm type-check` fails. Lives in `shared/types/` per Nuxt 4 conventions; needs zero tsconfig changes (see above).
- **`server/api/login.post.ts`** — the unauthenticated entry point; proxies credentials to the backend (BFF never validates passwords) and seals the returned token into `secure`.
- **`server/middleware/auth.ts`** — 401s unauthenticated `/api/*` except `/api/login`. Matches `pathname` (not raw `event.path`, which includes the query string) so `/api/login?x=y` still hits the carve-out.
- **`app/middleware/auth.global.ts`** — client route guard. The `.global.ts` suffix makes Nuxt run it without per-page opt-in. Uses `useUserSession()` (seeded during SSR/app-init) rather than the Pinia Colada store — an async `useQuery` status here would race and false-redirect authenticated users on first navigation.
- **`app/stores/session.ts`** + **`session.test.ts`** — sample Pinia Colada store; the test validates the whole Vitest + Nuxt env + Pinia Colada chain (fresh store is `'pending'` — Colada has no `'idle'`, `useQuery` fires eagerly).
- **`vitest.config.ts`** — minimal Nuxt-aware config (`environment: 'nuxt'`; requires `happy-dom`, installed in Stage 2).
- **`app/composables/useUsers.ts`** — `useFetch` against the same-origin BFF API.
- **`.claude/guards/lint-fix-file.py`** — backs the PostToolUse hook. Deliberately scoped to the single touched file, **not** repo-wide `eslint . --fix`: onboarding an existing repo with pre-existing violations, a blanket fix silently rewrote 10 unrelated files (848 lines in one) on a single edit. Python matches `bash-guard.py`'s convention — harness tooling, not an app dependency.
- **`.prettierignore`** (`*`) — ESLint is the sole formatter.
- **`openapi.yaml`** — stub so `pnpm openapi-types` works before the real contract lands; replace it.
- **`.env.example`** — documents `NUXT_SESSION_PASSWORD` + `NUXT_BACKEND_URL`.

## Drizzle opt-in (`templates/drizzle/`, only when `drizzle.enabled`)

Default is BFF proxy, **no DB**. When opted in: `wrangler.toml` (D1 binding; `{D1_DATABASE_ID}` stays a literal placeholder unless a real UUID was configured — replace before deploying), `server/db/schema.ts` (pass the D1 binding, e.g. `event.context.cloudflare.env.DB`), `drizzle.config.ts`.
