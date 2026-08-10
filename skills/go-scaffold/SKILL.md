---
name: go-scaffold
description: "Scaffolds a new Go modular-monolith REST API from scratch — empty repo or no go.mod. Gin, contract-first oapi-codegen, GORM + Postgres, JWT access/refresh auth, test-enforced module boundaries. Triggers: 'scaffold go api', 'create go rest api', 'new go backend'."
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# go-scaffold

This skill is mechanical: gather config, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Go REST API from a single template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the CLI flags, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Go ≥1.24, Gin, contract-first via `oapi-codegen` (`openapi.yaml` → `internal/openapi/openapi.gen.go`: gin-server interface + request/response models), GORM + `pgx` on Postgres, `godotenv` config, `golang-migrate` for schema, `air` for hot reload.

One template only — no variant menu like nuxt-scaffold's. The generated app is a **modular monolith**: `cmd/server` is the composition root, `internal/modules/<mod>/` holds each module's four layers (`domain`, `application`, `infrastructure`, `api`) behind a `module.go` public contract, and `internal/shared/` holds the cross-cutting kernel. It ships **one module** (`users`) carrying the full auth kernel: signup with password-complexity + HTML-rejection validation, login, refresh-token **rotation** (opaque, stored hashed, replay-detecting), logout, an authenticated profile, and admin user management (list/paginate, role change, delete) with self-demotion and self-deletion blocked. Per-route rate limiting, an origin-allowlisted CORS layer, liveness/readiness probes. `internal/arch` enforces the boundaries as a test. Everything else about the shape is fixed.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Go ≥1.24 on PATH, git. Docker/staticcheck are optional — staticcheck runs if found on PATH and is skipped with a note otherwise; Docker isn't touched by the script at all (compose/Dockerfile are written but never invoked). Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-api` first, or pass `--dir`).

---

## When not to use

This skill only ever creates a **new** project. A request about a Go app that already exists belongs elsewhere — even when it names this exact stack. Gin, GORM, `oapi-codegen`, JWT refresh rotation are what this scaffold *generates*; they are not topics it owns.

- Add a feature, endpoint, module, or query to an existing Go API → `task-workflow`
- Fix a bug or a failing check → `debug-workflow`
- Explain how a library in the stack works → answer directly, no skill
- Add governance files to an already-scaffolded repo → `bigin-harness-setup`

---

## Step 1: Detect state & confirm

Check the target directory:

- **`go.mod` already exists** → complete or partial scaffold from a prior run. Ask: *"go.mod already exists here — overwrite with --force? (yes / no)"*. If yes → re-run Step 3 with `--force`. If no → stop.
- **No `go.mod`, directory empty or doesn't exist** → ask: *"Scaffold a Go modular-monolith REST API here (Gin + oapi-codegen + GORM + Postgres)? (yes / no)"*. If no → stop.
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

### Structure

- **Why a modular monolith with only one module?** The layering is the deliverable — a repo whose first feature has an obvious home, and whose second module is a copy of the first rather than an argument. Shipping a second example module (the Node sibling's `posts`) was considered and declined: it doubles the surface to demonstrate a boundary that `internal/arch` already enforces mechanically. What replaces it is documentation of the exact shape a cross-module read must take, in `internal/modules/users/module.go`'s package comment — batch method on the module root, plain return type — because that is the decision a second module gets wrong.
- **Why `internal/openapi` rather than the old top-level `api/`?** Both `internal/api` (composition root) and each module's `api` package need the generated request/response types. If the generated code lived in either, the other could not import it without a cycle. A third package that both depend on is the only arrangement that works, and `internal/` keeps it unimportable from outside the module.
- **Why does the composition root embed `users.Handlers` instead of forwarding each method?** `oapi-codegen` generates ONE interface covering every operation, so a modular monolith has to reassemble modules into it somewhere. Embedding keeps `internal/api/server.go` to one line per module and is still fully compile-checked: `var _ openapi.ServerInterface = (*server)(nil)` fails the build the moment the contract gains an operation nobody implements. Two modules exporting the same method name is an *ambiguous selector* compile error, not a silent pick — resolve it with an explicit forwarding method.
- **Why is `module.go` an alias (`type Handlers = usersapi.Handlers`) rather than a wrapper?** So the composition root can embed the module's HTTP surface while importing only the module root. Without the alias, `internal/api` would have to import `internal/modules/users/api` directly, and the encapsulation rule below would have to carve out an exception for the one package most likely to abuse it.
- **Why `apperr` and not `errors`?** The package uses `errors.As` internally; naming it `errors` would shadow the standard library in its own files. The type it exports is what lets a use case say "this is a conflict" without importing `net/http` — `httpx.Fail` is the single place a `Kind` becomes a status code, and an error that never passed through `apperr` becomes 500 with a fixed message, so a driver error naming tables or the DSN can't reach a client by accident.
- **Why does nothing below `cmd/server` read `os.Getenv`?** `shared/config` resolves the environment once into a struct, and the signing key, TTLs, and CORS allowlist are passed down as arguments. `auth.TokenIssuer` holds the key as a field for the same reason: a package that reads the environment mid-request is invisible in the wiring and one deployment mistake away from signing with an empty key. It also removed every `t.Setenv` from the token tests.

### Enforcement

- **Why an architecture test rather than `golangci-lint`'s `depguard`?** It needs no tool on PATH, runs inside the `go test ./...` the scaffold and CI already run, and the failure message names the rule *and the reason* rather than a config key. `internal/arch/arch.go` reads imports with `go/parser` in `ImportsOnly` mode — no `golang.org/x/tools` dependency, and unlike a type-checked load it also sees files excluded by a build tag, which is exactly where an illegal import would survive.
- **The rule that makes a module a module** is encapsulation: from outside `internal/modules/<m>/`, the only importable package is the module root. Not its `domain`, not its `application` — and this applies to the composition root too. The layering rules (domain innermost, application depends on ports, domain/application free of gin and gorm, shared imports no module) are a static pattern table; encapsulation is a separate check because it has to compare the importing and imported module identities.
- **`arch_test.go` tests the checker, not just the repo.** A checker whose patterns silently match nothing keeps the suite green while every boundary rots — the classic dead-gate failure. The fixture table asserts both directions for each rule: the illegal import is caught, and the legal shape of the same import is not.
- **Why is routing generated but security hand-wired?** `oapi-codegen`'s gin-server registers every operation on one router and does **not** enforce `security:` from the contract. `internal/api/middleware/selector.go` closes that gap by matching `c.FullPath()` prefixes (`/api/v1/user` → user role, `/api/v1/admin` → admin role) and applying per-route rate limits. **The BaseURL drift that used to be this scaffold's sharpest edge is now structurally impossible**: `middleware.BaseURL` is one constant, read both by the router's `GinServerOptions.BaseURL` and by the selectors, so the two cannot disagree. What remains is a *new* path prefix with no selector case — public, compiling, answering 200 — which is why `internal/api/router_test.go` still asserts both directions against the real `NewRouter`.

### Stack choices

- **Why not vendor `oapi-codegen` in the scaffolded module's own `go.mod`?** Go 1.24's `go get -tool` would pin it reproducibly, but pulls its whole dependency tree into `go.sum` for a tool that never ships in the built binary. `go run pkg@version` avoids that: no `go.mod` pollution, version still pinned (kept in sync between the Makefile template and `scaffold.mjs`'s own constant).
- **Why does `internal/openapi/` have no template file?** It holds nothing but generated output. `scaffold.mjs` creates the directory explicitly (`OAPI_OUTPUT_DIR`, kept in sync with `oapi-codegen.yaml`'s `output:`) because `oapi-codegen` won't create a missing output directory itself.
- **Why two layers of HTML defense?** The `notags` custom validator (`shared/validate`, registered into Gin's validator engine before the first request) rejects markup at *bind* time with a clear 400; `validate.SanitizeText` (bluemonday + control-char strip + whitespace collapse) cleans at *write* time, called from `domain.NewUser`/`Rename` so every caller gets it, not just the JSON one. The first gives the client a usable error, the second keeps the DB clean if anything ever routes around the first.
- **Why is `Makefile`'s `include .env` written as `-include .env`?** A fresh clone has no `.env`. With plain `include`, every target — `test`, `build`, `lint` — dies on a missing file; `-include` degrades to just the DB-URL targets failing, which is the only place the values are actually needed.
- **Why does `docker-compose.yml` publish Postgres on host 5454, and name the volume explicitly?** 5432 is the port every other Postgres on a developer machine also wants; only the host side moves, the container keeps 5432. The volume is explicitly named rather than left as the implicit `<project>_pgdata` because adopting a stale volume makes Postgres ignore the credentials in the compose file (they only apply when initialising an empty data directory), producing a confusing "password authentication failed".
- **Why does `config.Load` fail on a missing `JWT_SECRET`, and why does the DB connect eagerly?** An empty signing key would silently accept forged tokens, so booting without one is never the safer option. GORM's Postgres driver connects on `gorm.Open`, so a bad DSN also fails at boot rather than on first request — `/readyz` exists for the DB going away *after* startup, not for starting without one. `db.Ping` is nil-safe so a router built without a database reports unavailable instead of panicking.

## Manual validation (maintainers)

After changing `scaffold.mjs` or templates, verify in an empty temp dir:

```sh
mkdir scaffold-test && cd scaffold-test
node <skill-dir>/scripts/scaffold.mjs --module github.com/acme/scaffold-test --dir .
```

Expect: exit 0, `go build`/`go vet`/`go test`/`staticcheck` all pass inline, a git commit created. Re-run the same command without `--force` → must fail fast ("exists and is not empty"), exit 2, no files touched.

Then check the three things static analysis can't prove.

**1. The CI drift gate holds.**

```sh
make generate && gofmt -s -w . && git diff --exit-code internal/openapi/openapi.gen.go
```

**2. The architecture test actually fires.** Two injections, because they fail for different reasons — one is a forbidden dependency, the other a forbidden *depth*. Both must compile, or the test isn't what caught them:

```sh
# a) domain reaching for the ORM
sed -i '' 's|^import (|import (\n\t_ "gorm.io/gorm"|' internal/modules/users/domain/user.go
go test ./internal/arch/    # must FAIL: "domain and application stay framework-free"
git checkout internal/modules/users/domain/user.go

# b) the composition root reaching past a module's public contract
sed -i '' 's|"<module>/internal/modules/users"|&\n\t_ "<module>/internal/modules/users/application"|' internal/api/server.go
go build ./...              # must SUCCEED — nothing else catches this
go test ./internal/arch/    # must FAIL: "a module's subpackages are private to it"
git checkout internal/api/server.go
```

**3. The app actually serves.** Needs a live Postgres — the binary refuses to boot without a reachable DB. `docker compose up -d db && make migrate-up` is the normal path; without a Docker daemon, a throwaway cluster works just as well (`initdb` into a temp dir, start it with `-k /tmp/<short>` because a long socket path exceeds the 103-byte limit, then create the `<project>` role and database to match `.env`).

```sh
cp .env.example .env      # set JWT_SECRET
PORT=18090 ./bin/server &
```

| Probe | Expect |
|---|---|
| `GET /healthz` / `GET /readyz` / `GET /openapi.yaml` | 200 |
| `GET /api/v1/user/profile`, `GET /api/v1/admin/users` anonymously | 401 — selectors are live |
| `POST /api/v1/auth/signup` with `"password":"weakpass"` | 400, names the missing character class |
| `POST /api/v1/auth/signup` with `"full_name":"<b>x</b>"` | 400 on the `notags` tag |
| signup `Ada@Example.COM`, then signup `ada@example.com` | 201 then 409 — email normalised before the dup check |
| `POST /api/v1/auth/login` → `GET /api/v1/user/profile` with the token | 200 |
| `GET /api/v1/admin/users` with a *user* token | 403 |
| `GET /api/v1/admin/users?limit=1000000` as admin | 200 with `"limit":20` — clamped in the use case, not the handler |
| self-demote / self-delete via `/api/v1/admin/users/<own id>` | 400 both |
| `DELETE /api/v1/admin/users/9999` | 404, not a cheerful 200 |
| `POST /api/v1/auth/refresh` twice with the **same** token | 200 then 401 — rotation revoked the first |
| logout, then refresh with the same token | 200 then 401 |
| stop Postgres → `GET /healthz` / `GET /readyz` | 200 / 503 |
| 6 rapid `POST /api/v1/auth/login` | the tail returns 429 |

Also worth a look in `psql`: `token_hash` is 64 hex chars (SHA-256) and no raw refresh token appears anywhere in the table.

That rate limit is per-IP and per-route with a one-minute window, so re-running the login probes inside the same minute keeps returning 429 — wait it out rather than debugging a phantom failure. If host port 5454 is already taken by another Postgres, remap it in the *test copy* only; don't change the template to dodge a local collision.

For a fast file-tree-only pass while iterating on templates, add `--skip-verify` — expect exit 0 in well under a second, no codegen/build/commit; inspect the written files directly, don't treat that run as a stand-in for the full validation above.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/files/` — **source of truth** for every file written into the project. `walkFiles` collects the whole tree and `writeFiles` writes it in one pass; nothing is compiled until codegen runs afterward, so there is no write-order split. `{{MODULE}}`/`{{PROJECT_NAME}}`/`{{DB_SLUG}}`/`{{CORS}}`/`{{OAPI_CODEGEN_VERSION}}` are substituted per file — note `{{MODULE}}` now appears in nearly every `.go` template, since intra-project imports are absolute in Go.
