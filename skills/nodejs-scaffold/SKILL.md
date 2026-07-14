---
name: nodejs-scaffold
description: "Scaffolds a production-ready Node.js REST API — non-interactive, template-driven. Contract-first: openapi.yaml generates API types (openapi-typescript); src/db/schema.ts generates migration SQL (drizzle-kit) — the reverse of a SQL-first generator like sqlc: the script runs both generators itself so the repo it leaves behind builds and tests green, not a skeleton needing manual fixup. MUST use when user says: 'scaffold node api', 'create node rest api', 'new node backend', 'create a fastify backend', 'initialize node api', 'node rest api scaffold', 'set up node api', 'tạo node api', 'khởi tạo node api', 'cài node api', or when the repo has no package.json. Also invoked by bigin-harness-setup Phase 0.5c for the nodejs profile on an empty repo."
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# nodejs-scaffold

This skill is mechanical: gather config, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Node.js REST API from a single template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the CLI flags, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Node.js ≥22, Fastify, contract-first via `openapi-typescript` (openapi.yaml → API types) and `drizzle-kit` (schema.ts → migration SQL), `drizzle-orm` + `postgres` (postgres.js) + Postgres, Zod validation at handler boundaries, `@fastify/cors` + `@fastify/rate-limit`, Fastify's built-in `pino` logger, ESLint (flat config), Vitest.

One template only — no variant menu like nuxt-scaffold's. The generated app ships a single example resource (`users`: create + get) proving the full pipeline end-to-end; everything else about the shape is fixed.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Node.js ≥22 on PATH, pnpm on PATH (`corepack enable && corepack prepare pnpm@latest --activate` if missing), git. Docker isn't touched by the script at all (compose/Dockerfile are written but never invoked). Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-api` first, or pass `--dir`).

---

## Step 1: Detect state & confirm

Check the target directory:

- **`package.json` already exists** → complete or partial scaffold from a prior run. Ask: *"package.json already exists here — overwrite with --force? (yes / no)"*. If yes → re-run Step 3 with `--force`. If no → stop.
- **No `package.json`, directory empty or doesn't exist** → ask: *"Scaffold a Node.js REST API here (Fastify + Drizzle + Postgres)? (yes / no)"*. If no → stop.
- **No `package.json`, but directory has other files** (e.g. a README already committed) → same question, but flag that `--force` will be needed since the script refuses to write into a non-empty directory otherwise.

## Step 2: Gather config

One decision matters here — everything else defaults sensibly:

1. **Project name** (required, free text, not `AskUserQuestion` — needs regex validation, not a menu) — kebab-case, e.g. `orders-api`. Drives `package.json` name, Docker image name, Postgres user/db, README title. Ask directly; there's no sensible default. Unlike go-scaffold, there is no module-path-equivalent second decision — Node has no module-path concept, so `--project` is the only required flag.

No `AskUserQuestion` call needed here — there's no multi-choice decision, unlike nuxt-scaffold's template/theme menu (this skill has one template, one stack). CORS origins, target directory, and commit behavior all default sensibly (see flag table below); only ask about them if the request implies a specific need (a named frontend origin, scaffolding without git, or maintainer template iteration).

Show a one-line summary and confirm, e.g. `Project: orders-api · Dir: .` If no → stop.

## Step 3: Run the script

```sh
node <this-skill-dir>/scripts/scaffold.mjs --project <name> [--dir <dir>] [--cors <origins>] [--force] [--no-commit] [--skip-verify]
```

| Flag | Default | Purpose |
|---|---|---|
| `--project` | *(required)* | kebab-case project name |
| `--dir` | `.` | Target directory |
| `--cors` | `http://localhost:3000` | Comma-separated default `CORS_ORIGINS` |
| `--force` | off | Allow writing into a non-empty directory |
| `--no-commit` | off | Skip `git init`/`add`/`commit` entirely — files are written and verified but nothing is committed |
| `--skip-verify` | off | Write files only — skip `pnpm add`, codegen, lint, typecheck, build, test, and commit. **Maintainer-only**, for fast template iteration; never set this from the normal user-facing flow. The result isn't buildable until `pnpm install && pnpm openapi-types && pnpm db:generate` run manually afterward. |

Stream its output — `pnpm add` (deps then devDeps) takes the bulk of the time on a fresh run. Every subsequent stage (codegen, glue files, lint, type-check, build, test, `git commit`) is internal — do not duplicate any of it by hand.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → bad flags; fix per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing command (commonly: pnpm not on PATH, Node <22, or a network failure during `pnpm add`). Fix the cause and re-run with `--force` — files from the failed attempt were already written.

---

## Design notes (for maintainers)

- **Why isn't any dependency version pinned in `scaffold.mjs`, unlike go-scaffold's `SQLC_VERSION`/`OAPI_CODEGEN_VERSION` constants?** Go's pinning exists specifically to avoid vendoring dev-only tools into the module's own `go.mod` (each would drag ~40 transitive packages into `go.sum`). Node has no equivalent problem — `pnpm add`/`pnpm add -D` resolve every dependency here as a normal `dependency`/`devDependency` into the committed `pnpm-lock.yaml`, the same as any other Node project. Hardcoding version numbers here would just go stale. The one exception is `typescript@^5` (a major-version constraint, not a pin) — confirmed via a real scaffold run that `openapi-typescript` crashes against bare `typescript`'s latest (currently resolves to a 7.x prerelease with a breaking `ts.factory` API change); `^5` is the actual compatibility requirement, not staleness-risk hardcoding.
- **Why is Drizzle's codegen direction the reverse of sqlc's?** sqlc requires hand-written SQL (`internal/store/queries/*.sql`), generating typed Go methods from it. Drizzle is schema-first: `src/db/schema.ts` is hand-written TypeScript, and `drizzle-kit generate` produces migration SQL under `drizzle/` from a diff against that schema. There's also no separate "typed queries" layer to keep in sync the way sqlc has one — `src/repositories/` calls Drizzle's query builder directly against the schema; the repository function *is* the query.
- **Why `postgres` (postgres.js) instead of `pg` (node-postgres)?** It's Drizzle's own most-documented default, is promise-first, and — like go-scaffold's `pgxpool.New` — doesn't eagerly connect: the client is constructed and the process starts cleanly even against an unreachable database, so only `/readyz` (a real query) surfaces connectivity failures. `{ prepare: false }` is set on the client because postgres.js's prepared statements don't survive PgBouncer's transaction-pooling mode — harmless against this scaffold's direct-Postgres `docker-compose.yml`, but a real production gotcha if a PgBouncer layer is added later.
- **Why are migrations applied manually (`pnpm db:migrate`) instead of automatically at server startup?** Mirrors go-scaffold's manual `make migrate-up` exactly — auto-running migrations at startup risks a race between concurrently-starting instances and turns a schema change into an implicit side effect of a deploy/restart rather than an explicit, reviewable step.
- **Why does `error-handler.ts` check `fastifyErr.statusCode < 500` instead of only handling `ZodError`?** Fastify's own body-parser errors (a malformed JSON request body) arrive at `setErrorHandler` as a `FastifyError` with a `statusCode`, through the *same* path as errors a route handler throws — this is the direct analog of go-scaffold's `api.HandlerWithOptions` fix (two separate error paths must not diverge and leak raw parser text). Verified live: `POST /users` with `{not valid json` as the body returns `{"code":"bad_request","message":"invalid request"}`, not `SyntaxError: Unexpected token`.
- **Why does `/readyz` check `checkConnection()` via a real query, and why must handlers never call it elsewhere?** Same rationale as go's `pool.Ping` — `postgres()` doesn't eagerly connect, so only an actual query surfaces connectivity failures; sprinkling connection checks elsewhere would just duplicate this and risk drifting out of sync with the actual failure mode.
- **No Prometheus `/metrics` endpoint.** A deliberate scope decision (not an oversight) to keep this scaffold matched to what was explicitly asked for (health/readiness/logging/CORS/rate-limit) — go-scaffold's `/metrics` via `promhttp` remains the one known go/nodejs parity gap; a small future addition would be `prom-client` + a `/metrics` route.

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir:

```sh
mkdir scaffold-test && cd scaffold-test
node <skill-dir>/scripts/scaffold.mjs --project scaffold-test --dir .
```

Expect: exit 0, `pnpm lint`/`pnpm type-check`/`pnpm build`/`pnpm test --run` all pass inline, a git commit created. Watch the first `pnpm add -D` for `ERR_PNPM_IGNORED_BUILDS` — if a package other than `esbuild` needs approval, add it to the `approvable` list in `scaffold.mjs`'s `pnpmAdd` call before shipping the change.

Then actually run the built server and curl it — static checks alone don't prove runtime behavior:

```sh
cp .env.example .env
DATABASE_URL="postgres://x:x@localhost:1/x" PORT=18080 node dist/server.js &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/healthz   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/readyz   # 503, no live db
curl -s -X POST http://localhost:18080/api/v1/users -H 'content-type: application/json' -d '{not valid json'
# {"code":"bad_request","message":"invalid request"} — not a leaked parser error
```

Re-run the same scaffold command again without `--force` → must fail fast ("exists and is not empty"), exit 2, no files touched.

For a fast file-tree-only pass while iterating on templates, add `--skip-verify` — expect exit 0 in a couple seconds, no install/codegen/build/commit; inspect the written files directly, don't treat that run as a stand-in for the full validation above.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/files/` — **source of truth** for every file written into the project. `STATIC_FILES` are written before `pnpm add`/codegen run; `GLUE_FILES` (which import fastify/@fastify/*/the generated `src/types/api.d.ts`) are written after.
