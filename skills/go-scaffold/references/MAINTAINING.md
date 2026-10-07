# go-scaffold — maintainer notes

Not loaded at run time: `SKILL.md` keeps only what a scaffold run executes. Read this when changing `scripts/scaffold.mjs` or its templates. Paths below are relative to this skill's directory; `tools/regress.mjs` is in the bigin-skills repo.

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

- **Why does the auth guard take an interface for sessions?** `internal/api/middleware` must not import a module, but a cookie is only meaningful to the module that stores sessions. `auth.SessionResolver` is declared in the kernel; the users module's `Service` implements it (asserted at compile time), `users.Module.Sessions()` hands it out, and `cmd/server` passes it into `api.Options`. The same seam is what lets `router_test.go` assert cookie handling with a fake and no database.
- **Why is CSRF keyed on how the request authenticated, not on whether a cookie is present?** A cookie the guard never read can't be abused, and checking every request that happens to carry one would 403 a browser calling a public route with a stale cookie. `Require` marks cookie-authenticated requests and `middleware.CSRF` — run after it — checks only those, plus the two `/auth/session` operations, which are public by necessity and forgeable by design (login CSRF, forced logout). `WEB_ORIGINS` stays separate from `CORS_ORIGINS`: one decides who may *read*, the other who may *change state* with a user's cookie, and widening one must not silently widen the other.

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
| `POST /api/v1/auth/session` with `Origin: http://localhost:3000` (in `WEB_ORIGINS`) | 201, `Set-Cookie: __Host-session=…; HttpOnly; Secure; SameSite=Lax` |
| same, with no `Origin` or `Origin: null` | 403 — login CSRF |
| `GET /api/v1/user/profile` with that cookie | 200 |
| `PUT /api/v1/user/profile` with the cookie, no `Origin` / foreign `Origin` / allowlisted `Origin` | 403 / 403 / 200 |
| the same `PUT` with a Bearer token and no `Origin` | 200 — Bearer is CSRF-exempt |
| an invalid Bearer plus the valid cookie | 401 — no fallback |
| `DELETE /api/v1/auth/session` with the cookie, then `GET /api/v1/user/profile` with it | 200 then 401 |
| `WEB_ORIGINS=*` | the binary refuses to boot |

Also worth a look in `psql`: `token_hash` is 64 hex chars (SHA-256) and no raw refresh token or session ID appears anywhere in `refresh_tokens` or `sessions`.

That rate limit is per-IP and per-route with a one-minute window, so re-running the login probes inside the same minute keeps returning 429 — wait it out rather than debugging a phantom failure. If host port 5454 is already taken by another Postgres, remap it in the *test copy* only; don't change the template to dodge a local collision.

For a fast file-tree-only pass while iterating on templates, add `--skip-verify` — expect exit 0 in well under a second, no codegen/build/commit; inspect the written files directly, don't treat that run as a stand-in for the full validation above.
