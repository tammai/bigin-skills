# Design: Drop the BFF for API-owned cookie sessions

- **Status:** shipped (v1.107.0 – v1.110.1)
- **Epic:** `.claude/memory/EPIC.md` → drop-bff
- **PRD:** none — no PRD for this initiative
- **Date:** 2026-10-07

## Context and scope

`nuxt-scaffold` and `next-scaffold` ship a token-holding BFF: a catch-all proxy at `/api/backend/*` unseals a session cookie, attaches the backend's Bearer token, forwards the request, and refreshes on a 401. An audit on 2026-10-07 found a refresh race that signs users out — the re-read meant to detect a sibling's rotation reads the same request's cookie, and the test covering it fakes a server-side store — plus unrestricted path and header forwarding, fully buffered bodies, raw backend errors reaching the browser, and drift between the two hand-written copies.

Every app these scaffolds produce is client-only (`ssr: false`) and deploys to Cloudflare. With no server rendering, the BFF's only job is token custody, and that one job is the source of every finding.

Out of frame: SSR, multi-backend aggregation, and the Fastify backend (`nodejs-scaffold`).

## Goals and non-goals

- **Goals** — no token readable by browser JavaScript; the API's domain is not visible to the browser; no token-refresh logic outside the API; Flutter's auth unchanged.
- **Non-goals** — SSR; aggregating several backends behind one endpoint; automated migration of already-scaffolded apps; fixing the BFF templates being removed.

## Design

```mermaid
sequenceDiagram
  participant B as Browser (acme-app.com)
  participant E as Pass-through /api/v*/**
  participant G as Go API (acme-api.io)
  B->>E: POST /api/v1/auth/session {email,password}
  E->>G: POST /api/v1/auth/session
  G-->>E: 201 + Set-Cookie: __Host-session (HttpOnly)
  E-->>B: 201 + Set-Cookie (first-party on acme-app.com)
  B->>E: GET /api/v1/user/profile (cookie)
  E->>G: GET /api/v1/user/profile (cookie)
  G->>G: session lookup + slide expiry; mutations: Origin ∈ WEB_ORIGINS
  G-->>B: 200 (streamed through)
```

The Go API gains a second auth mode beside Bearer: an opaque session ID in a `__Host-session` cookie (HttpOnly, Secure, SameSite=Lax, no `Domain`), backed by a `sessions` table with sliding expiry. Cookie-authenticated mutations must carry an `Origin` in `WEB_ORIGINS`. Each web app's domain passes `/api/v*/**` through to the API verbatim (the API's own `BaseURL` is `/api/v1`, so nothing is stripped) — a catch-all handler for Nuxt, `rewrites` for Next — so the cookie is first-party to the app. Flutter calls the API's own domain with Bearer + refresh, as today.

**Forced:** the web app and the API can be on different sites, and a cookie the API sets on its own domain is then third-party, which Safari blocks — so the cookie must arrive through the app's domain. Flutter has no browser cookie jar, so Bearer stays.
**Chosen:** server-side sessions with no refresh token on the web — refresh exists for mobile and is what produced the race. A pass-through with no tokens and no logic beyond a path allowlist — `rewrites` config for Next, a catch-all handler for Nuxt, because Nitro's `routeRules` proxy buffers responses and can't express the allowlist (see Spike results).

## Alternatives considered

- **Fix the BFF** (refresh before expiry + a grace window on the API) — keeps every responsibility the audit flagged and two copies to maintain.
- **Access token in browser memory, refresh token in an HttpOnly cookie** — the access token is readable by XSS, which fails the first goal.
- **Direct credentialed CORS to the API** — fails in Safari for cross-site deployments, and exposes the API domain.
- **A server-side session store at the edge** (Durable Objects) — heavy, and still a BFF.

## Cross-cutting concerns

- **Security and privacy** — no token is reachable by XSS, though XSS can still act within the session, as under the BFF. CSRF: SameSite=Lax plus the `Origin` allowlist. Sessions are revocable server-side immediately, which the JWT design could not do.
- **Observability** — `x-request-id` passes through in both directions.
- **Performance** — the same hop count as the BFF, without buffering or request replay.
- **Migration and rollout** — a manual guide, [`docs/migrating-off-bff.md`](../migrating-off-bff.md); existing repos keep their BFF and their BFF rules, so no patch blocks. Existing BFF apps get no interim refresh-before-expiry fix: they stay as they are until they move with the guide.
- **Failure modes** — an unreachable API yields a 502 from the edge; an expired session yields a 401 the client handles by sending the user to sign in.

## Risks

- The Nitro `routeRules` proxy rewrites or drops `Set-Cookie` on the cloudflare preset — signal: unit 0 sees no cookie on the app domain.
- `@opennextjs/cloudflare` rejects rewrites to an external domain — signal: unit 0's Next check returns 404/500; fallback is a Worker route.
- `__Host-` + `Secure` misbehaves on `http://localhost` in some browser — signal: local login works in Chrome but not Safari.
- The pass-through forwards client headers the API trusts — signal: unit 2's spoofing test.

Outcome: the first two did not occur (unit 0: `Set-Cookie` intact on all three paths, OpenNext accepted the external rewrite). The third was never browser-tested, so the migration guide gives both local options (HTTPS, or `SESSION_COOKIE_SECURE=false` on a local API). The fourth was closed by unit 2: the API trusts no forwarding header by default.

## Open questions

None remain.

- **Resolved:** existing BFF apps get no interim refresh-before-expiry patch. They move through the migration guide, because the BFF is the thing being removed and a fix would keep two copies alive.
- **Resolved:** session lifetime defaults are 72 hours idle and 30 days absolute (`SESSION_IDLE_HOURS`, `SESSION_ABSOLUTE_DAYS`), set in unit 1.

## What shipped

| Release | Unit | Result |
| --- | --- | --- |
| v1.107.0 | 1 | `go-scaffold` cookie sessions: `sessions` table, `POST` / `DELETE /api/v1/auth/session`, `Origin` check against `WEB_ORIGINS`, Bearer unchanged |
| v1.108.0 | 2 | `go-scaffold` trusts no forwarded client-IP header; `TRUSTED_PROXY=cloudflare` is opt-in |
| v1.109.0 | 3 | `nuxt-scaffold`: catch-all pass-through to server-only `NUXT_API_ORIGIN`, `nuxt-auth-utils` and the proxy removed |
| v1.109.1 | 4 | `next-scaffold` paired with Go (BFF kept for one release) |
| v1.110.0 | 5 | `next-scaffold`: `rewrites` to build-time `API_ORIGIN` on OpenNext/Cloudflare, `iron-session` and the proxy removed |
| v1.110.1 | 6 | `project-scaffold --web-origin` / `--api-origin` wiring, polyrepo routing docs, the migration guide |

Reconciled with what the spike found: the Nuxt pass-through is the catch-all handler, not `routeRules`; Next is pinned to 16.3.8; the Next origin is read at build time, the Nuxt one at runtime. The current user is `GET /api/v1/user/profile`, since `go-scaffold` has no `GET /auth/session`.

**Client IP stayed a trade-off.** Behind the pass-through the API sees the Worker's egress address, so browser users share one rate-limit bucket; the scaffolds and the [polyrepo standard](../polyrepo/SPEC-polyrepo-standard.md#browser-and-mobile-paths-to-the-api) say so. The fix path is not built: forward the visitor's IP in a header the API is configured to trust, with the API origin locked to the Worker, which needs a `go-scaffold` change.

## Spike results

Unit 0, 2026-10-07 — local `wrangler dev` only (no edge deploy, no browser), against a stub API on another origin. Versions: nuxt 4.6.0 / nitropack 2.13.4, next 16.3.8 + @opennextjs/cloudflare 1.20.9, wrangler 4.122–4.148.

| Check | Nuxt `routeRules` proxy | Nuxt catch-all handler | Next `rewrites` (OpenNext) |
| --- | --- | --- | --- |
| `Set-Cookie` intact, no `Domain` added | pass | pass | pass |
| Cookie reaches the API | pass | pass | pass |
| SSE streams incrementally | **fail** — buffered, `Content-Length` added | pass | pass |
| `/api/v<digits>/` allowlist | **not expressible** — radix3 wildcards are whole-segment | pass (`^/api/v\d+(/\|$)`) | pass (`/api/v:ver(\\d+)/:path*`) |
| Unknown `/api/*` path | 200 SPA shell, never reaches API | JSON 404 | 404 page |

What this changes:

- **Nuxt's pass-through is a ~8-line catch-all `server/routes/api/[...path].ts`, not `routeRules`.** It matches the version allowlist, 404s anything else, and returns the upstream `fetch()` `Response` unbuffered (`duplex: 'half'`, `redirect: 'manual'`). It still holds no tokens and no logic beyond the allowlist.
- **Next pins `next@16.3.8`.** `create-next-app`'s 16.4.0 with OpenNext 1.20.9 builds but 500s every non-rewrite request (`Unexpected loadManifest(.../preview-props.json)`), despite the adapter's peer range. Cloudflare's docs now recommend vinext for new Next apps on Workers — untested here.
- **The API must trust no forwarding header from the pass-through.** Client `X-Forwarded-For` and `X-Forwarded-Host` pass through untouched in all three; `Host` becomes the API's; a client `CF-Connecting-IP` was dropped locally. What the API sees as client IP on the real edge is unverified — unit 2 settles it.
- **Next strips a trailing slash before forwarding** (`/api/v1/x/` → `/v1/x`); Nuxt keeps it. The API must not distinguish the two — chi already serves paths exactly as written without trailing slashes.
- **`__Host-` needs HTTPS, localhost included** (MDN; not browser-tested). Local dev runs `wrangler dev --local-protocol https`, or the cookie name is configurable in dev — unit 1 decides.
- Nuxt 4.6 wants Node ≥ 22.21.

Unit 2 (go-scaffold client IP), 2026-10-07 — Cloudflare docs, not an edge test.

- **The pass-through cannot deliver the real client IP to the API in `CF-Connecting-IP`.** A Worker `fetch()` to another zone reaches the origin with `CF-Connecting-IP` set to a Cloudflare address (`2a06:98c0:3600::103`), not the visitor's. For a same-zone subrequest the header reflects the Worker-alterable `x-real-ip`. Neither carries the visitor's address for a Worker-to-API hop. The API's `TRUSTED_PROXY=cloudflare` mode is correct for browser traffic that reaches the origin through Cloudflare directly, but not for the pass-through.
- **Consequence for units 3, 5 and 6** (the pass-through templates): behind the pass-through, the Go API sees the Worker egress address as the client, so every browser user shares one rate-limit bucket. Those units must either forward the visitor's IP in a header the API is configured to trust (a decision that unit 2 deliberately did not make, and one that needs the origin locked to the Worker) or accept per-egress limiting and say so in their README.
- Unit 2 ships the safe default: `SetTrustedProxies(nil)` makes `X-Forwarded-For` and `X-Real-IP` inert, which closes the rate-limit bypass `gin.Default()` allowed (it trusts all proxies), and `X-Forwarded-Host` is never read.
