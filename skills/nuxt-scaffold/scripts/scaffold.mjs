#!/usr/bin/env node
/**
 * scaffold.mjs — deterministic Nuxt 4 BFF scaffold.
 *
 * Usage: node scaffold.mjs --config <path-to-json>
 *
 * All decisions are pre-resolved in the config file — this script never
 * prompts, never reads stdin. Node stdlib only; no npm install step.
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
 *   (winQuote), which also protects `^` in semver specs like `nuxt@^4` —
 *   cmd.exe would otherwise eat the caret. Every user-supplied value is
 *   regex-validated before it can reach an argv.
 * - All file writes use "\n" line endings. If the target repo checks out
 *   with core.autocrlf=true, `@stylistic` lint rules may flag CRLF — the
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

const PRIMARY_COLORS = ['blue', 'green', 'emerald', 'teal', 'cyan', 'sky', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'amber', 'yellow', 'lime', 'orange', 'red']
const NEUTRAL_COLORS = ['slate', 'gray', 'zinc', 'neutral', 'stone', 'taupe', 'mauve', 'mist', 'olive']
const PROJECT_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
// Packages create-nuxt's `ui` template + `--modules` install; Stage 1b re-pins them.
const TEMPLATE_PKGS = ['nuxt', '@nuxt/ui', '@nuxt/eslint', 'eslint', 'tailwindcss', 'vue-tsc', 'typescript', '@pinia/nuxt', 'nuxt-auth-utils', '@vueuse/nuxt']
// `starter` = today's from-scratch `--template ui` path (no repo). Everything else clones the
// matching official ui.nuxt.com template (github.com/nuxt-ui-templates/<slug>) via `nuxi init`.
const TEMPLATE_REPOS = {
  saas: 'nuxt-ui-templates/saas',
  dashboard: 'nuxt-ui-templates/dashboard',
  landing: 'nuxt-ui-templates/landing',
  docs: 'nuxt-ui-templates/docs',
  portfolio: 'nuxt-ui-templates/portfolio',
  chat: 'nuxt-ui-templates/chat',
  changelog: 'nuxt-ui-templates/changelog',
  editor: 'nuxt-ui-templates/editor'
}
const TEMPLATES_ENUM = ['starter', ...Object.keys(TEMPLATE_REPOS)]

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
  const KNOWN = ['projectName', 'targetDir', 'packageManager', 'template', 'theme', 'versionPolicy', 'resume', 'gitCommit', 'skipInstall']
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
    theme: { primary: cfg.theme?.primary ?? 'blue', neutral: cfg.theme?.neutral ?? 'slate' },
    versionPolicy: cfg.versionPolicy ?? 'capped',
    resume: cfg.resume ?? false,
    gitCommit: cfg.gitCommit ?? true,
    skipInstall: cfg.skipInstall ?? false
  }
  if (out.packageManager !== 'pnpm') bad(`packageManager must be "pnpm" (BigIn standard), got ${JSON.stringify(out.packageManager)}`)
  if (!TEMPLATES_ENUM.includes(out.template)) bad(`template must be one of ${TEMPLATES_ENUM.join('/')}`)
  if (!PRIMARY_COLORS.includes(out.theme.primary)) bad(`theme.primary must be one of ${PRIMARY_COLORS.join('/')}`)
  if (!NEUTRAL_COLORS.includes(out.theme.neutral)) bad(`theme.neutral must be one of ${NEUTRAL_COLORS.join('/')}`)
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
 * Each approve runs separately with allowFail: naming a package that isn't
 * actually pending fails the whole `pnpm approve-builds` call.
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
function deepMerge(base, fragment) {
  for (const [k, v] of Object.entries(fragment)) {
    if (Array.isArray(v) && Array.isArray(base[k])) {
      const seen = new Set(base[k].map(x => JSON.stringify(x)))
      for (const item of v) if (!seen.has(JSON.stringify(item))) base[k].push(item)
    } else if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
      deepMerge(base[k], v)
    } else if (!(k in base)) {
      base[k] = v
    } // existing scalar/mismatched shape wins — merge, never overwrite
  }
  return base
}

function mergeJsonFile(targetPath, fragment) {
  if (!fs.existsSync(targetPath)) {
    writeFileEnsured(targetPath, JSON.stringify(fragment, null, 2))
    return
  }
  const base = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
  writeFileEnsured(targetPath, JSON.stringify(deepMerge(base, fragment), null, 2))
}

function readTemplate(relPath, subs = {}) {
  return substitute(fs.readFileSync(path.join(TEMPLATES, relPath), 'utf8'), subs)
}

// ── stages ──────────────────────────────────────────────────────────────

function preflight() {
  const nodeMajor = Number(process.version.slice(1).split('.')[0])
  if (nodeMajor < 22) fail(`Node.js 22+ required (running ${process.version})`)
  const pnpmCheck = run('pnpm', ['--version'], { capture: true, allowFail: true, cwd: process.cwd() })
  if (pnpmCheck.status !== 0) fail('pnpm is required but not installed. Install: corepack enable && corepack prepare pnpm@latest --activate')

  fs.mkdirSync(CFG.targetDir, { recursive: true })

  const nuxtConfig = path.join(CFG.targetDir, 'nuxt.config.ts')
  const hasNuxtConfig = fs.existsSync(nuxtConfig)
  const complete = fs.existsSync(path.join(CFG.targetDir, 'vitest.config.ts')) && fs.existsSync(path.join(CFG.targetDir, '.claude', 'settings.json'))

  if (CFG.resume) {
    if (!hasNuxtConfig) fail('resume=true but no nuxt.config.ts in targetDir — nothing to resume; run without resume')
    if (complete) fail('resume=true but the scaffold looks complete (vitest.config.ts + .claude/settings.json present) — nothing to do')
    log('partial scaffold detected — resuming from the BFF-preset stage')
  } else if (hasNuxtConfig) {
    fail(complete
      ? 'nuxt.config.ts found and the scaffold looks complete — refusing to overwrite. Nothing to do.'
      : 'nuxt.config.ts found but vitest.config.ts or .claude/settings.json is missing — partial scaffold. Re-run with "resume": true to continue from the BFF-preset stage.')
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

const CORE_MODULES = ['@pinia/nuxt', 'nuxt-auth-utils', '@vueuse/nuxt']
const PRESET_DEPS = ['@pinia/colada', '@pinia/colada-nuxt', 'zod']
const PRESET_DEV_DEPS = ['vitest', '@nuxt/test-utils', 'happy-dom', 'simple-git-hooks', 'lint-staged', 'openapi-typescript']

/** skipInstall-only: declare deps in package.json as the "latest" dist-tag (no registry lookup, no pnpm add) so a later `pnpm install` resolves them. */
function declareDepsUnresolved(deps, devDeps) {
  const fragment = {
    dependencies: Object.fromEntries(deps.map((d) => [d, 'latest'])),
    devDependencies: Object.fromEntries(devDeps.map((d) => [d, 'latest']))
  }
  mergeJsonFile(path.join(CFG.targetDir, 'package.json'), fragment)
}

function verifyCoreModulesRegistered(context) {
  const nuxtConfig = fs.readFileSync(path.join(CFG.targetDir, 'nuxt.config.ts'), 'utf8')
  for (const mod of CORE_MODULES) {
    if (!nuxtConfig.includes(mod)) {
      fail(`${context}: ${mod} is not registered in nuxt.config.ts — re-verify bootstrap.md Stage 1`)
    }
  }
}

function stage1Init() {
  // --no-install only skips the base template's own dependency install (create-nuxt/nuxi
  // still write files + package.json). --gitInit is silently skipped alongside it, so the
  // explicit git-init fallback right below always covers both cases. --modules ALSO can't be
  // combined with --no-install: without installed node_modules create-nuxt can't detect the
  // Nuxt version, treats @pinia/nuxt as incompatible, and blocks on an interactive "continue
  // anyway?" prompt that silently defaults to "No" non-interactively — so --modules is atomic
  // install-and-register and only ever passed when an install is actually happening.
  const noInstall = CFG.skipInstall ? ['--no-install'] : []
  const modulesFlag = CFG.skipInstall ? [] : ['--modules', 'pinia,auth-utils,vueuse']
  const noInstallLabel = CFG.skipInstall ? ', --no-install' : ''
  if (CFG.template === 'starter') {
    log(`stage 1: npm create nuxt@latest (non-interactive, ui template, in-place${noInstallLabel})`)
    const createArgs = ['create', 'nuxt@latest', '.', '--', '--template', 'ui', '--packageManager', CFG.packageManager, '--gitInit', '--force', ...modulesFlag, ...noInstall]
    let res = run('npm', createArgs)
    if (res.status !== 0) {
      log('npm create failed — clearing npm cache and retrying once')
      run('npm', ['cache', 'clean', '--force'], { allowFail: true })
      res = run('npm', createArgs)
    }
    if (res.status !== 0) {
      log('npm create failed twice — falling back to npx nuxi init')
      must('npx', ['nuxi@latest', 'init', '.', '--template', 'ui', '--packageManager', CFG.packageManager, '--gitInit', '--force', ...modulesFlag, ...noInstall], 'nuxi init fallback')
    }
  } else {
    const repo = TEMPLATE_REPOS[CFG.template]
    log(`stage 1: npx nuxi init (non-interactive, cloning gh:${repo}, in-place${noInstallLabel})`)
    must('npx', ['nuxi@latest', 'init', '.', '--template', `gh:${repo}`, '--packageManager', CFG.packageManager, '--gitInit', '--force', ...noInstall], `nuxi init --template gh:${repo}`)
  }

  // --gitInit only fires when the install step runs; make sure a repo exists either way.
  if (!fs.existsSync(path.join(CFG.targetDir, '.git'))) {
    log('--gitInit did not fire — running git init explicitly')
    must('git', ['init'], 'git init')
  }

  if (CFG.template === 'starter' && !CFG.skipInstall) {
    // Registration check: create-nuxt@latest is unpinned, so --modules silently
    // changing behavior is the risk a version pin used to cover.
    verifyCoreModulesRegistered("Stage 1's --modules flag did not register core modules")
  } else {
    // Either a cloned template (arbitrary giget templates don't support --modules) or
    // skipInstall (which drops --modules on every template, see above) — add and register
    // the BFF preset's core modules ourselves so Stage 1b's refresh step (which assumes
    // they're already installed) sees the same shape as the starter+install path.
    const registerVerb = CFG.skipInstall ? 'declaring' : 'installing'
    const registerReason = CFG.template === 'starter' ? 'skipInstall drops --modules' : 'not supported by --modules on a cloned template'
    const registerContext = CFG.template === 'starter' ? '(skipInstall path)' : 'after cloning the template'
    log(`stage 1: ${registerVerb} core BFF modules (pinia, nuxt-auth-utils, vueuse) — ${registerReason}`)
    if (CFG.skipInstall) declareDepsUnresolved(CORE_MODULES, [])
    else pnpmAdd(CORE_MODULES)
    for (const mod of CORE_MODULES) ensureModuleRegistered(mod)
    verifyCoreModulesRegistered(`failed to register core modules ${registerContext}`)
  }

  const pkgPath = path.join(CFG.targetDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.name = CFG.projectName
  writeFileEnsured(pkgPath, JSON.stringify(pkg, null, 2))
  log(`stage 1 done — package.json name set to ${CFG.projectName}`)
}

function stage1bRefresh() {
  if (CFG.skipInstall) {
    log('stage 1b: skipped (skipInstall) — package.json keeps whatever versions create-nuxt@latest shipped, unrefreshed')
    return
  }
  log(`stage 1b: refreshing template-installed packages (policy: ${CFG.versionPolicy})`)
  const specs = TEMPLATE_PKGS.map((p) => {
    if (CFG.versionPolicy === 'latest') return `${p}@latest`
    const pkgJson = path.join(CFG.targetDir, 'node_modules', ...p.split('/'), 'package.json')
    if (!fs.existsSync(pkgJson)) {
      fail(`stage 1b: ${p} was not installed by stage 1 — create-nuxt@latest's template package set may have changed; re-verify bootstrap.md Stage 1`)
    }
    // Read the file directly — require()/import of '<pkg>/package.json' breaks on restrictive `exports` maps.
    const v = JSON.parse(fs.readFileSync(pkgJson, 'utf8')).version
    return `${p}@^${v.split('.')[0]}`
  })
  pnpmAdd(specs)

  // Safety checks: catch an unwanted major or a changed template shape before later stages build on it.
  const nuxtVersion = JSON.parse(fs.readFileSync(path.join(CFG.targetDir, 'node_modules', 'nuxt', 'package.json'), 'utf8')).version
  if (nuxtVersion.split('.')[0] !== '4') {
    fail(`nuxt is now v${nuxtVersion} (expected v4) — stop, re-validate this skill before continuing`)
  }
  const nuxtConfig = fs.readFileSync(path.join(CFG.targetDir, 'nuxt.config.ts'), 'utf8')
  if (!fs.existsSync(path.join(CFG.targetDir, 'app', 'app.config.ts')) || !fs.existsSync(path.join(CFG.targetDir, 'eslint.config.mjs')) || !nuxtConfig.includes('css:') || !nuxtConfig.includes('routeRules')) {
    fail("create-nuxt@latest's template shape changed — re-verify artifacts.md merge instructions (nuxt.config.ts key order, app.config.ts) before continuing")
  }
  log('stage 1b done — nuxt v4 confirmed, template shape ok')
}

function stage2Preset() {
  if (CFG.skipInstall) {
    log('stage 2: skipped installing BFF preset packages (skipInstall) — declaring them in package.json as "latest" for a later `pnpm install`')
    declareDepsUnresolved(PRESET_DEPS, PRESET_DEV_DEPS)
    // Required for useQuery/useMutation to work at all — registration is a text edit, not an install.
    ensureModuleRegistered('@pinia/colada-nuxt')
    return
  }
  log('stage 2: installing BFF preset packages')
  pnpmAdd(PRESET_DEPS)
  // Required for useQuery/useMutation to work at all (SSR-safe cache, auto PiniaColadaSSRNoGc) — not optional.
  ensureModuleRegistered('@pinia/colada-nuxt')
  // simple-git-hooks trips ERR_PNPM_IGNORED_BUILDS — expected; approved right after.
  pnpmAdd(['-D', ...PRESET_DEV_DEPS], ['simple-git-hooks'])
  log('stage 2 done')
}

function ensureModuleRegistered(moduleName) {
  const nuxtConfigPath = path.join(CFG.targetDir, 'nuxt.config.ts')
  let content = fs.readFileSync(nuxtConfigPath, 'utf8')
  if (!content.includes(moduleName)) {
    // nuxi can silently skip registration when a native-dep build-approval prompt defaults to "No".
    log(`${moduleName} missing from nuxt.config.ts modules — adding it`)
    const m = content.match(/modules:\s*\[/)
    if (!m) fail(`cannot find a modules array in nuxt.config.ts to register ${moduleName}`)
    const at = m.index + m[0].length
    content = `${content.slice(0, at)}\n    '${moduleName}',${content.slice(at)}`
    fs.writeFileSync(nuxtConfigPath, content)
  }
}

function applyArtifacts() {
  log('stage 3: applying artifacts')
  const subs = {
    PROJECT_NAME: CFG.projectName,
    PRIMARY: CFG.theme.primary,
    NEUTRAL: CFG.theme.neutral
  }

  // Write-fresh files (ours — safe to overwrite on resume).
  const filesRoot = path.join(TEMPLATES, 'files')
  for (const src of listFilesRecursive(filesRoot)) {
    const rel = path.relative(filesRoot, src)
    writeFileEnsured(path.join(CFG.targetDir, rel), substitute(fs.readFileSync(src, 'utf8'), subs))
  }
  // Template-specific overlays (same write-fresh mechanism as `files/`, gated by CFG.template):
  // `starter` gets the openapi stub (no backend contract to describe for a cloned template);
  // `saas` gets the demo-auth + private dashboard wiring the official template doesn't ship.
  const templateOverlay = CFG.template === 'starter' ? 'starter' : CFG.template === 'saas' ? 'saas' : null
  if (templateOverlay) {
    const overlayRoot = path.join(TEMPLATES, templateOverlay)
    for (const src of listFilesRecursive(overlayRoot)) {
      if (path.relative(overlayRoot, src).startsWith(`merge${path.sep}`)) continue // handled below, JSON-merged not overwritten
      const rel = path.relative(overlayRoot, src)
      writeFileEnsured(path.join(CFG.targetDir, rel), substitute(fs.readFileSync(src, 'utf8'), subs))
    }
  }
  // nuxt.config.ts merge: insert runtimeConfig between css and routeRules (key
  // order enforced by nuxt/nuxt-config-keys-order; comment on its own line —
  // a trailing comment trips @stylistic/no-multi-spaces).
  const nuxtConfigPath = path.join(CFG.targetDir, 'nuxt.config.ts')
  let nuxtConfig = fs.readFileSync(nuxtConfigPath, 'utf8')
  if (!nuxtConfig.includes('runtimeConfig')) {
    const m = nuxtConfig.match(/^([ \t]*)routeRules/m)
    if (!m) fail('cannot find routeRules in nuxt.config.ts — template shape changed; re-verify artifacts.md')
    const block = `${m[1]}// server-only; set via NUXT_BACKEND_URL env\n${m[1]}runtimeConfig: { backendUrl: '' },\n`
    nuxtConfig = nuxtConfig.slice(0, m.index) + block + nuxtConfig.slice(m.index)
  }
  // devtools: BFF preset ships with devtools off by default.
  if (!nuxtConfig.includes('devtools: { enabled: false }')) {
    const before = nuxtConfig
    nuxtConfig = nuxtConfig.replace(/devtools:\s*\{\s*enabled:\s*true\s*\}/, 'devtools: { enabled: false }')
    if (nuxtConfig === before) fail('cannot find devtools: { enabled: true } in nuxt.config.ts — template shape changed; re-verify artifacts.md')
  }
  // The ui template ships nuxt.config.ts without a trailing newline (@stylistic/eol-last fails lint).
  if (!nuxtConfig.endsWith('\n')) nuxtConfig += '\n'
  fs.writeFileSync(nuxtConfigPath, nuxtConfig)

  // app/app.config.ts: set theme colors in place (template ships green/slate).
  const appConfigPath = path.join(CFG.targetDir, 'app', 'app.config.ts')
  let appConfig = fs.readFileSync(appConfigPath, 'utf8')
  const before = appConfig
  appConfig = appConfig
    .replace(/primary:\s*(['"])[a-z]+\1/, `primary: '${CFG.theme.primary}'`)
    .replace(/neutral:\s*(['"])[a-z]+\1/, `neutral: '${CFG.theme.neutral}'`)
  if (appConfig === before && (!appConfig.includes(`'${CFG.theme.primary}'`) || !appConfig.includes(`'${CFG.theme.neutral}'`))) {
    fail('could not set theme colors in app/app.config.ts — template shape changed; re-verify artifacts.md')
  }
  fs.writeFileSync(appConfigPath, appConfig)

  // app/assets/css/main.css: BigIn brand default is Google Sans, regardless of
  // which font a given ui-templates repo ships (most ship 'Public Sans'; landing
  // ships 'Instrument Sans') — replace whatever's quoted after --font-sans.
  const mainCssPath = path.join(CFG.targetDir, 'app', 'assets', 'css', 'main.css')
  let mainCss = fs.readFileSync(mainCssPath, 'utf8')
  if (!mainCss.includes("--font-sans: 'Google Sans'")) {
    const before = mainCss
    mainCss = mainCss.replace(/--font-sans:\s*'[^']+'/, "--font-sans: 'Google Sans'")
    if (mainCss === before) fail('cannot find --font-sans in app/assets/css/main.css — template shape changed; re-verify artifacts.md')
  }
  fs.writeFileSync(mainCssPath, mainCss)

  // JSON merges — merge, never overwrite.
  mergeJsonFile(path.join(CFG.targetDir, 'package.json'), JSON.parse(readTemplate(path.join('merge', 'package.json'), subs)))
  mergeJsonFile(path.join(CFG.targetDir, '.claude', 'settings.json'), JSON.parse(readTemplate(path.join('merge', 'claude-settings.json'), subs)))
  mergeJsonFile(path.join(CFG.targetDir, '.vscode', 'settings.json'), JSON.parse(readTemplate(path.join('merge', 'vscode-settings.json'), subs)))
  if (CFG.template === 'starter') {
    // openapi-types script only makes sense alongside the openapi.yaml stub (starter-only overlay above).
    mergeJsonFile(path.join(CFG.targetDir, 'package.json'), JSON.parse(readTemplate(path.join('starter', 'merge', 'package.json'), subs)))
  }

  // .env must never be committed.
  const gitignorePath = path.join(CFG.targetDir, '.gitignore')
  const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : ''
  if (!gitignore.split(/\r?\n/).includes('.env')) {
    fs.writeFileSync(gitignorePath, `${gitignore}${gitignore.endsWith('\n') || gitignore === '' ? '' : '\n'}.env\n`)
  }
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
  must('git', ['commit', '-m', 'chore: scaffold Nuxt 4 BFF app'], 'git commit')
}

function printNextSteps() {
  const lines = [
    '',
    `Nuxt 4 BFF app scaffolded (template: ${CFG.template}).`,
    '',
    'Next:'
  ]
  if (CFG.template === 'starter') {
    lines.push(
      '  1. Copy .env.example → .env and set:',
      '     - NUXT_SESSION_PASSWORD (openssl rand -base64 32)',
      '     - NUXT_BACKEND_URL     (backend REST API; server-only)',
      '  2. Replace the stub openapi.yaml with the real backend contract, then:',
      '     pnpm openapi-types',
      '  3. Overlay governance: run bigin-harness-setup (CLAUDE.md, rules, bash-guard).',
      '  4. Start: pnpm dev'
    )
  } else if (CFG.template === 'saas') {
    lines.push(
      '  1. Copy .env.example → .env and set NUXT_SESSION_PASSWORD (openssl rand -base64 32).',
      '  2. /api/login and /api/signup are stubbed (any valid-shaped credentials succeed, no backend call) — swap in a real backend before shipping.',
      '  3. Overlay governance: run bigin-harness-setup (CLAUDE.md, rules, bash-guard).',
      '  4. Start: pnpm dev — public site at /, private area at /dashboard.'
    )
  } else {
    lines.push(
      '  1. Copy .env.example → .env and set NUXT_SESSION_PASSWORD (openssl rand -base64 32).',
      `  2. This is the official nuxt-ui-templates/${CFG.template} starter layered with the BFF preset — see its own README for template-specific usage.`,
      '  3. Overlay governance: run bigin-harness-setup (CLAUDE.md, rules, bash-guard).',
      '  4. Start: pnpm dev'
    )
  }
  if (CFG.versionPolicy === 'latest') {
    lines.push('  ⚠ versionPolicy=latest — skim the changelogs for nuxt/@nuxt/ui/tailwindcss (and the other refreshed packages) for breaking changes before shipping.')
  }
  if (CFG.skipInstall) {
    lines.push(
      '  ⚠ skipInstall=true — no dependency is installed and nothing was verified. Before anything else:',
      '     a. pnpm install',
      '     b. pnpm approve-builds simple-git-hooks   (deferred build script)',
      '     c. pnpm simple-git-hooks                  (activates the pre-commit hook)',
      '     d. pnpm lint && pnpm type-check && pnpm test',
      '  Preset packages (@pinia/colada*, zod, vitest, etc.) are pinned to the "latest" dist-tag in package.json, unresolved — pin exact versions once installed if you want reproducible installs.'
    )
  }
  console.log(lines.join('\n'))
}

// ── main ────────────────────────────────────────────────────────────────

const CFG = loadConfig()
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
