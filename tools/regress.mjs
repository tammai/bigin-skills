#!/usr/bin/env node
/**
 * regress.mjs — this repo's regression suite.
 *
 * The plugin has no unit tests: its product is markdown, and its skills are
 * checked by eval. What that leaves unchecked is everything mechanical around
 * them — manifest drift, an unregistered skill, the detection ladder, and the
 * scaffolder that ladder is verified against. This covers exactly that.
 *
 *   node tools/regress.mjs              # everything, including the three gates
 *   node tools/regress.mjs --skip-gates # the pre-commit hook's mode: it runs
 *                                       # the gates itself, so they aren't
 *                                       # repeated here
 *   node tools/regress.mjs --build      # + group 9: really install a scaffolded
 *                                       # site and run every pnpm step its CI
 *                                       # template runs. Network, ~3 minutes.
 *
 * Groups 1-8 are Node stdlib only, no network, no install — scaffolder cases
 * run with --no-install so the suite stays fast enough for a commit hook. They
 * assert on the *text* a scaffolder emits, which is enough to catch a token
 * that never got substituted, an import of a package no manifest declares, or
 * a helper nothing defines, and is not enough to catch anything that needs a
 * resolver or a compiler. Group 9 is the case that actually compiles, and it
 * is opt-in for the same reason it is necessary: it is slow.
 *
 * A case that cannot run prints SKIP with its reason and is counted in the
 * summary line. Nothing here ever passes by not running.
 * Exit 0 all green, 1 any failure.
 */

import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const TMP = join(tmpdir(), `bigin-skills-regress-${process.pid}`)
const SKIP_GATES = process.argv.includes('--skip-gates')
const WANT_BUILD = process.argv.includes('--build')
const PING = 'fetch("https://registry.npmjs.org/-/ping",{signal:AbortSignal.timeout(8000)})'
  + '.then(r=>process.exit(r.ok?0:1),()=>process.exit(1))'

// ── the Phase 0 ladder, transcribed from
//    skills/bigin-harness-setup/references/profile-detection.md rows 1-3.
//    If that file's rung changes, this transcription changes with it.
const has = existsSync

const dep = (pkg, name) => Boolean(pkg.dependencies?.[name])
const devOnly = (pkg, name) => !pkg.dependencies?.[name] && Boolean(pkg.devDependencies?.[name])

function detect (root, pkg) {
  const p = f => has(join(root, f))
  // row 1 — tauri, above nuxt on purpose
  if (p('src-tauri/tauri.conf.json')) return 'tauri'
  // row 2 — nuxt-marketing, four conditions, server/api deliberately untested
  const nuxtCfg = p('nuxt.config.ts') || p('nuxt.config.js')
  if (nuxtCfg
    && dep(pkg, '@nuxt/content')
    && dep(pkg, '@nuxtjs/i18n') && (p('content') || p('content.config.ts'))
    && !dep(pkg, 'nuxt-auth-utils') && !dep(pkg, '@sidebase/nuxt-auth')) return 'nuxt-marketing'
  // row 3 — nuxt
  if (nuxtCfg) return 'nuxt'
  return 'generic'
}

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
let pass = 0, fail = 0, skipped = 0
const t = (name, fn) => {
  try { const m = fn(); console.log(`  PASS  ${name}${m ? `  (${m})` : ''}`); pass++ }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++ }
}
const eq = (a, b, what) => { if (a !== b) throw new Error(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`) }
const sh = (cmd, args, opts={}) => spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', ...opts })
const read = f => readFileSync(f, 'utf8')
const skip = (name, why) => { console.log(`  SKIP  ${name}  (${why})`); skipped++ }

// Every hand-written source file in a generated site, in walk order.
const sources = (root) => {
  const out = []
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = join(d, e.name)
    if (e.isDirectory()) { if (!['node_modules','.nuxt','.output','.data','.git'].includes(e.name)) walk(f) }
    else if (/\.(?:ts|vue|mjs)$/.test(e.name)) out.push(f) } }
  walk(root); return out
}

// Packages Nuxt makes resolvable through generated tsconfig `paths` without the
// site declaring them. Type-only imports of these are fine; value imports are
// not — see the import check below.
const NUXT_ALIASED = new Set(['vue', 'h3'])

// A source file with its string literals, template literals and comments
// blanked out, so the call scan below sees code and not prose. The first pass
// has to be strings, or a URL inside one reads as the start of a comment.
const code = f => read(f)
  .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '\'\'')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .replace(/<!--[\s\S]*?-->/g, '')

// Keywords that take a parenthesis and are not calls.
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'typeof',
  'await', 'function', 'do', 'else', 'new', 'delete', 'void', 'in', 'of', 'yield',
  'throw', 'case', 'super', 'this', 'import', 'export', 'let', 'const', 'var'])

// Nuxt/Nitro/Vue auto-imports the generated tree is allowed to call without a
// definition of its own. This list is maintenance, and deliberately so: a new
// built-in call fails the suite until it is added here, which costs one line
// and is the price of catching a genuinely dangling symbol.
const NUXT_AUTO_IMPORTS = new Set([
  'computed', 'ref', 'reactive', 'watch', 'onMounted', 'defineProps', 'defineEmits',
  'defineNuxtConfig', 'defineAppConfig', 'defineContentConfig', 'defineCollection',
  'defineEventHandler', 'defineNuxtPlugin', 'defineNuxtRouteMiddleware',
  'useAsyncData', 'useFetch', 'useHead', 'useSeoMeta', 'useState', 'useRoute', 'useRouter',
  'useRuntimeConfig', 'useAppConfig', 'useI18n', 'useLocalePath', 'useSwitchLocalePath',
  'queryCollection', 'queryCollectionNavigation', 'readBody', 'readValidatedBody',
  'getQuery', 'getRequestIP', 'getRequestHeader', 'setResponseStatus', 'createError',
  'sendRedirect', 'navigateTo', 'createNuxtError'
])

// ── Commands the harness writes into a nuxt-marketing site, read out of the
//    templates that write them. Scoped to fenced blocks on purpose: prose in
//    the profile names `pnpm generate` precisely to say the profile does not
//    use it, and the settings allowlist names `pnpm typecheck`, which is a
//    permission pattern rather than a script.
const HS = join(REPO, 'skills/bigin-harness-setup/references')
const PNPM_BUILTINS = new Set(['install', 'i', 'add', 'remove', 'up', 'update', 'exec',
  'dlx', 'store', 'why', 'prune', 'rebuild', 'licenses', 'approve-builds', 'link', 'import'])

// The first fenced block under a `## <heading>` section of a reference file.
const fence = (file, heading) => {
  const src = read(join(HS, file))
  const at = src.indexOf(`\n## ${heading}\n`)
  if (at < 0) throw new Error(`${file}: no "## ${heading}" section`)
  const m = /```[a-z]*\n([\s\S]*?)\n```/.exec(src.slice(at))
  if (!m) throw new Error(`${file}: "## ${heading}" carries no fenced block`)
  return m[1]
}

// Every `pnpm …` invocation in a block as an argv array, with `run` and pnpm's
// own subcommands dropped — what is left is a script name and its arguments.
const pnpmCalls = (block) => {
  const out = []
  for (const [, rest] of block.matchAll(/(?<![\w@/-])pnpm[ \t]+([^\n|;&`#]*)/g)) {
    const argv = rest.trim().split(/\s+/).filter(Boolean)
    if (argv[0] === 'run') argv.shift()
    if (!argv.length || !/^[a-z][a-z0-9:_-]*$/.test(argv[0]) || PNPM_BUILTINS.has(argv[0])) continue
    out.push(argv)
  }
  return out
}

const COMMAND_BLOCKS = [
  ['ci.md github: nuxt-marketing', fence('ci.md', 'github: nuxt-marketing')],
  ['ci.md gitlab: nuxt-marketing', fence('ci.md', 'gitlab: nuxt-marketing')],
  ['profile-nuxt-marketing.md Commands', fence('profile-nuxt-marketing.md', 'Commands')]
]
// The GitHub workflow's own steps, in order. Group 9 runs these rather than a
// second list of them, so the build case proves the commands CI actually runs.
const CI_STEPS = pnpmCalls(COMMAND_BLOCKS[0][1])

if (SKIP_GATES) {
  console.log('\n1. GATES  (skipped — the hook runs them itself)')
} else {
  console.log('\n1. GATES')
  for (const g of ['context_budget.mjs', 'docs_sync.mjs', 'site_build.mjs']) {
    t(g, () => { const a = g === 'context_budget.mjs' ? [] : ['--check']
      const r = sh('node', [`tools/${g}`, ...a]); eq(r.status, 0, 'exit'); return r.stdout.trim().split('\n').pop() })
  }
}

console.log('\n2. MANIFEST CONSISTENCY')
const vers = []
t('four version fields agree', () => {
  for (const [f, sel] of [['.claude-plugin/plugin.json', d => [d.version]],
                          ['.cursor-plugin/plugin.json', d => [d.version]],
                          ['.cursor-plugin/marketplace.json', d => [d.metadata.version, ...d.plugins.map(p => p.version)]]]) {
    vers.push(...sel(JSON.parse(readFileSync(join(REPO, f), 'utf8'))))
  }
  const u = [...new Set(vers)]; eq(u.length, 1, 'distinct versions'); return u[0]
})
t('every manifest is valid JSON', () => {
  const fs_ = ['.claude-plugin/plugin.json','.claude-plugin/marketplace.json',
               '.cursor-plugin/plugin.json','.cursor-plugin/marketplace.json','tools/docs-manifest.json']
  for (const f of fs_) JSON.parse(readFileSync(join(REPO, f), 'utf8')); return `${fs_.length} files`
})
t('manifest profile list names nuxt-marketing', () => {
  for (const f of ['.claude-plugin/plugin.json','.cursor-plugin/plugin.json']) {
    const d = JSON.parse(readFileSync(join(REPO, f), 'utf8'))
    if (!d.description.includes('nuxt-marketing')) throw new Error(`${f} omits nuxt-marketing`)
  } return 'both'
})

console.log('\n3. SKILL INVENTORY')
const skills = readdirSync(join(REPO, 'skills')).filter(d => existsSync(join(REPO,'skills',d,'SKILL.md')))
t('every skill has evals/', () => {
  const missing = skills.filter(s => !existsSync(join(REPO,'skills',s,'evals')))
  eq(missing.join(',')||'none', 'none', 'skills without evals'); return `${skills.length} skills`
})
t('every skill is in docs-manifest', () => {
  const m = JSON.parse(readFileSync(join(REPO,'tools/docs-manifest.json'),'utf8')).skills
  const missing = skills.filter(s => !(s in m))
  eq(missing.join(',')||'none','none','unmanifested'); return `${Object.keys(m).length} entries`
})
t('every evals.json parses and is non-empty', () => {
  for (const s of skills) {
    const f = join(REPO,'skills',s,'evals','evals.json'); if (!existsSync(f)) continue
    const j = JSON.parse(readFileSync(f,'utf8')); if (!Array.isArray(j) || !j.length) throw new Error(`${s}: empty`)
  } return 'ok'
})
t("CLAUDE.md's scripts-count claim is true", () => {
  const claimed = Number(/\((\d+) skills have one\)/.exec(readFileSync(join(REPO,'CLAUDE.md'),'utf8'))[1])
  const actual = skills.filter(s => existsSync(join(REPO,'skills',s,'scripts'))).length
  eq(claimed, actual, 'scripts-count'); return `${actual}`
})

console.log('\n4. DETECTION')
const LAD = [
  ['marketing site',            ['nuxt.config.ts','content.config.ts','content/'], {dependencies:{'@nuxt/content':'1','@nuxtjs/i18n':'1'}}, 'nuxt-marketing'],
  ['+ contact form',            ['nuxt.config.ts','content.config.ts','content/','server/api/'], {dependencies:{'@nuxt/content':'1','@nuxtjs/i18n':'1'}}, 'nuxt-marketing'],
  ['BFF + docs section',        ['nuxt.config.ts','content/','server/api/'], {dependencies:{'@nuxt/content':'1','nuxt-auth-utils':'1'}}, 'nuxt'],
  ['BFF + docs + i18n, authed', ['nuxt.config.ts','content/','server/api/'], {dependencies:{'@nuxt/content':'1','@nuxtjs/i18n':'1','nuxt-auth-utils':'1'}}, 'nuxt'],
  ['content as devDependency',  ['nuxt.config.ts','content/'], {dependencies:{'@nuxtjs/i18n':'1'},devDependencies:{'@nuxt/content':'1'}}, 'nuxt'],
  ['tauri + nuxt + content',    ['src-tauri/tauri.conf.json','nuxt.config.ts','content/'], {dependencies:{'@nuxt/content':'1','@nuxtjs/i18n':'1'}}, 'tauri'],
  ['no content tree',           ['nuxt.config.ts'], {dependencies:{'@nuxt/content':'1','@nuxtjs/i18n':'1'}}, 'nuxt'],
  ['@sidebase/nuxt-auth',       ['nuxt.config.ts','content/'], {dependencies:{'@nuxt/content':'1','@nuxtjs/i18n':'1','@sidebase/nuxt-auth':'1'}}, 'nuxt'],
]
LAD.forEach(([name, paths, pkg, want], i) => t(name, () => {
  const dir = join(TMP, 'lad' + i)
  for (const f of paths) { if (f.endsWith('/')) mkdirSync(join(dir,f),{recursive:true})
    else { mkdirSync(join(dir,f,'..'),{recursive:true}); writeFileSync(join(dir,f),'') } }
  eq(detect(dir, pkg), want, 'profile'); return want
}))

// ── Phase 0a: repo type from the repo name ─────────────────────────────
//
// Transcribed from profile-detection.md's suffix table. Phase 0a is a name
// test rather than a marker test, which is exactly why it needed no rung in the
// ladder above — and the two cases worth guarding are the ones a looser match
// would get wrong: a bare `api` (no project prefix) and a name that merely
// contains a suffix (`acme-webhooks`).

const REPO_TYPES = ['specs', 'contracts', 'api', 'web', 'mobile', 'qa']
const repoType = name => REPO_TYPES.find(x => name.toLowerCase().endsWith(`-${x}`)) ?? 'none'

const SUFFIX = [
  ['acme-specs', 'specs'], ['acme-contracts', 'contracts'], ['acme-qa', 'qa'],
  ['acme-api', 'api'], ['acme-web', 'web'], ['acme-mobile', 'mobile'],
  ['ACME-API', 'api'],                 // lowercased before matching
  ['my-great-app-api', 'api'],         // the project slug may itself carry hyphens
  ['bigin-skills', 'none'],            // the overwhelmingly common case: silence
  ['api', 'none'],                     // bare name, no project prefix — not a match
  ['acme-webhooks', 'none'],           // contains `web`, does not end in `-web`
  ['acme-apidocs', 'none']             // contains `api`, does not end in `-api`
]
t('repo name maps to the right repo type', () => {
  for (const [name, want] of SUFFIX) eq(repoType(name), want, name)
  return `${SUFFIX.length} names`
})

t('every repo type that short-circuits the ladder has a profile file', () => {
  for (const p of ['specs', 'contracts', 'qa']) {
    const f = join(REPO, 'skills', 'bigin-harness-setup', 'references', `profile-${p}.md`)
    if (!existsSync(f)) throw new Error(`profile-${p}.md missing`)
    if (!read(f).includes('## CLAUDE.md Template')) throw new Error(`profile-${p}.md has no CLAUDE.md Template`)
  }
  return '3 profiles'
})

// The ladder must still be the same nine rungs. Phase 0a was added as a
// pre-step precisely so it could not disturb them, and this is what says so.
t('the stack ladder is still nine rungs, unrenumbered', () => {
  const det = read(join(REPO, 'skills', 'bigin-harness-setup', 'references', 'profile-detection.md'))
  // Fenced blocks are stripped first: rung 8's empty-repo question lists seven
  // numbered options, and counting those as rungs is how this check lied once.
  const ladder = det.slice(det.indexOf('# Phase 0: stack-profile detection'))
    .replace(/```[\s\S]*?```/g, '')
  const rungs = [...ladder.matchAll(/^(\d)\. /gm)].map(m => Number(m[1]))
  eq(rungs.length, 9, 'rung count')
  eq(rungs.join(','), '1,2,3,4,5,6,7,8,9', 'rung numbering')
  return '9 rungs'
})

// overlay-matrix.md claims each polyrepo profile installs 6 / 8 / 8 of the nine
// gates and names which are omitted. The settings.json block in each profile is
// the truth. Two files, one claim — so check them against each other rather
// than trusting the table, which is the half a reader believes.
t('the polyrepo gate matrix matches the settings each profile writes', () => {
  const NINE = [
    'bash-guard', 'spec-gate-guard', 'bugfix-test-guard', 'commit-msg-guard',
    'injection-scan-guard', 'injection-gate-guard', 'session-resume-check',
    'canary-seed', 'precompact-snapshot'
  ]
  const CLAIM = { specs: 6, contracts: 8, qa: 8 }
  const OMITTED = {
    specs: ['commit-msg-guard', 'bugfix-test-guard', 'spec-gate-guard'],
    contracts: ['bugfix-test-guard'],
    qa: ['spec-gate-guard']
  }
  for (const [prof, want] of Object.entries(CLAIM)) {
    const body = read(join(REPO, 'skills', 'bigin-harness-setup', 'references', `profile-${prof}.md`))
    const json = body.slice(body.indexOf('```json') + 7, body.lastIndexOf('```'))
    JSON.parse(json) // a malformed block would silently match zero guards below
    const present = NINE.filter(g => json.includes(`${g}.mjs`))
    eq(present.length, want, `${prof}: gates installed`)
    for (const g of OMITTED[prof]) {
      if (present.includes(g)) throw new Error(`${prof}: ${g} is installed but the matrix says it is omitted`)
    }
  }
  return '6/8/8'
})

console.log('\n5. SCAFFOLDER')
const SC = join(REPO, 'skills/nuxt-marketing-scaffold/scripts/scaffold.mjs')
const scaffold = (args, dir) => sh('node', [SC, '--dir', dir, '--no-install', '--no-commit', ...args], { cwd: TMP })
t('scaffolds and detects as nuxt-marketing', () => {
  const dir = join(TMP,'s1'); const r = scaffold(['--project','acme-site','--locales','en,vi,ja'], dir)
  eq(r.status, 0, 'exit'); eq(detect(dir, JSON.parse(readFileSync(join(dir,'package.json'),'utf8'))), 'nuxt-marketing', 'profile')
  return 'en,vi,ja'
})
t('content + i18n land in dependencies, not devDependencies', () => {
  const p = JSON.parse(readFileSync(join(TMP,'s1','package.json'),'utf8'))
  for (const d of ['@nuxt/content','@nuxtjs/i18n']) { if (!p.dependencies?.[d]) throw new Error(`${d} not a dependency`)
    if (p.devDependencies?.[d]) throw new Error(`${d} also in devDependencies`) } return 'both'
})
t('no auth dependency of any kind', () => {
  const p = JSON.parse(readFileSync(join(TMP,'s1','package.json'),'utf8'))
  const all = { ...p.dependencies, ...p.devDependencies }
  for (const a of ['nuxt-auth-utils','@sidebase/nuxt-auth','next-auth']) if (all[a]) throw new Error(`${a} present`)
  return 'clean'
})
t('emits one content dir + one message bundle per locale', () => {
  for (const l of ['en','vi','ja']) {
    if (!existsSync(join(TMP,'s1','content',l,'index.md'))) throw new Error(`content/${l} missing`)
    if (!existsSync(join(TMP,'s1','i18n','locales',`${l}.json`))) throw new Error(`i18n/${l}.json missing`)
  } return '3 locales'
})
t('no fallbackLocale anywhere (the profile forbids it)', () => {
  const cfg = readFileSync(join(TMP,'s1','nuxt.config.ts'),'utf8')
  if (/fallbackLocale/.test(cfg.replace(/\/\/.*$/gm,''))) throw new Error('fallbackLocale present in config')
  return 'absent'
})
t('server/api holds exactly contact + newsletter', () => {
  const got = readdirSync(join(TMP,'s1','server','api')).sort().join(',')
  eq(got, 'contact.post.ts,newsletter.post.ts', 'routes'); return got
})

// ── The four checks below are the always-on half of "does the scaffold build".
//    They are structural, cost milliseconds, and between them they would have
//    caught three of the four defects fixed in v1.88.2. What they cannot see is
//    anything needing a resolver, a compiler or a prerender — that is group 9,
//    which runs only under --build.
t('every requested locale reaches the config and the prerender routes', () => {
  const cfg = read(join(TMP,'s1','nuxt.config.ts'))
  for (const l of ['en','vi','ja'])
    if (!cfg.includes(`{ code: '${l}', file: '${l}.json' }`)) throw new Error(`i18n.locales omits ${l}`)
  const routes = /prerender:\s*\{[^}]*routes:\s*\[([^\]]*)\]/.exec(cfg)?.[1]
  if (!routes) throw new Error('no nitro.prerender.routes to check')
  for (const r of ["'/'", "'/vi'", "'/ja'"]) if (!routes.includes(r)) throw new Error(`prerender routes omit ${r}`)
  return 'en,vi,ja in both'
})
t('the theme flags reach app.config.ts', () => {
  const dir = join(TMP,'s6')
  eq(scaffold(['--project','themed','--locales','en','--primary','emerald','--neutral','zinc'], dir).status, 0, 'exit')
  const cfg = read(join(dir,'app','app.config.ts'))
  if (!/primary: 'emerald'/.test(cfg)) throw new Error('--primary did not reach app.config.ts')
  if (!/neutral: 'zinc'/.test(cfg)) throw new Error('--neutral did not reach app.config.ts')
  return 'emerald/zinc'
})
t('every bare import resolves to a declared dependency', () => {
  const pkg = JSON.parse(read(join(TMP,'s1','package.json')))
  const declared = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])
  const bad = []
  for (const f of sources(join(TMP,'s1'))) {
    for (const [, typeOnly, spec] of read(f).matchAll(/^\s*import\s+(type\s+)?(?:[^'"\n]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) {
      if (/^[.~#/]/.test(spec) || spec.startsWith('@/') || spec.startsWith('node:')) continue
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
      if (declared.has(name)) continue
      // `vue` and `h3` are reachable only through the path aliases Nuxt writes
      // into .nuxt/tsconfig.*.json. Enough for a type-only import, which is
      // erased before anything resolves it; not enough for a value one, since
      // pnpm's strict layout gives an undeclared package no node_modules entry.
      if (NUXT_ALIASED.has(name) && typeOnly) continue
      bad.push(`${spec}${typeOnly ? '' : ' (value import)'}`)
    }
  }
  eq([...new Set(bad)].join(', ')||'none','none','undeclared imports'); return `${declared.size} declared`
})
t('every helper a page or route calls is defined in the tree', () => {
  const root = join(TMP,'s1')
  const files = sources(root)
  const defined = new Set()
  for (const f of files) {
    if (!/\/(?:app\/utils|app\/composables|server\/utils)\//.test(f)) continue
    for (const [, n] of read(f).matchAll(/export\s+(?:async\s+)?(?:function|const|let)\s+([A-Za-z_$][\w$]*)/g)) defined.add(n)
  }
  const bad = []
  for (const f of files) {
    const src = read(f)
    const local = new Set([...NUXT_AUTO_IMPORTS, ...KEYWORDS])
    for (const [, n] of src.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) local.add(n)
    for (const [, names] of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g))
      for (const n of names.split(',')) local.add(n.split(':').pop().trim())
    for (const [, names] of src.matchAll(/^\s*import\s+(?:type\s+)?([^'"\n]*?)\s+from\s+['"]/gm))
      for (const n of names.replace(/[{}*]/g, ' ').split(',')) local.add(n.split(/\s+as\s+/).pop().trim())
    for (const [, n] of code(f).matchAll(/(?:^|[^.\w$])([a-z][\w$]*)\s*\(/g))
      if (!local.has(n) && !defined.has(n)) bad.push(`${f.slice(root.length + 1)} -> ${n}()`)
  }
  eq([...new Set(bad)].join(', ')||'none','none','calls with no definition'); return `${defined.size} helpers defined`
})
// ── The seam between the CI the harness writes and the scripts the scaffolder
//    declares. Nothing ever ran a generated workflow, so `pnpm test --run` sat
//    in both nuxt-marketing CI templates against a manifest that declared no
//    `test` script, and every site this scaffolder made failed on its first
//    push. The command list is PARSED OUT of the templates that write it: a
//    list transcribed here could drift from `ci.md` exactly as `ci.md` drifted
//    from `package.json.tmpl`, and an assertion copied from the thing it
//    audits asserts nothing.
t('every command the nuxt-marketing CI invokes is a script the scaffold declares', () => {
  const scripts = new Set(Object.keys(JSON.parse(read(join(TMP, 's1', 'package.json'))).scripts ?? {}))
  const wanted = new Map()
  for (const [where, block] of COMMAND_BLOCKS)
    for (const argv of pnpmCalls(block)) if (!wanted.has(argv[0])) wanted.set(argv[0], where)
  // A parse that silently found nothing would pass — the exact failure mode
  // this check exists to close, so it is a failure of its own.
  if (wanted.size < 4) throw new Error(`parsed only ${wanted.size} pnpm commands out of the templates`)
  const missing = [...wanted].filter(([n]) => !scripts.has(n)).map(([n, w]) => `${n} (${w})`)
  eq(missing.join(', ') || 'none', 'none', 'commands with no matching script')
  return `${wanted.size} commands, ${scripts.size} scripts`
})
t('single locale works', () => {
  const dir = join(TMP,'s2'); eq(scaffold(['--project','solo','--locales','en'], dir).status, 0, 'exit')
  eq(detect(dir, JSON.parse(readFileSync(join(dir,'package.json'),'utf8'))), 'nuxt-marketing', 'profile'); return 'en'
})
t('rejects bad project name with exit 2', () => {
  eq(scaffold(['--project','Not Kebab'], join(TMP,'s3')).status, 2, 'exit'); return 'exit 2'
})
t('rejects bad locale with exit 2', () => {
  eq(scaffold(['--project','ok','--locales','english'], join(TMP,'s4')).status, 2, 'exit'); return 'exit 2'
})
t('rejects unknown colour with exit 2', () => {
  eq(scaffold(['--project','ok','--primary','beige'], join(TMP,'s5')).status, 2, 'exit'); return 'exit 2'
})
t('refuses a non-empty dir without --force', () => {
  const dir = join(TMP,'s1'); eq(scaffold(['--project','again'], dir).status, 1, 'exit'); return 'exit 1'
})
t('--force overwrites a non-empty dir', () => {
  const dir = join(TMP,'s1'); eq(scaffold(['--project','again','--force'], dir).status, 0, 'exit'); return 'ok'
})
// This check shipped in v1.88.1 and passed while `__LOCALES_I18N__` sat
// unsubstituted in every generated nuxt.config.ts, because it was written with
// the same `[A-Z_]` class as the bug it was meant to catch: neither can match
// the digits in `I18N`. An assertion copied from the code it audits asserts
// nothing. The class here is wider than the scaffolder's own on purpose, and
// the scan covers every scaffold rather than the single-locale one.
t('no leftover __TOKEN__ placeholders', () => {
  const bad = []
  const walk = d => { for (const e of readdirSync(d,{withFileTypes:true})) {
    const f = join(d,e.name); if (e.isDirectory()) walk(f)
    else if (/__[A-Z0-9_]+__/.test(read(f))) bad.push(f) } }
  for (const s of ['s1','s2','s6']) walk(join(TMP,s))
  eq(bad.join(',')||'none','none','files with placeholders'); return 'clean'
})

console.log('\n6. WIRING')
const rd = f => readFileSync(join(REPO,f),'utf8')
t('Phase 0.5 table has a nuxt-marketing row', () => {
  if (!/\|\s*`nuxt-marketing`\s*\|.*`nuxt-marketing-scaffold`/.test(rd('skills/bigin-harness-setup/references/scaffold-delegation.md')))
    throw new Error('no delegation row'); return 'present' })
t('empty-repo question offers option 7', () => {
  const s = rd('skills/bigin-harness-setup/references/profile-detection.md')
  if (!/7\. nuxt-marketing/.test(s)) throw new Error('option 7 missing')
  if (!/Type 1, 2, 3, 4, 5, 6, or 7\./.test(s)) throw new Error('prompt still says 1-6'); return 'ok' })
t('the auth-marker rationale is recorded', () => {
  if (!/nuxt-auth-utils/.test(rd('skills/bigin-harness-setup/references/scaffold-delegation.md')))
    throw new Error('rationale absent — someone will merge the scaffolders'); return 'present' })
// The v1.88.0 changelog said there was no marketing-site scaffolder, which was
// true for four days. Two USER_GUIDE surfaces still said it at v1.88.1, one of
// them directly contradicting the option-7 check three lines above.
t('nothing still claims there is no marketing-site scaffolder', () => {
  const hits = []
  for (const f of ['docs/USER_GUIDE.md', 'skills/bigin-harness-setup/SKILL.md',
                   'skills/bigin-harness-setup/references/profile-detection.md',
                   'skills/bigin-harness-setup/references/profile-nuxt-marketing.md'])
    if (/no marketing-site scaffolder|detection-only/i.test(rd(f))) hits.push(f)
  eq(hits.join(',')||'none','none','files with stale wording'); return 'clean' })
t('no stale separate-Worker wording survives', () => {
  const hits = []
  for (const f of ['skills/bigin-harness-setup/references/profile-nuxt-marketing.md',
                   'skills/bigin-harness-setup/references/profile-detection.md',
                   'skills/bigin-harness-setup/SKILL.md','docs/USER_GUIDE.md','CHANGELOG.md'])
    if (/worker of their own|which stays absent/i.test(rd(f))) hits.push(f)
  eq(hits.join(',')||'none','none','files with stale wording'); return 'clean' })

// ── 7. contract_sync.mjs ────────────────────────────────────────────────
//
// The three refusals this script exists for — a moved tag, a bad checksum, a
// missing codegen entry point — are the ones nothing else can catch: each is a
// path that only runs when something has already gone wrong upstream, and each
// was verified once by hand against a live repo and would otherwise never be
// exercised again. They run here against a loopback fixture server, so the group
// needs no network and no credentials.
//
// What every case asserts alongside the exit code is that NOTHING WAS WRITTEN.
// A refusal that still leaves a half-vendored spec next to a stale client is the
// exact drift the skill exists to prevent, and it is invisible in an exit code.

console.log('\n7. CONTRACT SYNC')

const CS = join(REPO, 'skills', 'contract-sync', 'scripts', 'contract_sync.mjs')
const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)
const SPEC_V1 = 'openapi: 3.0.3\ninfo: { title: core, version: "1" }\n'
const SPEC_V2 = 'openapi: 3.0.3\ninfo: { title: core, version: "2" }\n'
const digest = txt => createHash('sha256').update(Buffer.from(txt)).digest('hex')

const FIXTURE_SERVER = `
import { createServer } from 'node:http'
import { writeFileSync, readFileSync } from 'node:fs'
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const send = (res, code, body, type) => {
  res.writeHead(code, { 'content-type': type }); res.end(body)
}
createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  let m
  if ((m = u.pathname.match(/^\\/repos\\/[^/]+\\/[^/]+\\/commits\\/(.+)$/))) {
    const sha = cfg.refs[decodeURIComponent(m[1])]
    return sha ? send(res, 200, JSON.stringify({ sha }), 'application/json')
               : send(res, 404, '{}', 'application/json')
  }
  if ((m = u.pathname.match(/^\\/repos\\/[^/]+\\/[^/]+\\/contents\\/(.+)$/))) {
    const key = u.searchParams.get('ref') + ':' + decodeURIComponent(m[1])
    const blob = cfg.blobs[key]
    return blob === undefined ? send(res, 404, '{}', 'application/json')
                              : send(res, 200, blob, 'text/plain')
  }
  if (u.pathname.endsWith('/tags')) return send(res, 200, JSON.stringify(cfg.tags ?? []), 'application/json')
  if (u.pathname.endsWith('/pulls')) return send(res, 200, '[]', 'application/json')
  send(res, 404, '{}', 'application/json')
}).listen(0, '127.0.0.1', function () {
  writeFileSync(process.argv[3], String(this.address().port))
})
`

// One consumer repo. `mobile` on purpose: its codegen entry point is a shell
// script this suite writes itself, so no case depends on make or pnpm existing.
function consumer(name, lock, { generator = true } = {}) {
  const dir = join(TMP, `cs-${name}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(join(dir, 'tool'), { recursive: true })
  writeFileSync(join(dir, 'pubspec.yaml'), 'name: fixture\n')
  if (generator) writeFileSync(join(dir, 'tool', 'generate_api.sh'), 'echo codegen-ran\n')
  writeFileSync(join(dir, 'api-contract.lock'), JSON.stringify({ contracts: lock }, null, 2))
  return dir
}

const vendored = dir => join(dir, 'api', 'openapi.yaml')
const cs = (dir, args, base) => spawnSync('node', [CS, ...args], {
  cwd: dir, encoding: 'utf8',
  env: { ...process.env, CONTRACT_SYNC_API: base, GITHUB_TOKEN: 'fixture-token', GH_TOKEN: '' }
})

let csServer = null
let csBase = null
try {
  const cfgPath = join(TMP, 'cs-fixture.json')
  const portPath = join(TMP, 'cs-port')
  const srvPath = join(TMP, 'cs-server.mjs')
  writeFileSync(srvPath, FIXTURE_SERVER)
  writeFileSync(cfgPath, JSON.stringify({
    refs: { 'v1.0.0': SHA_A, 'v2.0.0': SHA_B },
    blobs: {
      [`${SHA_A}:openapi/core.v1.yaml`]: SPEC_V1,
      [`${SHA_A}:openapi/core.v2.yaml`]: SPEC_V2,
      [`${SHA_B}:openapi/core.v1.yaml`]: SPEC_V1
    },
    tags: [{ name: 'v1.0.0' }, { name: 'v2.0.0' }]
  }))
  rmSync(portPath, { force: true })
  csServer = spawn('node', [srvPath, cfgPath, portPath], { stdio: 'ignore' })
  // spawnSync blocks this process's loop, so the server has to be its own
  // process; poll for the port file rather than awaiting anything.
  for (let i = 0; i < 100 && !existsSync(portPath); i++) {
    spawnSync(process.execPath, ['-e', 'setTimeout(()=>{},50)'])
  }
  if (existsSync(portPath)) csBase = `http://127.0.0.1:${read(portPath).trim()}`
} catch {
  csBase = null
}

if (!csBase) {
  skip('contract_sync fixture server', 'could not start the loopback fixture server')
} else {
  const good = { core: { repo: 'o/contracts', file: 'openapi/core.v1.yaml', ref: 'v1.0.0', commit: SHA_A, sha256: digest(SPEC_V1) } }

  t('sync vendors the pinned blob and runs codegen', () => {
    const dir = consumer('happy', good)
    const r = cs(dir, ['sync'], csBase)
    eq(r.status, 0, 'exit')
    eq(read(vendored(dir)), SPEC_V1, 'vendored bytes')
    if (!r.stdout.includes('codegen-ran')) throw new Error('codegen did not run')
    return 'spec + codegen'
  })

  t('a moved tag fails naming both SHAs, writing nothing', () => {
    const dir = consumer('moved', { core: { ...good.core, commit: SHA_B } })
    const r = cs(dir, ['sync'], csBase)
    eq(r.status, 1, 'exit')
    for (const want of ['MOVED', SHA_B, SHA_A]) {
      if (!r.stderr.includes(want)) throw new Error(`stderr did not name ${want}`)
    }
    eq(existsSync(vendored(dir)), false, 'spec written')
    return 'refused'
  })

  t('a checksum mismatch aborts before any write', () => {
    const dir = consumer('tampered', { core: { ...good.core, sha256: '0'.repeat(64) } })
    const r = cs(dir, ['sync'], csBase)
    eq(r.status, 1, 'exit')
    if (!r.stderr.includes('checksum mismatch')) throw new Error('stderr did not name the mismatch')
    eq(existsSync(vendored(dir)), false, 'spec written')
    return 'refused'
  })

  t('two repos pin different files at one commit', () => {
    const a = consumer('pin-v1', good)
    const b = consumer('pin-v2', { core: { ...good.core, file: 'openapi/core.v2.yaml', sha256: digest(SPEC_V2) } })
    eq(cs(a, ['sync'], csBase).status, 0, 'v1 exit')
    eq(cs(b, ['sync'], csBase).status, 0, 'v2 exit')
    eq(read(vendored(a)), SPEC_V1, 'v1 bytes')
    eq(read(vendored(b)), SPEC_V2, 'v2 bytes')
    return 'both'
  })

  t('a missing codegen entry point aborts with the repo untouched', () => {
    const dir = consumer('nogen', good, { generator: false })
    const before = read(join(dir, 'api-contract.lock'))
    const r = cs(dir, ['bump', 'v2.0.0'], csBase)
    eq(r.status, 1, 'exit')
    eq(existsSync(vendored(dir)), false, 'spec written')
    eq(read(join(dir, 'api-contract.lock')), before, 'lock touched')
    return 'spec and lock intact'
  })

  t('bump records the new commit, spec and checksum together', () => {
    const dir = consumer('bump', good)
    const r = cs(dir, ['bump', 'v2.0.0'], csBase)
    eq(r.status, 0, 'exit')
    const lock = JSON.parse(read(join(dir, 'api-contract.lock'))).contracts.core
    eq(lock.ref, 'v2.0.0', 'ref')
    eq(lock.commit, SHA_B, 'commit')
    eq(lock.sha256, digest(SPEC_V1), 'sha256')
    eq(read(vendored(dir)), SPEC_V1, 'vendored bytes')
    return 'lock + spec in step'
  })

  t('check degrades to one skip line, exit 0, when the API is unreachable', () => {
    const dir = consumer('offline', good)
    // Port 1 on loopback: refuses instantly, so this asserts the degrade path
    // rather than the timeout. Both land in the same branch.
    const r = cs(dir, ['check', '--no-cache'], 'http://127.0.0.1:1')
    eq(r.status, 0, 'exit')
    eq(r.stdout.trim().split('\n').length, 1, 'lines printed')
    if (!r.stdout.includes('skipped')) throw new Error(`no skip line: ${r.stdout.trim()}`)
    eq(existsSync(vendored(dir)), false, 'spec written')
    return 'quiet'
  })

  t('CONTRACT_SYNC_API is refused when it is not loopback', () => {
    const dir = consumer('seam', good)
    const r = cs(dir, ['check'], 'https://api.evil.example')
    eq(r.status, 2, 'exit')
    if (!r.stderr.includes('loopback')) throw new Error('did not name the restriction')
    return 'seam is loopback-only'
  })
}

if (csServer) csServer.kill()

// ── 8. guards ───────────────────────────────────────────────────────────
//
// The guard bodies live as ```javascript blocks inside hook-guard.md, which is
// why nothing here has ever executed one: they are text until a harness install
// writes them out. This group writes them out and runs them.
//
// spec-gate-guard is first because it is the one that failed OPEN. A hook's
// process.cwd() is the SESSION root, not the worktree the edited file lives in,
// so resolving PLAN.md against cwd read another tree's state: with a plan in the
// main worktree only, an edit in a worktree that had none was allowed — the gate
// waving through precisely what it exists to stop. Found downstream in
// nuxt-ssg-site-factory and ported here in 1.90.1. task-workflow's own
// parallelization reference recommends the worktree-per-instance pattern that
// triggers it, so this is not an exotic configuration.

console.log('\n8. GUARDS')

// Pull a guard's source out of the reference file that ships it.
function guardSource(name) {
  const md = read(join(REPO, 'skills', 'bigin-harness-setup', 'references', 'hook-guard.md'))
  const i = md.indexOf(`## ${name}`)
  if (i === -1) throw new Error(`hook-guard.md has no "## ${name}" section`)
  const start = md.indexOf('```javascript', i)
  const end = md.indexOf('```', start + 13)
  if (start === -1 || end === -1) throw new Error(`no javascript block under "## ${name}"`)
  return md.slice(start + 14, end)
}

const GUARD_DIR = join(TMP, 'guards')
let guardsReady = false
try {
  mkdirSync(join(GUARD_DIR, 'lib'), { recursive: true })
  writeFileSync(join(GUARD_DIR, 'lib', 'hook-io.mjs'), guardSource('lib/hook-io.mjs'))
  writeFileSync(join(GUARD_DIR, 'spec-gate-guard.mjs'), guardSource('spec-gate-guard.mjs'))
  guardsReady = true
} catch (e) {
  skip('extract the guards from hook-guard.md', e.message)
}

if (guardsReady) {
  const SPEC_GATE = join(GUARD_DIR, 'spec-gate-guard.mjs')
  const BIG = 'line\n'.repeat(40)

  // git exports GIT_DIR and GIT_WORK_TREE while running a hook, and they override
  // `git -C`. Without scrubbing them these cases pass standalone and fail under the
  // commit hook — which is how the downstream fix nearly shipped untested.
  const CLEAN_ENV = { ...process.env }
  delete CLEAN_ENV.GIT_DIR
  delete CLEAN_ENV.GIT_WORK_TREE
  delete CLEAN_ENV.GIT_INDEX_FILE

  // CLEAN_ENV here too, not just on the guard run: under the commit hook git exports
  // GIT_DIR at this repo, so an un-scrubbed `git init` silently builds no fixture at
  // all and every case below fails for the wrong reason. This suite caught exactly
  // that on its first run under the hook, having passed standalone.
  const gitq = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'ignore', env: CLEAN_ENV })

  // A main worktree carrying an approved plan, plus a linked worktree carrying none.
  const MAIN = join(TMP, 'wt-main')
  const LINKED = join(TMP, 'wt-linked')
  rmSync(MAIN, { recursive: true, force: true })
  rmSync(LINKED, { recursive: true, force: true })
  mkdirSync(MAIN, { recursive: true })
  gitq(MAIN, 'init', '-q', '-b', 'main', '.')
  gitq(MAIN, 'config', 'user.email', 'regress@example.com')
  gitq(MAIN, 'config', 'user.name', 'regress')
  writeFileSync(join(MAIN, 'seed.txt'), 'x\n')
  gitq(MAIN, 'add', '-A')
  gitq(MAIN, 'commit', '-qm', 'feat: seed')
  writeFileSync(join(MAIN, 'PLAN.md'), 'Status: approved\nBranch: main\n')
  gitq(MAIN, 'add', '-A')
  gitq(MAIN, 'commit', '-qm', 'chore: plan')
  gitq(MAIN, 'worktree', 'add', '-q', '-b', 'feat/side', LINKED)

  // Runs the guard the way a host does: payload on stdin, cwd = the SESSION root,
  // which is deliberately not the worktree the edited file lives in.
  const gate = (filePath, { cwd = MAIN, payload = null } = {}) => spawnSync(
    'node', [SPEC_GATE],
    {
      cwd,
      encoding: 'utf8',
      env: CLEAN_ENV,
      input: payload ?? JSON.stringify({
        tool_name: 'Edit',
        tool_input: { file_path: filePath, content: BIG }
      })
    }
  ).status

  t('an edit in a worktree with no plan is blocked, even with one in the main tree', () => {
    rmSync(join(LINKED, 'PLAN.md'), { force: true })
    eq(gate(join(LINKED, 'src.ts')), 2, 'exit')
    return 'blocked'
  })

  t('an edit beside its own approved plan is allowed', () => {
    writeFileSync(join(LINKED, 'PLAN.md'), 'Status: approved\nBranch: feat/side\n')
    eq(gate(join(LINKED, 'src.ts')), 0, 'exit')
    return 'allowed'
  })

  t('the branch check judges the file\'s own worktree, not the session\'s', () => {
    writeFileSync(join(LINKED, 'PLAN.md'), 'Status: approved\nBranch: some-other\n')
    eq(gate(join(LINKED, 'src.ts')), 2, 'exit')
    return 'blocked'
  })

  t('single-worktree behaviour is unchanged', () => {
    eq(gate(join(MAIN, 'src.ts')), 0, 'main tree, approved plan')
    const bare = join(TMP, 'wt-norepo')
    mkdirSync(bare, { recursive: true })
    eq(gate(join(bare, 'src.ts'), { cwd: bare }), 2, 'outside a repo, no plan')
    return 'both'
  })

  t('a Cursor-shaped payload is gated identically', () => {
    rmSync(join(LINKED, 'PLAN.md'), { force: true })
    const cursor = JSON.stringify({
      cursor_version: '1.0.0',
      conversation_id: 'c1',
      workspace_roots: [MAIN],
      tool_name: 'Edit',
      tool_input: { file_path: join(LINKED, 'src.ts'), content: BIG }
    })
    eq(gate(null, { payload: cursor }), 2, 'exit')
    return 'blocked'
  })

  t('a PreToolUse gate fails closed on unreadable stdin', () => {
    eq(gate(null, { payload: '{ not json' }), 2, 'malformed')
    eq(gate(null, { payload: '' }), 2, 'empty')
    return 'exit 2 both ways'
  })
}

console.log('\n9. SCAFFOLDED SITE BUILDS')
// The expensive half. Groups 1-8 prove things about text and behaviour; this one
// is the only
// case that proves the scaffolder emits a repo Nuxt can actually compile and
// prerender, because that needs a real resolver, a real compiler and a real
// Nitro build. It costs a network install plus roughly two minutes, so it is
// opt-in — and it announces itself as SKIPped rather than vanishing, because a
// slow check nobody notices is missing is how the last four defects shipped.
const BUILD_CASE = 'a three-locale scaffold installs and passes every pnpm step the CI template runs'
if (!WANT_BUILD) {
  skip(BUILD_CASE, 'pass --build to run it; needs the network and ~3 min')
} else if (spawnSync('pnpm', ['--version'], { encoding: 'utf8' }).status !== 0) {
  skip(BUILD_CASE, 'pnpm not on PATH')
} else if (spawnSync('node', ['-e', PING], { encoding: 'utf8' }).status !== 0) {
  skip(BUILD_CASE, 'npm registry unreachable — offline')
} else {
  t(BUILD_CASE, () => {
    const dir = join(TMP, 'build')
    const r = sh('node', [SC, '--dir', dir, '--project', 'regress-site', '--locales', 'en,vi,ja', '--no-commit'],
                 { cwd: TMP, timeout: 15 * 60_000, stdio: 'inherit' })
    eq(r.status, 0, 'scaffold + install exit')
    // Exactly the pnpm steps the generated GitHub workflow runs, parsed from
    // it — `pnpm lint`, `pnpm type-check`, `pnpm test --run`, `pnpm build`.
    for (const argv of CI_STEPS) {
      const x = spawnSync('pnpm', argv, { cwd: dir, encoding: 'utf8', timeout: 15 * 60_000, stdio: 'inherit' })
      eq(x.status, 0, `pnpm ${argv.join(' ')} exit`)
    }
    // The assertion that matters: one prerendered entry point per locale, each
    // rendered from its own content file. A build that emits only the default
    // locale is the failure this whole group exists to catch, and it is silent
    // everywhere else — a missing locale 404s in production and nowhere else.
    for (const [loc, sub] of [['en', ''], ['vi', 'vi/'], ['ja', 'ja/']]) {
      const html = join(dir, '.output', 'public', sub + 'index.html')
      if (!existsSync(html)) throw new Error(`${loc} was not prerendered (${sub}index.html missing)`)
      if (!read(html).includes(`content/${loc}/index.md`)) throw new Error(`${sub}index.html did not render content/${loc}/`)
    }
    return '3 locales prerendered'
  })
}

rmSync(TMP, { recursive: true, force: true })
console.log(`\n${'='.repeat(52)}\n${fail ? 'FAIL' : 'OK'}  ${pass} passed, ${fail} failed, ${skipped} skipped`)
process.exit(fail ? 1 : 0)
