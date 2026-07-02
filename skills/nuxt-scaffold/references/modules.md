# Modules — what gets installed

The BFF preset is installed by default. Optional modules and the Drizzle/D1 layer are added only when the user opts in during Phase 2.

---

## BFF Preset (default — always installed)

### Provided by the `--template ui` init (no action needed)

| npm package | Why |
| --- | --- |
| `@nuxt/ui` | 100+ accessible components, theming, dark mode |
| `@nuxt/eslint` + `eslint` | Flat-config ESLint — the only formatter (Prettier is disabled) |
| `tailwindcss` | Styling engine (via `@nuxt/ui`) |
| `vue-tsc`, `typescript` | Required by `nuxt typecheck` |

The template also ships the eslint stylistic config (`commaDangle: 'never'`, `braceStyle: '1tbs'`), `app.vue`, `app.config.ts`, `pages/index.vue`, `eslint.config.mjs`, and `main.css`.

### Stage 2 — BFF preset packages (plain packages only; Nuxt modules installed in Stage 1)

| Command | npm package | Why |
| --- | --- | --- |
| *(Stage 1 `--modules`)* | `@pinia/nuxt` | Vue state management, auto-imported stores |
| *(Stage 1 `--modules`)* | `nuxt-auth-utils` | Sealed session cookie + OAuth/password helpers — the only auth path |
| *(Stage 1 `--modules`)* | `@vueuse/nuxt` | Vue composition utilities, auto-imported |
| `pnpm add @pinia/colada` | `@pinia/colada` | Async data (`useQuery` / `useMutation`) on top of Pinia |
| `pnpm add zod` | `zod` | Runtime schema validation (validate backend responses in API routes, request bodies) |
| `pnpm add -D vitest` | `vitest` | Unit test runner |
| `pnpm add -D @nuxt/test-utils` | `@nuxt/test-utils` | Nuxt-aware Vitest environment (`defineVitestConfig`) |
| `pnpm add -D simple-git-hooks` | `simple-git-hooks` | Lightweight git hook manager (project commit gate) |
| `pnpm add -D lint-staged` | `lint-staged` | Run ESLint on staged files at commit |
| `pnpm add -D openapi-typescript` | `openapi-typescript` | Generate server API types from `openapi.yaml` |

---

## Optional Modules Menu (Phase 2 multi-select; empty allowed)

| Choice | Adds | Use when |
| --- | --- | --- |
| `image` | `@nuxt/image` | Responsive optimized images |
| `content` | `@nuxt/content` | Git-based Markdown CMS |

> **Already installed as dependencies of `@nuxt/ui`** (no need to add): `@nuxt/icon`, `@nuxt/fonts`, `@nuxtjs/color-mode`. They register automatically when `@nuxt/ui` is installed.

Each optional module is added via `nuxi module add <slug>` (auto-registers in `nuxt.config.ts`).

---

## Drizzle + Cloudflare D1 opt-in (Phase 2; default = no)

Default philosophy: **BFF proxy — the backend owns data persistence, the Nuxt app does not access a database directly.** Only add Drizzle + D1 when the app genuinely needs server-side DB access.

When opted in (`WANT_DRIZZLE = yes`):
- `pnpm add drizzle-orm` + `pnpm add -D drizzle-kit @cloudflare/workers-types wrangler`
- `wrangler` is required to apply migrations to a D1 database (`wrangler d1 execute`) — `drizzle-kit migrate` alone only works against a local SQLite file.
- Writes `wrangler.toml` (D1 binding with `{D1_DATABASE_ID}` placeholder + `{COMPAT_DATE}` generated at scaffold time), `server/db/schema.ts`, `drizzle.config.ts`, and `db:generate` / `db:migrate` / `db:studio` scripts.

---

## Requirements

- **Node.js 22+** (Nuxt 4 minimum; active LTS recommended).
- **pnpm** (the only supported package manager for this stack).
- `nuxi module add` resolves **latest** versions (no pin). Document the tested `create-nuxt` / Node version; re-validate periodically.
