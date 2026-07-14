# Artifacts — rationale & merge semantics

**File bodies live in `../scripts/templates/` — that directory is the source of truth**, consumed by `../scripts/scaffold.mjs` (`applyArtifacts()`). This doc keeps only the *why* and the merge rules; don't duplicate content here. Placeholder substituted by the script: `{PROJECT_NAME}`.

> Template-content assumptions (files/keys provided, App Router shape, `tsconfig.json` shape) were verified against a live `create-next-app@latest` run on 2026-07-14 (Next.js 16.2.10). Stage 1 runs it unpinned — re-verify if a future release changes the template and something starts failing lint/typecheck.

`create-next-app` already provides a working App Router app (`src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`). **Never overwrite those wholesale** — the script only patches specific spots (see below) and adds new files. New code follows the **BFF proxy** convention: `src/app/api/**/route.ts` is the sole caller of the backend; the browser calls same-origin `/api/*` only.

---

## Merged / patched files (never overwritten wholesale)

**`src/app/layout.tsx`** — the script inserts `import { Providers } from './providers'` at the top and wraps `<body>`'s children in `<Providers>` (the TanStack Query client, provided app-wide). Fails loudly if the `<body>` regex doesn't match rather than guessing an insertion point.

**`package.json`** (`templates/merge/package.json`) — `create-next-app` already provides `dev`/`build`/`start`/`lint`; kept (existing keys win). Adds `type-check` (`tsc --noEmit` — `create-next-app` doesn't ship this script by default), `test`/`test:watch`, `prepare`, plus `simple-git-hooks` + `lint-staged` blocks.

**`.claude/settings.json`** (`templates/merge/claude-settings.json`) — pre-approved commands + a `PostToolUse` hook running `lint-fix-file.mjs` after every Write/Edit/MultiEdit. **`PostToolUse` only — no `PreToolUse`**: `bigin-harness-setup` adds the `bash-guard.mjs` `PreToolUse` hook when it overlays governance later. Until then nothing gates git commands, so `git push` is deliberately **not** pre-approved (stays a per-call prompt); local reversible git commands are.

**`.vscode/settings.json`** (`templates/merge/vscode-settings.json`) — ESLint is the only formatter; Prettier disabled (`create-next-app` doesn't add Prettier by default anyway — this just makes the convention explicit and future-proof).

**`.gitignore`** — the script appends `.env` if missing (`create-next-app`'s default `.gitignore` already ignores `.env*`, so this is usually a no-op safety net, not a fix).

**`tsconfig.json`, `next.config.ts` — do not touch.** No known conflict with the BFF preset; if one appears, patch the specific key rather than regenerating the file.

**`eslint.config.mjs` — do not touch, except for the `dashboard` template.** The shadcn `dashboard-01` block's own shipped source (`src/hooks/use-mobile.ts`, `src/components/chart-area-interactive.tsx`) trips two `react-hooks` rules eslint-config-next 16 enables by default (React Compiler diagnostics, on regardless of whether the compiler itself is enabled — confirmed via a live scaffold run on 2026-07-14). This is vendored block code, not ours to rewrite, so the script inserts one scoped override object (`{ files: [...], rules: { 'react-hooks/set-state-in-effect': 'off' } }`) into the `defineConfig([...])` array right after the `...nextTs,` line, rather than disabling the rule project-wide or leaving `dashboard` scaffolds permanently lint-failing. `starter`/`saas` never touch this file.

**`components.json`** — written by `npx shadcn@latest init` in Stage 2, not by this stage. Left as the CLI wrote it (its `tailwind.baseColor` reflects the `nova` preset's default — see `bootstrap.md` Stage 2 for why there's no `baseColor` config option to plumb through here).

---

## Written-fresh files (`templates/files/`, safe to overwrite on resume — applied for every template)

- **`src/app/api/users/route.ts`** — sample **unauthenticated** BFF proxy route handler (no template wires auth unconditionally — see the `saas` opt-in below for the one that does). Demonstrates the proxy pattern: the browser only ever calls same-origin `/api/*`.
- **`src/hooks/queries/use-users.ts`** — sample TanStack Query hook (`userQueries.list` query options, wrapped in `useUsers`) against the same-origin BFF API, per the `hooks/queries/<domain>.ts` convention (the direct analog of Nuxt's `composables/queries/<domain>.ts`).
- **`src/hooks/queries/use-users.test.tsx`** — validates the whole Vitest + jsdom + React Testing Library + TanStack Query chain (fresh query is `'pending'` — TanStack Query has no `'idle'`, `useQuery` fires eagerly, same terminology as Pinia Colada). This is the *only* test file the base preset ships — without it `pnpm test` fails with "no test files found", so don't drop it without adding a replacement.
- **`src/app/providers.tsx`** — the `'use client'` component instantiating a `QueryClient` and wrapping children in `QueryClientProvider`; wired into `layout.tsx` by the patch above. `useState(() => new QueryClient())` (not a module-level singleton) so each request gets its own client under React Server Components / SSR.
- **`vitest.config.ts`** — `@vitejs/plugin-react` for JSX transform, `resolve: { tsconfigPaths: true }` for the `@/*` alias (Vite's native option — verified 2026-07-14 against a live Vitest 4.1.10 run; no separate `vite-tsconfig-paths` plugin dependency needed), `environment: 'jsdom'`. `test.include` is scoped to `src/**/*.test.{ts,tsx}`.
- **`vitest.setup.ts`** — imports `@testing-library/jest-dom/vitest` for the extended matchers (`toBeInTheDocument()` etc.) used by any future component test.
- **`.claude/guards/lint-fix-file.mjs`** — backs the PostToolUse hook. Identical to `nuxt-scaffold`'s copy (dependency-free, `eslint --fix` scoped to the single touched file) — deliberately not Vue/Nuxt-specific, reused verbatim.
- **`.env.example`** — documents `SESSION_PASSWORD` + `BACKEND_URL` (the latter only actually used by `users/route.ts` above; the former unused until a template wires auth — currently only `saas`).

## `starter` opt-in (`templates/starter/`, only when `template === 'starter'`)

- **`openapi.yaml`** — stub so `pnpm openapi-types` works before the real contract lands; replace it. Only describes `/users` (the one endpoint the base preset actually ships) — extend it alongside whatever real backend routes get added.
- **`merge/package.json`** — adds just the `openapi-types` script (merged, same `mergeJsonFile` mechanism as the base `merge/package.json`). Not applied to `dashboard`/`saas` — no backend contract to describe by default there either, but only `starter` ships the stub to point at.

## `saas` opt-in (`templates/saas/`, only when `template === 'saas'`)

A bare `create-next-app` has no auth, no login/signup pages, and no private area. This overlay adds a demo auth flow and a private `/dashboard` — **no real backend**, per explicit request; swap the two demo endpoints for real ones before shipping:

- **`src/app/login/page.tsx`**, **`src/app/signup/page.tsx`** — hand-authored client components using the `button`/`input`/`label`/`card` shadcn primitives (not the `login-03` block — see `bootstrap.md` Stage 1 for why). Client-side zod validation mirrors the server-side schema; `onSubmit` posts to `/api/login` / `/api/signup` and redirects to `/dashboard`.
- **`src/proxy.ts`** — the single-file Next equivalent of Nuxt's two-file split (`app/middleware/auth.global.ts` + `server/middleware/auth.ts`): only `/dashboard/**` requires a session (redirects to `/login`); an already-logged-in user hitting `/login` or `/signup` is redirected to `/dashboard`. Named `proxy.ts`/`export function proxy()`, not `middleware.ts`/`middleware()` — Next.js 16 deprecated the `middleware` file convention in favor of `proxy` (confirmed live against `nextjs.org/docs/messages/middleware-to-proxy` on 2026-07-14, surfaced as a build warning during this skill's own verification run); re-verify if a future Next release removes the old name's fallback entirely. Reads the sealed cookie via `iron-session`'s `unsealData()` directly (not `getIronSession()` — that needs a read/write cookie store; the proxy only ever reads and redirects, all writes happen in the route handlers below) so it works on the Edge runtime without a documented `getIronSession()` overload for this file.
- **`src/app/dashboard/page.tsx`** — the private page itself (server component, reads the session directly, `redirect('/login')` if absent). Deliberately built from plain shadcn `Card` primitives rather than the `dashboard-01` block's internals — this template's private area is a demo auth destination, not an admin shell (that's what the separate `dashboard` template is for).
- **`src/app/dashboard/logout-button.tsx`** — client component posting to `/api/logout` then redirecting home.
- **`src/app/api/login/route.ts`**, **`src/app/api/signup/route.ts`** — zod-validate the body, then set `session.user` and `session.save()` directly — **no backend call**. This is the one deliberate deviation from the BFF-proxy convention everywhere else in this skill; both files carry a comment marking it as a stand-in.
- **`src/app/api/me/route.ts`** — returns `session.user` directly (401 if absent) — no backend proxy, unlike the `starter` template's sample route.
- **`src/app/api/logout/route.ts`** — `session.destroy()`.
- **`src/lib/session.ts`** — `getSession()` wraps `getIronSession()` with `cookies()` from `next/headers` (the App Router API, verified against `iron-session` 8.0.4 on 2026-07-14). Reads `SESSION_PASSWORD` lazily inside the function, not at module load — a missing env var must fail at request time, not break `next build`/`pnpm lint` for every route that happens to import this module.
