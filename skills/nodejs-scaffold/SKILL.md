---
name: nodejs-scaffold
description: "Scaffolds a new Node.js modular-monolith REST API from scratch (no package.json yet) — Fastify, TypeBox OpenAPI, Drizzle + Postgres, JWT auth. Triggers: 'scaffold node api', 'create a fastify backend', 'new node backend'."
effort: low
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs *)
---

# nodejs-scaffold

This skill is mechanical: gather config, run the script, relay its output. Do not deliberate — no thinking needed on any step here.

Scaffolds a Node.js REST API from a single template. The mechanical work is done by a deterministic script — `scripts/scaffold.mjs` (Node stdlib only, cross-platform, zero prompts). This skill's only jobs: **decide the CLI flags, run the script, report the result.** Do not perform any scaffolding steps yourself.

Stack: Node.js ≥22, Fastify (modular monolith), **code-first OpenAPI** via TypeBox + `@fastify/swagger`/`@fastify/swagger-ui` (route schemas generate `src/api/openapi.json`), per-module `drizzle-orm` schemas + `postgres` (postgres.js) + Postgres with `drizzle-kit` migrations, JWT (`@fastify/jwt`, HS256) + argon2id auth, an in-process event bus + `graphile-worker` job queue (outbox/inbox pattern), Idempotency-Key handling, cursor pagination, a fixed nested error contract, `@fastify/cors` + `@fastify/rate-limit`, Fastify's built-in `pino` logger, ESLint (flat config) with `eslint-plugin-boundaries` enforcing module boundaries, Vitest.

One template only — no variant menu like nuxt-scaffold's. The generated app ships **two example modules** proving the full architecture end-to-end: `users` (create/list/get + auth) and `posts` (which composes `author_name` from `users` through a real cross-module read — the concrete proof the module boundary and batch-get rule work, not an empty folder a lint rule passes on). Everything else about the shape is fixed.

> Governance (CLAUDE.md, `.claude/rules/`, AI guides, `bash-guard.mjs`) is **not** this skill's job — run `bigin-harness-setup` afterward to overlay it.

Prerequisites: Node.js ≥22 on PATH, pnpm on PATH (`corepack enable && corepack prepare pnpm@latest --activate` if missing), git. Docker isn't touched by the script (compose/Dockerfile are written but never invoked). Scaffolding is **in-place** into the target directory (for a brand-new project: `mkdir my-api` first, or pass `--dir`).

---

## When not to use

This skill only ever creates a **new** project. A request about a Node app that already exists belongs elsewhere — even when it names this exact stack. Fastify, Drizzle, TypeBox, the outbox/inbox and the job queue are what this scaffold *generates*; they are not topics it owns.

- Add a feature, endpoint, migration, or worker to an existing Node API → `task-workflow`
- Fix a bug or a failing check → `debug-workflow`
- Explain how a library in the stack works → answer directly, no skill
- Add governance files to an already-scaffolded repo → `bigin-harness-setup`

---

## Step 1: Detect state & confirm

Check the target directory:

- **`package.json` and `drizzle.config.ts` and `src/modules/users/` all exist** → a complete or partial scaffold from a prior run. Ask: *"This looks like an earlier nodejs-scaffold run — overwrite with --force? (yes / no)"*. If yes → re-run Step 3 with `--force`. If no → stop.
- **`package.json` exists without those signature files** → an existing project, not a prior run. `--force` would overwrite its `package.json`, `README.md`, `tsconfig.json` and every other template path, so never offer it. Stop and point to `task-workflow` (add to it) or `bigin-harness-setup` (govern it).
- **No `package.json`, directory empty or doesn't exist** → ask: *"Scaffold a Node.js REST API here (Fastify modular monolith + Drizzle + Postgres)? (yes / no)"*. If no → stop.
- **No `package.json`, but directory has other files** (e.g. a README already committed) → same question, but flag that `--force` will be needed since the script refuses to write into a non-empty directory otherwise.

## Step 2: Gather config

One decision matters here — everything else defaults sensibly:

1. **Project name** (required, free text, not `AskUserQuestion` — needs regex validation, not a menu) — kebab-case, e.g. `orders-api`. Drives `package.json` name, Docker image name, Postgres user/db, README/OpenAPI title. Ask directly; there's no sensible default. Node has no module-path concept, so `--project` is the only required flag.

No `AskUserQuestion` call needed here — there's no multi-choice decision (this skill has one template, one stack). CORS origins, target directory, and commit behavior all default sensibly (see flag table below); only ask about them if the request implies a specific need (a named frontend origin, scaffolding without git, or maintainer template iteration).

Show a one-line summary and confirm, e.g. `Project: orders-api · Dir: .` If no → stop.

## Step 3: Run the script

```sh
node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs --project <name> [--dir <dir>] [--cors <origins>] [--force] [--no-commit] [--skip-verify]
```

| Flag | Default | Purpose |
|---|---|---|
| `--project` | *(required)* | kebab-case project name |
| `--dir` | `.` | Target directory |
| `--cors` | `http://localhost:3000` | Comma-separated default `CORS_ORIGINS` |
| `--force` | off | Allow writing into a non-empty directory |
| `--no-commit` | off | Skip `git init`/`add`/`commit` entirely — files are written and verified but nothing is committed |
| `--skip-verify` | off | Write files only — skip `pnpm add`, codegen, lint, typecheck, build, test, and commit. **Maintainer-only**, for fast template iteration; never set this from the normal user-facing flow. The result isn't buildable until `pnpm install && pnpm db:generate && pnpm openapi:export` run manually afterward. |

Stream its output — `pnpm add` (deps then devDeps) takes the bulk of the time on a fresh run. Every subsequent stage (codegen, `openapi:export`, lint, type-check, build, test, `git commit`) is internal — do not duplicate any of it by hand.

## Step 4: Report

- **Exit 0** → relay the script's "Next steps" output verbatim.
- **Exit 2** → bad flags; fix per the error message and re-run.
- **Exit 1** → runtime failure; the last `[scaffold] ERROR:` line names the failing command (commonly: pnpm not on PATH, Node <22, or a network failure during `pnpm add`). Fix the cause and re-run with `--force` — files from the failed attempt were already written.

Maintainer notes (design rationale, manual validation after changing the script or templates) live in `references/MAINTAINING.md`. A scaffold run never needs them, so it never reads them.

## References

- `scripts/scaffold.mjs` — the scaffold implementation (single file, Node stdlib only). Discovers template files by recursively walking `scripts/templates/files/` and writes them all in one pass (no STATIC/GLUE split — code-first OpenAPI removed the ordering dependency), then runs `pnpm add` → `drizzle-kit generate` → `openapi:export` → lint/type-check/build/test → commit. Never runs `pnpm test:integration` itself (see the testing design note above).
- `scripts/templates/files/` — **source of truth** for every file written into the project. `src/api/openapi.json` and `drizzle/*.sql` are NOT here — they're generated during the run and committed. `tests/global-setup.ts` and `vitest.integration.config.ts` are the testcontainers wiring for `pnpm test:integration`; `scripts/seed.ts` backs `pnpm dev:setup`.
