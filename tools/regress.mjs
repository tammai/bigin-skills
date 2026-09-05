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
 *
 * Node stdlib only, no network, no install. Scaffolder cases run with
 * --no-install so the suite stays fast enough for a commit hook.
 * Exit 0 all green, 1 any failure.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const TMP = join(tmpdir(), `bigin-skills-regress-${process.pid}`)
const SKIP_GATES = process.argv.includes('--skip-gates')

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
let pass = 0, fail = 0
const t = (name, fn) => {
  try { const m = fn(); console.log(`  PASS  ${name}${m ? `  (${m})` : ''}`); pass++ }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++ }
}
const eq = (a, b, what) => { if (a !== b) throw new Error(`${what}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`) }
const sh = (cmd, args, opts={}) => spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', ...opts })

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

console.log('\n4. DETECTION LADDER')
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
t('no leftover __TOKEN__ placeholders', () => {
  const bad = []
  const walk = d => { for (const e of readdirSync(d,{withFileTypes:true})) {
    const f = join(d,e.name); if (e.isDirectory()) walk(f)
    else if (/__[A-Z_]+__/.test(readFileSync(f,'utf8'))) bad.push(f) } }
  walk(join(TMP,'s2')); eq(bad.join(',')||'none','none','files with placeholders'); return 'clean'
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
t('no stale separate-Worker wording survives', () => {
  const hits = []
  for (const f of ['skills/bigin-harness-setup/references/profile-nuxt-marketing.md',
                   'skills/bigin-harness-setup/references/profile-detection.md',
                   'skills/bigin-harness-setup/SKILL.md','docs/USER_GUIDE.md','CHANGELOG.md'])
    if (/worker of their own|which stays absent/i.test(rd(f))) hits.push(f)
  eq(hits.join(',')||'none','none','files with stale wording'); return 'clean' })

rmSync(TMP, { recursive: true, force: true })
console.log(`\n${'='.repeat(52)}\n${fail ? 'FAIL' : 'OK'}  ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
