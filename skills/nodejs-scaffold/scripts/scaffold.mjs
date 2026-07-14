#!/usr/bin/env node
/**
 * scaffold.mjs — deterministic Node.js REST API scaffold (contract-first).
 *
 * Usage:
 *   node scaffold.mjs --project orders-api [--dir orders-api]
 *                      [--cors https://app.example.com]
 *                      [--force] [--no-commit] [--skip-verify]
 *
 * openapi.yaml generates API types (openapi-typescript); src/db/schema.ts
 * generates migration SQL (drizzle-kit) — the reverse direction of a
 * SQL-first generator like sqlc: schema.ts is hand-written, drizzle/*.sql is
 * generated from it. This script runs both generators itself so the repo it
 * leaves behind actually builds and tests green, not a skeleton needing
 * manual fixup first.
 *
 * All decisions are pre-resolved via CLI flags — this script never prompts,
 * never reads stdin. Node stdlib only (no npm dependency to run the script
 * itself — the scaffolded project's own deps are installed via `pnpm add`).
 * Exit codes: 0 ok, 1 runtime failure, 2 bad usage/args.
 *
 * Every runtime/dev dependency here is a normal devDependency/dependency
 * resolved through pnpm's lockfile — unlike go-scaffold's `go run pkg@version`
 * trick (which exists only to avoid vendoring sqlc/oapi-codegen into go.mod),
 * there's no equivalent problem in Node, so no dependency version is
 * hardcoded in this script. `pnpm add` resolves whatever's current.
 *
 * ── Windows notes (same problem nuxt-scaffold's scaffold.mjs solves) ──
 * pnpm/npx are .cmd shims on win32. Since Node's CVE-2024-27980 fix, spawning
 * a .cmd without a shell throws EINVAL — so run() sets `shell: true` ON
 * WINDOWS ONLY, always with an argument array (never a concatenated command
 * string), with args individually quoted for cmd.exe (winQuote). go-scaffold
 * doesn't need this (go/git are native binaries); this script shells out to
 * pnpm repeatedly, so it does.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const IS_WIN = process.platform === 'win32'
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(SCRIPT_DIR, 'templates', 'files')

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ORIGIN_RE = /^https?:\/\/[^\s,"]+$/

const STATIC_FILES = [
  'package.json',
  'tsconfig.json',
  'eslint.config.mjs',
  'vitest.config.ts',
  '.env.example',
  '.gitignore',
  'README.md',
  'Dockerfile',
  'docker-compose.yml',
  '.github/workflows/ci.yml',
  'openapi.yaml',
  'drizzle.config.ts',
  'src/config/env.ts',
  'src/db/schema.ts',
  'src/db/client.ts',
  'src/db/migrate.ts'
]

// Written only after `pnpm add` + codegen (openapi-typescript, drizzle-kit
// generate) have run — these import fastify/@fastify/*/generated api types.
const GLUE_FILES = [
  'src/app.ts',
  'src/server.ts',
  'src/routes/health.ts',
  'src/routes/health.test.ts',
  'src/routes/users.ts',
  'src/routes/users.test.ts',
  'src/services/user-service.ts',
  'src/repositories/user-repository.ts',
  'src/middleware/error-handler.ts'
]

const DEPS = ['fastify', '@fastify/cors', '@fastify/rate-limit', 'drizzle-orm', 'postgres', 'zod', 'dotenv']
// typescript is constrained to ^5 (not bare) — openapi-typescript's codegen
// uses the `typescript` package's ts.factory compiler API directly, which
// breaks under typescript 7's rewritten API shape (confirmed via a real
// scaffold run: bare `typescript` resolved 7.0.2 and openapi-typescript
// crashed with "Cannot read properties of undefined (reading
// 'createKeywordTypeNode')"). ^5 still floats freely within the major
// version everything here is actually compatible with.
const DEV_DEPS = ['typescript@^5', 'tsx', 'vitest', 'eslint', 'typescript-eslint', '@eslint/js', '@types/node', 'drizzle-kit', 'openapi-typescript']

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
        project: { type: 'string' },
        dir: { type: 'string', default: '.' },
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
    console.log(`node scaffold.mjs --project <name> [options]

Required:
  --project <name>   kebab-case project name — package.json name, Docker
                      image name, Postgres user/db, README title

Optional:
  --dir <dir>        Target directory (default: .)
  --cors <origins>   Comma-separated default CORS origins (default: http://localhost:3000)
  --force            Write into a non-empty directory
  --no-commit        Skip the final git commit
  --skip-verify      Skip pnpm install / codegen / build / lint / typecheck / test / commit (template iteration only)
`)
    process.exit(0)
  }

  if (!values.project) fail('missing required --project <name>', 2)
  if (!NAME_RE.test(values.project)) fail(`--project must be kebab-case (${NAME_RE}), got ${JSON.stringify(values.project)}`, 2)

  const origins = values.cors.split(',').map((s) => s.trim())
  for (const o of origins) {
    if (!ORIGIN_RE.test(o)) fail(`--cors origin "${o}" must be an http(s) URL`, 2)
  }

  return {
    project: values.project,
    dir: values.dir,
    dbSlug: values.project.replace(/-/g, '_'),
    cors: origins.join(','),
    force: values.force,
    commit: !values['no-commit'],
    skipVerify: values['skip-verify']
  }
}

// ── fs helpers ──────────────────────────────────────────────────────────

function substitute(content, cfg) {
  return content
    .replaceAll('{{PROJECT_NAME}}', cfg.project)
    .replaceAll('{{DB_SLUG}}', cfg.dbSlug)
    .replaceAll('{{CORS}}', cfg.cors)
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

function resolveBin(name) {
  // pnpm/npx are .cmd shims on Windows; git ships as git.exe and needs no suffix.
  if (IS_WIN && ['pnpm', 'npx', 'npm'].includes(name)) return `${name}.cmd`
  return name
}

function winQuote(arg) {
  if (/[\s&|<>^"()%!]/.test(arg)) return `"${arg.replace(/"/g, '""')}"`
  return arg
}

function run(cmd, args, cwd, { optional = false, capture = false } = {}) {
  log(`$ ${cmd} ${args.join(' ')}`)
  const res = spawnSync(resolveBin(cmd), IS_WIN ? args.map(winQuote) : args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: IS_WIN
  })
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      if (optional) return { ok: false, missing: true }
      fail(`${cmd} not found on PATH`)
    }
    fail(`${cmd} ${args.join(' ')} failed to spawn: ${res.error.message}`)
  }
  if (res.status !== 0) {
    if (optional) return { ok: false, missing: false, stdout: res.stdout, stderr: res.stderr }
    fail(`${cmd} ${args.join(' ')} exited ${res.status}`)
  }
  return { ok: true, stdout: res.stdout, stderr: res.stderr }
}

/**
 * pnpm add wrapper. `ERR_PNPM_IGNORED_BUILDS` exits 1 but the packages DO
 * install (native build scripts deferred pending approval) — treat it as
 * expected, approve the named packages, continue. Any other failure is
 * fatal. Each approve runs separately with `optional: true`: naming a
 * package that isn't actually pending fails the whole `pnpm approve-builds`
 * call.
 */
function pnpmAdd(args, targetDir, approvable = []) {
  const res = run('pnpm', ['add', ...args], targetDir, { optional: true, capture: true })
  if (res.ok || res.missing) {
    if (res.missing) fail('pnpm not found on PATH')
    return
  }
  const output = (res.stdout ?? '') + (res.stderr ?? '')
  process.stdout.write(res.stdout ?? '')
  process.stderr.write(res.stderr ?? '')
  if (output.includes('ERR_PNPM_IGNORED_BUILDS') && approvable.length > 0) {
    for (const pkg of approvable) {
      log(`approving deferred build scripts: ${pkg}`)
      run('pnpm', ['approve-builds', pkg], targetDir, { optional: true, capture: true })
    }
    return
  }
  fail(`pnpm add ${args.join(' ')} failed — partial install, not continuing`)
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

  const pnpmCheck = run('pnpm', ['--version'], targetDir, { optional: true, capture: true })
  if (pnpmCheck.missing) fail('pnpm is required but not found on PATH. Install: corepack enable && corepack prepare pnpm@latest --activate')

  log(`scaffolding into ${targetDir} (project: ${cfg.project})`)
  writeFiles(STATIC_FILES, targetDir, cfg)

  if (cfg.skipVerify) {
    log('--skip-verify set: skipping install, codegen, build, and commit. Files written only.')
    return
  }

  log('installing dependencies')
  pnpmAdd(DEPS, targetDir)
  // Native build scripts (e.g. esbuild's postinstall) commonly trip pnpm's
  // ignored-builds gate on a fresh install — approve the ones this project's
  // devDependency tree is known to pull in. If a future dependency bump
  // introduces a new one, pnpmAdd's fatal-failure path names it explicitly.
  pnpmAdd(['-D', ...DEV_DEPS], targetDir, ['esbuild'])

  log('generating API types (openapi-typescript) and DB migrations (drizzle-kit)')
  run('pnpm', ['exec', 'openapi-typescript', 'openapi.yaml', '-o', 'src/types/api.d.ts'], targetDir)
  run('pnpm', ['exec', 'drizzle-kit', 'generate'], targetDir)

  writeFiles(GLUE_FILES, targetDir, cfg)

  log('pnpm lint')
  run('pnpm', ['lint'], targetDir)

  log('pnpm type-check')
  run('pnpm', ['type-check'], targetDir)

  log('pnpm build')
  run('pnpm', ['build'], targetDir)

  log('pnpm test --run')
  run('pnpm', ['test', '--run'], targetDir)

  if (cfg.commit) {
    const inRepo = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: targetDir, encoding: 'utf8' })
    if (inRepo.status !== 0) {
      run('git', ['init'], targetDir)
    }
    run('git', ['add', '-A'], targetDir)
    const commit = spawnSync('git', ['commit', '-m', 'chore: scaffold Node.js REST API (Fastify + Drizzle, contract-first)'], { cwd: targetDir, encoding: 'utf8' })
    if (commit.status !== 0) {
      log(`git commit skipped: ${(commit.stderr || commit.stdout || '').trim() || 'nothing to commit or no git identity configured'}`)
    } else {
      log('committed: chore: scaffold Node.js REST API (Fastify + Drizzle, contract-first)')
    }
  }

  log(`
done.

Next steps:
  cd ${cfg.dir}
  cp .env.example .env
  docker compose up -d db
  pnpm db:migrate
  pnpm dev

Editable surface: openapi.yaml, src/db/schema.ts, src/routes/, src/services/, src/repositories/, src/middleware/
Everything else regenerates via \`pnpm openapi-types\` / \`pnpm db:generate\` — don't hand-edit src/types/api.d.ts or drizzle/*.sql.
`)
}

main()
