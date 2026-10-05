# nodejs-scaffold — maintainer notes

Not loaded at run time: `SKILL.md` keeps only what a scaffold run executes. Read this when changing `scripts/scaffold.mjs` or its templates. Paths below are relative to this skill's directory; `tools/regress.mjs` is in the bigin-skills repo.

## Design notes (for maintainers)

- **Why isn't any dependency version pinned in `scaffold.mjs`, unlike go-scaffold's `OAPI_CODEGEN_VERSION` constant?** Go's pinning exists specifically to avoid vendoring dev-only tools into the module's own `go.mod`. Node has no equivalent problem — `pnpm add`/`pnpm add -D` resolve every dependency here as a normal `dependency`/`devDependency` into the committed `pnpm-lock.yaml`. The one exception is `typescript@^5` (a major-version constraint, not a pin): bare `typescript` currently floats to a 7.x prerelease with a breaking `ts.factory` rewrite; `^5` is the actual compatibility requirement.
- **Why code-first OpenAPI (TypeBox → `openapi.json`) instead of the Go sibling's spec-first (`openapi.yaml` → types)?** The org-default ADR names code-first as the Fastify default, and it eliminates the ADR's own named anti-pattern (spec and code drifting with no generation step binding them). One TypeBox declaration in each module's `api/*.schemas.ts` is BOTH the runtime validator and the spec source, so they can't diverge. `scripts/export-openapi.ts` boots the app (no DB — static route-schema introspection, placeholder env) and dumps `src/api/openapi.json`; CI re-exports and `git diff --exit-code`s it. Generating frontend TS types from the spec is a consuming *frontend* scaffold's job, never this backend's — `openapi-typescript` was removed.
- **Why does the schema live in TypeScript, with SQL generated from it?** Drizzle is schema-first: each module's `infrastructure/*.schema.ts` is hand-written TypeScript, and `drizzle-kit generate` produces migration SQL under `drizzle/` from a diff against those schemas (the glob covers `src/modules/*/infrastructure/*.schema.ts` + `src/shared/**/*.schema.ts`). Repositories call Drizzle's query builder directly — the repository function *is* the query — with one exception: the cursor `list()` path uses `queryClient.unsafe` with a spike-verified keyset-WHERE generator (`shared/pagination/cursor.ts`), because a mixed-direction keyset comparison needs a per-column OR-chain that's cleanest as parameterized raw SQL. Column names there come only from a non-nullable allowlist.
- **Why `postgres` (postgres.js) instead of `pg`?** It's Drizzle's most-documented default, is promise-first, and doesn't eagerly connect: the process starts cleanly even against an unreachable database, so only `/readyz` (a real query) surfaces connectivity failures. `{ prepare: false }` is set because postgres.js's prepared statements don't survive PgBouncer's transaction-pooling mode.
- **Why migrations are applied manually (`pnpm db:migrate`), not at startup.** Auto-running migrations at boot races concurrently-starting instances and turns a schema change into an implicit side effect of a restart. Note: one shared migration history spans both modules (the glob) — an accepted limitation of a fixed two-module scaffold, not a per-module-independent-deploy story.
- **Why Graphile Worker (Postgres-backed), not BullMQ/Redis?** The scaffold ships zero infra beyond Postgres. The two jobs (outbox relay, idempotency TTL cleanup) are low-throughput/latency-tolerant; Graphile Worker's job table reuses `DATABASE_URL` with no new compose service. Matches the ADR's "add Redis the moment there's a second instance." The runner runs **in-process** with the API server because the event bus is in-process — the relay must publish to a bus that already has every module's subscriptions registered.
- **Why module boundaries need `eslint-plugin-boundaries`, and the resolver caveat.** Fastify plugin encapsulation enforces nothing about the module boundary — the directory shape is only real because `boundaries/dependencies` fails `pnpm lint` on an illegal import, and it ships in the same scaffold as the structure (a governed-looking repo that isn't enforced is worse than a flat one). **Spike-confirmed trap:** enforcement depends on `eslint-import-resolver-typescript` + `settings['import/resolver'].typescript` (both wired in `eslint.config.mjs`); without the resolver, `.js`-extension imports resolve to unknown elements and violations pass silently. `mode: 'file'` on the single-file `index.ts`/`outbox.ts` elements is deprecated-but-functional (its replacement `partialMatch: false` was tested and does not work) — the deprecation warning on lint is expected.
- **TypeBox + OpenAPI 3.0.3 nullable trap.** A raw `Type.Union([T, Type.Null()])` emits `type: "null"`, which is INVALID OpenAPI 3.0.3. Every nullable field uses the `Nullable()` helper in `shared/schema/nullable.ts` (emits `nullable: true`), and enums use `{ type, enum }` not `Type.Enum` (which emits 3.0-illegal `const`). Verified against swagger-parser during the pre-implementation spike.
- **No Prometheus `/metrics` endpoint.** A deliberate scope decision (health/readiness/logging/CORS/rate-limit are covered) — go-scaffold's `/metrics` via `promhttp` remains the one known go/nodejs parity gap; a small future addition would be `prom-client` + a `/metrics` route.
- **Each module plugin gets its own `/v1/<module>` prefix** (`usersRoutes` → `/v1/users`, `authRoutes` → `/v1/auth`, `postsRoutes` → `/v1/posts`), matching the ADR's wiring example. Self-erase (`DELETE /v1/users/:id`) lives in `users.routes.ts`, not `auth.routes.ts` — it's a users-resource operation, not a credential operation, even though `eraseUser` is exported from the same `application/erase-user.ts` either way.
- **Optimistic concurrency (ADR §9.4) is demonstrated on `posts`, not `users`.** `PATCH /v1/posts/:id` requires the caller's current `version` in the body; a mismatch is a 409, never a silent overwrite — enforced twice (a pre-check in `update-post.use-case.ts` for a fast, readable error, and the real guard in `posts.repository.ts#updateWithVersion`'s conditional `WHERE version = $expected`, which is what actually closes the TOCTOU race between the two). The route also sets `idempotent: true`, the exact pairing ADR §9.3 calls out: a network retry of a *successful* update replays the stored response instead of hitting a bogus 409 against the now-bumped version.
- **Dead-letter handling is a real DLQ table with backoff, not just a status flag.** After a publish attempt fails, `outbox-relay.ts` sets `next_attempt_at` (1 min, then 5 min) instead of retrying every cron tick; after `MAX_ATTEMPTS` (3) it copies the row into `shared.dead_letter_events` (`shared/job-queue/dead-letter.schema.ts`) *and* flags the source row's `dead_lettered_at` so the relay stops re-selecting it — the DLQ table is what stays queryable for manual inspection.
- **Testing is split unit vs. integration, and only unit runs during scaffolding.** `*.test.ts` (domain/application, mocked repositories — no DB) is the default `pnpm test`, including during `scaffold.mjs`'s own verification pass. `*.integration.test.ts` (infrastructure repositories + one full `app.inject` HTTP round trip, real Postgres) is `pnpm test:integration`, wired to a separate `vitest.integration.config.ts` whose `globalSetup` (`tests/global-setup.ts`) starts a Postgres testcontainer, applies the committed `drizzle/*.sql`, and tears it down. Deliberately **not** run by `scaffold.mjs` itself — requiring Docker during scaffolding would break the "leaves a green repo, no manual fixup" guarantee on any machine without a running daemon. CI runs both (`ubuntu-latest` ships Docker, so `test:integration` needs no `services:` block).
- **`pnpm dev:setup` and `scripts/seed.ts`.** One entrypoint (`docker compose up -d db && pnpm db:migrate && pnpm seed`) gets a new engineer a working dataset (one admin user + one post) instead of a wiki page of manual steps. The seed is idempotent by pre-checking for the seed email rather than `ON CONFLICT` — `users`' unique index is partial (`WHERE deleted_at IS NULL`), and matching that predicate from `onConflictDoNothing` would just duplicate the same condition in two places.

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir:

```sh
mkdir scaffold-test && cd scaffold-test
node <skill-dir>/scripts/scaffold.mjs --project scaffold-test --dir .
```

Expect: exit 0, `pnpm lint` (incl. boundary lint) / `pnpm type-check` / `pnpm build` / `pnpm test --run` all pass inline, `src/api/openapi.json` written, a git commit created. Watch the first `pnpm add`/`pnpm add -D` for `ERR_PNPM_IGNORED_BUILDS` — if a package other than `argon2`/`esbuild` needs a native build, add it to `package.json`'s `pnpm.onlyBuiltDependencies` and the relevant `pnpmAdd` approvable list in `scaffold.mjs`.

Confirm boundary enforcement actually fires: temporarily add a cross-module import that reaches past a module's `index.ts` (e.g. `import { usersRepository } from '../../users/infrastructure/users.repository.js'` inside `posts/application/list-posts.use-case.ts`) and confirm `pnpm lint` fails with a `boundaries/dependencies` error, then revert.

Then run the integration suite — it IS the golden path (signup → login → create post → list shows `author_name` → stale-version PATCH gets 409 → correct-version PATCH succeeds → erase → outbox relay ticked manually → post anonymizes), against a real Postgres via testcontainers, no manual `docker compose`/curl needed:

```sh
pnpm test:integration   # needs Docker; starts + tears down its own Postgres container
```

For a from-scratch manual poke instead (e.g. checking `/docs` renders, or a behavior `app.inject` can't exercise like real network binding):

```sh
cp .env.example .env          # set a JWT_SECRET
pnpm dev:setup                 # docker compose up -d db + migrate + seed
node dist/server.js &         # or pnpm dev
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/healthz   # 200
```

Re-run the same scaffold command again without `--force` → must fail fast ("exists and is not empty"), exit 2, no files touched.

For a fast file-tree-only pass while iterating on templates, add `--skip-verify` — expect exit 0 in a couple seconds, no install/codegen/build/commit; inspect the written files directly.
