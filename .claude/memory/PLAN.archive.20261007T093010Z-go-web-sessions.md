# Plan: go-scaffold cookie sessions + CSRF

Status: approved
Branch: feat/go-web-sessions

Epic: drop-bff, unit 1 (`.claude/memory/EPIC.md`, design `docs/design/drop-bff.md`). Every file below lives under `skills/go-scaffold/scripts/templates/files/` unless stated.

## Spec

**What.** go-scaffold gains a web auth mode beside Bearer JWT: a web login creates a row in a new `sessions` table and returns an opaque ID in an HttpOnly cookie; the auth middleware accepts **either** Bearer **or** that cookie; cookie-authenticated mutations must carry an `Origin` in `WEB_ORIGINS`. Bearer endpoints, refresh, and rotation are untouched.

**Inputs/outputs (contract, additive).** All paths under the existing `BaseURL` `/api/v1`.
- `POST /auth/session` — body `{email, password}` (same schema as `/auth/login`). Returns `201 {user}` + `Set-Cookie: __Host-session=<opaque>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<absolute>`. Same enumeration-safe 401 as login; rate-limited with its own budget. Requires `Origin` ∈ `WEB_ORIGINS`, else 403 (login-CSRF).
- `DELETE /auth/session` — deletes the row (unknown is not an error), clears the cookie (`Max-Age=0`), 200. CSRF-checked.
- `/user/*`, `/admin/*` — contract `security:` lists `cookieAuth` alongside `BearerAuth`.
- Config: `WEB_ORIGINS` (default empty → every cookie mutation 403s), `SESSION_IDLE_HOURS` (72), `SESSION_ABSOLUTE_DAYS` (30), `SESSION_COOKIE_SECURE` (true; false = plain-HTTP dev: cookie named `session`, no `__Host-`, boot logs a warning).
- Migration `000003_create_sessions_table`: `id`, `user_id` FK cascade, `token_hash` unique, `created_at`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`; index on `user_id`.
- Sliding: a valid session bumps `idle_expires_at` only when `last_seen_at` is >1h old. The cookie is never re-issued.
- Role read fresh from `users` on every cookie request.

**Edge cases.** Bearer + cookie → Bearer wins; an invalid Bearer 401s and never falls back to the cookie. Expired session (idle or absolute) → 401, row deleted best-effort. User deleted → cascade, next request 401. Cookie mutation with no `Origin` or `Origin: null` → 403. `*` in `WEB_ORIGINS` refuses boot. Origins compared normalised (lowercase scheme+host, no trailing slash), `WEB_ORIGINS` normalised at load. Safe methods (GET/HEAD/OPTIONS) with cookie skip the Origin check. Bearer requests are CSRF-exempt. Trailing slashes: Gin serves contract paths exactly; no change.

**Security considerations.** Attacker-controlled: cookie value, `Origin`, every forwarded header (no `X-Forwarded-*` is read — unit 2). Session ID = 32 bytes `crypto/rand`, stored only as SHA-256 hash (refresh-token scheme); lookup by hash on a unique index. CSRF = SameSite=Lax + Origin allowlist on cookie mutations and on session creation. CORS middleware unchanged; `WEB_ORIGINS` and `CORS_ORIGINS` stay separate. Logout revokes server-side immediately. 401s never distinguish missing / expired / idle. Residual: XSS can act within a live session (CSP, out of scope).

**Testing strategy.** Tests first (new files). Application: create, resolve, idle expiry, absolute expiry, slide-only-after-1h, logout-unknown, fresh role. Middleware table: Bearer only / cookie only / both / invalid Bearer + valid cookie → 401; CSRF matrix safe vs unsafe × Origin missing/null/wrong/right × Bearer vs cookie. Config: `*` refuses boot, normalisation, insecure-dev cookie name. `router_test.go`: new routes registered, `POST /auth/session` rate-limited, `/user/*` accepts the cookie. Existing tests incl. refresh-rotation replay stay green. Gates: in a scaffolded project `go build`, `go vet`, `go test ./...`, `staticcheck`, and `make generate` leaves no diff in `openapi.gen.go`; in this repo `node tools/regress.mjs`.

**Not in scope.** Client IP / `CF-Connecting-IP` (unit 2); BFF removal or web scaffolds; logout-everywhere; revoke-on-password-change; removing `CORS_ORIGINS`; Fastify. Version bump + CHANGELOG are done at review time by the orchestrator, not the implementer.

**Revert path.** Everything lands on `feat/go-web-sessions` from base `2c20eb3`; nothing ships until merged. Post-merge revert = `git revert` of the merge commit — the migration is additive (new table, `down` drops it) and no existing row or endpoint changes.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Contract: `POST`/`DELETE /auth/session`, `cookieAuth` scheme on `/user/*` + `/admin/*`; `make generate` | Done | |
| 2 | Migration `000003_create_sessions_table` (up/down) | Done | |
| 3 | Config: `WEB_ORIGINS` (normalised, `*` refuses boot), `SESSION_IDLE_HOURS`, `SESSION_ABSOLUTE_DAYS`, `SESSION_COOKIE_SECURE`; `.env.example` | Done | Tests first |
| 4 | Domain + repository: `Session` entity, hashed IDs, idle/absolute expiry, slide rule | Done | Tests first |
| 5 | Application: create (reusing login's enumeration-safe check), resolve (fresh role, slide, delete-on-expiry), delete | Done | Tests first |
| 6 | Session resolver interface in `internal/shared/auth` so middleware never imports a module; users module implements it | Done | Setup for 7 |
| 7 | Auth middleware: Bearer-or-cookie, Bearer wins, no fallback on invalid Bearer | Done | Tests first |
| 8 | CSRF middleware: cookie-authenticated unsafe methods require normalised `Origin` ∈ `WEB_ORIGINS`; Bearer exempt | Done | Tests first |
| 9 | Handlers + selectors: session create/delete with cookie set/clear, Origin required on create, own rate-limit budget; router + `cmd/server` wiring | Done | |
| 10 | `router_test.go`: routes registered, rate-limited, `/user/*` accepts cookie | Done | |
| 11 | go-scaffold `README.md` (generated project) + `skills/go-scaffold/SKILL.md` / `references/MAINTAINING.md` mentions of the auth model | Done | Docs |
| 12 | Gates: scaffold a project, `go build`/`vet`/`test ./...`/`staticcheck`, `make generate` no diff; `node tools/regress.mjs` | Done | `go test ./... -count=1` → 11 ok, 0 failing (also -race); regress → OK 181 passed, 0 failed, 1 skipped. Verifier round 1/3: PASS |
| 13 | Review fixes (code-review medium): slide interval `min(1h, idle/2)`; `scaffold.mjs --cors` validated with the server's origin rule; default ports stripped in `NormalizeOrigin`; logout clears the cookie regardless of delete error; `*` refused in `CORS_ORIGINS` at boot; CORS compares via `NormalizeOrigin`; a login deletes that user's expired sessions; CSRF-checked public routes as a named set in `selector.go` | Done | Amendment 1. Verifier round 2/3: PASS. `go test ./... -count=1` → 12 packages ok; regress → OK 182 passed, 0 failed, 1 skipped |

## Amendments

- **2026-10-07 — additive, after `/code-review medium`.** Spec line "CORS middleware unchanged" no longer holds: an ambient session cookie makes `CORS_ORIGINS=*` + credentials a cross-origin read hole, so `*` is refused at boot and CORS shares `NormalizeOrigin` with CSRF. Row 13 added for the eight approved review fixes; the 2-query session lookup (JOIN) is deferred to the epic notes.
