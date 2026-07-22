#!/usr/bin/env node
/**
 * scaffold.mjs — deterministic Node.js modular-monolith REST API scaffold.
 *
 * Usage:
 *   node scaffold.mjs --project orders-api [--dir orders-api]
 *                      [--cors https://app.example.com]
 *                      [--force] [--no-commit] [--skip-verify]
 *
 * Code-first OpenAPI: TypeBox route schemas ARE the spec, and
 * `pnpm openapi:export` dumps src/api/openapi.json from the live app (no DB).
 * src/modules/<mod>/infrastructure/*.schema.ts + src/shared/'s schema files
 * generate migration SQL under drizzle/ via drizzle-kit. This script runs both
 * generators itself so the repo it leaves behind builds and tests green.
 *
 * All decisions are pre-resolved via CLI flags — this script never prompts,
 * never reads stdin. Node stdlib only. Exit codes: 0 ok, 1 runtime failure,
 * 2 bad usage/args.
 *
 * Because both example modules (users, posts) are fixed named templates (not
 * user-parameterized), string templating + fs/spawnSync is enough — this stays
 * a single stdlib script, not an npm package.
 *
 * ── Windows notes (same problem nuxt-scaffold's scaffold.mjs solves) ──
 * pnpm/npx are .cmd shims on win32. Since Node's CVE-2024-27980 fix, spawning
 * a .cmd without a shell throws EINVAL — so run() sets `shell: true` ON
 * WINDOWS ONLY, always with an argument array (never a concatenated command
 * string), with args individually quoted for cmd.exe (winQuote).
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

// Runtime deps. argon2 has a native/postinstall build; package.json's
// pnpm.onlyBuiltDependencies already whitelists it so `pnpm add` builds it,
// but the approvable-list below is a belt-and-suspenders fallback (same
// mechanism go-/older scaffolds used for esbuild).
const DEPS = [
  'fastify',
  '@fastify/cors',
  '@fastify/rate-limit',
  '@fastify/swagger',
  '@fastify/swagger-ui',
  '@fastify/type-provider-typebox',
  '@sinclair/typebox',
  '@fastify/jwt',
  'argon2',
  'drizzle-orm',
  'postgres',
  'zod',
  'dotenv',
  'uuid',
  'graphile-worker'
]

// typescript is constrained to ^5 (a major-version constraint, not a pin):
// bare `typescript` currently floats to a 7.x prerelease with a rewritten
// ts.factory API that breaks tooling; ^5 is the actual compatibility bound.
const DEV_DEPS = [
  'typescript@^5',
  'tsx',
  'vitest',
  'eslint',
  'typescript-eslint',
  '@eslint/js',
  '@types/node',
  'drizzle-kit',
  'eslint-plugin-boundaries',
  'eslint-import-resolver-typescript',
  // Integration tests only (pnpm test:integration, never scaffold-time
  // verification below — that stays Docker-free by design).
  '@testcontainers/postgresql'
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
                      image name, Postgres user/db, README/OpenAPI title

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

// Recursively collect every template file (dotfiles/dotdirs included). The old
// STATIC_FILES/GLUE_FILES split existed only because glue files needed a
// generated types/api.d.ts to exist first; code-first OpenAPI removed that
// dependency, so everything is written in one pass.
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
    const content = substitute(fs.readFileSync(src, 'utf8'), cfg)
    fs.writeFileSync(dest, content, 'utf8')
    log(`wrote ${rel}`)
  }
}

// ── subprocess ──────────────────────────────────────────────────────────

function resolveBin(name) {
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
 * expected, approve the named packages, continue. package.json already lists
 * argon2/esbuild in pnpm.onlyBuiltDependencies so this path usually isn't hit,
 * but it stays as a fallback. Any other failure is fatal.
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
  const files = walkFiles(TEMPLATES)
  writeFiles(files, targetDir, cfg)

  if (cfg.skipVerify) {
    log('--skip-verify set: skipping install, codegen, build, and commit. Files written only.')
    return
  }

  log('installing dependencies')
  pnpmAdd(DEPS, targetDir, ['argon2'])
  pnpmAdd(['-D', ...DEV_DEPS], targetDir, ['esbuild'])

  log('generating DB migrations (drizzle-kit) and OpenAPI spec (code-first)')
  run('pnpm', ['exec', 'drizzle-kit', 'generate'], targetDir)
  // openapi:export boots the app (placeholder DATABASE_URL/JWT_SECRET, no DB)
  // and writes src/api/openapi.json from the live route schemas.
  run('pnpm', ['openapi:export'], targetDir)

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
    const commit = spawnSync('git', ['commit', '-m', 'chore: scaffold Node.js modular-monolith REST API (Fastify + Drizzle, code-first OpenAPI)'], { cwd: targetDir, encoding: 'utf8' })
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
  cp .env.example .env          # set JWT_SECRET
  pnpm dev:setup                 # docker compose up -d db + migrate + seed
  pnpm dev                      # API + in-process job runner

Editable surface: src/modules/<mod>/ (domain, application, infrastructure, api),
src/shared/. Add a module = create the tree, register its api plugin (its own
/v1/<module> prefix) in src/api/app.ts, add its infrastructure/*.schema.ts.

Generated — never hand-edit: src/api/openapi.json (\`pnpm openapi:export\`),
drizzle/*.sql (\`pnpm db:generate\`). CI diff-checks openapi.json.
Module boundaries are enforced by \`pnpm lint\` (eslint-plugin-boundaries).

\`pnpm test\` (just run, no setup) covers domain/application with mocks.
\`pnpm test:integration\` needs Docker — it spins up Postgres via
testcontainers itself, no docker-compose step needed first.
`)
}

main()
