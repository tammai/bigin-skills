# Epic: Drop the BFF for API-owned cookie sessions

Status: approved
Approved: 2026-10-07

## Goal

nuxt-scaffold and next-scaffold stop shipping a token-holding BFF proxy. Browsers reach the Go API
only through a same-origin pass-through (`/api/v*/**` on the app's own domain), and the API owns the
web session as an HttpOnly `__Host-session` cookie backed by a server-side `sessions` table; Flutter
keeps Bearer JWT + refresh. Done when both scaffolds produce apps with no BFF code, go-scaffold serves
both auth modes, project-scaffold wires the domains together, and existing BFF apps have a migration
guide. Design: `docs/design/drop-bff.md`.

## Constraints

- No SSR, ever — `ssr: false` is a scaffold default, not an option.
- Web app and API live on different domains, possibly cross-site. Browsers reach the API only through the app's own `/api/*` pass-through; Flutter calls the API directly with Bearer.
- The pass-through holds no tokens and no logic — path allowlist and header policy only, as framework config where possible.
- No patch blocks for the profile-nuxt / profile-next rewrites: a scaffolded repo still runs its BFF, so its rules must keep describing one. Existing repos move via the migration guide.
- Each unit ships as its own release. Units 3 and 5 are minor bumps and sweep every manual surface their change makes stale.
- Next pairs with Go, like Nuxt.

## Units

| # | Unit | Acceptance | Blocked by | Status | Notes |
|---|------|-----------|------------|--------|-------|
| 0 | Spike: pass-through on local Cloudflare tooling | Scratch Nuxt (cloudflare preset, `routeRules` proxy) and scratch Next (`@opennextjs/cloudflare`, `rewrites`) under `wrangler dev` against a stub API: `Set-Cookie` lands first-party on the app domain, the cookie is sent back on the next request, a streamed response stays streamed, paths outside `/api/v*/` 404. Results recorded in `docs/design/drop-bff.md`; no skill changes | — | Done | Nuxt `routeRules` proxy buffers SSE and can't express the `v<digits>` allowlist → catch-all handler instead (unit 3 amended); Next pins next@16.3.8 for OpenNext 1.20.9; API must trust no X-Forwarded-*; edge client IP unverified (unit 2); `__Host-` needs HTTPS locally (unit 1). Details: design doc § Spike results |
| 1 | go-scaffold: cookie sessions + CSRF | `sessions` table; create/read/delete-current-session endpoints set/clear `__Host-session` (HttpOnly, Secure, SameSite=Lax, sliding expiry); cookie-authenticated mutations rejected unless `Origin` ∈ `WEB_ORIGINS`; Bearer JWT path unchanged and tested; `openapi.yaml` updated | — | Done | Shipped v1.107.0 (c52cec3). Endpoints are `POST`/`DELETE /api/v1/auth/session` — the API's BaseURL is `/api/v1`, so pass-throughs forward `/api/v1/...` verbatim, nothing stripped (units 3, 5). `CORS_ORIGINS=*` now refuses boot; CORS and CSRF share `NormalizeOrigin`. Deferred: fold the 2-query session lookup into one JOIN; warn (not silently drop) invalid `CORS_ORIGINS` entries |
| 2 | go-scaffold: client IP behind Cloudflare | Client IP from `CF-Connecting-IP` only when `TRUSTED_PROXY` is set, otherwise `RemoteAddr`; a spoofed header is ignored, covered by tests; `X-Forwarded-For` / `X-Forwarded-Host` are never trusted; the `CF-Connecting-IP` rule is confirmed against Cloudflare's docs for Worker subrequests and recorded | — | Done | Shipped v1.108.0 (uncommitted at close). `gin.Default()` trusted all proxies, so rotating `X-Forwarded-For` bypassed the rate limiter — now `SetTrustedProxies(nil)`; `TRUSTED_PROXY=cloudflare` reads a validated `CF-Connecting-IP`. Cross-zone Worker subrequests carry `2a06:98c0:3600::103`, so the pass-through can't deliver the real client IP via that header — units 3, 5, 6 must address it |
| 3 | Nuxt: nuxt-scaffold + profile-nuxt | BFF files and `nuxt-auth-utils` removed; a catch-all `server/routes/api/[...path].ts` (~8 lines, no tokens) passes `^/api/v\d+/` to the server-only `NUXT_API_ORIGIN`, streams the response through, and returns a JSON 404 for anything else; `ssr: false` + cloudflare preset; `apiClient` → `/api` with credentials; saas login/signup use unit 1's endpoints; `profile-nuxt` rewritten (clears audit finding 9); `regress.mjs --build` green | 0, 1 | Done | Shipped v1.109.0 (2a25c7f). Current-user read is `GET /api/v1/user/profile` (go-scaffold has no `GET /auth/session`); signup is `POST /api/v1/auth/signup` then login. `nuxt-og-image` dropped from saas/docs/portfolio (`ssr:false` removes `defineOgImage`) — unit 5 should check Next for the same. Client IP: per-egress limiting accepted and documented in the scaffold; unit 5 repeats that note, unit 6 documents the polyrepo-level fix. `openapi.yaml` stays a placeholder; replacement needs `baseURL: '/api/v1'`. Review skipped |
| 4 | Next: pair with Go (BFF kept) | `openapi.json` snapshot replaced by Go's contract; Fastify-isms (trailing slashes, `Idempotency-Key`, `skipTrailingSlashRedirect`) removed; saas works against Go through the existing BFF | — | Not started | |
| 5 | Next: next-scaffold + profile-next | Proxy, `iron-session` and Next auth routes removed; `rewrites` passes `/api/v*/**` through; `@opennextjs/cloudflare` with `next` pinned to 16.3.8; `rewrites` uses `/api/v:ver(\\d+)/:path*`; saas uses unit 1's endpoints; `profile-next` rewritten | 0, 1, 4 | Not started | |
| 6 | Polyrepo + project-scaffold + migration guide | project-scaffold wires `WEB_ORIGINS` / `NUXT_API_ORIGIN` across the repos it creates; polyrepo standard documents the Cloudflare routing and optional Tunnel; `docs/migrating-off-bff.md` written and linked from README; final stale-docs sweep (USER_GUIDE, README prose, site) | 3, 5 | Not started | |

Units 0, 1, 2 and 4 have no `Blocked by` between them; run sequentially by choice.

## Not in scope

- Fixing audit findings 1–8 inside the BFF templates being removed
- Cookie sessions for Fastify (`nodejs-scaffold`)
- Automated migration of existing BFF apps
- SSR

## Amendments

- **2026-10-07 — amendment 1/2, after unit 0's spike.** Rows 3 and 6: Nitro `routeRules` proxy buffers SSE and can't express the `v<digits>` allowlist → catch-all handler; the origin env var becomes server-only `NUXT_API_ORIGIN` (a `NUXT_PUBLIC_*` value ships to the browser and would expose the API domain). Row 5: pin next@16.3.8 (16.4.0 + OpenNext 1.20.9 500s). Row 2: client `X-Forwarded-*` reach the API untouched; edge `CF-Connecting-IP` unverified locally.
