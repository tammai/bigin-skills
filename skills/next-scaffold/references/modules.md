# Modules — what gets installed

The preset is installed for every `template`. There is no optional-module menu — the scaffolder never installs a database driver or ORM, and the Next app never accesses a database directly; there is no DB opt-in.

Every template ships the **real pass-through wiring** — OpenNext on Cloudflare (`open-next.config.ts`, `wrangler.jsonc`, `preview`/`deploy` scripts), a `rewrites()` in `next.config.ts` forwarding `/api/v<digits>/**` to the server-only, build-time `API_ORIGIN`, a generated `openapi-fetch` client (`src/shared/api-client`), and the feature-folder structure with `eslint-plugin-boundaries` enforcement. There is no BFF: the app holds no token and no session store; the paired API owns the HttpOnly cookie session. Only `saas` additionally writes the login/signup UI + client `AuthGate` that use it (calling a **real** backend — `go-scaffold`; see `references/artifacts.md`'s `## saas opt-in`). For `starter`/`dashboard` no login flow exists until you add one.

---

## Preset (default — always installed)

### Provided by `create-next-app`, refreshed by Stage 1b

| npm package | Why |
| --- | --- |
| `next` (pinned 16.3.8), `react`, `react-dom` | The framework itself |
| `eslint` + `eslint-config-next` | Flat-config ESLint — the only formatter (no Prettier) |
| `tailwindcss` + `@tailwindcss/postcss` | Styling engine (Tailwind v4, CSS-first — no `tailwind.config.ts`) |
| `typescript` | TS project |

`create-next-app@16.3.8` installs whatever versions that release bundled at publish time — not necessarily current. `references/bootstrap.md` → Stage 1b immediately refreshes all of these per `VERSION_POLICY` — except `next` and `eslint-config-next`, which stay at 16.3.8 so a stale template snapshot never reaches the scaffolded app but OpenNext's verified `next` does.

The template also ships `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`.

### Stage 2 — preset packages + shadcn/ui

| Command | npm package | Why |
| --- | --- | --- |
| `pnpm add zustand` | `zustand` | Client state management — the direct analog of Pinia |
| `pnpm add @tanstack/react-query` | `@tanstack/react-query` | Async data (`useQuery`/`useMutation`) — Pinia Colada is itself modeled on this library |
| `pnpm add zod` | `zod` | Runtime schema validation (form input, API responses) |
| `pnpm add openapi-fetch` | `openapi-fetch` | Runtime typed API client (`src/shared/api-client`), calling the API through the same-origin `/api/v1` pass-through |
| `pnpm add @opennextjs/cloudflare@1.20.9` | `@opennextjs/cloudflare` | Builds the app for Cloudflare Workers (`opennextjs-cloudflare build/preview/deploy`) and gives `next.config.ts` its dev init; exact-pinned because it is only verified against `next` 16.3.8 |
| `pnpm add -D wrangler@^4` | `wrangler` | Runs the Worker locally (`pnpm preview`) and deploys it; OpenNext's peer range is `^4.125.0` |
| `pnpm add -D vitest` | `vitest` | Unit test runner |
| `pnpm add -D @vitejs/plugin-react` | `@vitejs/plugin-react` | JSX transform for Vitest (Vite-powered, not Next's own bundler) |
| `pnpm add -D jsdom` | `jsdom` | DOM implementation for `environment: 'jsdom'` — `pnpm test` fails without it |
| `pnpm add -D @testing-library/react` | `@testing-library/react` | `renderHook`/`render` for component + hook tests |
| `pnpm add -D @testing-library/jest-dom` | `@testing-library/jest-dom` | Extended matchers (`toBeInTheDocument()` etc.), wired via `vitest.setup.ts` |
| `pnpm add -D simple-git-hooks` | `simple-git-hooks` | Lightweight git hook manager (project commit gate) — needs `pnpm approve-builds simple-git-hooks` (Stage 4) on pnpm 10+ |
| `pnpm add -D lint-staged` | `lint-staged` | Run ESLint on staged files at commit |
| `pnpm add -D openapi-typescript` | `openapi-typescript` | Regenerates the committed client-types snapshot (`src/shared/api-client/schema.d.ts`) from `openapi.json` via `pnpm openapi:generate` |
| `pnpm add -D eslint-plugin-boundaries eslint-import-resolver-typescript` | `eslint-plugin-boundaries` + resolver | Enforce feature-folder boundaries in `eslint.config.mjs` (cross-`src/features/*` imports fail `pnpm lint`); the resolver is load-bearing — see `files/eslint.boundaries.mjs` |
| `npx shadcn@latest init` | `shadcn` (not a project dependency — always invoked via `npx`, same convention as `nuxi`) | Writes `components.json`, patches `globals.css`, copies `src/lib/utils.ts` |
| `npx shadcn@latest add button card tooltip [...]` | shadcn components (copied into `src/components/ui/`, not installed as a package) | `button`/`card`/`tooltip` (`BASE_BLOCKS`) every template needs — `tooltip` because `providers.tsx` wraps the app in `TooltipProvider` unconditionally; `dashboard`/`saas` add more on top — see `TEMPLATE_BLOCKS` in `scaffold.mjs` |

> `vite-tsconfig-paths` was deliberately **not** added — Vitest 4's own `resolve: { tsconfigPaths: true }` option resolves the `@/*` alias natively (verified live 2026-07-14), so no extra dependency is needed for the same result.

---

## Requirements

- **Node.js 20+** (Next.js 16 minimum; active LTS recommended).
- **pnpm** (the only supported package manager for this stack).
- Stage 1 resolves versions per `create-next-app@16.3.8`'s own pin, then Stage 1b refreshes per `VERSION_POLICY` (the `next` pair excepted). Re-verify Stage 1 behavior reactively if `create-next-app` or `shadcn` starts failing — not on a fixed schedule.
