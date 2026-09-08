#!/usr/bin/env node
/**
 * story_sync.mjs — pulls story files and REPO_MAP.md from the specs repo into a
 * consumer repo, as read-only copies.
 *
 * Usage:
 *   node story_sync.mjs check
 *   node story_sync.mjs sync
 *
 * NOT `docs_sync.mjs`. That name belongs to a different tool in bigin-skills that
 * regenerates README tables and gates every commit there; two tools with one name
 * is how the wrong one gets run.
 *
 * The specs repo is the single writer. Copies land here carrying `synced: true`,
 * a PreToolUse guard refuses edits to them, and the target directory is treated as
 * GENERATED — a story deleted upstream is deleted here.
 *
 * Node >=20 stdlib only (fetch, node:crypto, node:fs). Exit codes: 0 ok, 1 runtime
 * failure, 2 bad usage/args.
 *
 * The one rule worth stating twice: a wholesale-generated directory deletes files,
 * and this one deletes ONLY files that carry the `synced: true` marker it wrote
 * itself. A hand-added file in the same directory is left alone and reported. Any
 * other rule makes "sync" a command nobody dares run.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const CONFIG_NAME = 'story-sync.json'
const UA = 'bigin-story-sync'
const CHECK_TIMEOUT_MS = 2500
const SYNC_TIMEOUT_MS = 20_000

// Same loopback-only test seam as contract_sync.mjs, for the same reason: an env
// var that could repoint a credentialed fetch at an arbitrary host is a token-leak
// surface on a script that writes to the repo.
const API_BASE = (() => {
  const raw = process.env.STORY_SYNC_API
  if (!raw) return 'https://api.github.com'
  let u
  try {
    u = new URL(raw)
  } catch {
    fail('STORY_SYNC_API is not a URL', 2)
  }
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(u.hostname)) {
    fail(`STORY_SYNC_API may only point at loopback (got ${u.hostname})`, 2)
  }
  return raw.replace(/\/$/, '')
})()

function fail(msg, code = 1) {
  console.error(`[story-sync] ERROR: ${msg}`)
  process.exit(code)
}

function info(msg) {
  console.log(`[story-sync] ${msg}`)
}

// ── repo + config ───────────────────────────────────────────────────────

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    let dir = process.cwd()
    for (;;) {
      if (existsSync(join(dir, CONFIG_NAME))) return dir
      const up = dirname(dir)
      if (up === dir) return process.cwd()
      dir = up
    }
  }
}

function loadConfig(root) {
  const p = join(root, CONFIG_NAME)
  if (!existsSync(p)) {
    fail(`no ${CONFIG_NAME} at ${root} — this repo does not receive synced stories.`)
  }
  let cfg
  try {
    cfg = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    fail(`${CONFIG_NAME} is not valid JSON: ${e.message}`)
  }
  if (typeof cfg.repo !== 'string' || !cfg.repo.includes('/')) {
    fail(`${CONFIG_NAME}: "repo" must be "owner/name"`)
  }
  cfg.ref ??= 'main'
  // Directory pairs are synced wholesale; file pairs are synced one for one.
  cfg.dirs ??= { 'docs/stories': 'docs/stories' }
  cfg.files ??= { 'REPO_MAP.md': 'REPO_MAP.md' }
  return cfg
}

// ── auth + github ───────────────────────────────────────────────────────

function token() {
  const env = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (env && env.trim()) return env.trim()
  try {
    const out = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    return out || null
  } catch {
    return null
  }
}

class Unreachable extends Error {}

async function gh(path, { raw = false, timeout = SYNC_TIMEOUT_MS, auth } = {}) {
  const headers = {
    'user-agent': UA,
    'accept': raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28'
  }
  if (auth) headers.authorization = `Bearer ${auth}`
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, { headers, signal: AbortSignal.timeout(timeout) })
  } catch (e) {
    throw new Unreachable(e.name === 'TimeoutError' ? `timed out after ${timeout} ms` : 'network unreachable')
  }
  if (res.status === 401 || res.status === 403) throw new Unreachable(`GitHub refused the request (${res.status})`)
  if (res.status === 404) {
    const err = new Error(`not found: ${path}`)
    err.notFound = true
    throw err
  }
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${path}`)
  return raw ? await res.text() : res.json()
}

const enc = p => p.split('/').map(encodeURIComponent).join('/')

async function listDir(repo, path, ref, opts) {
  const entries = await gh(`/repos/${repo}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`, opts)
  if (!Array.isArray(entries)) throw new Error(`${path} is not a directory in ${repo}`)
  return entries.filter(e => e.type === 'file').map(e => e.name)
}

function fetchFile(repo, path, ref, opts) {
  return gh(`/repos/${repo}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`, { ...opts, raw: true })
}

// ── frontmatter ─────────────────────────────────────────────────────────

// The copy differs from the source by an injected key, so freshness can never be a
// byte comparison of the whole file — it is the digest of the body BELOW the
// frontmatter, which is the half the specs repo actually owns.
function splitFrontmatter(text) {
  if (!text.startsWith('---')) return { fm: null, body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { fm: null, body: text }
  const after = text.indexOf('\n', end + 1)
  return { fm: text.slice(3, end).replace(/^\n/, ''), body: after === -1 ? '' : text.slice(after + 1) }
}

function bodyDigest(text) {
  return createHash('sha256').update(splitFrontmatter(text).body).digest('hex')
}

// Merge the marker into whatever frontmatter the source already had. Never prepend a
// second block: BMAD stories may carry their own, and two blocks is a broken file.
function stamp(text) {
  const { fm, body } = splitFrontmatter(text)
  if (fm === null) return `---\nsynced: true\n---\n${text}`
  const kept = fm.split('\n').filter(l => !/^synced:\s/.test(l)).join('\n')
  return `---\nsynced: true\n${kept}\n---\n${body}`
}

function isSyncedFile(path) {
  try {
    const head = readFileSync(path, 'utf8').slice(0, 1024)
    if (!head.startsWith('---')) return false
    const end = head.indexOf('\n---', 3)
    return end !== -1 && /^synced:\s*true\s*$/m.test(head.slice(3, end))
  } catch {
    return false
  }
}

// ── plan ────────────────────────────────────────────────────────────────

// Everything sync would do, computed before anything is written, so `check` and
// `sync` can never disagree about what is stale.
async function plan(root, cfg, opts) {
  const write = []
  const remove = []
  const foreign = []

  for (const [src, dst] of Object.entries(cfg.dirs)) {
    const names = await listDir(cfg.repo, src, cfg.ref, opts)
    const localDir = join(root, dst)
    for (const name of names) {
      const body = await fetchFile(cfg.repo, `${src}/${name}`, cfg.ref, opts)
      const target = join(localDir, name)
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null
      if (current === null || bodyDigest(current) !== bodyDigest(body)) {
        write.push({ target, content: stamp(body), rel: `${dst}/${name}` })
      }
    }
    if (existsSync(localDir)) {
      for (const name of readdirSync(localDir)) {
        const target = join(localDir, name)
        if (names.includes(name)) continue
        // A wholesale-generated directory deletes — but only what it wrote.
        if (isSyncedFile(target)) remove.push({ target, rel: `${dst}/${name}` })
        else foreign.push(`${dst}/${name}`)
      }
    }
  }

  for (const [src, dst] of Object.entries(cfg.files)) {
    const body = await fetchFile(cfg.repo, src, cfg.ref, opts)
    const target = join(root, dst)
    const current = existsSync(target) ? readFileSync(target, 'utf8') : null
    if (current === null || bodyDigest(current) !== bodyDigest(body)) {
      write.push({ target, content: stamp(body), rel: dst })
    }
  }

  return { write, remove, foreign }
}

// ── commands ────────────────────────────────────────────────────────────

async function cmdCheck(root, cfg) {
  const auth = token()
  try {
    const { write, remove, foreign } = await plan(root, cfg, { auth, timeout: CHECK_TIMEOUT_MS })
    if (write.length === 0 && remove.length === 0) console.log(`stories: up to date with ${cfg.repo}`)
    else console.log(`stories: ${write.length} to update, ${remove.length} to remove (${cfg.repo})`)
    if (foreign.length > 0) {
      console.log(`stories: ${foreign.length} unsynced file(s) in a synced directory — left alone: ${foreign.join(', ')}`)
    }
  } catch (e) {
    // Same rule as contract_sync check: this runs at session start and must never
    // hold one up or turn into a diagnostic about itself.
    console.log(`stories: check skipped (${e.message})`)
  }
  return 0
}

async function cmdSync(root, cfg) {
  const auth = token()
  if (!auth) fail('no credentials: set GITHUB_TOKEN or run `gh auth login`.')

  let p
  try {
    p = await plan(root, cfg, { auth })
  } catch (e) {
    fail(`could not read ${cfg.repo}: ${e.message}`)
  }

  // Everything is fetched and compared before the first write, so a mid-run failure
  // cannot leave the directory half-updated.
  for (const w of p.write) {
    mkdirSync(dirname(w.target), { recursive: true })
    writeFileSync(w.target, w.content)
  }
  for (const r of p.remove) rmSync(r.target, { force: true })

  for (const w of p.write) info(`updated ${w.rel}`)
  for (const r of p.remove) info(`removed ${r.rel} (deleted upstream)`)
  for (const f of p.foreign) info(`left alone: ${f} — not a synced file`)
  if (p.write.length === 0 && p.remove.length === 0) info('already up to date')
  return 0
}

// ── main ────────────────────────────────────────────────────────────────

const USAGE = `Usage:
  story_sync.mjs check
  story_sync.mjs sync`

async function main() {
  let positionals
  try {
    ;({ positionals } = parseArgs({ allowPositionals: true, options: { help: { type: 'boolean', default: false } } }))
  } catch (e) {
    fail(`bad arguments: ${e.message}\n${USAGE}`, 2)
  }
  const command = positionals[0]
  if (!command || !['check', 'sync'].includes(command)) {
    console.log(USAGE)
    process.exit(2)
  }
  const root = repoRoot()
  const cfg = loadConfig(root)
  process.exit(command === 'check' ? await cmdCheck(root, cfg) : await cmdSync(root, cfg))
}

main().catch(e => fail(e?.message ?? String(e)))
