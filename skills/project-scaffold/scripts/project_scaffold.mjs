#!/usr/bin/env node
/**
 * project_scaffold.mjs — stands up a complete polyrepo project.
 *
 * Usage:
 *   node project_scaffold.mjs --project acme [--dir .] [--owner <login>]
 *                             [--app-id <id> --app-key <path/to.pem>]
 *                             [--repos specs,contracts,api,web,mobile,qa]
 *                             [--no-install] [--force]
 *
 * Node >=20 stdlib only. Exit 0 ok, 1 runtime failure, 2 bad usage.
 *
 * WHAT THIS DOES NOT DO, ON PURPOSE
 *
 * It writes no guard, no `.claude/rules/`, no `settings.json` and no `CLAUDE.md`.
 * `bigin-harness-setup` owns the governance overlay, and a second implementation of
 * it here would drift the day either changed. This writes the CONNECTIVE TISSUE the
 * harness has no way to know about — which repo pairs with which, what the lock
 * points at, which toolchain each workflow needs — and hands off.
 *
 * It also never scaffolds an app itself: `go-scaffold`, `nuxt-scaffold` and
 * `flutter create` already do that, and are invoked as they are.
 *
 * `--owner` is required to create anything remote. There is no inferred default,
 * because the accident it prevents is six repos appearing in an organisation
 * nobody meant to touch.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGIN = resolve(SCRIPT_DIR, '..', '..', '..')          // repo root of bigin-skills
const REF = join(PLUGIN, 'skills', 'bigin-harness-setup', 'references')

const TYPES = ['specs', 'contracts', 'api', 'web', 'mobile', 'qa']
const CONSUMERS = ['api', 'web', 'mobile']          // vendor a contract
const STORY_CONSUMERS = ['api', 'web', 'mobile', 'qa']  // receive synced stories

// Per repo type: where its vendored spec lives, and the CI toolchain block its
// codegen needs. The commented placeholder in the shipped workflow template is what
// broke both consumer repos in the pilot — this is the fix, applied at write time.
const ADAPTER = {
  api: {
    spec: 'openapi.yaml',
    toolchain: '      - uses: actions/setup-go@v5\n        with:\n          go-version-file: go.mod\n'
  },
  web: {
    spec: 'openapi.yaml',
    // No `version:` — package.json's packageManager is the pin, and passing both
    // makes pnpm/action-setup fail outright.
    toolchain: '      - uses: pnpm/action-setup@v4\n      - run: pnpm install --no-frozen-lockfile\n'
  },
  mobile: {
    spec: 'api/openapi.yaml',
    toolchain: '      - uses: subosito/flutter-action@v2\n        with:\n          channel: stable\n'
  }
}

const PROJECT_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

function fail(msg, code = 1) {
  console.error(`[project-scaffold] ERROR: ${msg}`)
  process.exit(code)
}
function log(msg) { console.log(`[project-scaffold] ${msg}`) }
const notes = []
function note(msg) { notes.push(msg); log(msg) }

function run(cmd, args, cwd, { quiet = true } = {}) {
  return spawnSync(cmd, args, {
    cwd, encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    shell: process.platform === 'win32' && /^(pnpm|npm|npx)$/.test(cmd)
  })
}
function has(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which'
  return spawnSync(probe, [cmd], { stdio: 'ignore' }).status === 0
}

// First fenced block of `lang` under `## heading` in one of the plugin's references.
function block(file, heading, lang) {
  const md = readFileSync(join(REF, file), 'utf8')
  const i = md.indexOf(`\n## ${heading}\n`)
  if (i === -1) fail(`${file} has no "## ${heading}" — the plugin and this script disagree`)
  const open = md.indexOf('```' + lang, i)
  const start = open + 3 + lang.length + 1
  return md.slice(start, md.indexOf('\n```', start)) + '\n'
}

// ── args ────────────────────────────────────────────────────────────────

let values
try {
  ;({ values } = parseArgs({
    options: {
      'project': { type: 'string' },
      'dir': { type: 'string', default: '.' },
      'owner': { type: 'string' },
      'app-id': { type: 'string' },
      'app-key': { type: 'string' },
      'repos': { type: 'string', default: TYPES.join(',') },
      'no-install': { type: 'boolean', default: false },
      'force': { type: 'boolean', default: false },
      'help': { type: 'boolean', default: false }
    }
  }))
} catch (e) {
  fail(`bad arguments: ${e.message}`, 2)
}

if (values.help || !values.project) {
  console.log(`Usage: project_scaffold.mjs --project <slug> [--dir .] [--owner <login>]
                            [--app-id <id> --app-key <path.pem>]
                            [--repos ${TYPES.join(',')}] [--no-install] [--force]`)
  process.exit(values.help ? 0 : 2)
}
if (!PROJECT_RE.test(values.project)) fail(`--project must be kebab-case, got "${values.project}"`, 2)

const wanted = values.repos.split(',').map(s => s.trim()).filter(Boolean)
for (const r of wanted) if (!TYPES.includes(r)) fail(`unknown repo type "${r}"`, 2)
if ((values['app-id'] && !values['app-key']) || (!values['app-id'] && values['app-key'])) {
  fail('--app-id and --app-key go together', 2)
}
if (values['app-key'] && !existsSync(values['app-key'])) fail(`no such key file: ${values['app-key']}`, 2)
if (values['app-id'] && !values.owner) fail('--app-id needs --owner: credentials are set on remote repos', 2)

const PROJECT = values.project
const ROOT = resolve(values.dir)
const OWNER = values.owner ?? null
const repoName = t => `${PROJECT}-${t}`
const repoDir = t => join(ROOT, repoName(t))
const slug = t => (OWNER ? `${OWNER}/${repoName(t)}` : `<owner>/${repoName(t)}`)

// ── seeds ───────────────────────────────────────────────────────────────

function seedSpecs(dir) {
  for (const d of ['docs/prd', 'docs/architecture', 'docs/epics', 'docs/stories', 'docs/qa', 'ux', 'scripts']) {
    mkdirSync(join(dir, d), { recursive: true })
  }
  const map = readFileSync(join(PLUGIN, 'docs', 'polyrepo', 'templates', 'REPO_MAP.md'), 'utf8')
    .replaceAll('{{project}}', PROJECT)
    // replaceAll, not replace: the template names it twice, and the explanatory
    // HTML comment below has done its job once the value is substituted.
    .replaceAll('{{vendored-spec-path}}', 'openapi.yaml (api, web) · api/openapi.yaml (mobile)')
    .replace(/<!--[^>]*is per repo type[\s\S]*?-->\n\n?/, '')
    .replace(/\{\{deprecation-window[^}]*\}\}/, 'TODO: agree a window, e.g. 90 days after mobile release adoption')
    .replace('{{tunnel-url}}', 'TODO: not yet provisioned')
  writeFileSync(join(dir, 'REPO_MAP.md'), map)
  copyFileSync(join(PLUGIN, 'skills', 'bigin-harness-setup', 'scripts', 'story_lint.mjs'), join(dir, 'scripts', 'story_lint.mjs'))
  writeFileSync(join(dir, 'ux', 'figma-links.md'),
    `# Figma\n\nDesign system links live here. Per-story frames are linked from each consumer repo's\n\`docs/story-meta/<ID>.yaml\` — never from the story itself.\n`)
  writeFileSync(join(dir, 'docs', 'stories', '.gitkeep'), '')
}

function seedContracts(dir) {
  mkdirSync(join(dir, 'openapi'), { recursive: true })
  writeFileSync(join(dir, 'openapi', 'core.v1.yaml'),
    `# Owned by ${repoName('contracts')}. Consumers vendor this at a pinned commit; nobody edits a copy.\n`
    + `openapi: 3.0.3\ninfo:\n  title: ${PROJECT} core API\n  version: "1.0.0"\npaths: {}\ncomponents:\n  schemas: {}\n`)
  writeFileSync(join(dir, 'CHANGELOG.md'),
    `# Contract changelog\n\nOne entry per published tag. Name the consumers expected to move, not just the change.\n\n## Unreleased\n- Initial contract skeleton.\n`)
}

function seedQa(dir) {
  for (const d of ['cases', 'e2e', 'traceability', 'docs/stories', 'docs/story-meta']) {
    mkdirSync(join(dir, d), { recursive: true })
  }
  writeFileSync(join(dir, 'traceability', 'README.md'),
    '# Traceability\n\n| Story | Manual cases | E2E specs |\n|---|---|---|\n')
  writeFileSync(join(dir, 'cases', '.gitkeep'), '')
}

// ── connective tissue ───────────────────────────────────────────────────

function wireConsumer(dir, type) {
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  mkdirSync(join(dir, 'docs', 'stories'), { recursive: true })
  mkdirSync(join(dir, 'docs', 'story-meta'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'story-meta', '.gitkeep'), '')

  for (const [from, to] of [
    [join(PLUGIN, 'skills', 'bigin-harness-setup', 'scripts', 'story_sync.mjs'), 'story_sync.mjs'],
    [join(PLUGIN, 'skills', 'bigin-harness-setup', 'scripts', 'story_gate.mjs'), 'story_gate.mjs']
  ]) copyFileSync(from, join(dir, 'scripts', to))

  writeFileSync(join(dir, 'story-sync.json'),
    `${JSON.stringify({ repo: slug('specs'), ref: 'main' }, null, 2)}\n`)

  if (CONSUMERS.includes(type)) {
    copyFileSync(join(PLUGIN, 'skills', 'contract-sync', 'scripts', 'contract_sync.mjs'), join(dir, 'scripts', 'contract_sync.mjs'))
    const lock = JSON.parse(readFileSync(join(PLUGIN, 'skills', 'contract-sync', 'templates', 'api-contract.lock.json'), 'utf8'))
    lock.contracts.core.repo = slug('contracts')
    writeFileSync(join(dir, 'api-contract.lock'), `${JSON.stringify(lock, null, 2)}\n`)
  }
}

// The whole point of this script: the shipped workflow ships its toolchain block
// COMMENTED OUT, and a harness install that leaves it there produces a workflow which
// gets through checkout, setup and token minting and then dies at codegen. Both of the
// pilot's consumer repos did exactly that.
function fillToolchain(yaml, type) {
  const start = yaml.indexOf('      # === REPLACE THIS BLOCK')
  if (start === -1) return yaml   // template changed shape; leave it rather than guess
  const endMark = yaml.indexOf('=========================================================================', start)
  const end = yaml.indexOf('\n', endMark) + 1
  return yaml.slice(0, start) + (ADAPTER[type]?.toolchain ?? '') + yaml.slice(end)
}

function writeWorkflows(dir, type) {
  const wf = join(dir, '.github', 'workflows')
  mkdirSync(wf, { recursive: true })
  if (type === 'specs') {
    writeFileSync(join(wf, 'story-dispatch.yml'), block('ci.md', 'story-sync workflow: github (specs repo)', 'yaml'))
    return
  }
  if (!STORY_CONSUMERS.includes(type)) return
  writeFileSync(join(wf, 'story-sync.yml'), block('ci.md', 'story-sync workflow: github (consumer repos)', 'yaml'))
  writeFileSync(join(wf, 'story-gates.yml'), block('ci.md', 'story gates: github (consumer repos)', 'yaml'))
  if (!CONSUMERS.includes(type)) return
  const tmplDir = join(PLUGIN, 'skills', 'contract-sync', 'templates', 'workflows')
  for (const f of ['contract-bump.yml', 'contract-drift.yml']) {
    writeFileSync(join(wf, f), fillToolchain(readFileSync(join(tmplDir, f), 'utf8'), type))
  }
}

// ── app scaffolds, delegated ────────────────────────────────────────────

function scaffoldApp(dir, type) {
  if (type === 'api') {
    if (!has('go')) { note(`${repoName(type)}: go not installed — repo created, run go-scaffold there later`); return false }
    const r = run('node', [join(PLUGIN, 'skills', 'go-scaffold', 'scripts', 'scaffold.mjs'),
      '--module', `github.com/${OWNER ?? 'CHANGE-ME'}/${repoName('api')}`,
      '--dir', dir, '--project', repoName('api'), '--no-commit'], ROOT, { quiet: false })
    if (r.status !== 0) { note(`${repoName(type)}: go-scaffold failed — see its output above`); return false }
    return true
  }
  if (type === 'web') {
    if (!has('pnpm')) { note(`${repoName(type)}: pnpm not installed — repo created, run nuxt-scaffold there later`); return false }
    const cfg = join(dir, '.project-scaffold-nuxt.json')
    writeFileSync(cfg, JSON.stringify({
      projectName: repoName('web'), targetDir: dir, template: 'starter',
      skipInstall: values['no-install'], gitCommit: false
    }))
    const r = run('node', [join(PLUGIN, 'skills', 'nuxt-scaffold', 'scripts', 'scaffold.mjs'), '--config', cfg], ROOT, { quiet: false })
    try { readdirSync(dir) } catch { /* ignore */ }
    if (r.status !== 0) { note(`${repoName(type)}: nuxt-scaffold failed — see its output above`); return false }
    return true
  }
  if (type === 'mobile') {
    if (!has('flutter')) { note(`${repoName(type)}: flutter not installed — repo created, run \`flutter create\` there later`); return false }
    const r = run('flutter', ['create', '--project-name', repoName('mobile').replace(/-/g, '_'),
      '--org', 'com.example', '--platforms=ios,android', '--empty', '.'], dir, { quiet: false })
    if (r.status !== 0) { note(`${repoName(type)}: flutter create failed`); return false }
    return true
  }
  return false
}

// ── build ───────────────────────────────────────────────────────────────

log(`project "${PROJECT}" → ${ROOT}`)
mkdirSync(ROOT, { recursive: true })

const built = []
for (const type of wanted) {
  const dir = repoDir(type)
  const existed = existsSync(dir) && readdirSync(dir).length > 0
  if (existed && !values.force) { note(`${repoName(type)}: already exists — adopted, nothing overwritten`); }
  mkdirSync(dir, { recursive: true })

  if (!existed || values.force) {
    if (type === 'specs') seedSpecs(dir)
    else if (type === 'contracts') seedContracts(dir)
    else if (type === 'qa') seedQa(dir)
    else scaffoldApp(dir, type)
  }
  if (STORY_CONSUMERS.includes(type)) wireConsumer(dir, type)
  writeWorkflows(dir, type)

  if (!existsSync(join(dir, '.git'))) run('git', ['init', '-q', '-b', 'main', '.'], dir)
  run('git', ['add', '-A'], dir)
  const c = run('git', ['-c', 'user.name=project-scaffold', '-c', 'user.email=project-scaffold@local',
    'commit', '-q', '-m', `chore: scaffold ${repoName(type)} for the ${PROJECT} polyrepo project`], dir)
  if (c.status !== 0 && !(c.stdout + c.stderr).includes('nothing to commit')) {
    note(`${repoName(type)}: nothing committed — ${(c.stderr || c.stdout).trim().split('\n')[0]}`)
  }
  built.push(type)
  log(`${repoName(type)}: ready`)
}

// ── remotes, opt-in ─────────────────────────────────────────────────────

if (OWNER) {
  if (!has('gh')) {
    note('gh is not installed — no remote was created. Everything above is local and complete.')
  } else if (run('gh', ['api', 'user'], ROOT).status !== 0) {
    note('gh cannot reach the GitHub API — no remote was created. Everything above is local and complete.')
  } else {
    for (const type of built) {
      const dir = repoDir(type)
      const name = `${OWNER}/${repoName(type)}`
      if (run('gh', ['repo', 'view', name], ROOT).status !== 0) {
        const r = run('gh', ['repo', 'create', name, '--private'], ROOT)
        if (r.status !== 0) { note(`${name}: could not create (${(r.stderr || '').trim().split('\n')[0]})`); continue }
      } else note(`${name}: already on GitHub — adopted`)
      run('git', ['remote', 'remove', 'origin'], dir)
      run('git', ['remote', 'add', 'origin', `https://github.com/${name}.git`], dir)
      const p = run('git', ['push', '-q', '-u', 'origin', 'main'], dir)
      log(p.status === 0 ? `${name}: pushed` : `${name}: PUSH FAILED — ${(p.stderr || '').trim().split('\n')[0]}`)
    }
  }
}

// ── credentials, opt-in ─────────────────────────────────────────────────

if (values['app-id'] && OWNER && has('gh')) {
  for (const type of built) {
    const name = `${OWNER}/${repoName(type)}`
    run('gh', ['variable', 'set', 'CONTRACT_APP_ID', '--repo', name, '--body', values['app-id']], ROOT)
    // The key goes from disk to GitHub. It is never read into this process, never
    // logged, and never written anywhere else.
    const r = spawnSync('gh', ['secret', 'set', 'CONTRACT_APP_PRIVATE_KEY', '--repo', name], {
      cwd: ROOT, stdio: [readFileSync(values['app-key']), 'ignore', 'pipe'], encoding: 'utf8'
    })
    if (r.status !== 0) note(`${name}: could not set the private key — ${(r.stderr || '').trim().split('\n')[0]}`)
  }
  if (built.includes('specs')) {
    const consumers = STORY_CONSUMERS.filter(t => built.includes(t)).map(t => `${OWNER}/${repoName(t)}`)
    run('gh', ['variable', 'set', 'STORY_CONSUMERS', '--repo', `${OWNER}/${repoName('specs')}`,
      '--body', JSON.stringify(consumers)], ROOT)
  }
  log('CI credentials set on every repo')
}

// ── summary ─────────────────────────────────────────────────────────────

console.log(`
[project-scaffold] ${built.length} repo(s) ready for "${PROJECT}"${OWNER ? ` under ${OWNER}` : ' (local only)'}.

Next, and this script deliberately does none of it:
  1. Run bigin-harness-setup in each repo. Phase 0a reads the name suffix and installs
     the profile plus, on api/web/mobile, the consumer overlay and its guard.
  2. Write the first contract in ${repoName('contracts')}, tag it, then
     \`node scripts/contract_sync.mjs bump <tag>\` in each consumer.
  3. ${OWNER ? 'Install your GitHub App on ' + OWNER + ' with access to these repos.' : 'Re-run with --owner <login> when you want remotes.'}
`)
if (notes.length > 0) {
  console.log('[project-scaffold] worth knowing:')
  for (const n of notes) console.log(`  - ${n}`)
}
