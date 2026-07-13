---
name: go-scaffold
description: "Scaffolds a production-ready Go REST API — non-interactive, template-driven. Contract-first: openapi.yaml generates the server interface + models (oapi-codegen), internal/store/queries/*.sql generates typed queries (sqlc); the script runs both generators itself so the repo it leaves behind builds and tests green, not a skeleton needing manual fixup. MUST use when user says: 'scaffold go api', 'create go rest api', 'new go backend', 'initialize go api', 'go rest api scaffold', 'set up go api', 'tạo go api', 'khởi tạo go api', 'cài go api', or when the repo has no go.mod. Also invoked by bigin-harness-setup Phase 0.5 for the go profile on an empty repo."
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# go-scaffold

This skill is mechanical: gather config, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Go REST API from a single template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the CLI flags, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Go ≥1.24, chi router, contract-first via `oapi-codegen` (openapi.yaml → server interface + models) and `sqlc` (SQL → typed queries), `pgx/v5` + Postgres, `caarlos0/env` config, structured `log/slog`, Prometheus metrics, `go-chi/cors` + `go-chi/httprate`, `golang-migrate` for schema migrations, `testify` for assertions.

One template only — no variant menu like nuxt-scaffold's. The generated app ships a single example resource (`users`: create + get) proving the full pipeline end-to-end; everything else about the shape is fixed.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Go ≥1.24 on PATH, git. Docker/staticcheck are optional — staticcheck runs if found on PATH and is skipped with a note otherwise; Docker isn't touched by the script at all (compose/Dockerfile are written but never invoked). Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-api` first, or pass `--dir`).

---

## Step 1: Detect state & confirm

Check the target directory:

- **`go.mod` already exists** → complete or partial scaffold from a prior run. Ask: *"go.mod already exists here — overwrite with --force? (yes / no)"*. If yes → re-run Step 3 with `--force`. If no → stop.
- **No `go.mod`, directory empty or doesn't exist** → ask: *"Scaffold a Go REST API here (chi + oapi-codegen + sqlc + Postgres)? (yes / no)"*. If no → stop.
- **No `go.mod`, but directory has other files** (e.g. a README already committed) → same question, but flag that `--force` will be needed since the script refuses to write into a non-empty directory otherwise.

## Step 2: Gather config

Two decisions matter here — everything else defaults sensibly:

1. **Module path** (required, free text, not `AskUserQuestion` — needs regex validation, not a menu) — e.g. `github.com/acme/orders-api`. Ask directly; there's no sensible default, it's tied to VCS hosting.
2. **Project name** (optional, free text) — kebab-case, defaults to the module path's last segment. Only ask if that derived default looks wrong (e.g. the module ends in something generic) — otherwise state the default in the confirmation and let the user correct it rather than asking outright.

No `AskUserQuestion` call needed here — there's no multi-choice decision, unlike nuxt-scaffold's template/theme menu (this skill has one template, one stack). CORS origins, target directory, and commit behavior all default sensibly (see flag table below); only ask about them if the request implies a specific need (a named frontend origin, scaffolding without git, or maintainer template iteration).

Show a one-line summary and confirm, e.g. `Module: github.com/acme/orders-api · Project: orders-api · Dir: .` If no → stop.

## Step 3: Run the script

```sh
node <this-skill-dir>/scripts/scaffold.mjs --module <module-path> [--dir <dir>] [--project <name>] [--cors <origins>] [--force] [--no-commit] [--skip-verify]
```

| Flag | Default | Purpose |
|---|---|---|
| `--module` | *(required)* | Go module path |
| `--dir` | `.` | Target directory |
| `--project` | last path segment of `--module` | kebab-case; drives Docker image name, Postgres user/db, README title |
| `--cors` | `http://localhost:3000` | Comma-separated default `CORS_ORIGINS` |
| `--force` | off | Allow writing into a non-empty directory |
| `--no-commit` | off | Skip `git init`/`add`/`commit` entirely — files are written and verified but nothing is committed |
| `--skip-verify` | off | Write files only — skip codegen, `go mod tidy`, build, vet, test, and commit. **Maintainer-only**, for fast template iteration; never set this from the normal user-facing flow. The result isn't buildable until `make generate && go mod tidy` run manually afterward. |

Stream its output — the first run downloads and builds `oapi-codegen` and `sqlc` via `go run pkg@version` (not installed globally, not added to the scaffolded module's own `go.mod`), which takes roughly a minute. Every subsequent stage (glue files, `go mod tidy`, `gofmt`, `go vet`, `go build`, `go test`, optional `staticcheck`, `git commit`) is internal — do not duplicate any of it by hand.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → bad flags; fix per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing command (commonly: Go not on PATH, Go <1.24, or a network failure downloading `oapi-codegen`/`sqlc`/module deps). Fix the cause and re-run with `--force` — files from the failed attempt were already written.

---

## Design notes (for maintainers)

- **Why not vendor `sqlc`/`oapi-codegen` in the scaffolded module's own `go.mod`?** Go 1.24's `go get -tool` would pin them reproducibly, but empirically pulls ~40 transitive packages (sqlc alone drags in a wasm runtime, a full SQL parser, grpc, zap...) into `go.sum`, and can bump the module's `go` directive higher than intended — for tools that never ship in the built binary. `go run pkg@version` avoids both: no `go.mod` pollution, versions still pinned (kept in sync between the Makefile template and `scaffold.mjs`'s own constants).
- **Why is the Dockerfile's builder tag `golang:1-alpine` and not a pinned patch version?** `go mod tidy` bumps `go.mod`'s `go` directive as dependencies require. A pinned builder tag goes stale and eventually fails the build ("go.mod requires go >= X, running Y"); the floating major tag always tracks current.
- **Why does `docker-compose.yml`'s `api` service override `DATABASE_URL` instead of relying on `.env` alone?** `.env.example`'s `DATABASE_URL` points at `localhost:5432`, correct for `make run` on the host against `docker compose up -d db` (which publishes that port). Inside the `api` container, `localhost` is itself, not the `db` service — the compose file overrides just that key to `db:5432` while `ADDR`/`LOG_LEVEL`/`CORS_ORIGINS` still come from `.env` via `env_file`.
- **Why `api.HandlerWithOptions` instead of the simpler `api.HandlerFromMux`?** oapi-codegen's strict-server wrapper only covers JSON body decode errors, via `RequestErrorHandlerFunc`. Path/query param binding (e.g. a malformed UUID in `/users/{id}`) goes through a *different* error path — the underlying chi `ServerInterfaceWrapper`'s own `ErrorHandlerFunc`, which defaults to writing the raw parser error text straight to the client. `HandlerWithOptions` routes both paths through the same handler (`handleRequestError`), so neither leaks internals — verified live: hitting `/api/v1/users/not-a-uuid` returns `{"code":"bad_request","message":"invalid request"}`, not the underlying `uuid: invalid UUID length` parser error.
- **Why is `store.Querier` used directly as `Server`'s dependency type instead of a hand-rolled interface?** sqlc already generates `Querier` (the exact method set `*store.Queries` implements) in `querier.go` — a hand-written duplicate would just be a second copy to keep in sync by hand.
- **Why does `readyz` check `s.pool.Ping`, and why must handlers never call `pool.Ping` themselves elsewhere?** `pgxpool.New` doesn't eagerly connect — the pool is usable (and the process starts cleanly) even against an unreachable database; only `readyz` and actual queries surface connectivity failures. Verified live: with `DATABASE_URL` pointed at a closed port, the binary still starts, `/healthz` returns 200, `/readyz` returns 503, and `POST /api/v1/users` returns a generic 500 (the connect error is logged server-side, never echoed to the client).

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir:

```sh
mkdir scaffold-test && cd scaffold-test
node <skill-dir>/scripts/scaffold.mjs --module github.com/acme/scaffold-test --dir .
```

Expect: exit 0, `go build`/`go vet`/`go test` all pass inline, a git commit created. Then actually run the binary and curl it — static checks alone don't prove runtime behavior:

```sh
DATABASE_URL="postgres://x:x@localhost:1/x?sslmode=disable" ADDR=":18080" ./bin/server &
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/healthz   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:18080/readyz   # 503, no live db
curl -s http://localhost:18080/api/v1/users/not-a-uuid                    # {"code":"bad_request",...} — not a leaked parser error
```

Re-run the same scaffold command again without `--force` → must fail fast ("exists and is not empty"), exit 2, no files touched.

For a fast file-tree-only pass while iterating on templates, add `--skip-verify` — expect exit 0 in a couple seconds, no codegen/build/commit; inspect the written files directly, don't treat that run as a stand-in for the full validation above.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/files/` — **source of truth** for every file written into the project. `STATIC_FILES` are written before codegen runs; `GLUE_FILES` (which import the generated `internal/api`/`internal/store` packages) are written after.
