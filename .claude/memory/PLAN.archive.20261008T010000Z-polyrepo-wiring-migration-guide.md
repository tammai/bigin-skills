# Plan: polyrepo wiring, project-scaffold domains and the migration guide

Status: approved
Branch: main

## Spec

**What:** Epic drop-bff unit 6.
1. **project-scaffold wiring.** `project_scaffold.mjs` gains `--web-origin` (default `http://localhost:3000`) and `--api-origin` (default `http://localhost:8090`). After the app scaffolds, it sets `WEB_ORIGINS` in `<project>-api/.env.example` and `NUXT_API_ORIGIN` in `<project>-web/.env.example` from them. Never writes `.env`. The final summary names both values and the deploy-time reminders.
2. **Polyrepo standard docs.** `docs/polyrepo/SPEC-polyrepo-standard.md` and the specs-repo `REPO_MAP.md` template document the browser path: the browser reaches the API only through the web app's own `/api/v*` pass-through (cookie first-party to the web domain), Flutter calls the API directly with Bearer. Includes a mermaid routing diagram, the Cloudflare routing (web Worker → API origin; optional Tunnel for a non-public API), the client-IP trade-off (shared rate-limit bucket) and its fix path (forward visitor IP in a header the API trusts, origin locked to the Worker; needs a go-scaffold change).
3. **Migration guide.** `docs/migrating-off-bff.md` linked from README: moving an existing BFF app to cookie sessions, Nuxt and Next — upgrade/confirm the Go API (cookie sessions, `WEB_ORIGINS`), swap in the pass-through, move auth calls to `/api/v1/auth/session`, remove `nuxt-auth-utils`/`iron-session` and old env vars, set the origin env. Mermaid before/after diagram, rollback note, checklist, `__Host-` HTTPS requirement for local dev. Resolves the design doc's open question: existing BFF apps get no interim refresh-before-expiry patch and move via this guide; record that in the design doc.

**Final sweep/release:** stale-docs sweep over USER_GUIDE, README prose, `site/src/pages` prose, project-scaffold SKILL.md, polyrepo docs; `docs/design/drop-bff.md` → `Status: shipped` with sections reconciled to what shipped. Patch bump v1.110.1 across the four fields + CHANGELOG entry (no patch block). The epic distill/archive is done separately by the orchestrator, not in this plan.

**Inputs/outputs:** CLI gains two optional flags; defaults are the local-dev values; existing runs unaffected; `--repos` runs that skip api or web skip that side of the wiring.

**Edge cases:** an `.env.example` missing the expected key (scaffold failed or tool missing) → summary note, nothing written. Re-run on an adopted repo never overwrites an existing value. `CORS_ORIGINS=*` is refused by the API (unit 1), so never written. A trailing slash on an origin flag is rejected (API origin matching is exact).

**Security considerations:** writes only non-secret origin values into `.env.example`. `WEB_ORIGINS` is the API's CSRF allowlist: docs say it must list only the web app's exact origins, no wildcards. Guide warns against exposing the pass-through on the API's own domain for browsers.

**Testing strategy:** a regress case for the new flags (written values, adopted repos not overwritten, missing key noted, trailing slash rejected); a real `project_scaffold.mjs --no-install` run in a scratch dir checked for the written values; `node tools/regress.mjs`; docs_sync and site_build `--check`; budget gate; link and grep sweep for stale BFF references in docs and the site.

**Not in scope:** go-scaffold changes (incl. visitor-IP forwarding); automated migration; Next in project-scaffold (still Nuxt-only); nodejs-scaffold.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | project_scaffold.mjs: flags, validation, `.env.example` wiring, summary; regress case(s) | Done | |
| 2 | Polyrepo standard + REPO_MAP template: routing doc with mermaid, Cloudflare/Tunnel, client-IP trade-off; project-scaffold SKILL.md | Done | |
| 3 | `docs/migrating-off-bff.md` + README link; design doc → shipped, open question resolved | Done | |
| 4 | Final stale-docs sweep (USER_GUIDE, README prose, site pages, polyrepo docs); v1.110.1 bump + CHANGELOG | Done | |
| 5 | regress.mjs, docs_sync/site_build/budget gates, real project_scaffold dry run, link/grep sweep | Done | |

Coverage: spec requirements → rows 1–4; testing/gates → row 5.

## Review

Declined by the user (code-review skipped).
