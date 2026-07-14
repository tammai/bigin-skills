# Modules — what gets installed

The BFF preset is installed for every `template`. There is no optional-module menu — the scaffolder never installs a database driver or ORM. BFF is a proxy layer only — the Next app never accesses a database directly; there is no DB opt-in.

Installing `iron-session` doesn't mean a template ships an auth *flow* — only `saas` writes a sample login/session/dashboard implementation (a demo one, not backend-proxied; see `references/artifacts.md`'s `## saas opt-in`). For `starter` and `dashboard`, the package is present but unused until hand-wired.

---

## BFF Preset (default — always installed)

### Provided by `create-next-app`, refreshed by Stage 1b

| npm package | Why |
| --- | --- |
| `next`, `react`, `react-dom` | The framework itself |
| `eslint` + `eslint-config-next` | Flat-config ESLint — the only formatter (no Prettier) |
| `tailwindcss` + `@tailwindcss/postcss` | Styling engine (Tailwind v4, CSS-first — no `tailwind.config.ts`) |
| `typescript` | TS project |

`create-next-app` installs whatever versions the resolved `create-next-app@latest` release bundled at publish time — not necessarily current. `references/bootstrap.md` → Stage 1b immediately refreshes all of these per `VERSION_POLICY`, so a stale template snapshot never reaches the scaffolded app.

The template also ships `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`.

### Stage 2 — BFF preset packages + shadcn/ui

| Command | npm package | Why |
| --- | --- | --- |
| `pnpm add zustand` | `zustand` | Client state management — the direct analog of Pinia |
| `pnpm add @tanstack/react-query` | `@tanstack/react-query` | Async data (`useQuery`/`useMutation`) — Pinia Colada is itself modeled on this library |
| `pnpm add zod` | `zod` | Runtime schema validation (validate backend responses in API routes, request bodies) |
| `pnpm add iron-session` | `iron-session` | Sealed session cookie helpers — the only auth path; direct analog of `nuxt-auth-utils` |
| `pnpm add -D vitest` | `vitest` | Unit test runner |
| `pnpm add -D @vitejs/plugin-react` | `@vitejs/plugin-react` | JSX transform for Vitest (Vite-powered, not Next's own bundler) |
| `pnpm add -D jsdom` | `jsdom` | DOM implementation for `environment: 'jsdom'` — `pnpm test` fails without it |
| `pnpm add -D @testing-library/react` | `@testing-library/react` | `renderHook`/`render` for component + hook tests |
| `pnpm add -D @testing-library/jest-dom` | `@testing-library/jest-dom` | Extended matchers (`toBeInTheDocument()` etc.), wired via `vitest.setup.ts` |
| `pnpm add -D simple-git-hooks` | `simple-git-hooks` | Lightweight git hook manager (project commit gate) — needs `pnpm approve-builds simple-git-hooks` (Stage 4) on pnpm 10+ |
| `pnpm add -D lint-staged` | `lint-staged` | Run ESLint on staged files at commit |
| `pnpm add -D openapi-typescript` [`starter` only] | `openapi-typescript` | Generate API types from `openapi.yaml` — only `starter` ships the stub contract + script that use it, so it's not installed for `dashboard`/`saas` |
| `npx shadcn@latest init` | `shadcn` (not a project dependency — always invoked via `npx`, same convention as `nuxi`) | Writes `components.json`, patches `globals.css`, copies `src/lib/utils.ts` |
| `npx shadcn@latest add button card tooltip [...]` | shadcn components (copied into `src/components/ui/`, not installed as a package) | `button`/`card`/`tooltip` (`BASE_BLOCKS`) every template needs — `tooltip` because `providers.tsx` wraps the app in `TooltipProvider` unconditionally; `dashboard`/`saas` add more on top — see `TEMPLATE_BLOCKS` in `scaffold.mjs` |

> `vite-tsconfig-paths` was deliberately **not** added — Vitest 4's own `resolve: { tsconfigPaths: true }` option resolves the `@/*` alias natively (verified live 2026-07-14), so no extra dependency is needed for the same result.

---

## Requirements

- **Node.js 20+** (Next.js 16 minimum; active LTS recommended).
- **pnpm** (the only supported package manager for this stack).
- Stage 1 resolves versions per `create-next-app@latest`'s own pin, then Stage 1b refreshes per `VERSION_POLICY`. Re-verify Stage 1 behavior reactively if `create-next-app` or `shadcn` starts failing — not on a fixed schedule.
