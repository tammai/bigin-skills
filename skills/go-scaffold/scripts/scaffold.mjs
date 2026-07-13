#!/usr/bin/env node
/**
 * scaffold.mjs — deterministic Go REST API scaffold (contract-first).
 *
 * Usage:
 *   node scaffold.mjs --module github.com/acme/orders-api [--dir orders-api]
 *                      [--project orders-api] [--cors https://app.example.com]
 *                      [--force] [--no-commit] [--skip-verify]
 *
 * openapi.yaml generates the server interface + models (oapi-codegen);
 * internal/store/queries/*.sql generates typed queries (sqlc). Neither
 * internal/api/ nor internal/store/ is hand-written — this script runs both
 * generators itself so the repo it leaves behind actually builds and tests
 * green, not a skeleton that needs manual fixup first.
 *
 * All decisions are pre-resolved via CLI flags — this script never prompts,
 * never reads stdin. Node stdlib only. Exit codes: 0 ok, 1 runtime failure,
 * 2 bad usage/args.
 *
 * go/git/docker are native binaries on every platform (unlike npm/pnpm's
 * .cmd shims on Windows) — spawnSync needs no shell:true workaround here.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(SCRIPT_DIR, 'templates', 'files')

// Pinned via `go run pkg@version` — never added to the scaffolded module's
// own go.mod (that would drag ~40 unrelated transitive deps, incl. a bumped
// `go` directive, into go.sum just to pin a dev tool). Bump here + Makefile
// stays in sync since the Makefile template is written from these too.
const SQLC_VERSION = 'v1.29.0'
const OAPI_CODEGEN_VERSION = 'v2.4.1'

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MODULE_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]*(\/[A-Za-z0-9][A-Za-z0-9._~-]*)*$/
const ORIGIN_RE = /^https?:\/\/[^\s,"]+$/

const STATIC_FILES = [
  'go.mod',
  'openapi.yaml',
  'oapi-codegen.yaml',
  'sqlc.yaml',
  'db/migrations/0001_create_users.up.sql',
  'db/migrations/0001_create_users.down.sql',
  'internal/store/queries/users.sql',
  'Makefile',
  'Dockerfile',
  'docker-compose.yml',
  '.env.example',
  '.gitignore',
  'README.md',
  '.github/workflows/ci.yml'
]

// Written only after codegen has produced internal/api/gen.go and
// internal/store/*.go — these import both.
const GLUE_FILES = [
  'cmd/server/main.go',
  'internal/config/config.go',
  'internal/server/server.go',
  'internal/server/routes.go',
  'internal/server/middleware.go',
  'internal/server/handlers.go',
  'internal/server/server_test.go'
]

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
  --skip-verify      Skip go mod tidy / codegen / build / vet / test / commit (template iteration only)
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

function writeFiles(relPaths, targetDir, cfg) {
  for (const rel of relPaths) {
    const src = path.join(TEMPLATES, rel)
    const dest = path.join(targetDir, rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    const content = substitute(fs.readFileSync(src, 'utf8'), cfg)
    fs.writeFileSync(dest, content, 'utf8')
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

// ── main ────────────────────────────────────────────────────────────────

function main() {
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
  writeFiles(STATIC_FILES, targetDir, cfg)

  if (cfg.skipVerify) {
    log('--skip-verify set: skipping codegen, build, and commit. Files written only.')
    return
  }

  log('running codegen (oapi-codegen + sqlc) — first run downloads and builds both tools, can take a minute')
  fs.mkdirSync(path.join(targetDir, 'internal', 'api'), { recursive: true }) // oapi-codegen writes gen.go here but won't create the dir itself
  run('go', ['run', `github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@${OAPI_CODEGEN_VERSION}`, '-config', 'oapi-codegen.yaml', 'openapi.yaml'], targetDir)
  run('go', ['run', `github.com/sqlc-dev/sqlc/cmd/sqlc@${SQLC_VERSION}`, 'generate'], targetDir)

  writeFiles(GLUE_FILES, targetDir, cfg)

  log('go mod tidy')
  run('go', ['mod', 'tidy'], targetDir)

  log('gofmt')
  run('gofmt', ['-l', '-s', '-w', '.'], targetDir)

  log('go vet')
  run('go', ['vet', './...'], targetDir)

  log('go build')
  run('go', ['build', '-o', 'bin/server', './cmd/server'], targetDir)

  log('go test')
  run('go', ['test', './...'], targetDir)

  const staticcheck = run('staticcheck', ['./...'], targetDir, { optional: true })
  if (staticcheck.missing) {
    log('staticcheck not found on PATH — skipped. Install: go install honnef.co/go/tools/cmd/staticcheck@latest')
  }

  if (cfg.commit) {
    const inRepo = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: targetDir, encoding: 'utf8' })
    if (inRepo.status !== 0) {
      run('git', ['init'], targetDir)
    }
    run('git', ['add', '-A'], targetDir)
    const commit = spawnSync('git', ['commit', '-m', 'chore: scaffold Go REST API (contract-first: oapi-codegen + sqlc)'], { cwd: targetDir, encoding: 'utf8' })
    if (commit.status !== 0) {
      log(`git commit skipped: ${(commit.stderr || commit.stdout || '').trim() || 'nothing to commit or no git identity configured'}`)
    } else {
      log('committed: chore: scaffold Go REST API (contract-first: oapi-codegen + sqlc)')
    }
  }

  log(`
done.

Next steps:
  cd ${cfg.dir}
  cp .env.example .env
  go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest   # one-time, only tool not go-run-able
  docker compose up -d db
  make migrate-up
  make run

Editable surface: openapi.yaml, internal/store/queries/, db/migrations/, internal/server/handlers.go
Everything else regenerates via \`make generate\` — don't hand-edit internal/api/ or internal/store/.
`)
}

main()
