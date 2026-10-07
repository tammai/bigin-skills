# Plan: go-scaffold — client IP behind Cloudflare

Status: approved
Branch: main

## Spec

**What:** `NewRouter` calls `SetTrustedProxies(nil)` so Gin ignores `X-Forwarded-For`/`X-Real-IP`; `c.ClientIP()` is `RemoteAddr`. `TRUSTED_PROXY=cloudflare` additionally takes the client IP from `CF-Connecting-IP`, only if it parses via `net.ParseAddr`; invalid/missing falls back to `RemoteAddr`. Any other non-empty `TRUSTED_PROXY` refuses boot (like `CORS_ORIGINS=*`). `X-Forwarded-Host` never read. Finding: `gin.Default()` trusts all proxies today, so rotating `X-Forwarded-For` bypasses `ratelimit.go:66`.

**Inputs/outputs:** `TRUSTED_PROXY` env (config.go, .env.example, README); request headers → `c.ClientIP()`. No API contract change.

**Edge cases:** spoofed XFF / CF-Connecting-IP with unset → ignored; cloudflare mode with garbage/multi-value header → RemoteAddr; header trustworthy only if origin reachable solely via Cloudflare (README note). Cloudflare docs: cross-zone Worker subrequest gets `CF-Connecting-IP = 2a06:98c0:3600::103`, same-zone reflects Worker-alterable `x-real-ip` → pass-through can't deliver real client IP via this header; record in docs/design/drop-bff.md § Spike results, flag units 3, 5, 6.

**Security considerations:** closes rate-limit bypass by spoofed IP; default-deny; header validated with net.ParseAddr.

**Testing strategy:** router-level tests (unset ignores both headers; cloudflare honours valid CF-Connecting-IP; invalid/missing falls back; XFF ignored in both modes); rate-limit test with rotating XFF stays in one bucket; config tests for valid/empty/unknown TRUSTED_PROXY; regress.mjs.

**Not in scope:** Worker real-IP forwarding (units 3, 5, 6), Cloudflare range allowlisting, other proxies.

**Release:** v1.108.0 (minor) + CHANGELOG entry (all four version fields).

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | config: parse `TRUSTED_PROXY` (empty/`cloudflare`, else error) + config tests | Done | skills/go-scaffold/scripts/templates/files/internal/shared/config |
| 2 | router: SetTrustedProxies(nil) + cloudflare-mode client-IP middleware/Options wiring + router/rate-limit tests | Done | router.go, tests; fix any test relying on old XFF behaviour |
| 3 | `.env.example` + README docs (origin lock-down note) | Done | |
| 4 | Record Cloudflare docs finding in docs/design/drop-bff.md § Spike results | Done | |
| 5 | Release: bump 1.108.0 in the 3 manifests (4 fields), CHANGELOG entry, run regress.mjs + docs_sync | Done | |

Review: declined by user.
