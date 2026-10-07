# Plan: next-scaffold drops the BFF for an OpenNext/Cloudflare /api pass-through

Status: approved
Branch: main

## Spec

**What:** next-scaffold stops holding tokens. Every template: `next.config.ts` `rewrites()` maps `/api/v:ver(\d+)/:path*` → `${API_ORIGIN}/api/v:ver/:path*` (anything else under `/api/*` → Next 404; `API_ORIGIN` server-only, no `NEXT_PUBLIC_`); `@opennextjs/cloudflare@1.20.9` + `wrangler`, `open-next.config.ts`, `wrangler.jsonc`, `preview`/`deploy` scripts, `initOpenNextCloudflareForDev()` in config; `next` pinned exactly `16.3.8`. Stage 1 pins `create-next-app@16.3.8` (should also clear the `@tailwindcss/turbopack` break; `TEMPLATE_PKGS` stays `@tailwindcss/postcss`); stage 1b must not re-bump `next`, even under `versionPolicy: latest`. Client: `apiClient` baseUrl `/api/v1`, `credentials: 'include'`, path keys unchanged (`/user/profile`…). Removed: `iron-session`, `src/lib/{session,csrf,backend}.ts`, BFF proxy route + test, `src/proxy.ts`, `SESSION_PASSWORD`, `BACKEND_URL`, saas `api/{login,signup,logout,me}` routes; `auth-errors.ts` stays only if pages still use it.

**saas:** login page `POST /api/v1/auth/session`, logout `DELETE` it, signup `POST /api/v1/auth/signup` then login, all `credentials: 'include'`. Dashboard becomes a client component using `useProfile`; a client `AuthGate` redirects to `/login` on 401 from `GET /api/v1/user/profile`; login/signup redirect to `/dashboard` when the profile read succeeds. No server-side route protection (no-SSR stance).

**profile-next.md** rewritten to describe this shape; `use-users` examples → `use-profile`; no CHANGELOG patch block.

**Version/sweep:** minor bump v1.110.0 across the four manifest fields; sweep every stale manual surface (README prose, USER_GUIDE, docs/, site/src/pages prose, CLAUDE.md Structure tree, next-scaffold SKILL.md + references/*, both marketplace.json), CHANGELOG entry.

**Inputs/outputs:** Browser → `/api/v1/**` → Next rewrite → Go API. `Set-Cookie`/`Cookie` pass through; cookie first-party to the app domain.

**Edge cases:** Next bakes rewrite destinations at build time, so `API_ORIGIN` must be set when `next build` runs — verify how OpenNext resolves it and document in README and `.env.example`. Next strips trailing slash before forwarding; Go has no trailing-slash routes, fine. Unset `API_ORIGIN` → `next.config.ts` fails the build with a clear message. `nuxt-og-image` does not apply to Next.

**Client IP:** same as unit 3 — behind the pass-through the API sees the Worker egress address, users share one rate-limit bucket; README and `.env.example` document it; visitor-IP forwarding left out (needs a go-scaffold change).

**Security considerations:** No token stored/readable by JS; cookie HttpOnly, set by the API. CSRF moves to the API (SameSite=Lax + `WEB_ORIGINS`). The rewrite pattern is the only allowlist; `\d+` must keep `/api/v1x`, `/api/v/…`, encoded traversal out. `API_ORIGIN` never reaches the client bundle. Client `X-Forwarded-*` reaches the API untouched; the API ignores it (unit 2).

**Testing strategy:** unit tests for saas pages and `AuthGate` redirects, and for `apiClient` credentials/baseUrl; a test parsing `next.config.ts` for the `v:ver(\d+)` rewrite shape and the missing-`API_ORIGIN` failure; a real saas scaffold through `scaffold.mjs` passes lint, type-check, tests (acceptance — `--build` doesn't build next-scaffold); if feasible a `wrangler dev`/OpenNext preview against a stub API checking `Set-Cookie` and 404 on `/api/other` (reuse unit 0's setup); `node tools/regress.mjs`; gates docs_sync/site_build/budget; stale-ref grep for `iron-session`, `SESSION_PASSWORD`, `BACKEND_URL`, `/api/backend`.

**Not in scope:** go-scaffold changes; nuxt-scaffold; unit 6 (polyrepo, project-scaffold, migration guide); a patch block for already-scaffolded Next repos; vinext; `next` above 16.3.8.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | scaffold.mjs: pin create-next-app@16.3.8 and next 16.3.8 (stage 1b safe under `latest`); OpenNext/wrangler deps, `open-next.config.ts`, `wrangler.jsonc`, scripts, next.config rewrites + dev init + missing-origin failure; drop iron-session | Done | |
| 2 | Remove BFF files (session/csrf/backend libs, proxy route + test, `src/proxy.ts`); `apiClient` → `/api/v1` with credentials; `.env.example` (`API_ORIGIN`, client-IP note) | Done | |
| 3 | saas: remove server auth routes; pages use unit 1 endpoints; client dashboard + `AuthGate`; tests (pages, AuthGate, apiClient, next.config rewrite shape) | Done | |
| 4 | Rewrite `profile-next.md`; update next-scaffold SKILL.md, references, evals | Done | |
| 5 | Minor bump v1.110.0 + CHANGELOG; sweep every stale manual surface | Done | |
| 6 | Run regress.mjs, gates, real saas scaffold lint+type-check+tests, OpenNext preview check if feasible, stale-ref grep | Done | |

Coverage: spec requirements → rows 1–5; testing/gates → row 6.

## Review

Declined by the user (code-review and security-review skipped).
