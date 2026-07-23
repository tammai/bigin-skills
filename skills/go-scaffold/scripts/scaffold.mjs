#!/usr/bin/env node
/**
 * scaffold.mjs — deterministic Go modular-monolith REST API scaffold.
 *
 * Usage:
 *   node scaffold.mjs --module github.com/acme/orders-api [--dir orders-api]
 *                      [--project orders-api] [--cors https://app.example.com]
 *                      [--force] [--no-commit] [--skip-verify]
 *
 * Contract-first, per-module codegen (ADR §4.1): the single api/openapi.yaml
 * tags every operation with its module; each module's own oapi-codegen config
 * (include-tags) generates that module's chi-server interface + models into its
 * nested internal/gen/. sqlc generates each module's typed queries into its
 * internal/infrastructure/db/. This script runs every generator itself so the
 * repo it leaves behind builds and tests green, not a skeleton needing fixup.
 *
 * All decisions are pre-resolved via CLI flags — never prompts, never stdin.
 * Node stdlib only. Exit codes: 0 ok, 1 runtime failure, 2 bad usage/args.
 *
 * go/git/docker are native binaries on every platform (unlike npm/pnpm's .cmd
 * shims on Windows) — spawnSync needs no shell:true workaround here.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, spawn } from 'node:child_process'
import { parseArgs } from 'node:util'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(SCRIPT_DIR, 'templates', 'files')

// Pinned via `go run pkg@version` — never added to the scaffolded module's own
// go.mod (that would drag ~40 unrelated transitive deps into go.sum just to pin
// a dev tool). Bump here + the Makefile stays in sync (its template is written
// from these too).
const SQLC_VERSION = 'v1.29.0'
const OAPI_CODEGEN_VERSION = 'v2.4.1'

// Per-module oapi-codegen configs (ADR §4.1). Each writes gen.go into its own
// nested internal/gen/ (output path is set inside each config, relative to the
// project root this script runs generators from).
const OAPI_MODULE_CONFIGS = [
  'internal/users/internal/gen/oapi-codegen.yaml',
  'internal/posts/internal/gen/oapi-codegen.yaml'
]

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MODULE_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]*(\/[A-Za-z0-9][A-Za-z0-9._~-]*)*$/
const ORIGIN_RE = /^https?:\/\/[^\s,"]+$/

function log(msg) {
  console.log(`[scaffold] ${msg}`)
}

function fail(msg, code = 1) {
  console.error(`[scaffold] ERROR: ${msg}`)
  process.exit(code)
}

// ── args ────────────────────────────────────────────────────────────────

function parseCliArgs() {
  let values
  try {
    ;({ values } = parseArgs({
      options: {
        module: { type: 'string' },
        dir: { type: 'string', default: '.' },
        project: { type: 'string' },
        cors: { type: 'string', default: 'http://localhost:3000' },
        force: { type: 'boolean', default: false },
        'no-commit': { type: 'boolean', default: false },
        'skip-verify': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false }
      }
    }))
  } catch (e) {
    fail(`bad arguments: ${e.message}`, 2)
  }

  if (values.help) {
    console.log(`node scaffold.mjs --module <path> [options]

Required:
  --module <path>    Go module path, e.g. github.com/acme/orders-api

Optional:
  --dir <dir>        Target directory (default: .)
  --project <name>   kebab-case project name (default: last segment of --module)
  --cors <origins>   Comma-separated default CORS origins (default: http://localhost:3000)
  --force            Write into a non-empty directory
  --no-commit        Skip the final git commit
  --skip-verify      Skip codegen / tidy / build / vet / test / commit (template iteration only)
`)
    process.exit(0)
  }

  if (!values.module) fail('missing required --module <path>', 2)
  if (!MODULE_RE.test(values.module)) fail(`--module "${values.module}" doesn't look like a Go module path`, 2)

  const defaultProject = values.module.split('/').pop().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const project = values.project ?? defaultProject
  if (!NAME_RE.test(project)) fail(`--project must be kebab-case (${NAME_RE}), got ${JSON.stringify(project)}`, 2)

  const origins = values.cors.split(',').map((s) => s.trim())
  for (const o of origins) {
    if (!ORIGIN_RE.test(o)) fail(`--cors origin "${o}" must be an http(s) URL`, 2)
  }

  return {
    module: values.module,
    dir: values.dir,
    project,
    dbSlug: project.replace(/-/g, '_'),
    cors: origins.join(','),
    force: values.force,
    commit: !values['no-commit'],
    skipVerify: values['skip-verify']
  }
}

// ── fs helpers ──────────────────────────────────────────────────────────

function substitute(content, cfg) {
  return content
    .replaceAll('{{MODULE}}', cfg.module)
    .replaceAll('{{PROJECT_NAME}}', cfg.project)
    .replaceAll('{{DB_SLUG}}', cfg.dbSlug)
    .replaceAll('{{CORS}}', cfg.cors)
    .replaceAll('{{SQLC_VERSION}}', SQLC_VERSION)
    .replaceAll('{{OAPI_CODEGEN_VERSION}}', OAPI_CODEGEN_VERSION)
}

// Recursively collect every template file (dotfiles/dotdirs included). The old
// STATIC/GLUE split existed because glue files needed generated code to exist
// first; nothing is compiled until AFTER codegen runs below, so file WRITE order
// no longer matters — everything is written in one pass, then generated.
function walkFiles(dir, base = dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(full, base))
    else out.push(path.relative(base, full))
  }
  return out
}

function writeFiles(relPaths, targetDir, cfg) {
  for (const rel of relPaths) {
    const src = path.join(TEMPLATES, rel)
    const dest = path.join(targetDir, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, substitute(fs.readFileSync(src, 'utf8'), cfg), 'utf8')
    log(`wrote ${rel}`)
  }
}

// ── subprocess ──────────────────────────────────────────────────────────

function run(cmd, args, cwd, { optional = false } = {}) {
  log(`$ ${cmd} ${args.join(' ')}`)
  const res = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      if (optional) return { ok: false, missing: true }
      fail(`${cmd} not found on PATH`)
    }
    fail(`${cmd} ${args.join(' ')} failed to spawn: ${res.error.message}`)
  }
  if (res.stdout?.trim()) process.stdout.write(res.stdout)
  if (res.status !== 0) {
    if (res.stderr?.trim()) process.stderr.write(res.stderr)
    if (optional) return { ok: false, missing: false }
    fail(`${cmd} ${args.join(' ')} exited ${res.status}`)
  }
  return { ok: true, stdout: res.stdout, stderr: res.stderr }
}

// Runs several independent commands concurrently (used for the per-module
// oapi-codegen invocations, which just filter the same api/openapi.yaml into
// separate output dirs — no data dependency between them, so serializing them
// only adds latency, doubly so on the first run where each may download/build
// its own copy of the tool). Each command's own output is buffered and
// flushed once it finishes, then any failure fails the whole scaffold.
function runParallel(commands, cwd) {
  return Promise.all(
    commands.map(
      ({ cmd, args }) =>
        new Promise((resolve) => {
          const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
          let stdout = ''
          let stderr = ''
          child.stdout.on('data', (d) => { stdout += d })
          child.stderr.on('data', (d) => { stderr += d })
          child.on('error', (error) => resolve({ ok: false, cmd, args, error }))
          child.on('close', (status) => resolve({ ok: status === 0, cmd, args, status, stdout, stderr }))
        })
    )
  ).then((results) => {
    for (const r of results) {
      log(`$ ${r.cmd} ${r.args.join(' ')}`)
      if (r.stdout?.trim()) process.stdout.write(r.stdout)
      if (!r.ok) {
        if (r.stderr?.trim()) process.stderr.write(r.stderr)
        if (r.error?.code === 'ENOENT') fail(`${r.cmd} not found on PATH`)
        fail(r.error ? `${r.cmd} ${r.args.join(' ')} failed to spawn: ${r.error.message}` : `${r.cmd} ${r.args.join(' ')} exited ${r.status}`)
      }
    }
  })
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const cfg = parseCliArgs()
  const targetDir = path.resolve(cfg.dir)

  if (fs.existsSync(targetDir)) {
    const entries = fs.readdirSync(targetDir)
    if (entries.length > 0 && !cfg.force) {
      fail(`${targetDir} exists and is not empty. Re-run with --force to proceed.`, 2)
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  run('go', ['version'], targetDir)

  log(`scaffolding into ${targetDir} (module: ${cfg.module}, project: ${cfg.project})`)
  writeFiles(walkFiles(TEMPLATES), targetDir, cfg)

  if (cfg.skipVerify) {
    log('--skip-verify set: skipping codegen, build, and commit. Files written only.')
    return
  }

  log('running codegen (oapi-codegen per module + sqlc) — first run downloads and builds both tools, can take a minute')
  await runParallel(
    OAPI_MODULE_CONFIGS.map((config) => ({
      cmd: 'go',
      args: ['run', `github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@${OAPI_CODEGEN_VERSION}`, '-config', config, 'api/openapi.yaml']
    })),
    targetDir
  )
  run('go', ['run', `github.com/sqlc-dev/sqlc/cmd/sqlc@${SQLC_VERSION}`, 'generate'], targetDir)

  log('go mod tidy')
  run('go', ['mod', 'tidy'], targetDir)

  log('gofmt')
  run('gofmt', ['-l', '-s', '-w', '.'], targetDir)

  log('go vet')
  run('go', ['vet', './...'], targetDir)

  log('go build')
  run('go', ['build', '-o', 'bin/server', './cmd/server'], targetDir)

  // Unit tests only — integration tests are behind `//go:build integration` and
  // need Docker (run via `make test-integration`), never at scaffold time.
  log('go test (unit)')
  run('go', ['test', './...'], targetDir)

  // Scoped to hand-written code — internal/gen (oapi-codegen) and infrastructure/db
  // (sqlc) are DO-NOT-EDIT generated output the scaffold's own tooling regenerates,
  // and staticcheck's generated-file heuristic doesn't recognize either marker.
  const pkgList = run('go', ['list', './...'], targetDir, { optional: true })
  const pkgs = pkgList.ok
    ? pkgList.stdout.split('\n').filter(p => p.trim() && !/\/(internal\/gen|infrastructure\/db)$/.test(p.trim()))
    : []
  const staticcheck = pkgs.length
    ? run('staticcheck', pkgs, targetDir, { optional: true })
    : { missing: true }
  if (staticcheck.missing) {
    log('staticcheck not found on PATH — skipped. Install: go install honnef.co/go/tools/cmd/staticcheck@latest')
  }

  if (cfg.commit) {
    const inRepo = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: targetDir, encoding: 'utf8' })
    if (inRepo.status !== 0) {
      run('git', ['init'], targetDir)
    }
    run('git', ['add', '-A'], targetDir)
    const commit = spawnSync('git', ['commit', '-m', 'chore: scaffold Go modular-monolith REST API (per-module oapi-codegen + sqlc)'], { cwd: targetDir, encoding: 'utf8' })
    if (commit.status !== 0) {
      log(`git commit skipped: ${(commit.stderr || commit.stdout || '').trim() || 'nothing to commit or no git identity configured'}`)
    } else {
      log('committed the scaffold')
    }
  }

  log(`
done.

Next steps:
  cd ${cfg.dir}
  cp .env.example .env          # set JWT_SECRET (openssl rand -base64 48)
  go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest   # one-time, only tool not go-run-able
  make dev-setup                 # docker compose up -d db + migrate + seed
  make run

Editable surface: api/openapi.yaml, internal/<module>/ (domain, application,
infrastructure, api), internal/shared/, internal/<module>/internal/infrastructure/queries/,
db/migrations/. Everything else regenerates via \`make generate\` — don't hand-edit
internal/<module>/internal/gen/ or internal/<module>/internal/infrastructure/db/.

\`go test ./...\` runs unit tests (Docker-free). \`make test-integration\` runs the
golden-path suite against a real Postgres via testcontainers-go (needs Docker).
Module boundaries are compiler-enforced by Go's nested internal/ — a cross-module
import of another module's internals fails to build.
`)
}

main().catch((err) => fail(err?.stack || String(err)))
