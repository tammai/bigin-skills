#!/usr/bin/env node
/**
 * contract_sync.mjs — vendors an OpenAPI contract into a consumer repo at a
 * pinned commit and regenerates that repo's client code.
 *
 * Usage:
 *   node contract_sync.mjs check  [--contract <name>] [--no-cache] [--json]
 *   node contract_sync.mjs verify [--contract <name>]
 *   node contract_sync.mjs sync   [--contract <name>]
 *   node contract_sync.mjs bump <ref> [--contract <name>] [--file <path>]
 *
 * The contracts repo is the single source of truth; this script is the ONLY
 * writer of the vendored spec and of api-contract.lock. Manual edits to either
 * are denied by a PreToolUse guard in-session and caught by a CI drift job at
 * merge time — see SPEC-contract-sync.md §7.
 *
 * Node ≥20 stdlib only (fetch, node:crypto, node:fs, node:child_process).
 * Exit codes: 0 ok, 1 runtime failure, 2 bad usage/args.
 *
 * Two rules this file exists to enforce, both of which fail silently if broken:
 *   - A tag that no longer resolves to the SHA in the lock is a HARD FAILURE.
 *     Tags move; a silent re-resolve would vendor a different contract under
 *     the same version number and nothing downstream would notice.
 *   - The fetched blob is checksummed BEFORE anything is written. A mismatch
 *     aborts with the repo untouched — never a half-written spec next to a
 *     stale generated client.
 *
 * The token is read but never printed: no logging, no echoing into an error
 * message, never written to the lock.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const LOCK_NAME = 'api-contract.lock'
const CACHE_REL = join('.claude', 'memory', 'contract-sync-check.json')
const UA = 'bigin-contract-sync'

// Test seam. The regression suite serves fixtures from a loopback HTTP server so
// the suite needs no network and no credentials. Deliberately restricted to
// loopback: an env var that could repoint a credentialed fetch at an arbitrary
// host would be both a token-leak surface and, for `bump` (which records
// whatever it fetches rather than verifying it), a blob-injection surface.
const API_BASE = (() => {
  const raw = process.env.CONTRACT_SYNC_API
  if (!raw) return 'https://api.github.com'
  let u
  try {
    u = new URL(raw)
  } catch {
    fail('CONTRACT_SYNC_API is not a URL', 2)
  }
  if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(u.hostname)) {
    fail(`CONTRACT_SYNC_API may only point at loopback (got ${u.hostname})`, 2)
  }
  return raw.replace(/\/$/, '')
})()

// C5: the SessionStart notice must not hold up a session, so `check` is bounded
// hard. `sync`/`bump` are interactive or CI and fetch a whole spec file, so they
// get a realistic budget — the 1500 ms cap was never about them.
const CHECK_TIMEOUT_MS = 1500
const SYNC_TIMEOUT_MS = 15_000

// `check` caches so repeated runs in one session cost one network call. The hook
// calls it once per session anyway; the TTL is what makes that true for a human
// running it by hand too.
const CACHE_TTL_MS = 15 * 60 * 1000

// ── adapters ────────────────────────────────────────────────────────────
//
// Corrected against the shipped profiles and scaffolders (SPEC-contract-sync.md
// §6, correction C2) — every row of the original draft named an output this repo
// does not produce. The vendored path differs per type and is NEVER hardcoded
// elsewhere (C3).
//
// The command is always the repo's OWN pinned tool. This script carries no
// codegen logic: it writes the spec, then shells out. `mobile` points at a repo
// script because the pinned openapi-generator Docker invocation belongs to the
// flutter profile, not here.

const ADAPTERS = {
  api: {
    marker: 'go.mod',
    spec: 'openapi.yaml',
    multiDir: 'openapi',
    cmd: ['make', ['generate']]
  },
  web: {
    marker: ['nuxt.config.ts', 'nuxt.config.js'],
    spec: 'openapi.yaml',
    multiDir: 'openapi',
    cmd: ['pnpm', ['openapi-types']]
  },
  mobile: {
    marker: 'pubspec.yaml',
    spec: join('api', 'openapi.yaml'),
    multiDir: join('api', 'openapi'),
    cmd: ['sh', [join('tool', 'generate_api.sh')]]
  }
}

// A repo consuming exactly one contract vendors it at the adapter's single path —
// which is what every shipped profile's codegen config already points at. A repo
// consuming several cannot: one path cannot hold two specs, and silently letting
// the second overwrite the first is the defect this function exists to prevent.
// Multiples go to <multiDir>/<name>.yaml, and that repo's own codegen config has
// to point there — the script writes the files, it never rewrites their config.
function vendoredPath(repoType, name, total) {
  const a = ADAPTERS[repoType]
  return total === 1 ? a.spec : join(a.multiDir, `${name}.yaml`)
}

// ── output ──────────────────────────────────────────────────────────────

function fail(msg, code = 1) {
  console.error(`[contract-sync] ERROR: ${msg}`)
  process.exit(code)
}

function info(msg) {
  console.log(`[contract-sync] ${msg}`)
}

// ── repo ────────────────────────────────────────────────────────────────

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    // Not a git repo (or no git): walk up looking for the lock instead.
    let dir = process.cwd()
    for (;;) {
      if (existsSync(join(dir, LOCK_NAME))) return dir
      const up = dirname(dir)
      if (up === dir) return process.cwd()
      dir = up
    }
  }
}

function detectRepoType(root, override) {
  if (override) {
    if (!ADAPTERS[override]) {
      fail(`unknown --repo-type '${override}' (expected: ${Object.keys(ADAPTERS).join(', ')})`, 2)
    }
    return override
  }
  const hits = Object.entries(ADAPTERS).filter(([, a]) => {
    const markers = Array.isArray(a.marker) ? a.marker : [a.marker]
    return markers.some(m => existsSync(join(root, m)))
  })
  if (hits.length === 1) return hits[0][0]
  if (hits.length === 0) {
    fail(
      'could not tell what kind of consumer repo this is — no go.mod, nuxt.config.* or '
      + 'pubspec.yaml at the repo root. Pass --repo-type api|web|mobile.'
    )
  }
  fail(
    `this repo matches more than one consumer type (${hits.map(h => h[0]).join(', ')}). `
    + 'Pass --repo-type to say which one it is.'
  )
}

// The consumer's own "owner/name", for finding an open sync PR. Best-effort:
// every caller treats a null as "just don't mention PRs".
function originSlug(root) {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    const m = url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

// ── lock ────────────────────────────────────────────────────────────────

function lockPath(root) {
  return join(root, LOCK_NAME)
}

function loadLock(root) {
  const p = lockPath(root)
  if (!existsSync(p)) {
    fail(`no ${LOCK_NAME} at ${root} — this is not a consumer repo, or it has not been set up yet.`)
  }
  let parsed
  try {
    parsed = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    fail(`${LOCK_NAME} is not valid JSON: ${e.message}`)
  }
  const contracts = parsed?.contracts
  if (!contracts || typeof contracts !== 'object' || Object.keys(contracts).length === 0) {
    fail(`${LOCK_NAME} has no "contracts" entries`)
  }
  for (const [name, entry] of Object.entries(contracts)) {
    for (const field of ['repo', 'file', 'ref']) {
      if (typeof entry?.[field] !== 'string' || entry[field].length === 0) {
        fail(`${LOCK_NAME}: contract "${name}" is missing "${field}"`)
      }
    }
  }
  return parsed
}

function saveLock(root, lock) {
  writeFileSync(lockPath(root), `${JSON.stringify(lock, null, 2)}\n`)
}

function pickContracts(lock, wanted, command) {
  const names = Object.keys(lock.contracts)
  if (!wanted) {
    if (command === 'bump' && names.length > 1) {
      fail(`${LOCK_NAME} holds ${names.length} contracts (${names.join(', ')}) — pass --contract to say which to bump.`, 2)
    }
    return names
  }
  if (!lock.contracts[wanted]) {
    fail(`no contract named "${wanted}" in ${LOCK_NAME} (have: ${names.join(', ')})`, 2)
  }
  return [wanted]
}

// ── auth ────────────────────────────────────────────────────────────────
//
// GITHUB_TOKEN, then `gh auth token`, then unauthenticated. Decided 2026-09-08;
// nothing in this plugin fetched anything or shelled out to `gh` before, so this
// is a new convention either way and `gh` is a documented prerequisite.
// The value is returned and used — never printed, never stored.

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

// ── github ──────────────────────────────────────────────────────────────

class Unreachable extends Error {}

async function gh(path, { raw = false, timeout = SYNC_TIMEOUT_MS, auth } = {}) {
  const headers = {
    'user-agent': UA,
    accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28'
  }
  if (auth) headers.authorization = `Bearer ${auth}`

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers, signal: AbortSignal.timeout(timeout)
    })
  } catch (e) {
    // Offline, DNS failure, or the timeout tripping. Deliberately does not
    // include the caught message verbatim in the auth case — nothing here ever
    // risks surfacing a header value.
    throw new Unreachable(e.name === 'TimeoutError' ? `timed out after ${timeout} ms` : 'network unreachable')
  }
  if (res.status === 401 || res.status === 403) {
    throw new Unreachable(
      res.status === 401
        ? 'GitHub rejected the credentials (401)'
        : 'GitHub refused the request (403) — rate limit, or the token cannot see this repo'
    )
  }
  if (res.status === 404) {
    const err = new Error(`not found: ${path}`)
    err.notFound = true
    throw err
  }
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${path}`)
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json()
}

// Resolves a tag, branch or SHA to a commit SHA. Uses the commits endpoint
// rather than git/refs on purpose: it dereferences annotated tags for us, which
// the refs endpoint does not.
async function resolveRef(repo, ref, opts) {
  const data = await gh(`/repos/${repo}/commits/${encodeURIComponent(ref)}`, opts)
  if (!data?.sha) throw new Error(`could not resolve ${ref} in ${repo}`)
  return data.sha
}

async function fetchBlob(repo, file, commit, opts) {
  const path = file.split('/').map(encodeURIComponent).join('/')
  return gh(`/repos/${repo}/contents/${path}?ref=${commit}`, { ...opts, raw: true })
}

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

// GitHub does not promise the tags list is ordered, so sort it ourselves rather
// than trusting position 0. Prereleases rank below the release they precede, and
// are only ever chosen when nothing else exists.
async function latestTag(repo, opts) {
  const tags = await gh(`/repos/${repo}/tags?per_page=100`, opts)
  const parsed = []
  for (const t of tags ?? []) {
    const m = String(t.name).match(SEMVER)
    if (m) parsed.push({ name: t.name, n: [+m[1], +m[2], +m[3]], pre: m[4] ?? null })
  }
  if (parsed.length === 0) return null
  parsed.sort((a, b) => {
    for (let i = 0; i < 3; i++) if (a.n[i] !== b.n[i]) return b.n[i] - a.n[i]
    if (a.pre === b.pre) return 0
    if (a.pre === null) return -1
    if (b.pre === null) return 1
    return a.pre < b.pre ? 1 : -1
  })
  return parsed[0].name
}

async function openBumpPr(slug, opts) {
  if (!slug) return null
  try {
    const prs = await gh(`/repos/${slug}/pulls?state=open&per_page=50`, opts)
    const hit = (prs ?? []).find(p => String(p.head?.ref ?? '').startsWith('contract-bump/'))
    return hit ? hit.number : null
  } catch {
    return null // best-effort: a missing PR line is never worth failing over
  }
}

// ── hashing + writing ───────────────────────────────────────────────────

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

// Write via a temp file in the same directory, then rename. A crash mid-write
// leaves the old spec intact rather than a truncated one.
function writeAtomic(target, buf) {
  mkdirSync(dirname(target), { recursive: true })
  const tmp = `${target}.contract-sync.tmp`
  try {
    writeFileSync(tmp, buf)
    renameSync(tmp, target)
  } catch (e) {
    rmSync(tmp, { force: true })
    throw e
  }
}

// Checked BEFORE anything is written. A repo whose codegen entry point is missing
// must fail with the spec untouched — vendoring a new contract and then failing to
// regenerate leaves precisely the lock/spec/code drift this skill exists to make
// impossible, and the CI job would only catch it one commit later.
function assertCodegenReady(root, repoType) {
  if (repoType === 'mobile' && !existsSync(join(root, 'tool', 'generate_api.sh'))) {
    fail(
      'the mobile adapter needs tool/generate_api.sh (the pinned openapi-generator dart-dio '
      + 'invocation, owned by the flutter profile) and this repo has none. Nothing was written.'
    )
  }
  if (repoType === 'api' && !existsSync(join(root, 'Makefile'))) {
    fail('the api adapter runs `make generate` and this repo has no Makefile. Nothing was written.')
  }
  if (repoType === 'web') {
    try {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
      if (!pkg?.scripts?.['openapi-types']) {
        fail('the web adapter runs `pnpm openapi-types` and package.json declares no such script. Nothing was written.')
      }
    } catch (e) {
      if (e?.code === 'ENOENT') fail('the web adapter needs a package.json and this repo has none. Nothing was written.')
      throw e
    }
  }
}

function runCodegen(root, repoType) {
  const [bin, args] = ADAPTERS[repoType].cmd
  info(`running codegen: ${bin} ${args.join(' ')}`)
  // pnpm is a .cmd shim on Windows; make/sh are not. Only pay for a shell there.
  const r = spawnSync(bin, args, {
    cwd: root, stdio: 'inherit', shell: process.platform === 'win32'
  })
  if (r.error) fail(`codegen could not start (${bin}): ${r.error.message}`)
  if (r.status !== 0) fail(`codegen failed (${bin} ${args.join(' ')}) — exit ${r.status}`)
}

// ── cache ───────────────────────────────────────────────────────────────

function readCache(root) {
  try {
    const c = JSON.parse(readFileSync(join(root, CACHE_REL), 'utf8'))
    if (Date.now() - c.at > CACHE_TTL_MS) return null
    return c
  } catch {
    return null
  }
}

function writeCache(root, payload) {
  try {
    const p = join(root, CACHE_REL)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, `${JSON.stringify({ at: Date.now(), ...payload }, null, 2)}\n`)
  } catch {
    // A repo without .claude/ still gets a correct answer, just an uncached one.
  }
}

// ── commands ────────────────────────────────────────────────────────────

async function cmdCheck(root, lock, names, flags) {
  if (!flags['no-cache']) {
    const cached = readCache(root)
    if (cached?.lines) {
      for (const l of cached.lines) console.log(l)
      return 0
    }
  }

  const auth = token()
  const opts = { timeout: CHECK_TIMEOUT_MS, auth }
  const slug = originSlug(root)
  const lines = []

  for (const name of names) {
    const c = lock.contracts[name]
    const pinned = c.commit ? ` (${c.commit.slice(0, 7)})` : ''
    try {
      const latest = await latestTag(c.repo, opts)
      const pr = await openBumpPr(slug, opts)
      let line = `${name}: lock ${c.ref}${pinned}`
      if (latest && latest !== c.ref) line += ` — latest ${latest}`
      else if (latest) line += ' — up to date'
      if (pr) line += `; sync PR #${pr} open`
      lines.push(line)
    } catch (e) {
      if (e instanceof Unreachable) {
        // Offline, unauthenticated or timed out: say so once, in one line, and
        // exit 0. A session must never be held up or interrupted by this.
        lines.push(`${name}: lock ${c.ref}${pinned} — staleness check skipped (${e.message})`)
      } else if (e.notFound) {
        lines.push(`${name}: lock ${c.ref}${pinned} — cannot see ${c.repo} (not found)`)
      } else {
        lines.push(`${name}: lock ${c.ref}${pinned} — staleness check skipped (${e.message})`)
      }
    }
  }

  for (const l of lines) console.log(l)
  writeCache(root, { lines })
  return 0
}

// Offline integrity check: does the vendored spec on disk still hash to what the
// lock recorded? No network, no token, milliseconds — which is what makes it usable
// as a pre-commit gate.
//
// This exists because the PreToolUse guard only sees edits made THROUGH an agent.
// A human with an editor bypasses it entirely, and before this the only thing that
// caught them was a CI job. A repo with no CI had no check at all.
function cmdVerify(root, lock, names, repoType) {
  const total = Object.keys(lock.contracts).length
  const problems = []
  for (const name of names) {
    const c = lock.contracts[name]
    const rel = vendoredPath(repoType, name, total)
    const path = join(root, rel)
    if (!existsSync(path)) {
      problems.push(`${rel} is missing — run \`sync\` to restore it from ${c.repo}`)
      continue
    }
    if (!/^[0-9a-f]{64}$/i.test(c.sha256 ?? '')) {
      problems.push(`${LOCK_NAME} has no usable sha256 for "${name}" — run \`bump ${c.ref}\``)
      continue
    }
    const got = sha256(readFileSync(path))
    if (got !== c.sha256.toLowerCase()) {
      problems.push(
        `${rel} does not match ${LOCK_NAME}\n`
        + `      lock expects: ${c.sha256}\n`
        + `      file on disk: ${got}\n`
        + '      Someone edited the vendored contract by hand. Revert it (`sync`), or take the '
        + 'change to the contracts repo where it belongs.'
      )
    }
  }
  if (problems.length === 0) {
    info(`vendored contract matches the lock (${names.length} contract${names.length === 1 ? '' : 's'})`)
    return 0
  }
  for (const p of problems) console.error(`[contract-sync] ERROR: ${p}`)
  process.exit(1)
}

async function cmdSync(root, lock, names, repoType) {
  const auth = token()
  if (!auth) {
    fail(
      'no credentials: set GITHUB_TOKEN or run `gh auth login`. '
      + '(`check` degrades quietly without a token; `sync` must not.)'
    )
  }
  assertCodegenReady(root, repoType)
  const total = Object.keys(lock.contracts).length

  for (const name of names) {
    const specRel = vendoredPath(repoType, name, total)
    const c = lock.contracts[name]
    // Shape, not presence. The lock template ships descriptive placeholders
    // ("<sha recorded by contract_sync.mjs bump>") which are perfectly truthy, so a
    // presence check sails past them and the run dies later with a confusing
    // "could not resolve <ref>" instead of the one instruction that helps.
    if (!/^[0-9a-f]{40}$/i.test(c.commit ?? '') || !/^[0-9a-f]{64}$/i.test(c.sha256 ?? '')) {
      fail(
        `contract "${name}" has no usable commit/sha256 in ${LOCK_NAME} — run `
        + `\`node scripts/contract_sync.mjs bump ${c.ref}\` first, which records both.`
      )
    }

    let resolved
    try {
      resolved = await resolveRef(c.repo, c.ref, { auth })
    } catch (e) {
      fail(`could not resolve ${c.ref} in ${c.repo}: ${e.message}`)
    }
    // The rule this whole script exists for. A moved tag is never absorbed.
    if (resolved !== c.commit) {
      fail(
        `the tag ${c.ref} in ${c.repo} has MOVED.\n`
        + `  lock records: ${c.commit}\n`
        + `  ${c.ref} now resolves to: ${resolved}\n`
        + 'Refusing to sync. A version number now points at different bytes — take this to '
        + 'the contracts repo rather than re-pinning past it.'
      )
    }

    let blob
    try {
      blob = await fetchBlob(c.repo, c.file, c.commit, { auth })
    } catch (e) {
      fail(`could not fetch ${c.file} at ${c.commit.slice(0, 7)} from ${c.repo}: ${e.message}`)
    }

    const got = sha256(blob)
    // Verified BEFORE any write — a mismatch must leave the repo untouched.
    if (got !== c.sha256) {
      fail(
        `checksum mismatch for ${name} — nothing was written.\n`
        + `  lock expects: ${c.sha256}\n`
        + `  fetched blob: ${got}`
      )
    }

    writeAtomic(join(root, specRel), blob)
    info(`${name}: vendored ${c.file}@${c.commit.slice(0, 7)} → ${specRel}`)
  }

  runCodegen(root, repoType)
  info('done — review the type diff before committing')
  return 0
}

async function cmdBump(root, lock, names, repoType, ref, fileOverride) {
  const auth = token()
  if (!auth) fail('no credentials: set GITHUB_TOKEN or run `gh auth login`.')

  assertCodegenReady(root, repoType)
  const name = names[0]
  const specRel = vendoredPath(repoType, name, Object.keys(lock.contracts).length)
  const c = lock.contracts[name]
  const file = fileOverride ?? c.file

  let resolved
  try {
    resolved = await resolveRef(c.repo, ref, { auth })
  } catch (e) {
    fail(`could not resolve ${ref} in ${c.repo}: ${e.message}`)
  }

  let blob
  try {
    blob = await fetchBlob(c.repo, file, resolved, { auth })
  } catch (e) {
    if (e.notFound) fail(`${c.repo} has no ${file} at ${ref} (${resolved.slice(0, 7)})`)
    fail(`could not fetch ${file} at ${ref}: ${e.message}`)
  }

  // bump RECORDS the checksum rather than verifying against one — there is
  // nothing to verify against yet. Deliberately does not re-run `sync`
  // afterwards: that would re-resolve and re-fetch the same two things for an
  // identical result. Every later `sync` verifies against what is written here.
  const digest = sha256(blob)

  writeAtomic(join(root, specRel), blob)
  lock.contracts[name] = { ...c, file, ref, commit: resolved, sha256: digest }
  saveLock(root, lock)
  info(`${name}: ${c.ref} → ${ref} (${resolved.slice(0, 7)}), ${file} → ${specRel}`)

  runCodegen(root, repoType)
  info('done — lock, spec and generated code are one commit')
  return 0
}

// ── main ────────────────────────────────────────────────────────────────

const USAGE = `Usage:
  contract_sync.mjs check  [--contract <name>] [--no-cache] [--repo-type api|web|mobile]
  contract_sync.mjs verify [--contract <name>] [--repo-type api|web|mobile]   (offline)
  contract_sync.mjs sync   [--contract <name>] [--repo-type api|web|mobile]
  contract_sync.mjs bump <ref> [--contract <name>] [--file <path>] [--repo-type api|web|mobile]`

async function main() {
  let values, positionals
  try {
    ;({ values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        contract: { type: 'string' },
        file: { type: 'string' },
        'repo-type': { type: 'string' },
        'no-cache': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false }
      }
    }))
  } catch (e) {
    fail(`bad arguments: ${e.message}\n${USAGE}`, 2)
  }

  const command = positionals[0]
  if (values.help || !command) {
    console.log(USAGE)
    process.exit(values.help ? 0 : 2)
  }
  if (!['check', 'verify', 'sync', 'bump'].includes(command)) {
    fail(`unknown command "${command}"\n${USAGE}`, 2)
  }

  const root = repoRoot()
  const lock = loadLock(root)
  const names = pickContracts(lock, values.contract, command)

  if (command === 'check') {
    // check never needs to know the repo type — it writes nothing.
    process.exit(await cmdCheck(root, lock, names, values))
  }

  const repoType = detectRepoType(root, values['repo-type'])

  if (command === 'verify') process.exit(cmdVerify(root, lock, names, repoType))
  if (command === 'sync') process.exit(await cmdSync(root, lock, names, repoType))

  const ref = positionals[1]
  if (!ref) fail(`bump needs a ref\n${USAGE}`, 2)
  process.exit(await cmdBump(root, lock, names, repoType, ref, values.file))
}

main().catch((e) => fail(e?.message ?? String(e)))
