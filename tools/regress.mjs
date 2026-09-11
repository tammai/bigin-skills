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

// go-scaffold's verification build must not depend on ambient VCS state. It runs
// BEFORE the scaffold's own `git init`, so Go's default stamping walks up to
// whatever ancestor repo exists — and a malformed one (a dotfiles .git in $HOME is
// the common case) makes git exit 128 and kills the scaffold at "go build" with a
// message about VCS rather than about the code. Found by the pilot project, whose
// six repos sat under exactly such a $HOME.
t('go-scaffold builds with VCS stamping off', () => {
  const src = read(join(REPO, 'skills', 'go-scaffold', 'scripts', 'scaffold.mjs'))
  const m = src.match(/run\('go', \[([^\]]*)\], targetDir\)/g)?.find(x => x.includes("'build'"))
  if (!m) throw new Error('could not find the go build invocation')
  if (!m.includes('-buildvcs=false')) throw new Error(`go build carries no -buildvcs=false: ${m}`)
  return 'stamping off'
})

console.log('\n6. WIRING')
const rd = f => readFileSync(join(REPO,f),'utf8')
t('Phase 0.5 table has a nuxt-marketing row', () => {
  if (!/\|\s*`nuxt-marketing`\s*\|.*`nuxt-marketing-scaffold`/.test(rd('skills/bigin-harness-setup/references/scaffold-delegation.md')))
    throw new Error('no delegation row'); return 'present' })
t('empty-repo question reaches all seven profiles', () => {
  const s = rd('skills/bigin-harness-setup/references/profile-detection.md')
  const block = s.split('```').find(x => /^1\. nuxt\s/m.test(x)) ?? ''
  // v1.98.2: AskUserQuestion takes at most four options, so the seven profiles are
  // three named plus a fourth naming the rest — the shape nuxt-scaffold already uses.
  const opts = block.match(/^\d+\. /gm) ?? []
  if (opts.length !== 4) throw new Error(`the question offers ${opts.length} options; the tool caps them at 4`)
  for (const slug of ['nuxt', 'go', 'flutter', 'nodejs', 'next', 'tauri', 'nuxt-marketing'])
    if (!new RegExp(`\\b${slug.replace('-', '\\-')}\\b`).test(block)) throw new Error(`profile ${slug} is no longer reachable from the question`)
  if (/^\d+\. Other\b/m.test(block)) throw new Error("an option is labelled 'Other' — that slot belongs to the tool")
  return '4 options, 7 profiles' })
t('no ask site promises more options than the tool allows', () => {
  const files = ['skills/bigin-harness-setup/SKILL.md', 'skills/bigin-harness-setup/references/profile-detection.md',
    'skills/bigin-harness-setup/references/decision-bundle.md']
  for (const f of files) {
    const m = rd(f).match(/`AskUserQuestion`[^.\n]{0,60}?\b(five|six|seven|eight|nine)\s+options/i)
    if (m) throw new Error(`${f} promises ${m[1]} options in one question: "${m[0]}"`)
  }
  return `${files.length} files clean` })
t('install mode is asked before the bundle, not inside it', () => {
  const skill = rd('skills/bigin-harness-setup/SKILL.md')
  const bundle = rd('skills/bigin-harness-setup/references/decision-bundle.md')
  if (!/\*\*Ask this one first and alone, before Phase 1\.5's bundle\*\*/.test(skill))
    throw new Error('Phase 1 no longer asks install mode first')
  if (/^\d+\. \*\*Install mode\*\*/m.test(bundle)) throw new Error('install mode is back in the bundle')
  if (!/five install modes|Five answers, four option slots/.test(skill)) throw new Error('the 5-answers-into-4-slots mapping is gone')
  return 'first and alone' })
// v1.98.1: two same-day runs of v1.96.3 split on this very question — one asked
// it with AskUserQuestion, the other printed it as a code block and waited for a
// typed number. The wording is not the contract; the tool is.
t('every ask site in bigin-harness-setup names AskUserQuestion', () => {
  const skill = rd('skills/bigin-harness-setup/SKILL.md')
  if (!/## How this skill asks/.test(skill)) throw new Error('the rule section is gone')
  const sites = [
    ['SKILL.md', skill, [/Confirm it; never trust it\.\*\* Ask one `AskUserQuestion`/, /empty repo[^|]*\|\s*\*\*ask\*\* — one `AskUserQuestion`/, /show what was found and ask — `AskUserQuestion`/, /ask whether to replace it \(`AskUserQuestion`\)/, /ask before replacing \(`AskUserQuestion`\)/]],
    ['profile-detection.md', rd('skills/bigin-harness-setup/references/profile-detection.md'), [/Asked with `AskUserQuestion`/, /ask which is true — `AskUserQuestion`/, /One `AskUserQuestion` — but seven profiles do not fit in it/]],
    ['scaffold-delegation.md', rd('skills/bigin-harness-setup/references/scaffold-delegation.md'), [/Gather every decision now\*\*, with `AskUserQuestion`/]],
    ['decision-bundle.md', rd('skills/bigin-harness-setup/references/decision-bundle.md'), [/one bundled `AskUserQuestion` call/]],
  ]
  for (const [file, body, pats] of sites)
    for (const p of pats)
      if (!p.test(body)) throw new Error(`${file}: an ask site stopped naming the tool (${p})`)
  if (/Type 1, 2, 3/.test(sites[1][1])) throw new Error('profile-detection.md went back to a typed-number prompt')
  return `${sites.reduce((n, x) => n + x[2].length, 0)} sites` })
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

// Every gate must be registered on BOTH hosts. A gate present in
// .claude/settings.json and absent from .cursor/hooks.json is a Cursor teammate
// quietly editing files a Claude Code teammate cannot — a silent, per-person
// difference in what the repo enforces, which is the failure mode the
// one-body-two-hosts rule exists to prevent.
// A SKILL.md citing a reference that does not exist is a dead end at run time, and
// nothing else here reads those paths. Two forms are checked: `references/x.md`, which
// the authoring rules define as relative to that skill's own directory, and an explicit
// ${CLAUDE_PLUGIN_ROOT}/... path into this repo.
t('every reference a SKILL.md cites exists', () => {
  let checked = 0
  const missing = []
  for (const dir of readdirSync(join(REPO, 'skills'))) {
    const skill = join(REPO, 'skills', dir, 'SKILL.md')
    if (!existsSync(skill)) continue
    const body = read(skill)
    const cited = new Set()
    for (const m of body.matchAll(/`references\/([A-Za-z0-9._-]+\.md)`/g)) {
      cited.add(join(REPO, 'skills', dir, 'references', m[1]))
    }
    for (const m of body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9._/-]+\.(?:md|mjs))/g)) {
      cited.add(join(REPO, m[1]))
    }
    for (const path of cited) {
      checked++
      if (!existsSync(path)) missing.push(`${dir}: ${path.slice(REPO.length + 1)}`)
    }
  }
  if (missing.length) throw new Error(missing.join('; '))
  return `${checked} citations`
})

// The design doc is the one epic-workflow artifact with no gate script behind it, so the
// three rules that make it work rather than rot are asserted here instead.
t('the epic design doc carries its skip rule, its diagram rule and the MADR shape', () => {
  const ref = read(join(REPO, 'skills', 'epic-workflow', 'references', 'design-doc.md'))
  const skill = read(join(REPO, 'skills', 'epic-workflow', 'SKILL.md'))
  if (!/skipped it and why/.test(ref) || !/skipped it and why/.test(skill)) {
    throw new Error('the say-the-skip-out-loud rule is missing from the reference or the skill')
  }
  if (!/```mermaid/.test(ref)) throw new Error('the template shows no mermaid block')
  if (!/mermaid/.test(skill)) throw new Error('the skill never tells the author to draw one')
  for (const heading of ['Context and Problem Statement', 'Decision Drivers', 'Considered Options', 'Decision Outcome']) {
    if (!ref.includes(heading)) throw new Error(`the MADR shape is missing "${heading}"`)
  }
  if (!/adr\.github\.io\/madr/.test(ref)) throw new Error('MADR is copied but not credited')
  if (!/docs\/design\//.test(skill)) throw new Error('the skill never names where the doc lands')
  return 'skip rule, diagram, MADR'
})

t('every gate a profile registers is registered on Cursor too', () => {
  const REF = join(REPO, 'skills', 'bigin-harness-setup', 'references')
  // Documented Claude-Code-only, and not gates: a Setup bootstrap, a formatter,
  // and an opt-in debug log. cursor-parity.md states each and why.
  const CLAUDE_ONLY = new Set(['install-hooks.mjs', 'lint-fix-file.mjs', 'instructions-trace.mjs'])

  const claudeSide = new Set()
  for (const f of readdirSync(REF).filter(f => f.startsWith('profile-') && f.endsWith('.md'))) {
    for (const m of read(join(REF, f)).matchAll(/\.claude\/guards\/([a-z-]+\.mjs)/g)) claudeSide.add(m[1])
  }
  // The conditional gate is registered from SKILL.md, not from a profile block.
  for (const m of read(join(REPO, 'skills', 'bigin-harness-setup', 'SKILL.md')).matchAll(/\.claude\/guards\/([a-z-]+\.mjs)/g)) {
    claudeSide.add(m[1])
  }

  const cursor = read(join(REF, 'cursor-parity.md'))
  const cursorSide = new Set([...cursor.matchAll(/\.claude\/guards\/([a-z-]+\.mjs)/g)].map(m => m[1]))

  const missing = [...claudeSide].filter(g => !CLAUDE_ONLY.has(g) && !cursorSide.has(g))
  if (missing.length > 0) throw new Error(`registered on Claude Code but not Cursor: ${missing.join(', ')}`)
  return `${claudeSide.size - CLAUDE_ONLY.size} gates on both hosts`
})

console.log('\n7. SYNC SCRIPTS')

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
    const dir = (cfg.dirs ?? {})[key]
    if (dir) {
      return send(res, 200, JSON.stringify(dir.map(name => ({ type: 'file', name }))), 'application/json')
    }
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
      [`${SHA_B}:openapi/core.v1.yaml`]: SPEC_V1,
      // the specs repo, for story_sync below
      'main:docs/stories/ST-001.md': '---\nstory: ST-001\n---\n# Login\n',
      'main:docs/stories/ST-002.md': '# Checkout\n',
      'main:REPO_MAP.md': '# REPO_MAP\n'
    },
    dirs: { 'main:docs/stories': ['ST-001.md', 'ST-002.md'] },
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

  t('a fresh lock says which command records the pins', () => {
    // The shipped template's placeholders are truthy strings, so a presence check
    // would let them through and fail later with a confusing resolve error.
    const tmpl = JSON.parse(read(join(REPO, 'skills', 'contract-sync', 'templates', 'api-contract.lock.json')))
    const dir = consumer('fresh-lock', { core: { ...tmpl.contracts.core, repo: 'o/contracts' } })
    const r = cs(dir, ['sync'], csBase)
    eq(r.status, 1, 'exit')
    if (!r.stderr.includes('bump')) throw new Error(`did not name bump: ${r.stderr.trim()}`)
    eq(existsSync(vendored(dir)), false, 'wrote nothing')
    return 'points at bump'
  })

  // `verify` is the local-first half: the PreToolUse guard only sees edits made
  // through an agent, so a human with an editor was caught by CI alone. A repo
  // with no CI had nothing. This runs offline, in milliseconds, at pre-commit.
  t('verify catches a hand-edited vendored spec, offline', () => {
    const dir = consumer('verify', good)
    eq(cs(dir, ['sync'], csBase).status, 0, 'seed')
    // Point it at a dead port: verify must not need the network at all.
    eq(cs(dir, ['verify'], 'http://127.0.0.1:1').status, 0, 'clean, offline')
    writeFileSync(vendored(dir), `${SPEC_V1}# someone edited this by hand\n`)
    const r = cs(dir, ['verify'], 'http://127.0.0.1:1')
    eq(r.status, 1, 'tampered exit')
    if (!r.stderr.includes('does not match')) throw new Error('did not name the mismatch')
    if (!r.stderr.includes('by hand')) throw new Error('did not say what happened')
    return 'offline integrity'
  })

  // A freshly set-up consumer repo has placeholder pins and no vendored file. If
  // verify called that drift, the pre-commit hook would block the repo's very first
  // commit — which is exactly what happened to the pilot's mobile repo.
  t('verify does not block a repo that has never bumped', () => {
    const tmpl = JSON.parse(read(join(REPO, 'skills', 'contract-sync', 'templates', 'api-contract.lock.json')))
    const dir = consumer('never-bumped', { core: { ...tmpl.contracts.core, repo: 'o/contracts' } })
    const r = cs(dir, ['verify'], 'http://127.0.0.1:1')
    eq(r.status, 0, 'exit')
    if (!r.stdout.includes('not vendored yet')) throw new Error(`unhelpful: ${r.stdout.trim()}`)
    return 'first commit survives'
  })

  // But a spec that exists against placeholder pins is a different thing: someone
  // put a file there by hand, and nothing can vouch for it.
  t('verify still objects to a spec that exists with no pin behind it', () => {
    const tmpl = JSON.parse(read(join(REPO, 'skills', 'contract-sync', 'templates', 'api-contract.lock.json')))
    const dir = consumer('unpinned-spec', { core: { ...tmpl.contracts.core, repo: 'o/contracts' } })
    mkdirSync(join(dir, 'api'), { recursive: true })
    writeFileSync(vendored(dir), 'openapi: 3.0.3\n')
    eq(cs(dir, ['verify'], 'http://127.0.0.1:1').status, 1, 'exit')
    return 'unvouched file rejected'
  })

  t('verify reports a missing vendored spec rather than passing', () => {
    const dir = consumer('verify-missing', good)
    eq(cs(dir, ['sync'], csBase).status, 0, 'seed')
    rmSync(vendored(dir), { force: true })
    const r = cs(dir, ['verify'], 'http://127.0.0.1:1')
    eq(r.status, 1, 'exit')
    if (!r.stderr.includes('missing')) throw new Error('silent on a missing spec')
    return 'absence is a failure'
  })

  // Codegen that EXISTS but FAILS is a different case from codegen that is missing,
  // and it is the one the pilot hit: the lock and spec were already written, so the
  // repo was left holding a new contract next to a stale client — exactly the drift
  // the design refuses. Everything moves together or nothing does.
  t('a failing codegen rolls the lock and the spec back', () => {
    const dir = consumer('codegen-fails', good, { generator: false })
    writeFileSync(join(dir, 'tool', 'generate_api.sh'), 'echo "boom" >&2\nexit 3\n')
    const lockBefore = read(join(dir, 'api-contract.lock'))
    const r = cs(dir, ['bump', 'v2.0.0'], csBase)
    eq(r.status, 1, 'exit')
    if (!r.stderr.includes('put back')) throw new Error('did not say it rolled back')
    eq(read(join(dir, 'api-contract.lock')), lockBefore, 'lock restored')
    eq(existsSync(vendored(dir)), false, 'spec restored (was absent)')
    return 'nothing moved'
  })

  t('a failing codegen on sync restores the previous spec, not just deletes it', () => {
    const dir = consumer('codegen-fails-sync', good)
    eq(cs(dir, ['sync'], csBase).status, 0, 'seed a good vendored spec')
    const before = read(vendored(dir))
    writeFileSync(join(dir, 'tool', 'generate_api.sh'), 'exit 3\n')
    const r = cs(dir, ['sync'], csBase)
    eq(r.status, 1, 'exit')
    eq(read(vendored(dir)), before, 'previous spec restored byte-for-byte')
    return 'restored, not removed'
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

  // ── story_sync.mjs ───────────────────────────────────────────────────

  const SS = join(REPO, 'skills', 'bigin-harness-setup', 'scripts', 'story_sync.mjs')
  const specsRepo = (name, extra = {}) => {
    const dir = join(TMP, `ss-${name}`)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(join(dir, 'docs', 'stories'), { recursive: true })
    mkdirSync(join(dir, 'docs', 'story-meta'), { recursive: true })
    writeFileSync(join(dir, 'story-sync.json'), JSON.stringify({ repo: 'o/specs', ref: 'main' }))
    for (const [rel, body] of Object.entries(extra)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true })
      writeFileSync(join(dir, rel), body)
    }
    return dir
  }
  const ss = (dir, args, base) => spawnSync('node', [SS, ...args], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, STORY_SYNC_API: base, GITHUB_TOKEN: 'fixture-token', GH_TOKEN: '' }
  })

  t('story sync stamps synced: true without a second frontmatter block', () => {
    const dir = specsRepo('fresh')
    eq(ss(dir, ['sync'], csBase).status, 0, 'exit')
    const one = read(join(dir, 'docs/stories/ST-001.md'))
    const two = read(join(dir, 'docs/stories/ST-002.md'))
    // ST-001 arrived WITH frontmatter: the marker merges in, it does not stack.
    eq(one.match(/^---$/gm)?.length, 2, 'ST-001 frontmatter blocks')
    if (!one.includes('synced: true') || !one.includes('story: ST-001')) throw new Error('merged frontmatter lost a key')
    // ST-002 arrived with none: one block is created.
    if (!two.startsWith('---\nsynced: true\n---\n')) throw new Error('ST-002 not stamped')
    if (!read(join(dir, 'REPO_MAP.md')).includes('synced: true')) throw new Error('REPO_MAP not stamped')
    return 'merged + created'
  })

  t('story sync is idempotent', () => {
    const dir = specsRepo('idem')
    eq(ss(dir, ['sync'], csBase).status, 0, 'first')
    const before = read(join(dir, 'docs/stories/ST-001.md'))
    const r = ss(dir, ['sync'], csBase)
    eq(r.status, 0, 'second')
    eq(read(join(dir, 'docs/stories/ST-001.md')), before, 'bytes')
    if (!r.stdout.includes('already up to date')) throw new Error('second run did work')
    return 'no-op'
  })

  t('a story deleted upstream is deleted here', () => {
    const dir = specsRepo('deleted', {
      'docs/stories/ST-099.md': '---\nsynced: true\n---\n# Gone upstream\n'
    })
    eq(ss(dir, ['sync'], csBase).status, 0, 'exit')
    eq(existsSync(join(dir, 'docs/stories/ST-099.md')), false, 'removed')
    return 'propagated'
  })

  // The safety property. A wholesale-generated directory deletes files, and this
  // one deletes only what it wrote. Any other rule makes `sync` a command nobody
  // dares run — and it would silently eat a dev's scratch notes.
  t('an unsynced file in a synced directory is never deleted', () => {
    const dir = specsRepo('foreign', {
      'docs/stories/NOTES.md': '# my scratch notes, not synced\n',
      'docs/story-meta/ST-001.yaml': 'story: ST-001\n'
    })
    const r = ss(dir, ['sync'], csBase)
    eq(r.status, 0, 'exit')
    eq(existsSync(join(dir, 'docs/stories/NOTES.md')), true, 'foreign file kept')
    eq(existsSync(join(dir, 'docs/story-meta/ST-001.yaml')), true, 'sidecar kept')
    if (!r.stdout.includes('left alone')) throw new Error('kept it but said nothing')
    return 'kept and reported'
  })

  t('story check writes nothing and degrades offline', () => {
    const dir = specsRepo('check')
    const r = ss(dir, ['check'], csBase)
    eq(r.status, 0, 'exit')
    eq(existsSync(join(dir, 'docs/stories/ST-001.md')), false, 'wrote nothing')
    if (!r.stdout.includes('to update')) throw new Error(`no report: ${r.stdout.trim()}`)
    const off = ss(dir, ['check'], 'http://127.0.0.1:1')
    eq(off.status, 0, 'offline exit')
    if (!off.stdout.includes('skipped')) throw new Error('no skip line offline')
    return 'read-only'
  })

  // ── story_lint.mjs ───────────────────────────────────────────────────
  //
  // Written against a documented shape rather than a real BMAD corpus, so these
  // cases are what pins the assumptions listed in the script's own header. When
  // the first live specs repo arrives, these are what change with it.

  const SL = join(REPO, 'skills', 'bigin-harness-setup', 'scripts', 'story_lint.mjs')
  const GOOD = '# ST-001\n\n## Contract impact\n- contracts: core.v1 — POST /orders\n- breaking: no\n- ui: yes\n'
  const lint = body => {
    const dir = join(TMP, `sl-${createHash('sha256').update(body ?? 'empty').digest('hex').slice(0, 8)}`)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(join(dir, 'docs', 'stories'), { recursive: true })
    if (body !== null) writeFileSync(join(dir, 'docs', 'stories', 'ST-001.md'), body)
    return spawnSync('node', [SL], { cwd: dir, encoding: 'utf8' })
  }

  t('story lint passes a filled-in section', () => {
    eq(lint(GOOD).status, 0, 'exit')
    eq(lint('# ST\n\n## Contract impact\n- contracts: none\n- breaking: no\n- ui: no\n').status, 0, 'contracts: none')
    return 'both forms'
  })

  t('story lint fails what it should', () => {
    const cases = {
      'no section at all': '# ST-001\n\nJust a story.\n',
      'missing ui': '# ST\n\n## Contract impact\n- contracts: none\n- breaking: no\n',
      'bad contracts value': '# ST\n\n## Contract impact\n- contracts: maybe\n- breaking: no\n- ui: no\n',
      'bad breaking value': '# ST\n\n## Contract impact\n- contracts: none\n- breaking: sort of\n- ui: no\n',
      // The keys exist, but under a LATER heading — the section itself is empty.
      'keys outside the section': '# ST\n\n## Contract impact\n\n## Notes\n- contracts: none\n- breaking: no\n- ui: no\n'
    }
    for (const [name, body] of Object.entries(cases)) eq(lint(body).status, 1, name)
    return `${Object.keys(cases).length} rejected`
  })

  t('an empty specs repo is not a failure', () => {
    eq(lint(null).status, 0, 'exit')
    return 'no stories, no complaint'
  })

  // ── story_gate.mjs ───────────────────────────────────────────────────

  const SG = join(REPO, 'skills', 'bigin-harness-setup', 'scripts', 'story_gate.mjs')
  const UI_STORY = '# ST-042\n\n## Contract impact\n- contracts: none\n- breaking: no\n- ui: yes\n'
  const PLAIN_STORY = '# ST-043\n\n## Contract impact\n- contracts: none\n- breaking: no\n- ui: no\n'
  const gateRepo = (name, files) => {
    const dir = join(TMP, `sg-${name}`)
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(join(dir, 'docs', 'stories'), { recursive: true })
    mkdirSync(join(dir, 'docs', 'story-meta'), { recursive: true })
    for (const [rel, body] of Object.entries(files)) writeFileSync(join(dir, rel), body)
    return dir
  }
  const gate = (dir, args, env = {}) => spawnSync('node', [SG, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env }
  })

  t('a PR must name a story', () => {
    const dir = gateRepo('pr', {})
    eq(gate(dir, ['pr'], { PR_TITLE: 'fix the thing', PR_BODY: '' }).status, 1, 'unnamed')
    const ok = gate(dir, ['pr'], { PR_TITLE: 'feat: checkout (ST-042)', PR_BODY: '' })
    eq(ok.status, 0, 'named in title')
    eq(ok.stdout.trim(), 'ST-042', 'id extracted')
    eq(gate(dir, ['pr'], { PR_TITLE: 'feat: x', PR_BODY: 'closes ST-042 and ST-043' }).stdout.trim(), 'ST-042 ST-043', 'body, deduped and ordered')
    return '3 forms'
  })

  t('a UI story needs a final Figma sidecar before dev', () => {
    const base = { 'docs/stories/ST-042.md': UI_STORY }
    // no sidecar at all
    eq(gate(gateRepo('nosidecar', base), ['ready', 'ST-042']).status, 1, 'missing sidecar')
    // sidecar, but the link is to the file rather than a frame
    eq(gate(gateRepo('nonode', { ...base, 'docs/story-meta/ST-042.yaml': 'design:\n  figma: https://figma.com/design/ABC\n  status: final\n' }), ['ready', 'ST-042']).status, 1, 'no node-id')
    // sidecar with a node-id but still a draft
    eq(gate(gateRepo('draft', { ...base, 'docs/story-meta/ST-042.yaml': 'design:\n  figma: https://figma.com/design/ABC?node-id=1-2\n  status: draft\n' }), ['ready', 'ST-042']).status, 1, 'draft')
    // complete
    eq(gate(gateRepo('final', { ...base, 'docs/story-meta/ST-042.yaml': 'design:\n  figma: https://figma.com/design/ABC?node-id=1-2\n  status: final\n' }), ['ready', 'ST-042']).status, 0, 'final')
    return '4 states'
  })

  t('the gate passes what it has no business blocking', () => {
    // A non-UI story needs no sidecar...
    eq(gate(gateRepo('nonui', { 'docs/stories/ST-043.md': PLAIN_STORY }), ['ready', 'ST-043']).status, 0, 'non-UI story')
    // ...and a PR may name a story this repo never received.
    eq(gate(gateRepo('absent', {}), ['ready', 'ST-999']).status, 0, 'story not in this repo')
    // Adding the sidecar passes the gate WITHOUT touching the story file, which is
    // the acceptance criterion the whole sidecar convention exists for.
    const dir = gateRepo('untouched', { 'docs/stories/ST-042.md': UI_STORY })
    eq(gate(dir, ['ready', 'ST-042']).status, 1, 'before')
    writeFileSync(join(dir, 'docs/story-meta/ST-042.yaml'), 'design:\n  figma: https://f.com/d/A?node-id=1-2\n  status: final\n')
    eq(gate(dir, ['ready', 'ST-042']).status, 0, 'after')
    eq(read(join(dir, 'docs/stories/ST-042.md')), UI_STORY, 'story file untouched')
    return 'sidecar alone flips it'
  })

  t('an orphaned sidecar warns and never fails', () => {
    const dir = gateRepo('orphan', { 'docs/story-meta/ST-777.yaml': 'story: ST-777\n' })
    const r = gate(dir, ['orphans'])
    eq(r.status, 0, 'exit')
    if (!r.stdout.includes('::warning::')) throw new Error('no warning emitted')
    eq(gate(gateRepo('noorphan', {}), ['orphans']).status, 0, 'empty repo')
    return 'warned, not blocked'
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

// ── project-scaffold ────────────────────────────────────────────────────
//
// Run with a PATH holding only node and git, so go/pnpm/flutter all read as
// absent. That exercises the "toolchain missing" path AND keeps the group
// offline and fast — the app scaffolds are the only slow part, and each has its
// own coverage already. What matters here is the connective tissue: the wiring
// and the workflows are written whether or not an app got scaffolded.

console.log('\n7b. PROJECT SCAFFOLD')

const PS = join(REPO, 'skills', 'project-scaffold', 'scripts', 'project_scaffold.mjs')
const BARE_BIN = join(TMP, 'bare-bin')
let psReady = false
try {
  mkdirSync(BARE_BIN, { recursive: true })
  for (const tool of ['node', 'git']) {
    const found = spawnSync('which', [tool], { encoding: 'utf8' }).stdout.trim()
    if (found) spawnSync('ln', ['-sf', found, join(BARE_BIN, tool)])
  }
  psReady = existsSync(join(BARE_BIN, 'node')) && existsSync(join(BARE_BIN, 'git'))
} catch { /* fall through to the skip */ }

if (!psReady) {
  skip('project-scaffold', 'could not build a minimal PATH for the run')
} else {
  // Same GIT_* scrub the guards group needs, for the same reason: git exports
  // GIT_DIR while running a hook, and it would override every `git -C` below.
  const psEnv = { ...process.env, PATH: BARE_BIN }
  delete psEnv.GIT_DIR
  delete psEnv.GIT_WORK_TREE
  delete psEnv.GIT_INDEX_FILE
  const PS_ENV = psEnv
  const psRun = (dir, args) => spawnSync('node', [PS, ...args], {
    cwd: REPO, encoding: 'utf8', env: { ...PS_ENV, HOME: dir }
  })
  const OUT = join(TMP, 'ps-out')
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  const first = psRun(OUT, ['--project', 'demo', '--dir', OUT])

  t('scaffolds six repos, each committed', () => {
    eq(first.status, 0, 'exit')
    for (const type of ['specs', 'contracts', 'api', 'web', 'mobile', 'qa']) {
      const d = join(OUT, `demo-${type}`)
      if (!existsSync(join(d, '.git'))) throw new Error(`demo-${type} is not a git repo`)
      const log = spawnSync('git', ['log', '--oneline'], { cwd: d, encoding: 'utf8', env: PS_ENV }).stdout.trim()
      if (!log) throw new Error(`demo-${type} has no commit`)
    }
    return '6 repos'
  })

  t('a missing toolchain is reported, never silently skipped', () => {
    for (const type of ['api', 'web', 'mobile']) {
      if (!first.stdout.includes(`demo-${type}:`)) throw new Error(`said nothing about demo-${type}`)
    }
    if (!/not installed/.test(first.stdout)) throw new Error('did not name the absent toolchains')
    return 'named'
  })

  // The defect that broke both of the pilot's consumer repos: the shipped workflow
  // ships its toolchain block commented out, and a job that gets through checkout,
  // setup and token minting before dying at codegen looks like a workflow problem
  // rather than an install one.
  t('no workflow ships with its toolchain block still commented', () => {
    const files = []
    for (const type of ['specs', 'contracts', 'api', 'web', 'mobile', 'qa']) {
      const wf = join(OUT, `demo-${type}`, '.github', 'workflows')
      if (!existsSync(wf)) continue
      for (const f of readdirSync(wf)) files.push(join(wf, f))
    }
    if (files.length === 0) throw new Error('no workflows written at all')
    for (const f of files) {
      if (read(f).includes('REPLACE THIS BLOCK')) throw new Error(`${f} still carries the placeholder`)
    }
    return `${files.length} workflows`
  })

  t('each consumer gets the toolchain its codegen actually needs', () => {
    const want = {
      api: 'actions/setup-go@v5',
      web: 'pnpm/action-setup@v4',
      mobile: 'subosito/flutter-action@v2'
    }
    for (const [type, needle] of Object.entries(want)) {
      const f = join(OUT, `demo-${type}`, '.github', 'workflows', 'contract-bump.yml')
      const body = read(f)
      if (!body.includes(needle)) throw new Error(`demo-${type} did not get ${needle}`)
      for (const [other, wrong] of Object.entries(want)) {
        if (other !== type && body.includes(wrong)) throw new Error(`demo-${type} also got ${other}'s toolchain`)
      }
    }
    return '3 adapters'
  })

  t('the connective tissue names the project everywhere', () => {
    for (const type of ['api', 'web', 'mobile']) {
      const lock = JSON.parse(read(join(OUT, `demo-${type}`, 'api-contract.lock')))
      if (!lock.contracts.core.repo.endsWith('/demo-contracts')) {
        throw new Error(`demo-${type} lock points at ${lock.contracts.core.repo}`)
      }
    }
    for (const type of ['api', 'web', 'mobile', 'qa']) {
      const cfg = JSON.parse(read(join(OUT, `demo-${type}`, 'story-sync.json')))
      if (!cfg.repo.endsWith('/demo-specs')) throw new Error(`demo-${type} story-sync points at ${cfg.repo}`)
    }
    const map = read(join(OUT, 'demo-specs', 'REPO_MAP.md'))
    if (map.includes('{{')) throw new Error('REPO_MAP still holds an unsubstituted placeholder')
    return 'locks, story-sync, REPO_MAP'
  })

  t('re-running changes nothing', () => {
    const headsBefore = ['specs', 'contracts', 'api', 'web', 'mobile', 'qa'].map(type =>
      spawnSync('git', ['rev-parse', 'HEAD'], { cwd: join(OUT, `demo-${type}`), encoding: 'utf8', env: PS_ENV }).stdout.trim())
    const again = psRun(OUT, ['--project', 'demo', '--dir', OUT])
    eq(again.status, 0, 'second run exit')
    const headsAfter = ['specs', 'contracts', 'api', 'web', 'mobile', 'qa'].map(type =>
      spawnSync('git', ['rev-parse', 'HEAD'], { cwd: join(OUT, `demo-${type}`), encoding: 'utf8', env: PS_ENV }).stdout.trim())
    eq(headsAfter.join(), headsBefore.join(), 'HEADs')
    if (!again.stdout.includes('adopted')) throw new Error('did not say it adopted what was there')
    return 'idempotent'
  })

  t('a bad slug is refused before anything is created', () => {
    const r = psRun(OUT, ['--project', 'Not A Slug', '--dir', join(TMP, 'ps-never')])
    eq(r.status, 2, 'exit')
    eq(existsSync(join(TMP, 'ps-never')), false, 'created nothing')
    return 'exit 2'
  })

  t('credentials require an explicit owner', () => {
    const r = psRun(OUT, ['--project', 'demo', '--dir', OUT, '--app-id', '123'])
    eq(r.status, 2, 'exit')
    if (!r.stderr.includes('--app-key')) throw new Error('did not name the missing pair')
    return 'refused'
  })

  // ── STORY_CONSUMERS on an incremental add ─────────────────────────────────
  // The variable is the project's consumer list, and deriving it from this run's
  // `built` alone was wrong in both directions: `--repos mobile` never wrote it, so
  // the repo just created received no stories, and `--repos specs,mobile` replaced
  // three consumers with one. Both fail silently — stories simply stop arriving — so
  // every case below asserts on the exact body handed to `gh`. A fake `gh` and a
  // rewritten push URL keep the run offline.
  const GH_BIN = join(TMP, 'ps-gh-bin')
  let ghReady = false
  try {
    mkdirSync(GH_BIN, { recursive: true })
    // `which` too: project_scaffold probes for gh with it, so a PATH without it
    // reports every tool absent and the credentials block never runs. `cat` is what
    // the stub below reads its state with.
    for (const tool of ['node', 'git', 'which', 'cat']) {
      const found = spawnSync('which', [tool], { encoding: 'utf8' }).stdout.trim()
      if (found) spawnSync('ln', ['-sf', found, join(GH_BIN, tool)])
    }
    writeFileSync(join(GH_BIN, 'gh'), [
      '#!/bin/sh',
      '# Fake gh: only the surface project_scaffold.mjs touches. State lives under $HOME.',
      'case "$1 $2" in',
      '  "api user") exit 0 ;;',
      'esac',
      'case "$1" in',
      '  api)',
      '    case "$2" in',
      '      */actions/variables/STORY_CONSUMERS)',
      '        if [ -f "$HOME/gh-var" ]; then cat "$HOME/gh-var"; exit 0; fi',
      '        echo "gh: Not Found (HTTP 404)" >&2; exit 1 ;;',
      '    esac ;;',
      '  variable)',
      '    [ "$2" = set ] || exit 0',
      '    [ "$3" = STORY_CONSUMERS ] || exit 0   # CONTRACT_APP_ID goes the same way',
      '    while [ $# -gt 0 ]; do',
      '      if [ "$1" = "--body" ]; then shift; printf \'%s\' "$1" > "$HOME/gh-var-written"; break; fi',
      '      shift',
      '    done ;;',
      '  secret) cat > /dev/null ;;',
      'esac',
      'exit 0',
      ''
    ].join('\n'))
    spawnSync('chmod', ['+x', join(GH_BIN, 'gh')])
    ghReady = existsSync(join(GH_BIN, 'node')) && existsSync(join(GH_BIN, 'git'))
  } catch { /* falls through to the skip */ }

  if (!ghReady) {
    skip('STORY_CONSUMERS on an incremental add', 'could not build a PATH carrying the fake gh')
  } else {
    const THREE = ['acme/demo-api', 'acme/demo-web', 'acme/demo-qa']
    // One case fixture: a HOME holding the fake gh's state, a gitconfig that rewrites
    // github.com to local bare repos, and those repos, so no push leaves the machine.
    const ghHome = (name, existing) => {
      const D = join(TMP, `ps-gh-${name}`)
      rmSync(D, { recursive: true, force: true })
      mkdirSync(join(D, 'remotes', 'acme'), { recursive: true })
      writeFileSync(join(D, '.gitconfig'),
        `[url "${join(D, 'remotes')}/"]\n\tinsteadOf = https://github.com/\n`)
      for (const type of ['specs', 'contracts', 'api', 'web', 'mobile', 'qa']) {
        const bare = join(D, 'remotes', 'acme', `demo-${type}.git`)
        spawnSync('git', ['init', '-q', '--bare', bare], { env: PS_ENV })
      }
      if (existing !== undefined) writeFileSync(join(D, 'gh-var'), JSON.stringify(existing))
      writeFileSync(join(D, 'key.pem'), 'not-a-real-key\n')
      return D
    }
    const psRunGh = (home, repos, { creds = true } = {}) => spawnSync('node', [PS,
      '--project', 'demo', '--dir', join(home, 'repos'), '--owner', 'acme', '--repos', repos,
      ...(creds ? ['--app-id', '123', '--app-key', join(home, 'key.pem')] : [])
    ], { cwd: REPO, encoding: 'utf8', env: { ...PS_ENV, PATH: GH_BIN, HOME: home } })
    const written = home => {
      const f = join(home, 'gh-var-written')
      return existsSync(f) ? JSON.parse(read(f)) : null
    }

    t('an incremental add unions STORY_CONSUMERS instead of narrowing it', () => {
      const home = ghHome('narrow', THREE)
      const r = psRunGh(home, 'specs,mobile')
      eq(r.status, 0, 'exit')
      const body = written(home)
      if (!body) throw new Error('never set the variable')
      for (const repo of THREE) {
        if (!body.includes(repo)) throw new Error(`dropped ${repo}: wrote ${JSON.stringify(body)}`)
      }
      if (!body.includes('acme/demo-mobile')) throw new Error(`did not add the new consumer: ${JSON.stringify(body)}`)
      eq(body.length, 4, 'consumers')
      return '4, none dropped'
    })

    t('a run that never builds specs still registers the consumer it created', () => {
      const home = ghHome('nospecs', THREE)
      const r = psRunGh(home, 'mobile')
      eq(r.status, 0, 'exit')
      const body = written(home)
      if (!body) throw new Error('left the variable untouched, so the new repo gets no stories')
      eq(body.join(), [...THREE, 'acme/demo-mobile'].sort().join(), 'consumers')
      return 'registered'
    })

    t('a STORY_CONSUMERS value it cannot parse is reported, never overwritten', () => {
      const home = ghHome('unparseable')
      writeFileSync(join(home, 'gh-var'), 'oops, not json\n')
      const r = psRunGh(home, 'specs,mobile')
      eq(r.status, 0, 'exit')
      eq(written(home), null, 'wrote nothing')
      if (!/STORY_CONSUMERS/.test(r.stdout)) throw new Error('did not report the value it refused to touch')
      return 'left alone'
    })

    // The list is wiring the specs repo's dispatch workflow reads, not a credential:
    // whoever creates the GitHub App, a consumer missing from it receives no stories.
    t('the consumer list is set with --owner alone, no credentials', () => {
      const home = ghHome('nocreds', THREE)
      const r = psRunGh(home, 'mobile', { creds: false })
      eq(r.status, 0, 'exit')
      const body = written(home)
      if (!body) throw new Error('set nothing without --app-id, so the list is stale until someone notices')
      eq(body.join(), [...THREE, 'acme/demo-mobile'].sort().join(), 'consumers')
      if (/CI credentials set/.test(r.stdout)) throw new Error('claimed to set credentials it was never given')
      return 'set, no credentials'
    })

    t('a run that adds no consumer writes no variable', () => {
      const home = ghHome('noop', [...THREE, 'acme/demo-mobile'])
      const r = psRunGh(home, 'mobile')
      eq(r.status, 0, 'exit')
      eq(written(home), null, 'wrote nothing')
      if (!/already lists/.test(r.stdout)) throw new Error('did not say the list was already complete')
      return 'no write'
    })
  }
}

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

  // ── vendored-contract-guard ──────────────────────────────────────────
  //
  // Every case asserts the exit code AND, for a refusal, that the message names
  // somewhere to go. A gate that only says no gets worked around.

  const VCG = join(GUARD_DIR, 'vendored-contract-guard.mjs')
  let vcgReady = false
  try {
    writeFileSync(VCG, guardSource('vendored-contract-guard.mjs'))
    vcgReady = true
  } catch (e) {
    skip('extract vendored-contract-guard', e.message)
  }

  if (vcgReady) {
    const VREPO = join(TMP, 'vendored')
    rmSync(VREPO, { recursive: true, force: true })
    for (const d of ['docs/stories', 'docs/story-meta', 'api/openapi', 'src']) {
      mkdirSync(join(VREPO, d), { recursive: true })
    }
    gitq(VREPO, 'init', '-q', '.')
    writeFileSync(join(VREPO, 'api-contract.lock'), JSON.stringify({
      contracts: { core: { repo: 'bigin-io/acme-contracts', file: 'openapi/core.v1.yaml', ref: 'v1.0.0', commit: 'a', sha256: 'b' } }
    }))
    for (const f of ['openapi.yaml', 'api/openapi.yaml', 'api/openapi/core.yaml']) {
      writeFileSync(join(VREPO, f), 'openapi: 3.0.3\n')
    }
    writeFileSync(join(VREPO, 'docs/stories/ST-042.md'), '---\nsynced: true\nstory: ST-042\n---\n# Story\n')
    writeFileSync(join(VREPO, 'docs/notes.md'), '---\ntitle: mine\n---\n# Notes\n')
    writeFileSync(join(VREPO, 'docs/story-meta/ST-042.yaml'), 'story: ST-042\n')
    writeFileSync(join(VREPO, 'src/app.ts'), 'x\n')

    const vcg = (rel, tool = 'Edit') => spawnSync('node', [VCG], {
      cwd: VREPO,
      encoding: 'utf8',
      env: CLEAN_ENV,
      input: JSON.stringify({
        tool_name: tool,
        tool_input: tool === 'Read' ? { file_path: join(VREPO, rel) } : { file_path: join(VREPO, rel), content: 'x' }
      })
    })

    t('the vendored spec and its lock are denied on every layout', () => {
      for (const f of ['api-contract.lock', 'openapi.yaml', 'api/openapi.yaml', 'api/openapi/core.yaml']) {
        const r = vcg(f)
        eq(r.status, 2, `${f} exit`)
        if (!r.stderr.includes('contract_sync.mjs bump')) throw new Error(`${f}: message names no way forward`)
      }
      return '4 paths'
    })

    t('the refusal names the contracts repo, read out of the lock', () => {
      const r = vcg('openapi.yaml')
      if (!r.stderr.includes('bigin-io/acme-contracts')) throw new Error('did not name the contracts repo')
      return 'named'
    })

    t('a synced story is denied and points at its own sidecar', () => {
      const r = vcg('docs/stories/ST-042.md')
      eq(r.status, 2, 'exit')
      if (!r.stderr.includes('docs/story-meta/ST-042.yaml')) throw new Error('did not name the sidecar')
      return 'sidecar named'
    })

    t('what this repo does own is left alone', () => {
      for (const f of ['docs/notes.md', 'docs/story-meta/ST-042.yaml', 'src/app.ts', 'openapi-notes.md']) {
        eq(vcg(f).status, 0, `${f} exit`)
      }
      eq(vcg('openapi.yaml', 'Read').status, 0, 'a Read is not a write')
      return '5 allowed'
    })

    t('vendored-contract-guard fails closed on unreadable stdin', () => {
      for (const bad of ['{ not json', '']) {
        eq(spawnSync('node', [VCG], { cwd: VREPO, encoding: 'utf8', env: CLEAN_ENV, input: bad }).status, 2, 'exit')
      }
      return 'exit 2 both ways'
    })

    // The guard's path regex and contract_sync.mjs's adapter table are two
    // statements of the same fact in two files. Drift means the guard stops
    // covering a layout the script still writes — silently, since nothing else
    // reads both. So check them against each other.
    t('the guard covers every path contract_sync.mjs can vendor', () => {
      const src = read(join(REPO, 'skills', 'contract-sync', 'scripts', 'contract_sync.mjs'))
      const specs = [...src.matchAll(/spec: (?:'([^']+)'|join\('([^']+)', '([^']+)'\))/g)]
        .map(m => m[1] ?? `${m[2]}/${m[3]}`)
      const dirs = [...src.matchAll(/multiDir: (?:'([^']+)'|join\('([^']+)', '([^']+)'\))/g)]
        .map(m => m[1] ?? `${m[2]}/${m[3]}`)
      if (specs.length !== 3 || dirs.length !== 3) {
        throw new Error(`parsed ${specs.length} spec paths and ${dirs.length} multiDirs, expected 3 and 3`)
      }
      const guard = guardSource('vendored-contract-guard.mjs')
      const re = new RegExp(guard.match(/const VENDORED_SPEC = \/(.+)\/$/m)[1])
      for (const p of specs) if (!re.test(p)) throw new Error(`guard does not cover ${p}`)
      for (const d of dirs) if (!re.test(`${d}/core.yaml`)) throw new Error(`guard does not cover ${d}/<name>.yaml`)
      return `${specs.length} specs + ${dirs.length} dirs`
    })
  }

  // ── session-resume-check, contract-staleness half ────────────────────

  let srcReady = false
  const SRC = join(GUARD_DIR, 'session-resume-check.mjs')
  try {
    writeFileSync(SRC, guardSource('session-resume-check.mjs'))
    srcReady = true
  } catch (e) {
    skip('extract session-resume-check', e.message)
  }

  if (srcReady) {
    const mkConsumer = (name, { script = null, lock = true } = {}) => {
      const dir = join(TMP, `srck-${name}`)
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(join(dir, 'scripts'), { recursive: true })
      if (lock) writeFileSync(join(dir, 'api-contract.lock'), '{"contracts":{}}')
      if (script) writeFileSync(join(dir, 'scripts', 'contract_sync.mjs'), script)
      return dir
    }
    const session = dir => spawnSync('node', [SRC], {
      cwd: dir, encoding: 'utf8', env: CLEAN_ENV,
      input: JSON.stringify({ cwd: dir, hook_event_name: 'SessionStart' })
    })

    t('session start reports contract staleness on a consumer repo', () => {
      const dir = mkConsumer('ok', { script: "console.log('core: lock v1.0.0 (abc1234) — latest v2.0.0')\n" })
      const r = session(dir)
      eq(r.status, 0, 'exit')
      if (!r.stdout.includes('Contract:') || !r.stdout.includes('latest v2.0.0')) {
        throw new Error(`no contract line: ${r.stdout.trim().slice(0, 120)}`)
      }
      return 'reported'
    })

    t('session start says nothing when there is nothing to say', () => {
      // No lock at all — an ordinary repo must not pay for this feature.
      eq(session(mkConsumer('nolock', { lock: false })).stdout.includes('Contract:'), false, 'silent')
      // Lock but no script installed yet.
      eq(session(mkConsumer('noscript')).stdout.includes('Contract:'), false, 'silent')
      // The check failed — a notice must never become a diagnostic about itself.
      const failing = mkConsumer('failing', { script: "console.log('half a line'); process.exit(1)\n" })
      eq(session(failing).stdout.includes('Contract:'), false, 'silent on failure')
      return '3 quiet cases'
    })

    // v1.98.3: an empty precompact autosave was announced as a resumable session at
    // every SessionStart, so the same question came back until someone archived the
    // file. A notice is not a question; only a save with real content earns the prompt.
    const mkSession = (name, body) => {
      const dir = join(TMP, `srck-${name}`)
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(join(dir, '.claude', 'memory'), { recursive: true })
      writeFileSync(join(dir, '.claude', 'memory', 'SESSION.md'), body)
      return dir
    }
    const AUTOSAVE = [
      '---', 'session-id: abc', 'status: in-progress', '---', '<!-- precompact-autosave -->',
      '', '**Session saved:** 2026-09-09T09:03:58.873Z', '',
      '## What We Were Working On', '',
      '(autosaved before compaction — no summary captured yet; fill in on next manual save)', '',
      '### Tasks', '', '(none captured by autosave — see TaskList)', '',
      '### Decisions Made', '', '(none captured by autosave)', ''
    ].join('\n')

    t('an empty precompact autosave is a notice, never a question', () => {
      const r = session(mkSession('autosave', AUTOSAVE))
      eq(r.status, 0, 'exit')
      if (!/empty precompact autosave/.test(r.stdout)) throw new Error(`no notice: ${r.stdout.trim().slice(0, 140)}`)
      if (/resume this session/.test(r.stdout)) throw new Error('still asks the user to decide')
      if (!r.stdout.includes('2026-09-09T09:03:58.873Z')) throw new Error('the notice does not date the autosave')
      return 'notice, not a prompt'
    })

    t('a real handoff save still earns the resume prompt', () => {
      // Same marker, but a later save replaced the placeholders — that is content worth resuming.
      const filled = AUTOSAVE
        .replace('(autosaved before compaction — no summary captured yet; fill in on next manual save)', 'Refactoring the token repository behind the users module.')
        .replace('(none captured by autosave — see TaskList)', '1. Finish the refresh-token migration')
        .replace('(none captured by autosave)', 'Chose GORM soft-deletes over a status column.')
      const r = session(mkSession('filled', filled))
      if (!/resume this session/.test(r.stdout)) throw new Error('a real save stopped prompting')
      if (/empty precompact autosave/.test(r.stdout)) throw new Error('a real save was mistaken for an empty one')
      // A file with no marker at all — the pre-1.98.3 shape — must also still prompt.
      const legacy = session(mkSession('legacy', '---\nstatus: in-progress\n---\n\n# Session Handoff\n\nHand-written.\n'))
      if (!/resume this session/.test(legacy.stdout)) throw new Error('a hand-written save stopped prompting')
      return 'both shapes prompt'
    })

    t('the autosave notice reaches a Cursor session too', () => {
      const dir = mkSession('cursor', AUTOSAVE)
      const r = spawnSync('node', [SRC], {
        cwd: dir, encoding: 'utf8', env: CLEAN_ENV,
        input: JSON.stringify({ workspace_roots: [dir], conversation_id: 'c1', cursor_version: '1.0', hook_event_name: 'sessionStart' })
      })
      eq(r.status, 0, 'exit')
      if (!/empty precompact autosave/.test(r.stdout)) throw new Error(`no notice on the Cursor payload: ${r.stdout.trim().slice(0, 140)}`)
      return 'both payload shapes'
    })

    t('a hung check cannot hold up a session', () => {
      const dir = mkConsumer('hung', { script: 'setTimeout(() => {}, 60000)\n' })
      const t0 = Date.now()
      const r = session(dir)
      const ms = Date.now() - t0
      eq(r.status, 0, 'exit')
      if (ms > 8000) throw new Error(`session start took ${ms} ms`)
      eq(r.stdout.includes('Contract:'), false, 'no line from a timed-out check')
      return `${ms} ms`
    })
  }

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
