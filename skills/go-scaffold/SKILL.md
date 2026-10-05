---
name: go-scaffold
description: "Scaffolds a new Go modular-monolith REST API from scratch (no go.mod yet) — Gin, contract-first oapi-codegen, GORM + Postgres, JWT auth. Triggers: 'scaffold go api', 'create go rest api', 'new go backend'."
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

- **`go.mod` and `internal/arch/arch_test.go` both exist** → a complete or partial scaffold from a prior run. Ask: *"This looks like an earlier go-scaffold run — overwrite with --force? (yes / no)"*. If yes → re-run Step 3 with `--force`. If no → stop.
- **`go.mod` exists without that signature file** → an existing project, not a prior run. `--force` would overwrite its `go.mod`, `Makefile`, `README.md` and `cmd/server/main.go`, so never offer it. Stop and point to `task-workflow` (add to it) or `bigin-harness-setup` (govern it).
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
node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs --module <module-path> [--dir <dir>] [--project <name>] [--cors <origins>] [--force] [--no-commit] [--skip-verify]
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

Maintainer notes (design rationale, manual validation after changing the script or templates) live in `references/MAINTAINING.md`. A scaffold run never needs them, so it never reads them.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only).
- `scripts/templates/files/` — **source of truth** for every file written into the project. `walkFiles` collects the whole tree and `writeFiles` writes it in one pass; nothing is compiled until codegen runs afterward, so there is no write-order split. `{{MODULE}}`/`{{PROJECT_NAME}}`/`{{DB_SLUG}}`/`{{CORS}}`/`{{OAPI_CODEGEN_VERSION}}` are substituted per file — note `{{MODULE}}` now appears in nearly every `.go` template, since intra-project imports are absolute in Go.
