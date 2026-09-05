#!/usr/bin/env node
/**
 * scaffold.mjs — deterministic multi-locale Nuxt 4 marketing-site scaffold.
 *
 * Usage:
 *   node scaffold.mjs --project acme-site [--dir acme-site]
 *                     [--locales en,vi] [--primary blue] [--neutral slate]
 *                     [--force] [--no-install] [--no-commit]
 *
 * Why this is NOT a template inside nuxt-scaffold: that script's TEMPLATE_PKGS
 * installs `nuxt-auth-utils` and `@pinia/nuxt` into every project it makes.
 * `nuxt-auth-utils` is exactly the auth marker condition 4 of the
 * `nuxt-marketing` detection rung tests for, so a marketing site scaffolded
 * through nuxt-scaffold would resolve to `nuxt` and be onboarded with
 * BFF-proxy conventions — the precise failure the profile exists to prevent.
 *
 * The repo this leaves behind is the profile's own reference layout:
 *   nuxt.config.ts + content.config.ts + content/<locale>/ tree
 *   @nuxt/content AND @nuxtjs/i18n in `dependencies`
 *   no auth dependency of any kind
 *   server/api/ holding exactly the contact + newsletter routes,
 *     with their Turnstile / rate-limit / delivery helpers in server/utils/
 *
 * It leaves behind a repo that BUILDS: `pnpm install && pnpm build` prerenders
 * one entry point per locale. `tools/regress.mjs --build` is the check that
 * keeps that true; the always-on cases in that suite are the cheap half.
 *
 * All decisions are pre-resolved via CLI flags — never prompts, never reads
 * stdin. Node stdlib only. Exit codes: 0 ok, 1 runtime failure, 2 bad usage.
 *
 * Windows: pnpm/npx are .cmd shims; since Node's CVE-2024-27980 fix spawning
 * one without a shell throws EINVAL, so run() sets shell:true on win32 only,
 * always with an argument array (never a concatenated string).
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
const LOCALE_RE = /^[a-z]{2}(-[A-Z]{2})?$/
const PRIMARY = ['blue','green','emerald','teal','cyan','sky','indigo','violet','purple','fuchsia','pink','rose','amber','yellow','lime','orange','red']
const NEUTRAL = ['slate','gray','zinc','neutral','stone']

// There is no dependency list here on purpose. `package.json.tmpl` declares
// every dependency at a tested range, and the install step is `pnpm install`
// against that manifest — never `pnpm add`, which would re-resolve each name
// to whatever is latest that morning and silently discard the pins. The
// --no-install path and the install path have to produce the same tree, or
// the thing that was verified is not the thing that ships.
//
// @nuxt/content and @nuxtjs/i18n are `dependencies` in that manifest on
// purpose: they are conditions 2 and 3 of the detection rung, and a
// devDependency-only entry is specified NOT to match.

function log (m) { console.log(`[scaffold] ${m}`) }
function bad (m) { console.error(`[scaffold] usage: ${m}`); process.exit(2) }
function die (m) { console.error(`[scaffold] error: ${m}`); process.exit(1) }

const winQuote = a => (/[\s"^&|<>()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)
function run (cmd, args, opts = {}) {
  const r = IS_WIN
    ? spawnSync(winQuote(cmd), args.map(winQuote), { stdio: 'inherit', shell: true, ...opts })
    : spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (r.error) die(`${cmd} failed to start: ${r.error.message}`)
  return r.status ?? 1
}

function parse () {
  let v
  try {
    ({ values: v } = parseArgs({ options: {
      project:   { type: 'string' },
      dir:       { type: 'string' },
      locales:   { type: 'string' },
      primary:   { type: 'string' },
      neutral:   { type: 'string' },
      force:     { type: 'boolean' },
      'no-install': { type: 'boolean' },
      'no-commit':  { type: 'boolean' }
    }, strict: true }))
  } catch (e) { bad(e.message) }

  if (!v.project) bad('--project is required')
  if (!NAME_RE.test(v.project)) bad('--project must be kebab-case')
  const locales = (v.locales ?? 'en,vi').split(',').map(s => s.trim()).filter(Boolean)
  if (locales.length < 1) bad('--locales needs at least one locale')
  for (const l of locales) if (!LOCALE_RE.test(l)) bad(`bad locale "${l}" (expected e.g. en or en-US)`)
  const primary = v.primary ?? 'blue'
  const neutral = v.neutral ?? 'slate'
  if (!PRIMARY.includes(primary)) bad(`--primary must be one of ${PRIMARY.join('/')}`)
  if (!NEUTRAL.includes(neutral)) bad(`--neutral must be one of ${NEUTRAL.join('/')}`)
  return { project: v.project, dir: v.dir ?? v.project, locales, primary, neutral,
           force: !!v.force, install: !v['no-install'], commit: !v['no-commit'] }
}

// The character class must include digits: `__LOCALES_I18N__` is a real token
// name and `[A-Z_]+` cannot match the `18` in it, so a digit-bearing token
// silently survived substitution into the generated config for four releases.
// A token that does not match here is not an error — it is written through
// unchanged, and nothing downstream reads it — which is why the regression
// suite asserts on the generated tree rather than on this line.
const subst = (s, m) => s.replace(/__([A-Z0-9_]+)__/g, (_, k) => (k in m ? m[k] : `__${k}__`))

function writeTree (root, opts) {
  const [defaultLocale, ...prefixed] = opts.locales
  const map = {
    PROJECT: opts.project,
    DEFAULT_LOCALE: defaultLocale,
    LOCALES_I18N: opts.locales.map(c => `{ code: '${c}', file: '${c}.json' }`).join(', '),
    // prefix_except_default: the default locale is served at the root, every
    // other locale under its own prefix. One prerender entry point each.
    LOCALE_ROUTES: ['/', ...prefixed.map(c => `/${c}`)].map(r => `'${r}'`).join(', '),
    PRIMARY: opts.primary,
    NEUTRAL: opts.neutral
  }
  const walk = (src, dst) => {
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      const from = path.join(src, e.name)
      const to = path.join(dst, e.name.replace(/\.tmpl$/, ''))
      if (e.isDirectory()) { fs.mkdirSync(to, { recursive: true }); walk(from, to) }
      else { fs.mkdirSync(path.dirname(to), { recursive: true })
             fs.writeFileSync(to, subst(fs.readFileSync(from, 'utf8'), map)) }
    }
  }
  walk(TEMPLATES, root)

  // Per-locale content + message bundles. One page per locale so the prerender
  // has something real to walk, and so a missing locale is visibly missing
  // rather than silently falling back — this profile forbids fallbackLocale.
  for (const code of opts.locales) {
    const dir = path.join(root, 'content', code)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.md'),
`---
title: ${opts.project}
description: A multi-locale marketing site.
blocks:
  - type: hero
    heading: ${opts.project}
    body: Replace this copy in content/${code}/index.md.
---
`)
    fs.mkdirSync(path.join(root, 'i18n', 'locales'), { recursive: true })
    fs.writeFileSync(path.join(root, 'i18n', 'locales', `${code}.json`),
      JSON.stringify({ nav: { home: 'Home' }, form: { submit: 'Send' } }, null, 2) + '\n')
  }
}

function main () {
  const opts = parse()
  const root = path.resolve(opts.dir)
  if (fs.existsSync(root) && fs.readdirSync(root).length && !opts.force)
    die(`${root} is not empty (use --force)`)
  fs.mkdirSync(root, { recursive: true })
  log(`scaffolding ${opts.project} into ${root} (locales: ${opts.locales.join(', ')})`)
  writeTree(root, opts)
  log('wrote project tree')

  if (opts.install) {
    if (run('pnpm', ['install'], { cwd: root })) die('pnpm install failed')
    log('installed dependencies')
  } else {
    log('skipped install (--no-install) — package.json already declares every dependency')
  }

  if (opts.commit) {
    run('git', ['init', '-q'], { cwd: root })
    run('git', ['add', '-A'], { cwd: root })
    run('git', ['-c', 'user.name=scaffold', '-c', 'user.email=scaffold@local',
                'commit', '-q', '-m', `chore: scaffold ${opts.project}`], { cwd: root })
    log('initial commit')
  }
  log('done')
}

main()
