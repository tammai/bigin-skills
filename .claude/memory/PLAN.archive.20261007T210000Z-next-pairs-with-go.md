# Plan: next-scaffold pairs with Go (BFF kept)

Status: approved
Branch: main

## Spec

**What:** Repoint next-scaffold's contract and BFF helpers from Fastify to go-scaffold. `openapi.json` regenerated from go-scaffold's `openapi.yaml` (YAML→JSON, `{{PROJECT_NAME}}` → placeholder title); `src/shared/api-client/schema.d.ts` regenerated with `openapi-typescript`. Go serves under `/api/v1`: client `baseUrl: '/api/backend/api/v1'`, path keys `/user/profile`, `/auth/login`…; proxy still forwards `/api/backend/<rest>` verbatim to `BACKEND_URL/<rest>`; `backend.ts` calls `${BACKEND_URL}/api/v1/auth/{login,refresh,logout}`; signup is `POST /auth/signup` followed by a login. Fastify-isms removed: the `skipTrailingSlashRedirect` patch (scaffold.mjs step + artifacts.md text), the `Idempotency-Key` header and comments, trailing-slash comments in `backend.ts`/`use-users.ts`, "nodejs-scaffold/Fastify" wording in `.env.example`, scaffold.mjs next-steps, SKILL.md, references/*. Sample `use-users` hook → `useProfile` on `GET /user/profile` (Go has no public user list), same TanStack Query shape. `BackendTokenPair`/`BackendUser` and login/signup/me routes follow Go's field names via the new schema. Saas keeps iron-session custody, the proxy's 401→refresh→retry unchanged except paths/shapes; unit 5 removes it.

**Inputs/outputs:** Browser → same-origin `/api/backend/api/v1/**` → proxy attaches Bearer → Go. Login stores the token pair in the sealed session as today.

**Edge cases:** Proxy forwards paths verbatim and Go has no trailing-slash routes, so Next's default 308 trailing-slash strip is correct (patch removed). Signup 409 duplicate email follows Go's error codes; `auth-errors.ts` mapping updated. If Go's `middleware.BaseURL` changes, client `baseUrl` and `backend.ts` change together; noted in `.env.example` and the client comment.

**Security considerations:** Auth design (token custody, proxy, refresh) unchanged, no new risk. `openapi.json` is documentation, not enforcement. Raw backend error bodies still never reach the browser: `BackendError` reads Go's error envelope code only.

**Testing strategy:** Update existing route tests (login, signup, backend proxy, use-users) to new paths/shapes. Real saas scaffold via `scaffold.mjs` passes lint, type-check, tests. `node tools/regress.mjs`; `--build` doesn't cover next-scaffold, so the real scaffold run is the acceptance check. Manual Go smoke test only if a Go env is available (not promised). Gates: docs_sync/site_build --check, budget gate, grep sweep for stale Fastify/Idempotency/skipTrailingSlashRedirect/`/v1/users/` refs.

**Not in scope:** removing the BFF/iron-session/Next auth routes, OpenNext/Cloudflare pin (unit 5); go-scaffold changes.

**Version:** patch, v1.109.1 in all four manifest fields + CHANGELOG entry (no patch block).

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Replace `openapi.json` with Go's contract; regenerate `schema.d.ts`; client `baseUrl` `/api/backend/api/v1` and path keys | Done | |
| 2 | `backend.ts`, proxy, login/signup/logout/me routes, `auth-errors.ts`, `useProfile` hook: Go paths/shapes, remove Idempotency-Key and trailing-slash code; update their tests | Done | |
| 3 | scaffold.mjs: remove `skipTrailingSlashRedirect` patch; update next-steps; `.env.example`; SKILL.md, artifacts.md, bootstrap.md, modules.md, MAINTAINING.md, evals: drop Fastify wording | Done | |
| 4 | Bump 1.109.1 in all four fields; CHANGELOG entry | Done | |
| 5 | Run regress.mjs, docs_sync/site_build/budget gates, real saas scaffold lint+type-check+tests, stale-ref grep sweep | Done | |

Coverage: spec requirements → rows 1–4; testing/gates → row 5.

## Review

Declined by the user (code-review and security-review skipped).
