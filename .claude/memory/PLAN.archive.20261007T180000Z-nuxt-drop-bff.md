# Plan: Nuxt scaffold drops the BFF for a tokenless /api pass-through

Status: approved
Branch: main

## Spec

**What:** `nuxt-scaffold` stops shipping a token-holding BFF. Every template gets: a catch-all `server/routes/api/[...path].ts` (replacing `server/api/backend/[...path].ts`) forwarding only `^/api/v\d+(/|$)` to the server-only `NUXT_API_ORIGIN` via `fetch` (`duplex:'half'`, `redirect:'manual'`), returning the upstream `Response` unbuffered, JSON 404 `{error:{code:'not_found',…}}` for any other `/api/*` path, no tokens; `ssr: false` + `cloudflare_module` Nitro preset; `apiClient = $fetch.create({ baseURL: '/api', credentials: 'include' })` (paths stay `/v1/...`). Removed: `nuxt-auth-utils`, `server/utils/{proxy,backend}.ts`, `server/middleware/csrf.ts`, `shared/types/session.d.ts`, `tests/server/proxy.test.ts`, `NUXT_SESSION_PASSWORD`, `NUXT_BACKEND_URL`, the `runtimeConfig.backendUrl` merge in `scaffold.mjs`. `saas` loses `server/api/{login,signup,logout,me}`, `server/utils/auth-flow.ts`, `server/middleware/auth.ts`; its pages call `POST /api/v1/auth/session` (login), `DELETE /api/v1/auth/session` (logout), the existing signup endpoint, `GET /api/v1/auth/session` (current user); `app/middleware/auth.global.ts` redirects to `/login` on a 401 from that GET. `profile-nuxt.md` rewritten (clears audit finding 9). Docs/manifests updated: SKILL.md, references/*, scaffold.mjs next-steps text, evals, README, USER_GUIDE, site pages, CHANGELOG. Minor bump to v1.109.0.

**Inputs/outputs:** Browser → `/api/v1/**` → API; `Set-Cookie`, `Cookie`, `x-request-id` pass through unchanged. `NUXT_API_ORIGIN` (server-only, in `.env.example`) required; unset → JSON 502 `upstream_not_configured`. All request headers forwarded except `host`.

**Client IP (unit 2 handoff):** accept per-egress limiting for now. Behind the pass-through the API sees the Worker egress address (`2a06:98c0:3600::103`), so all browser users share one rate-limit bucket. The scaffold forwards no `X-Forwarded-*`/`CF-Connecting-IP` and sets no `TRUSTED_PROXY`. Scaffold README and `.env.example` say so plainly and name the future fix (forward visitor IP in a header the API is configured to trust, origin locked to the Worker). That fix needs a go-scaffold change and is out of scope.

**Edge cases:** `/api`, `/api/`, `/api/v/x`, `/api/v1x/…`, `/api/vX/…`, `/api/%2e%2e/…`, repeated-slash/`..` paths normalizing outside `/api/v\d+/` → 404. Trailing slash forwarded as written. Upstream 5xx/network error → JSON 502, no upstream body or URL leaked. Redirects not followed. Large/streamed bodies and SSE never buffered. Templates already setting `ssr` or a Nitro preset handled by the existing nuxt.config.ts merge.

**Security considerations:** The allowlist is the only access control; the regex runs against the decoded, normalized path so encoded traversal can't reach other upstream paths. Upstream URL = `NUXT_API_ORIGIN` + validated path + client query string, no other client input. `NUXT_API_ORIGIN` never in public runtimeConfig (no `NUXT_PUBLIC_*`). No token stored/readable by JS; cookie HttpOnly, set by the API. CSRF moves to the API (SameSite=Lax + `WEB_ORIGINS`, unit 1); scaffold `csrf.ts` removed. `Host` never forwarded; API trusts no `X-Forwarded-*`; client `CF-Connecting-IP` reaches the API untouched but is only read when `TRUSTED_PROXY` is set, which the scaffold doesn't set.

**Testing strategy:** Vitest unit tests for the handler: allowlist and every edge-case path above, header passthrough (`Set-Cookie` intact, `host` not forwarded), unbuffered streaming, 502, unset origin. saas auth-flow tests replaced by tests that pages call the unit-1 endpoints. `node tools/regress.mjs` for the scaffolder group; `node tools/regress.mjs --build` as the acceptance check. Gates: docs_sync --check, site_build --check, budget gate, grep sweep for stale `backend`/`nuxt-auth-utils`/`NUXT_SESSION_PASSWORD`/`NUXT_BACKEND_URL`.

**Not in scope:** units 4–6 (Next, polyrepo/project-scaffold wiring, migration guide); any go-scaffold change incl. forwarding visitor IP; `nuxt-marketing-scaffold`; a patch block for already-scaffolded Nuxt repos; local-HTTPS setup beyond a README note; refreshing `openapi.yaml` unless stale vs go-scaffold.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Templates: new pass-through handler + tests; delete BFF files (proxy/backend utils, csrf, session types, old handler/test); apiClient → `/api` with credentials; `.env.example` | Done | |
| 2 | scaffold.mjs: drop nuxt-auth-utils and backendUrl merge; add `ssr:false` + cloudflare preset merge; `NUXT_API_ORIGIN`; next-steps text incl. client-IP note | Done | |
| 3 | saas template: remove server auth routes/utils/middleware; pages and `auth.global.ts` use `/api/v1/auth/session` endpoints; replace tests | Done | |
| 4 | Rewrite `profile-nuxt.md`; update nuxt-scaffold SKILL.md, references, evals | Done | |
| 5 | Sweep manual surfaces (README, USER_GUIDE, site pages, docs, CLAUDE.md Structure if needed); bump 1.109.0 across manifests; CHANGELOG | Done | |
| 7 | Drop `nuxt-og-image` and its `defineOgImage` calls from saas/docs/portfolio (and any other template shipping it); verify real saas/docs/portfolio scaffolds pass lint, type-check, tests | Done | Amendment 1 |
| 6 | Run regress.mjs, regress.mjs --build, docs_sync/site_build/budget gates | Done | |

Coverage: spec requirements → rows 1–5; testing/gates → row 6.

## Amendments

- **2026-10-07 — additive: drop nuxt-og-image.** `ssr:false` removes the `defineOgImage` auto-import, failing type-check in saas/docs/portfolio; user chose to drop the module and its calls (no shim, no SSR exemption). Row 7 added; row 6 re-runs after it. Also recorded: go-scaffold has no `GET /auth/session`, so the current-user read is `GET /api/v1/user/profile` and signup is `POST /api/v1/auth/signup` then login; upstream 5xx → JSON 502; hop-by-hop headers dropped with `host`.

## Review

Declined by the user (code-review and security-review skipped).
