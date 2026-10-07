#!/usr/bin/env node
/**
 * scaffold.mjs — deterministic Next.js scaffold (OpenNext/Cloudflare, tokenless /api pass-through).
 *
 * Usage: node scaffold.mjs --config <path-to-json>
 *
 * All decisions are pre-resolved in the config file — this script never
 * prompts, never reads stdin. Node stdlib only; no npm install step of its
 * own (it shells out to npx/pnpm, same as nuxt-scaffold).
 * Exit codes: 0 ok, 1 runtime failure, 2 bad usage/config.
 *
 * The command sequence and its rationale live in ../references/bootstrap.md;
 * per-file rationale in ../references/artifacts.md. Update those docs and
 * this script together.
 *
 * ── Windows notes (platform-risky paths, flagged for manual validation) ──
 * - npm/npx/pnpm are .cmd shims on win32. Since Node's CVE-2024-27980 fix,
 *   spawning a .cmd without a shell throws EINVAL — so run() sets
 *   `shell: true` ON WINDOWS ONLY, always with an argument array (never a
 *   concatenated command string). Args are individually quoted for cmd.exe
 *   (winQuote).
 * - All file writes use "\n" line endings. If the target repo checks out
 *   with core.autocrlf=true, ESLint's stylistic rules may flag CRLF — the
 *   verify stage (pnpm lint) surfaces that immediately.
 * - Subprocess output is decoded as utf8 explicitly (cmd.exe defaults to a
 *   legacy codepage otherwise).
 * - Paths are built with node:path exclusively; no hardcoded separators.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const IS_WIN = process.platform === 'win32'
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATES = path.join(SCRIPT_DIR, 'templates')

const PROJECT_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
// `next` is pinned EXACTLY, never refreshed: @opennextjs/cloudflare@1.20.9 builds against 16.3.8, while
// create-next-app 16.4.0's `next` builds but 500s every non-rewrite request under it (design doc, Spike
// results). Stage 1 therefore runs create-next-app@NEXT_VERSION, and Stage 1b leaves `next` and
// `eslint-config-next` at it under both version policies.
const NEXT_VERSION = '16.3.8'
const OPENNEXT_VERSION = '1.20.9'
// Packages create-next-app's template installs; Stage 1b re-pins them (the next pair excepted, see above).
const PINNED_PKGS = ['next', 'eslint-config-next']
const TEMPLATE_PKGS = ['react', 'react-dom', 'typescript', 'eslint', 'tailwindcss', '@tailwindcss/postcss']
// shadcn/ui components are copied into the repo's own source tree by the CLI, not installed as
// a versioned dependency — nothing to re-pin the way @nuxt/ui is. `base` = every template gets
// these; the rest are added on top per template, same tiering as nuxt-scaffold's saas/dashboard.
const BASE_BLOCKS = ['button', 'card', 'tooltip']
const TEMPLATE_BLOCKS = {
  starter: [],
  dashboard: ['dashboard-01'],
  saas: ['input', 'label']
}
const TEMPLATES_ENUM = Object.keys(TEMPLATE_BLOCKS)

function log(msg) {
  console.log(`[scaffold] ${msg}`)
}

function fail(msg, code = 1) {
  console.error(`[scaffold] ERROR: ${msg}`)
  process.exit(code)
}

// ── config ──────────────────────────────────────────────────────────────

function loadConfig() {
  const idx = process.argv.indexOf('--config')
  if (idx === -1 || !process.argv[idx + 1]) fail('usage: node scaffold.mjs --config <path>', 2)
  const configPath = path.resolve(process.argv[idx + 1])
  let raw
  try {
    raw = fs.readFileSync(configPath, 'utf8')
  } catch (e) {
    fail(`cannot read config ${configPath}: ${e.message}`, 2)
  }
  let cfg
  try {
    cfg = JSON.parse(raw)
  } catch (e) {
    fail(`config is not valid JSON: ${e.message}`, 2)
  }
  return validateConfig(cfg)
}

function validateConfig(cfg) {
  const KNOWN = ['projectName', 'targetDir', 'packageManager', 'template', 'versionPolicy', 'resume', 'gitCommit', 'skipInstall']
  for (const k of Object.keys(cfg)) {
    if (!KNOWN.includes(k)) fail(`unknown config key "${k}" (known: ${KNOWN.join(', ')})`, 2)
  }
  const bad = (msg) => fail(`config: ${msg}`, 2)

  if (typeof cfg.projectName !== 'string' || !PROJECT_NAME_RE.test(cfg.projectName)) {
    bad(`projectName must be kebab-case (${PROJECT_NAME_RE}), got ${JSON.stringify(cfg.projectName)}`)
  }
  const out = {
    projectName: cfg.projectName,
    targetDir: path.resolve(cfg.targetDir ?? '.'),
    packageManager: cfg.packageManager ?? 'pnpm',
    template: cfg.template ?? 'starter',
    versionPolicy: cfg.versionPolicy ?? 'capped',
    resume: cfg.resume ?? false,
    gitCommit: cfg.gitCommit ?? true,
    skipInstall: cfg.skipInstall ?? false
  }
  if (out.packageManager !== 'pnpm') bad(`packageManager must be "pnpm" (BigIn standard), got ${JSON.stringify(out.packageManager)}`)
  if (!TEMPLATES_ENUM.includes(out.template)) bad(`template must be one of ${TEMPLATES_ENUM.join('/')}`)
  if (!['capped', 'latest'].includes(out.versionPolicy)) bad('versionPolicy must be "capped" or "latest"')
  if (typeof out.resume !== 'boolean') bad('resume must be a boolean')
  if (typeof out.gitCommit !== 'boolean') bad('gitCommit must be a boolean')
  if (typeof out.skipInstall !== 'boolean') bad('skipInstall must be a boolean')
  return out
}

// ── subprocess helpers ──────────────────────────────────────────────────

function resolveBin(name) {
  // npm/npx/pnpm are .cmd shims on Windows; git ships as git.exe and needs no suffix.
  if (IS_WIN && ['npm', 'npx', 'pnpm'].includes(name)) return `${name}.cmd`
  return name
}

function winQuote(arg) {
  // Inside double quotes cmd.exe treats ^ & | < > literally; escape embedded quotes by doubling.
  if (/[\s&|<>^"()%!]/.test(arg)) return `"${arg.replace(/"/g, '""')}"`
  return arg
}

function run(bin, args, opts = {}) {
  const res = spawnSync(resolveBin(bin), IS_WIN ? args.map(winQuote) : args, {
    cwd: opts.cwd ?? CFG.targetDir,
    stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
    encoding: 'utf8',
    shell: IS_WIN, // .cmd shims need a shell post-CVE-2024-27980; args stay an array, quoted above
    env: process.env
  })
  if (res.error) {
    if (opts.allowFail) return { status: 1, stdout: '', stderr: String(res.error.message) }
    fail(`${bin} ${args.join(' ')} failed to start: ${res.error.message}`)
  }
  return { status: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
}

function must(bin, args, what) {
  const res = run(bin, args)
  if (res.status !== 0) fail(`${what} failed (exit ${res.status}): ${bin} ${args.join(' ')}`)
}

/**
 * pnpm add wrapper. `ERR_PNPM_IGNORED_BUILDS` exits 1 but the packages DO
 * install (build scripts deferred pending approval) — treat it as expected,
 * approve the named packages, continue. Any other failure is fatal.
 */
function pnpmAdd(args, approvable = []) {
  const res = run('pnpm', ['add', ...args], { capture: true })
  process.stdout.write(res.stdout)
  process.stderr.write(res.stderr)
  if (res.status === 0) return
  if ((res.stdout + res.stderr).includes('ERR_PNPM_IGNORED_BUILDS') && approvable.length > 0) {
    for (const pkg of approvable) {
      log(`approving deferred build scripts: ${pkg}`)
      run('pnpm', ['approve-builds', pkg], { capture: true, allowFail: true })
    }
    return
  }
  fail(`pnpm add ${args.join(' ')} failed — partial install, not continuing`)
}

// ── file helpers ────────────────────────────────────────────────────────

function substitute(text, subs) {
  let out = text
  for (const [token, value] of Object.entries(subs)) out = out.split(`{${token}}`).join(value)
  return out
}

function writeFileEnsured(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content.endsWith('\n') ? content : content + '\n')
}

// Read → check-marker (resume-safe, skip if already patched) → transform →
// verify → write, the shared shape behind every "patch this generated config
// file in place" step below. Always reads fresh from disk, so sequential
// patches to the same file (e.g. the two eslint.config.mjs edits) never need
// to pass an in-memory copy between them. `verify` defaults to "the transform
// actually changed something"; pass one when a patch needs a stronger check
// (e.g. a specific string must appear in the result).
function patchFile(filePath, { marker, transform, verify, failMsg, optional = false }) {
  if (!fs.existsSync(filePath)) {
    if (optional) return
    fail(`${filePath} not found — template shape changed; re-verify artifacts.md`)
  }
  const before = fs.readFileSync(filePath, 'utf8')
  if (marker && before.includes(marker)) return // already patched (resume-safe)
  const after = transform(before)
  const ok = after !== before && (verify ? verify(after) : true)
  if (!ok) fail(failMsg)
  fs.writeFileSync(filePath, after)
}

function listFilesRecursive(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFilesRecursive(p))
    else out.push(p)
  }
  return out
}

/** Deep merge `fragment` into `base`: objects recurse, arrays union (by string identity), existing scalars win. */
function deepMerge(base, fragment, targetPath) {
  for (const [k, v] of Object.entries(fragment)) {
    if (Array.isArray(v) && Array.isArray(base[k])) {
      const seen = new Set(base[k].map(x => JSON.stringify(x)))
      for (const item of v) if (!seen.has(JSON.stringify(item))) base[k].push(item)
    } else if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], v, targetPath)
    } else if (!(k in base)) {
      base[k] = v
    } else if (v && typeof v === 'object') {
      // fragment wants to merge an array/object into an existing key of a different shape — dropped, not applied.
      log(`WARNING: ${targetPath}: existing "${k}" has a different shape than expected — skipped merging it in, verify manually`)
    } // else: existing scalar wins — expected merge-never-overwrite behavior, no warning needed
  }
  return base
}

function mergeJsonFile(targetPath, fragment) {
  if (!fs.existsSync(targetPath)) {
    writeFileEnsured(targetPath, JSON.stringify(fragment, null, 2))
    return
  }
  const base = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
  writeFileEnsured(targetPath, JSON.stringify(deepMerge(base, fragment, targetPath), null, 2))
}

function readTemplate(relPath, subs = {}) {
  return substitute(fs.readFileSync(path.join(TEMPLATES, relPath), 'utf8'), subs)
}

// ── stages ──────────────────────────────────────────────────────────────

function hasNextConfig(dir) {
  return ['next.config.ts', 'next.config.js', 'next.config.mjs'].some(f => fs.existsSync(path.join(dir, f)))
}

function preflight() {
  const nodeMajor = Number(process.version.slice(1).split('.')[0])
  if (nodeMajor < 20) fail(`Node.js 20+ required (running ${process.version})`)
  const pnpmCheck = run('pnpm', ['--version'], { capture: true, allowFail: true, cwd: process.cwd() })
  if (pnpmCheck.status !== 0) fail('pnpm is required but not installed. Install: corepack enable && corepack prepare pnpm@latest --activate')

  fs.mkdirSync(CFG.targetDir, { recursive: true })

  const hasConfig = hasNextConfig(CFG.targetDir)
  // node_modules is the signal a skipInstall run never produces — the two signature files alone
  // are written unconditionally in Stage 3 regardless of skipInstall, so they can't distinguish
  // "actually installed and verified" from "files written, nothing installed."
  const complete = fs.existsSync(path.join(CFG.targetDir, 'vitest.config.ts')) && fs.existsSync(path.join(CFG.targetDir, '.claude', 'settings.json')) && fs.existsSync(path.join(CFG.targetDir, 'node_modules'))

  if (CFG.resume) {
    if (!hasConfig) fail('resume=true but no next.config.* in targetDir — nothing to resume; run without resume')
    if (complete) fail('resume=true but the scaffold looks complete (vitest.config.ts + .claude/settings.json + node_modules present) — nothing to do')
    log('partial scaffold detected — resuming from the preset stage')
  } else if (hasConfig) {
    fail(complete
      ? 'next.config.* found and the scaffold looks complete — refusing to overwrite. Nothing to do.'
      : 'next.config.* found but vitest.config.ts, .claude/settings.json, or node_modules is missing — partial scaffold. Re-run with "resume": true to continue from the preset stage.')
  }

  // Monorepo hoisting warning (informational, matches bootstrap.md)
  for (let dir = path.dirname(CFG.targetDir); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      log(`WARNING: parent pnpm workspace at ${dir} — pnpm may hoist dependencies to the workspace root`)
      break
    }
    if (dir === path.dirname(dir)) break
  }
  log(`preflight ok — Node ${process.version}, pnpm ${pnpmCheck.stdout.trim()}, target ${CFG.targetDir}`)
}

// openapi-fetch is the runtime typed API client (src/shared/api-client), which every template ships.
// @opennextjs/cloudflare is exact-pinned (see NEXT_VERSION); wrangler stays on its ^4 peer range.
const PRESET_DEPS = ['zustand', '@tanstack/react-query', 'zod', 'openapi-fetch', `@opennextjs/cloudflare@${OPENNEXT_VERSION}`]
// openapi-typescript regenerates the committed client-types snapshot (pnpm openapi:generate);
// eslint-plugin-boundaries + eslint-import-resolver-typescript enforce the feature-folder
// boundaries in eslint.config.mjs (the resolver is load-bearing — see eslint.boundaries.mjs).
const PRESET_DEV_DEPS = ['vitest', '@vitejs/plugin-react', 'jsdom', '@testing-library/react', '@testing-library/jest-dom', 'simple-git-hooks', 'lint-staged', 'openapi-typescript', 'eslint-plugin-boundaries', 'eslint-import-resolver-typescript', 'wrangler@^4']

/** skipInstall-only: declare deps in package.json (no registry lookup, no pnpm add) so a later `pnpm install` resolves them — a bare name becomes the "latest" dist-tag, `name@spec` keeps its spec. */
function declareDepsUnresolved(deps, devDeps) {
  const entry = (d) => {
    const at = d.lastIndexOf('@')
    return at > 0 ? [d.slice(0, at), d.slice(at + 1)] : [d, 'latest']
  }
  const fragment = {
    dependencies: Object.fromEntries(deps.map(entry)),
    devDependencies: Object.fromEntries(devDeps.map(entry))
  }
  mergeJsonFile(path.join(CFG.targetDir, 'package.json'), fragment)
}

function stage1Init() {
  // --no-agents-md: create-next-app writes its own AGENTS.md + CLAUDE.md by default — this
  // skill does NOT own CLAUDE.md (bigin-harness-setup writes it fresh, same division of labor
  // as nuxt-scaffold; see SKILL.md Phase 2's note). --skip-install mirrors nuxt-scaffold's
  // --no-install: writes files + package.json but skips the dependency install.
  const skipInstall = CFG.skipInstall ? ['--skip-install'] : []
  log(`stage 1: create-next-app@${NEXT_VERSION} (non-interactive, in-place${CFG.skipInstall ? ', --skip-install' : ''})`)
  must('npx', [
    `create-next-app@${NEXT_VERSION}`, '.',
    '--ts', '--tailwind', '--eslint', '--app', '--src-dir',
    '--import-alias', '@/*',
    '--use-pnpm', '--turbopack',
    '--no-agents-md',
    ...skipInstall
  ], 'create-next-app')

  // --disable-git is never passed, so create-next-app runs its own git init — except when
  // --skip-install also suppresses it (same "check, don't assume" pattern as nuxt-scaffold's
  // --gitInit fallback).
  if (!fs.existsSync(path.join(CFG.targetDir, '.git'))) {
    log('git init did not fire — running it explicitly')
    must('git', ['init'], 'git init')
  }

  const pkgPath = path.join(CFG.targetDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.name = CFG.projectName
  writeFileEnsured(pkgPath, JSON.stringify(pkg, null, 2))
  log(`stage 1 done — package.json name set to ${CFG.projectName}`)
}

function stage1bRefresh() {
  if (CFG.skipInstall) {
    log(`stage 1b: skipped (skipInstall) — package.json keeps whatever versions create-next-app@${NEXT_VERSION} shipped, unrefreshed`)
    return
  }
  log(`stage 1b: refreshing template-installed packages (policy: ${CFG.versionPolicy})`)
  const specs = PINNED_PKGS.map((p) => `${p}@${NEXT_VERSION}`)
  specs.push(...TEMPLATE_PKGS.map((p) => {
    if (CFG.versionPolicy === 'latest') return `${p}@latest`
    const pkgJson = path.join(CFG.targetDir, 'node_modules', ...p.split('/'), 'package.json')
    if (!fs.existsSync(pkgJson)) {
      fail(`stage 1b: ${p} was not installed by stage 1 — create-next-app's default package set may have changed; re-verify bootstrap.md Stage 1`)
    }
    // Read the file directly — require()/import of '<pkg>/package.json' breaks on restrictive `exports` maps.
    const v = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version
    return `${p}@^${v.split('.')[0]}`
  }))
  pnpmAdd(specs)

  // Safety checks: catch an unwanted major or a changed template shape before later stages build on it.
  const nextVersion = JSON.parse(fs.readFileSync(path.join(CFG.targetDir, 'node_modules', 'next', 'package.json'), 'utf8')).version
  if (nextVersion !== NEXT_VERSION) {
    fail(`next is v${nextVersion} (expected the pinned ${NEXT_VERSION}) — stop; OpenNext ${OPENNEXT_VERSION} is only verified against ${NEXT_VERSION}, see bootstrap.md Stage 1`)
  }
  if (!hasNextConfig(CFG.targetDir) || !fs.existsSync(path.join(CFG.targetDir, 'src', 'app', 'layout.tsx'))) {
    fail("create-next-app's template shape changed — re-verify artifacts.md merge instructions (src/app/layout.tsx, next.config.*) before continuing")
  }
  const globalsCss = fs.readFileSync(path.join(CFG.targetDir, 'src', 'app', 'globals.css'), 'utf8')
  if (!globalsCss.includes('tailwindcss')) {
    fail('src/app/globals.css does not import tailwindcss — Tailwind v4 CSS-first shape changed; re-verify artifacts.md')
  }
  log(`stage 1b done — next ${NEXT_VERSION} confirmed, template shape ok`)
}

function stage2Preset() {
  if (CFG.skipInstall) {
    log('stage 2: skipped installing the preset + shadcn/ui (skipInstall) — declaring preset deps in package.json (unresolved dist-tags, pinned specs kept) for a later `pnpm install`; shadcn/ui itself must be initialized manually (`npx shadcn@latest init`) since it needs a real install to detect the project shape')
    declareDepsUnresolved(PRESET_DEPS, PRESET_DEV_DEPS)
    return
  }
  log('stage 2: installing preset packages')
  // @opennextjs/cloudflare pulls in wrangler's esbuild + workerd, whose install scripts pnpm 10+ defers pending approval.
  pnpmAdd(PRESET_DEPS, ['esbuild', 'workerd'])
  // simple-git-hooks trips ERR_PNPM_IGNORED_BUILDS — expected; approved right after.
  pnpmAdd(['-D', ...PRESET_DEV_DEPS], ['simple-git-hooks', 'esbuild', 'workerd'])

  // components.json is shadcn init's own signature file — re-running init on a resume would
  // rewrite components.json/globals.css even though nothing needs it; `shadcn add` below is
  // already idempotent (skips files that exist) so it always re-runs safely.
  if (!fs.existsSync(path.join(CFG.targetDir, 'components.json'))) {
    log('stage 2: initializing shadcn/ui (non-interactive defaults)')
    must('npx', ['shadcn@latest', 'init', '-y', '-d'], 'shadcn init')
  } else {
    log('stage 2: shadcn/ui already initialized (components.json present) — skipping init')
  }
  const blocks = [...BASE_BLOCKS, ...TEMPLATE_BLOCKS[CFG.template]]
  must('npx', ['shadcn@latest', 'add', ...blocks, '-y'], 'shadcn add')
  log('stage 2 done')
}

function applyArtifacts() {
  log('stage 3: applying artifacts')
  const subs = { PROJECT_NAME: CFG.projectName }

  // Write-fresh files (ours — safe to overwrite on resume).
  const filesRoot = path.join(TEMPLATES, 'files')
  for (const src of listFilesRecursive(filesRoot)) {
    const rel = path.relative(filesRoot, src)
    writeFileEnsured(path.join(CFG.targetDir, rel), substitute(fs.readFileSync(src, 'utf8'), subs))
  }
  // Template-specific overlay (same write-fresh mechanism as `files/`, gated by CFG.template):
  // `saas` gets the cookie-session auth flow (login/signup pages, client AuthGate + private
  // dashboard) that a bare create-next-app + shadcn init doesn't ship. The base `files/` template
  // already ships the OpenNext/Cloudflare config, generated API client, and feature-folder
  // structure for every template — `saas` only adds the auth UI on top. `starter` and
  // `dashboard` get nothing bespoke: `dashboard`'s deliverable is the shadcn `dashboard-01` block
  // added in stage2Preset (same as 6 of nuxt-scaffold's 8 non-starter templates getting zero
  // extra files).
  const templateOverlay = CFG.template === 'saas' ? 'saas' : null
  if (templateOverlay) {
    const overlayRoot = path.join(TEMPLATES, templateOverlay)
    for (const src of listFilesRecursive(overlayRoot)) {
      const rel = path.relative(overlayRoot, src)
      writeFileEnsured(path.join(CFG.targetDir, rel), substitute(fs.readFileSync(src, 'utf8'), subs))
    }
  }

  // next.config.ts: the tokenless /api pass-through (rewrites) + OpenNext dev init. create-next-app's
  // own file is empty config, so it is replaced wholesale — but only after checking it still is,
  // so a template that grew options fails loudly instead of losing them.
  patchFile(path.join(CFG.targetDir, 'next.config.ts'), {
    marker: 'API_ORIGIN',
    transform: (current) => {
      const body = current.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
      return body.includes('const nextConfig: NextConfig = { };') ? readTemplate(path.join('patch', 'next.config.ts'), subs) : current
    },
    failMsg: 'next.config.ts is not the empty create-next-app shape — re-verify artifacts.md and merge the pass-through by hand'
  })

  // .open-next / .wrangler are build output (the OpenNext bundle is megabytes of generated JS) —
  // ESLint must not lint it and git must not track it.
  patchFile(path.join(CFG.targetDir, 'eslint.config.mjs'), {
    marker: '.open-next',
    transform: (eslintConfig) => eslintConfig.replace(/(globalIgnores\(\[\n(?:.*\n)*?\s*"next-env\.d\.ts",\n)/, `$1    ".open-next/**",\n    ".wrangler/**",\n`),
    failMsg: 'cannot add .open-next to eslint.config.mjs globalIgnores — create-next-app config shape changed; re-verify artifacts.md'
  })

  // src/app/layout.tsx: wrap children in <Providers> so TanStack Query's client is available
  // app-wide. Import inserted at the top, wrapper inserted around <body>'s children.
  const layoutPath = path.join(CFG.targetDir, 'src', 'app', 'layout.tsx')
  patchFile(layoutPath, {
    marker: './providers',
    transform: (layout) => {
      layout = `import { Providers } from './providers'\n${layout}`
      return layout.replace(/<body([^>]*)>([\s\S]*?)<\/body>/, (_m, attrs, inner) => `<body${attrs}>\n        <Providers>${inner}</Providers>\n      </body>`)
    },
    verify: (layout) => layout.includes('<Providers>'),
    failMsg: 'cannot wire <Providers> into src/app/layout.tsx — template shape changed; re-verify artifacts.md'
  })

  // All templates: wire eslint-plugin-boundaries into the generated eslint.config.mjs so the
  // feature-folder structure (src/features/<f>, src/shared, src/lib, src/app) is a REAL boundary
  // — the config body lives in the shipped files/eslint.boundaries.mjs (source of truth); here we
  // just import it and spread it into the defineConfig([...]) array. Insert the array entry after
  // `...nextTs,` (same anchor the dashboard patch below uses — both survive because the anchor is
  // preserved by `$1`). Fails loudly if create-next-app's config shape changed.
  const eslintConfigPath = path.join(CFG.targetDir, 'eslint.config.mjs')
  patchFile(eslintConfigPath, {
    marker: 'eslint.boundaries.mjs',
    transform: (eslintConfig) => {
      eslintConfig = eslintConfig.replace(
        /(import nextTs from "eslint-config-next\/typescript";\n)/,
        `$1import { boundariesConfig } from "./eslint.boundaries.mjs";\n`
      )
      return eslintConfig.replace(/(\.\.\.nextTs,\n)/, `$1  boundariesConfig,\n`)
    },
    verify: (eslintConfig) => eslintConfig.includes('boundariesConfig,'),
    failMsg: 'cannot wire boundariesConfig into eslint.config.mjs — create-next-app config shape changed; re-verify the eslint imports/defineConfig array in artifacts.md'
  })

  // dashboard only: the shadcn `dashboard-01` block's own shipped source trips two react-hooks
  // rules that ship enabled-by-default in eslint-config-next 16 (React Compiler diagnostics,
  // on regardless of whether the compiler itself is enabled) — confirmed via a live scaffold run
  // on 2026-07-14 (src/hooks/use-mobile.ts, src/components/chart-area-interactive.tsx). This is
  // vendored block code, not ours to rewrite; scope an override to exactly those two files rather
  // than disabling the rules project-wide.
  if (CFG.template === 'dashboard') {
    patchFile(eslintConfigPath, {
      marker: 'react-hooks/set-state-in-effect',
      transform: (eslintConfig) => eslintConfig.replace(
        /(\.\.\.nextTs,\n)/,
        `$1  {\n    files: ['src/hooks/use-mobile.ts', 'src/components/chart-area-interactive.tsx'],\n    rules: { 'react-hooks/set-state-in-effect': 'off' }\n  },\n`
      ),
      failMsg: 'cannot patch eslint.config.mjs for the dashboard-01 block override — template shape changed; re-verify artifacts.md'
    })
  }

  // JSON merges — merge, never overwrite.
  mergeJsonFile(path.join(CFG.targetDir, 'package.json'), JSON.parse(readTemplate(path.join('merge', 'package.json'), subs)))
  mergeJsonFile(path.join(CFG.targetDir, '.claude', 'settings.json'), JSON.parse(readTemplate(path.join('merge', 'claude-settings.json'), subs)))
  mergeJsonFile(path.join(CFG.targetDir, '.vscode', 'settings.json'), JSON.parse(readTemplate(path.join('merge', 'vscode-settings.json'), subs)))

  // .env must never be committed; .open-next / .wrangler are OpenNext + wrangler build output;
  // create-next-app's own `.env*` would also swallow .env.example, which documents API_ORIGIN, so
  // it is re-included (after .env*, since the last match wins).
  const gitignorePath = path.join(CFG.targetDir, '.gitignore')
  let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : ''
  for (const entry of ['.env', '.open-next', '.wrangler', '!.env.example']) {
    if (!gitignore.split(/\r?\n/).includes(entry)) {
      gitignore = `${gitignore}${gitignore.endsWith('\n') || gitignore === '' ? '' : '\n'}${entry}\n`
    }
  }
  fs.writeFileSync(gitignorePath, gitignore)
  log('stage 3 done — artifacts written/merged')
}

function activateHooks() {
  log('stage 4: activating simple-git-hooks pre-commit gate')
  let res = run('pnpm', ['simple-git-hooks'], { capture: true, allowFail: true })
  process.stdout.write(res.stdout)
  if (res.status !== 0 && (res.stdout + res.stderr).includes('ERR_PNPM_IGNORED_BUILDS')) {
    run('pnpm', ['approve-builds', 'simple-git-hooks'], { capture: true, allowFail: true })
    res = run('pnpm', ['simple-git-hooks'], { capture: true, allowFail: true })
    process.stdout.write(res.stdout)
  }
  if (res.status !== 0) {
    process.stderr.write(res.stderr)
    fail('pnpm simple-git-hooks failed')
  }
}

function verify() {
  log('stage 5: verify — lint, type-check, test must all pass')
  must('pnpm', ['lint'], 'pnpm lint')
  must('pnpm', ['type-check'], 'pnpm type-check')
  must('pnpm', ['test'], 'pnpm test')
  log('stage 5 done — lint, type-check, test all green')
}

function commitIfDirty() {
  if (!CFG.gitCommit || !fs.existsSync(path.join(CFG.targetDir, '.git'))) return
  const status = run('git', ['status', '--porcelain'], { capture: true })
  if (status.stdout.trim() === '') return
  log('creating initial commit')
  must('git', ['add', '-A'], 'git add')
  must('git', ['commit', '-m', 'chore: scaffold Next.js app'], 'git commit')
}

function printNextSteps() {
  const lines = [
    '',
    `Next.js app scaffolded (template: ${CFG.template}).`,
    '',
    'Next:'
  ]
  const apiOrigin = [
    '  1. Copy .env.example → .env and set API_ORIGIN (the paired API\'s origin, e.g. https://api.example.com or',
    '     http://localhost:8090; server-only, and read at BUILD time — set it wherever pnpm build / preview / run deploy run).',
    '     The /api/v<N>/** rewrite in next.config.ts forwards there, so the API\'s HttpOnly session cookie is',
    '     first-party to this app; the browser never holds a token. Set WEB_ORIGINS on the API to this app\'s origin.',
    '     Client IP: the API sees this app\'s egress address, so all browser users share one rate-limit bucket —',
    '     nothing forwards X-Forwarded-For / CF-Connecting-IP and TRUSTED_PROXY must stay unset (see .env.example).'
  ]
  const deploy = '  5. Preview on the Workers runtime: pnpm preview. Deploy: pnpm run deploy (not bare `pnpm deploy`, which is pnpm\'s own command; wrangler login first).'
  if (CFG.template === 'starter') {
    lines.push(
      ...apiOrigin,
      '  2. The typed client + generated types live in src/shared/api-client (baseUrl /api/v1, credentials included;',
      '     committed snapshot of the API contract, openapi.json). Refresh the types after an API change:',
      '     pnpm openapi:generate (point openapi.json at go-scaffold\'s openapi.yaml converted to JSON first).',
      '  3. Overlay governance: run bigin-harness-setup (CLAUDE.md, rules, bash-guard).',
      '  4. Start: pnpm dev (needs the API running)',
      deploy
    )
  } else if (CFG.template === 'saas') {
    lines.push(
      ...apiOrigin,
      '  2. Login/signup call POST /api/v1/auth/session and POST /api/v1/auth/signup; sign-out is',
      '     DELETE /api/v1/auth/session; the current user is GET /api/v1/user/profile, and AuthGate sends a',
      '     visitor on a 401 to /login. No SSR and no server-side route protection. Local dev needs HTTPS for the',
      '     __Host- cookie, or the API\'s SESSION_COOKIE_SECURE=false. Start the API before signing in.',
      '  3. Overlay governance: run bigin-harness-setup (CLAUDE.md, rules, bash-guard).',
      '  4. Start: pnpm dev — public site at /, private area at /dashboard.',
      deploy
    )
  } else {
    lines.push(
      ...apiOrigin,
      '  2. The shadcn `dashboard-01` block wrote a working admin shell straight to /dashboard (sidebar, charts, data table — currently on sample data). Wire it to real data with a feature hook in src/features/ calling the typed client, as needed.',
      '  3. Overlay governance: run bigin-harness-setup (CLAUDE.md, rules, bash-guard).',
      '  4. Start: pnpm dev — admin shell at /dashboard.',
      deploy
    )
  }
  if (CFG.versionPolicy === 'latest') {
    lines.push('  ⚠ versionPolicy=latest — skim the changelogs for next/react/tailwindcss (and the other refreshed packages) for breaking changes before shipping.')
  }
  if (CFG.skipInstall) {
    lines.push(
      '  ⚠ skipInstall=true — no dependency is installed and nothing was verified. Before anything else:',
      '     a. pnpm install',
      '     b. pnpm approve-builds simple-git-hooks; pnpm approve-builds esbuild; pnpm approve-builds workerd   (deferred build scripts, one call each)',
      '     c. pnpm simple-git-hooks                  (activates the pre-commit hook)',
      `     d. npx shadcn@latest init -y -d && npx shadcn@latest add ${[...BASE_BLOCKS, ...TEMPLATE_BLOCKS[CFG.template]].join(' ')} -y   (skipped above)`,
      '     e. pnpm lint && pnpm type-check && pnpm test',
      '  Preset packages (zustand, @tanstack/react-query, zod, vitest, etc.) are pinned to the "latest" dist-tag in package.json, unresolved (@opennextjs/cloudflare and wrangler keep their pinned specs) — pin exact versions once installed if you want reproducible installs.'
    )
  }
  console.log(lines.join('\n'))
}

// ── main ────────────────────────────────────────────────────────────────

const CFG = loadConfig()

// Any unexpected throw still surfaces through fail()'s `[scaffold] ERROR:`
// contract documented in SKILL.md, not as a raw Node stack trace.
try {
  preflight()
  if (!CFG.resume) {
    stage1Init()
    stage1bRefresh()
  }
  stage2Preset()
  applyArtifacts()
  if (!CFG.skipInstall) {
    activateHooks()
    verify()
  }
  commitIfDirty()
  printNextSteps()
} catch (err) {
  fail(err?.stack || String(err))
}
