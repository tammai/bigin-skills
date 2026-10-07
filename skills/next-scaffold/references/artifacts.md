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

**`tsconfig.json` — do not touch.** No known conflict with the BFF preset; if one appears, patch the specific key rather than regenerating the file.

**`eslint.config.mjs` — patched (all templates + one dashboard-only extra).** All templates: the script adds `import { boundariesConfig } from "./eslint.boundaries.mjs"` and spreads `boundariesConfig` into the `defineConfig([...])` array after the `...nextTs,` line, wiring `eslint-plugin-boundaries` so the feature-folder structure is a real, lint-enforced boundary (config body lives in the shipped `files/eslint.boundaries.mjs`). `dashboard` only: the shadcn `dashboard-01` block's own shipped source (`src/hooks/use-mobile.ts`, `src/components/chart-area-interactive.tsx`) trips two `react-hooks` rules eslint-config-next 16 enables by default (React Compiler diagnostics — confirmed via a live scaffold run on 2026-07-14), so a second scoped override object (`{ files: [...], rules: { 'react-hooks/set-state-in-effect': 'off' } }`) is inserted after the same `...nextTs,` anchor (both patches survive because the anchor is preserved). This is vendored block code, not ours to rewrite.

**`components.json`** — written by `npx shadcn@latest init` in Stage 2, not by this stage. Left as the CLI wrote it (its `tailwind.baseColor` reflects the `nova` preset's default — see `bootstrap.md` Stage 2 for why there's no `baseColor` config option to plumb through here).

---

## Written-fresh files (`templates/files/`, safe to overwrite on resume — applied for every template)

The base preset ships the **real BFF wiring** for every template: a catch-all backend proxy, a generated typed API client, and the feature-folder structure. Only the `saas` overlay adds the auth *UI* + routes on top (see below).

- **`src/app/api/backend/[...path]/route.ts`** — the **catch-all BFF backend proxy** (GET/POST/PUT/PATCH/DELETE), the single mechanism the browser uses to reach the backend. Unseals the session cookie, attaches `Authorization: Bearer <access_token>`, and forwards to `${BACKEND_URL}<path>` as a *version-agnostic passthrough* (the incoming path after `/api/backend`, e.g. `/api/v1/user/profile`, is forwarded verbatim — the API version lives in the path, not this file, and the generated client's `baseUrl` plus path keys line up 1:1 with what the backend serves; Next's default 308 trailing-slash strip is correct because go-scaffold has no trailing-slash routes). Implements the ADR §7.3 401→refresh→retry-once flow (on a backend 401, refresh via the session's refresh token, save the new pair, retry once; if refresh fails, destroy the session and return 401). Rejects cross-site mutating requests (403) via a `Sec-Fetch-Site`/`Origin` same-origin check (CSRF defense, ADR §7). Replaces the old unauthenticated `api/users/route.ts` sample.
- **`src/app/api/backend/[...path]/route.test.ts`** — Vitest coverage of the proxy: Bearer attachment + verbatim forward, 401→exactly-one-refresh→retry, refresh-failure clears session + returns 401, and CSRF 403 on a cross-site mutation. Mocks `@/lib/session` and stubs `global.fetch` (the refresh call runs its real code against the fetch stub).
- **`src/features/users/hooks/use-profile.ts`** — sample TanStack Query hook (`userQueries.profile` wrapped in `useProfile`), calling the generated `openapi-fetch` client (`apiClient.GET('/user/profile')` — go-scaffold has no public user list) through the proxy — not a hand-written `fetch()`. The `User` type is derived from the generated contract, not hand-maintained. Lives under `src/features/<feature>/hooks/` per ADR §5.1.
- **`src/features/users/hooks/use-profile.test.tsx`** — validates the Vitest + jsdom + React Testing Library + TanStack Query chain (fresh query is `'pending'` — TanStack Query has no `'idle'`, `useQuery` fires eagerly).
- **`src/shared/api-client/index.ts`** — the `openapi-fetch` client instance, `baseUrl: '/api/backend/api/v1'` (the same-origin proxy plus go-scaffold's `/api/v1` base path, **never** `BACKEND_URL` — the browser never holds a token or the backend URL; if the backend's `middleware.BaseURL` changes, `baseUrl` and `API_PREFIX` in `backend.ts` change together).
- **`src/shared/api-client/schema.d.ts`** — committed pre-generated `openapi-typescript` snapshot of the backend contract (see `openapi.json` below). Regenerate with `pnpm openapi:generate`.
- **`src/lib/session.ts`** — `getSession()` wraps `getIronSession()` with `cookies()` from `next/headers`. `SessionData` carries `user?: {id?, email, full_name?, role?}` (the backend's `User` field names) **and** `tokens?: {access_token, refresh_token}` (the token pair the proxy replays; the backend's `TokenResponse` carries no expiry, so refresh is reactive — 401 → refresh → retry). Reads `SESSION_PASSWORD` lazily inside the function, not at module load, so a missing env var fails at request time rather than breaking `next build`/`pnpm lint`. **Moved here from the `saas` overlay** so the proxy (base) can read it in every template.
- **`src/lib/backend.ts`** — server-only backend HTTP helpers (`backendLogin`/`backendRefresh`/`backendSignup`/`backendLogout` + a `BackendError` that carries the status but never forwards the raw backend body to the browser; the backend's error body is `{ "error": "<message>" }` with no code, so callers branch on status). `backendLogin` returns the token pair plus the `user` from `LoginResponse`. Calls go to `${BACKEND_URL}/api/v1/auth/{login,refresh,signup,logout}`. Used by the proxy's refresh step and (in `saas`) the auth routes.
- **`openapi.json`** — the committed backend-contract snapshot the client types are generated from (go-scaffold's `openapi.yaml` converted to JSON, title replaced by a placeholder). Re-convert it when go-scaffold's contract changes, or point it at your own backend's contract, then run `pnpm openapi:generate`.
- **`eslint.boundaries.mjs`** — the `eslint-plugin-boundaries@7` flat-config body (elements: `feature`/`shared`/`lib`/`app`; policies blocking cross-feature imports; `import/resolver.typescript` is load-bearing). Spread into `eslint.config.mjs` by the patch above. Tests exempt.
- **`src/app/providers.tsx`** — the `'use client'` component instantiating a `QueryClient` and wrapping children in `QueryClientProvider`; wired into `layout.tsx` by the patch above. `useState(() => new QueryClient())` (not a module-level singleton) so each request gets its own client under React Server Components / SSR.
- **`vitest.config.ts`** — `@vitejs/plugin-react` for JSX transform, `resolve: { tsconfigPaths: true }` for the `@/*` alias, `environment: 'jsdom'`, `test.include` scoped to `src/**/*.test.{ts,tsx}`.
- **`vitest.setup.ts`** — imports `@testing-library/jest-dom/vitest` for the extended matchers.
- **`.claude/guards/lint-fix-file.mjs`** — backs the PostToolUse hook. Identical to `nuxt-scaffold`'s copy, reused verbatim.
- **`.env.example`** — documents `SESSION_PASSWORD` + `BACKEND_URL`, **both used by every template now** (the proxy uses `BACKEND_URL`; `SESSION_PASSWORD` seals the session the proxy reads).

The base `merge/package.json` adds the `openapi:generate` script (`openapi-typescript openapi.json -o src/shared/api-client/schema.d.ts`) for every template — there is no longer a `starter`-only overlay (the base ships a real contract snapshot instead of a stub).

## `saas` opt-in (`templates/saas/`, only when `template === 'saas'`)

A bare `create-next-app` has no auth, no login/signup pages, and no private area. This overlay adds a **real-backend** auth flow and a private `/dashboard` on top of the base BFF wiring. It calls the paired backend (`go-scaffold`) directly, server-side, via `src/lib/backend.ts`; the returned token pair is sealed into the session and replayed by the base proxy on authenticated data calls.

- **`src/app/login/page.tsx`**, **`src/app/signup/page.tsx`** — hand-authored client components using the `button`/`input`/`label`/`card` shadcn primitives (not the `login-03` block — see `bootstrap.md` Stage 1 for why). Client-side zod validation mirrors the server-side schema; `onSubmit` posts to `/api/login` / `/api/signup` and redirects to `/dashboard`.
- **`src/proxy.ts`** — Next request middleware (route protection), **distinct from the base BFF backend proxy** (`app/api/backend/[...path]`). Only `/dashboard/**` requires a session (redirects to `/login`); an already-logged-in user hitting `/login` or `/signup` is redirected to `/dashboard`. Named `proxy.ts`/`export function proxy()`, not `middleware.ts`/`middleware()` — Next.js 16 deprecated the `middleware` file convention in favor of `proxy` (confirmed live on 2026-07-14). Reads the sealed cookie via `iron-session`'s `unsealData()` directly (Edge-runtime safe) and checks `Boolean(user)`.
- **`src/app/dashboard/page.tsx`** — the private page itself (server component, reads the session directly, `redirect('/login')` if absent). Built from plain shadcn `Card` primitives — this template's private area is an auth destination, not an admin shell (that's the separate `dashboard` template).
- **`src/app/dashboard/logout-button.tsx`** — client component posting to `/api/logout` then redirecting home.
- **`src/app/api/login/route.ts`** — zod-validates the body, calls `backendLogin` (`POST ${BACKEND_URL}/api/v1/auth/login`), stores the returned token pair + the `user` from the response in the session. On a backend 4xx, returns a **clean** `{ error: { code, message } }` (never the raw backend body); a 401 is the expected bad-credentials case.
- **`src/app/api/signup/route.ts`** — calls `backendSignup` (`POST ${BACKEND_URL}/api/v1/auth/signup` with `full_name`/`email`/`password`, which does **not** log you in) then immediately `backendLogin` with the same credentials to obtain the token pair, then saves the session. 409 (email taken) / 400 (the backend's validation status) surface as clean client errors.
- **`src/app/api/logout/route.ts`** — best-effort `backendLogout` (`POST /api/v1/auth/logout` with the refresh token in the body), then `session.destroy()` **regardless** of the backend call's outcome — local logout must always succeed even if the backend is slow/down.
- **`src/app/api/me/route.ts`** — returns `session.user` directly (401 if absent).
- (`src/lib/session.ts` and `src/lib/backend.ts` are base files now — see the written-fresh section above — not saas-only.)
