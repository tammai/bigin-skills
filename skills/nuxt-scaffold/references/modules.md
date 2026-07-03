# Modules — what gets installed

The BFF preset is installed for every `template` (`starter` and every cloned template alike — see `references/bootstrap.md`'s "Stage 1 (cloned templates)" section for how `@pinia/nuxt`/`nuxt-auth-utils`/`@vueuse/nuxt` get added and registered on the clone path). Optional modules and the Drizzle/D1 layer are added only when the user opts in during SKILL.md Step 2, and only for `template: starter` (cloned templates already bundle what they need — `optionalModules` must be empty otherwise).

Installing `nuxt-auth-utils` doesn't mean a template ships an auth *flow* — only `saas` writes a sample login/session/dashboard implementation (a demo one, not backend-proxied; see `references/artifacts.md`'s `## saas opt-in`). For `starter` and every other cloned template, the module is present but unused until hand-wired.

---

## BFF Preset (default — always installed)

### Provided by the `--template ui` init, refreshed by Stage 1b

| npm package | Why |
| --- | --- |
| `@nuxt/ui` | 100+ accessible components, theming, dark mode |
| `@nuxt/eslint` + `eslint` | Flat-config ESLint — the only formatter (Prettier is disabled) |
| `tailwindcss` | Styling engine (via `@nuxt/ui`) |
| `vue-tsc`, `typescript` | Required by `nuxt typecheck` |

The `--template ui` init installs whatever versions the resolved `create-nuxt@latest` release bundled at publish time — not necessarily current. `references/bootstrap.md` → Stage 1b immediately refreshes all of these (plus `nuxt`, `@pinia/nuxt`, `nuxt-auth-utils`, `@vueuse/nuxt`) per `VERSION_POLICY`, so a stale template snapshot never reaches the scaffolded app.

The template also ships the eslint stylistic config — explicit override `commaDangle: 'never'` (default `'always-multiline'`) plus `braceStyle: '1tbs'` (same as `@stylistic/eslint-plugin`'s own default, restated); the rest of the effective rules (`indent: 2`, `quotes: 'single'`, `semi: false`) come from that plugin's defaults, not from anything the template writes. Also ships `app.vue`, `app.config.ts`, `pages/index.vue`, `eslint.config.mjs`, and `main.css`.

### Stage 2 — BFF preset packages

| Command | npm package | Why |
| --- | --- | --- |
| *(Stage 1 `--modules`)* | `@pinia/nuxt` | Vue state management, auto-imported stores |
| *(Stage 1 `--modules`)* | `nuxt-auth-utils` | Sealed session cookie + OAuth/password helpers — the only auth path |
| *(Stage 1 `--modules`)* | `@vueuse/nuxt` | Vue composition utilities, auto-imported |
| `pnpm add @pinia/colada` | `@pinia/colada` | Async data (`useQuery` / `useMutation`) on top of Pinia |
| `pnpm add @pinia/colada-nuxt` | `@pinia/colada-nuxt` | Nuxt module for `@pinia/colada` — **required**, not optional (see [official guide](https://pinia-colada.esm.dev/nuxt.html)); without it `useQuery`/`useMutation` throw. Registered in `nuxt.config.ts` by the script itself (`ensureModuleRegistered`), not `nuxi module add` |
| `pnpm add zod` | `zod` | Runtime schema validation (validate backend responses in API routes, request bodies) |
| `pnpm add -D vitest` | `vitest` | Unit test runner |
| `pnpm add -D @nuxt/test-utils` | `@nuxt/test-utils` | Nuxt-aware Vitest environment (`defineVitestConfig`) |
| `pnpm add -D happy-dom` | `happy-dom` | DOM implementation required by `@nuxt/test-utils`'s `environment: 'nuxt'` — `pnpm test` fails without it |
| `pnpm add -D simple-git-hooks` | `simple-git-hooks` | Lightweight git hook manager (project commit gate) — needs `pnpm approve-builds simple-git-hooks` (Stage 4) on pnpm 10+ |
| `pnpm add -D lint-staged` | `lint-staged` | Run ESLint on staged files at commit |
| `pnpm add -D openapi-typescript` | `openapi-typescript` | Generate server API types from `openapi.yaml` |

---

## Optional Modules Menu (SKILL.md Step 2 multi-select; empty allowed)

| Choice | Adds | Use when |
| --- | --- | --- |
| `image` | `@nuxt/image` | Responsive optimized images — `nuxi` frequently fails to register it in `nuxt.config.ts`'s `modules` array (silently, over a `sharp` build-approval prompt with no TTY) — a manual registration check after adding it is mandatory, not optional, and `pnpm approve-builds sharp` is required afterward or every later `pnpm` command fails (see `bootstrap.md` Stage 2b) |
| `content` | `@nuxt/content` | Git-based Markdown CMS — needs `better-sqlite3` pre-installed and its build approved *before* adding the module, or `nuxi module add content` hangs forever on a non-interactive prompt (see `bootstrap.md` Stage 2b) |

> **Already installed as dependencies of `@nuxt/ui`** (no need to add): `@nuxt/icon`, `@nuxt/fonts`, `@nuxtjs/color-mode`. They register automatically when `@nuxt/ui` is installed.

Each optional module is added via `nuxi module add <slug>` (auto-registers in `nuxt.config.ts` — except `image`, which sometimes doesn't; verify after running it).

---

## Drizzle + Cloudflare D1 opt-in (SKILL.md Step 2; default = no)

Default philosophy: **BFF proxy — the backend owns data persistence, the Nuxt app does not access a database directly.** Only add Drizzle + D1 when the app genuinely needs server-side DB access.

When opted in (`WANT_DRIZZLE = yes`):
- `pnpm add drizzle-orm` + `pnpm add -D drizzle-kit @cloudflare/workers-types wrangler`, then `pnpm approve-builds esbuild workerd` (wrangler's native deps, blocked by pnpm's build-approval gate otherwise).
- `wrangler` is required to apply migrations to a D1 database (`wrangler d1 execute`) — `drizzle-kit migrate` alone only works against a local SQLite file.
- Writes `wrangler.toml` (D1 binding with `{D1_DATABASE_ID}` placeholder + `{COMPAT_DATE}` generated at scaffold time), `server/db/schema.ts`, `drizzle.config.ts`, and `db:generate` / `db:migrate` / `db:studio` scripts.

---

## Requirements

- **Node.js 22+** (Nuxt 4 minimum; active LTS recommended).
- **pnpm** (the only supported package manager for this stack).
- `nuxi module add` resolves **latest** versions (no pin), same as Stage 1's now-unpinned `create-nuxt@latest`. Re-verify Stage 1/Stage 2b behavior reactively if `create-nuxt` or `nuxi` start failing — not on a fixed schedule.
