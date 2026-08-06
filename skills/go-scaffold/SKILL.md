---
name: go-scaffold
description: "Scaffolds a new Go REST API from scratch — empty repo or no go.mod. Gin, contract-first oapi-codegen, GORM + Postgres, JWT access/refresh auth. Triggers: 'scaffold go api', 'create go rest api', 'new go backend'."
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# go-scaffold

This skill is mechanical: gather config, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Go REST API from a single template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the CLI flags, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Go ≥1.24, Gin, contract-first via `oapi-codegen` (`openapi.yaml` → `api/api.gen.go`: gin-server interface + request/response models), GORM + `pgx` on Postgres, `godotenv` config, `golang-migrate` for schema, `air` for hot reload.

One template only — no variant menu like nuxt-scaffold's. The generated app is a flat-package REST API with a full auth kernel: signup with password-complexity + HTML-rejection validation, login, refresh-token **rotation** (opaque, stored hashed, replay-detecting), logout, an authenticated profile, and admin user management (list/paginate, role change, delete) with self-demotion and self-deletion blocked. Per-route rate limiting, an origin-allowlisted CORS layer, liveness/readiness probes. Everything else about the shape is fixed.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Go ≥1.24 on PATH, git. Docker/staticcheck are optional — staticcheck runs if found on PATH and is skipped with a note otherwise; Docker isn't touched by the script at all (compose/Dockerfile are written but never invoked). Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-api` first, or pass `--dir`).

---

## When not to use

This skill only ever creates a **new** project. A request about a Go app that already exists belongs elsewhere — even when it names this exact stack. Gin, GORM, `oapi-codegen`, JWT refresh rotation are what this scaffold *generates*; they are not topics it owns.

- Add a feature, endpoint, or query to an existing Go API → `task-workflow`
- Fix a bug or a failing check → `debug-workflow`
- Explain how a library in the stack works → answer directly, no skill
- Add governance files to an already-scaffolded repo → `bigin-harness-setup`

---

## Step 1: Detect state & confirm

Check the target directory:

- **`go.mod` already exists** → complete or partial scaffold from a prior run. Ask: *"go.mod already exists here — overwrite with --force? (yes / no)"*. If yes → re-run Step 3 with `--force`. If no → stop.
- **No `go.mod`, directory empty or doesn't exist** → ask: *"Scaffold a Go REST API here (Gin + oapi-codegen + GORM + Postgres)? (yes / no)"*. If no → stop.
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

Stream its output — the first run downloads and builds `oapi-codegen` via `go run pkg@version` (not installed globally, not added to the scaffolded module's own `go.mod`), which takes roughly a minute. Every subsequent stage (`go mod tidy`, `gofmt`, `go vet`, `go build`, `go test`, optional `staticcheck`, `git commit`) is internal — do not duplicate any of it by hand.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → bad flags; fix per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing command (commonly: Go not on PATH, Go <1.24, or a network failure downloading `oapi-codegen`/module deps). Fix the cause and re-run with `--force` — files from the failed attempt were already written.

---

## Design notes (for maintainers)

- **Why is routing generated but security hand-wired?** `oapi-codegen`'s gin-server registers every operation on one router and does **not** enforce `security:` from the contract. `middleware/selector.go` closes that gap by matching `c.FullPath()` prefixes (`/api/v1/user` → user role, `/api/v1/admin` → admin role) and applying per-route rate limits. That coupling is the scaffold's sharpest edge: `GinServerOptions.BaseURL` in `main.go` is part of the string the selectors match, so changing it without updating the selectors makes every case fall through to `default: c.Next()` — protected routes go **public**, nothing fails to compile, and every response is still 200. `main_test.go` asserts both directions (protected routes 401 anonymously, public auth routes not 401) against the real `newRouter`, which is why `newRouter` is split out of `main()`.
- **Why not vendor `oapi-codegen` in the scaffolded module's own `go.mod`?** Go 1.24's `go get -tool` would pin it reproducibly, but pulls its whole dependency tree into `go.sum` for a tool that never ships in the built binary. `go run pkg@version` avoids that: no `go.mod` pollution, version still pinned (kept in sync between the Makefile template and `scaffold.mjs`'s own constant).
- **Why does `api/` have no template file?** It holds nothing but `api.gen.go`. `scaffold.mjs` creates the directory explicitly before codegen, because `oapi-codegen` won't create a missing output directory itself.
- **Why two layers of HTML defense?** The `notags` custom validator (`utils/validators.go`, registered into Gin's validator engine before the first request) rejects markup at *bind* time with a clear 400; `utils.SanitizeText` (bluemonday + control-char strip + whitespace collapse) cleans at *write* time. The first gives the client a usable error, the second keeps the DB clean if anything ever routes around the first.
- **Why is `Makefile`'s `include .env` written as `-include .env`?** A fresh clone has no `.env`. With plain `include`, every target — `test`, `build`, `lint` — dies on a missing file; `-include` degrades to just the DB-URL targets failing, which is the only place the values are actually needed.
- **Why does `docker-compose.yml` publish Postgres on host 5454, and name the volume explicitly?** 5432 is the port every other Postgres on a developer machine also wants; only the host side moves, the container keeps 5432. The volume is explicitly named rather than left as the implicit `<project>_pgdata` because adopting a stale volume makes Postgres ignore the credentials in the compose file (they only apply when initialising an empty data directory), producing a confusing "password authentication failed".
- **Why does `main()` `log.Fatal` on a missing `JWT_SECRET`, and why does the DB connect eagerly?** An empty signing key would silently accept forged tokens, so booting without one is never the safer option. GORM's Postgres driver connects on `gorm.Open`, so a bad DSN also fails at boot rather than on first request — `/readyz` exists for the DB going away *after* startup, not for starting without one.

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir:

```sh
mkdir scaffold-test && cd scaffold-test
node <skill-dir>/scripts/scaffold.mjs --module github.com/acme/scaffold-test --dir .
```

Expect: exit 0, `go build`/`go vet`/`go test`/`staticcheck` all pass inline, a git commit created. Re-run the same command without `--force` → must fail fast ("exists and is not empty"), exit 2, no files touched.

Then check the two things static analysis can't prove — that the CI drift gate holds, and that the app actually serves:

```sh
make generate && gofmt -s -w . && git diff --exit-code api/api.gen.go   # codegen is reproducible
cp .env.example .env      # set JWT_SECRET
docker compose up -d db && make migrate-up
PORT=18090 ./bin/server &
```

Golden path to exercise (needs the live Postgres above — the binary refuses to boot without a reachable DB):

| Probe | Expect |
|---|---|
| `GET /healthz` / `GET /readyz` / `GET /openapi.yaml` | 200 |
| `GET /api/v1/user/profile`, `GET /api/v1/admin/users` anonymously | 401 — selectors are live |
| `POST /api/v1/auth/signup` with `"password":"weakpass"` | 400, names the missing character class |
| `POST /api/v1/auth/signup` with `"full_name":"<b>x</b>"` | 400 on the `notags` tag |
| signup `Ada@Example.COM`, then signup `ada@example.com` | 201 then 409 — email normalised before the dup check |
| `POST /api/v1/auth/login` → `GET /api/v1/user/profile` with the token | 200 |
| `GET /api/v1/admin/users` with a *user* token | 403 |
| `POST /api/v1/auth/refresh` twice with the **same** token | 200 then 401 — rotation revoked the first |
| 7 rapid `POST /api/v1/auth/login` | 5 pass, then 429 |

That rate limit is per-IP and per-route with a one-minute window, so re-running the login probes inside the same minute keeps returning 429 — wait it out rather than debugging a phantom failure. If host port 5454 is already taken by another Postgres, remap it in the *test copy* only; don't change the template to dodge a local collision.

For a fast file-tree-only pass while iterating on templates, add `--skip-verify` — expect exit 0 in a couple seconds, no codegen/build/commit; inspect the written files directly, don't treat that run as a stand-in for the full validation above.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/files/` — **source of truth** for every file written into the project. `walkFiles` collects the whole tree and `writeFiles` writes it in one pass; nothing is compiled until codegen runs afterward, so there is no write-order split. `{{MODULE}}`/`{{PROJECT_NAME}}`/`{{DB_SLUG}}`/`{{CORS}}`/`{{OAPI_CODEGEN_VERSION}}` are substituted per file.
