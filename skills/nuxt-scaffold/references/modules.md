# Modules — what gets installed

The BFF preset is installed for every `template` (`starter` and every cloned template alike — see `references/bootstrap.md`'s "Stage 1 (cloned templates)" section for how `@pinia/nuxt`/`nuxt-auth-utils`/`@vueuse/nuxt` get added and registered on the clone path). There is no optional-module menu — the scaffolder never installs `@nuxt/image` or `@nuxt/content`. BFF is a proxy layer only — the Nuxt app never accesses a database directly; there is no DB opt-in.

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
| `pnpm add -D openapi-typescript` [`starter` only] | `openapi-typescript` | Generate server API types from `openapi.yaml` — only `starter` ships the stub contract + script that use it, so it's not installed for the other 8 templates |

> **Already installed as dependencies of `@nuxt/ui`** (no need to add): `@nuxt/icon`, `@nuxt/fonts`, `@nuxtjs/color-mode`. They register automatically when `@nuxt/ui` is installed.

---

## Requirements

- **Node.js 22+** (Nuxt 4 minimum; active LTS recommended).
- **pnpm** (the only supported package manager for this stack).
- Stage 1 resolves versions per `create-nuxt@latest`'s own pin, then Stage 1b refreshes per `VERSION_POLICY`. Re-verify Stage 1 behavior reactively if `create-nuxt` starts failing — not on a fixed schedule.
