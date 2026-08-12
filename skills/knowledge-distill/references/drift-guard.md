# Drift guard

A distilled bundle is pinned to one version. The dependency it describes is not. When they
diverge, agents read confident, accurate-looking documentation for a version the repo no longer
uses — the exact failure the bundle was built to prevent, now with a provenance header that
makes it look trustworthy.

`tools/knowledge_drift.mjs` compares each bundle's `version` against the version **declared** in
`package.json` or `go.mod` and fails on a minor-or-above divergence.

Declared, not locked: lockfile formats are `pnpm-lock.yaml` (needs a YAML parser),
`package-lock.json`, `yarn.lock`, `go.sum` — four parsers and a dependency, for a signal the
declared range already gives. A patch-level move doesn't change an API surface; a minor does.

**Escape hatch.** A team that knows the bundle is one minor behind and has decided that's fine
sets `drift_ack: <declared-version>` in the bundle's `pin.md` frontmatter. It suppresses the
failure for that exact declared version and nothing else — bump the dependency again and the
guard fires again. It lives in the file being acknowledged, shows up in the diff, and Phase 3
of a re-distill deletes it. Without it, the only way past a failing hook is `--no-verify`,
which `bash-guard.mjs` blocks outright.

## Install

Written by `knowledge-distill` Phase 3, once per repo. The two steps are checked independently,
so a run interrupted between them completes on the next distill rather than leaving a script
that nothing ever calls:

1. If `tools/knowledge_drift.mjs` doesn't exist, write the script below to it. Zero-dependency
   Node — no chmod, no package install.
2. If the repo's pre-commit script doesn't already run it, add `node tools/knowledge_drift.mjs`
   immediately after the `node tools/knowledge_validate.mjs` step. If the repo uses
   `simple-git-hooks` or `husky` instead of a generated `scripts/pre-commit.sh`, add it to that
   config next to the validator.

`bigin-harness-setup` deliberately does **not** install this guard, and no CHANGELOG `patch`
block ships it: the guard is meaningless until a library bundle exists, and `knowledge-distill`
is the only thing that creates one. Shipping it via patch mode would put an unwired script in
every scaffolded repo.

## tools/knowledge_drift.mjs

```javascript
#!/usr/bin/env node
// Fail when a distilled library bundle's pinned version has drifted from the version the
// project declares. Compares knowledge/libraries/*/pin.md frontmatter (`library`, `version`)
// against package.json dependencies or go.mod requires. Patch-level drift passes; minor and
// major fail. `drift_ack: <declared-version>` in a bundle's frontmatter suppresses that one.
// Pre-v0.2 bundles kept the pin in index.md; that is still read, with a warning.
// Zero dependencies — runs on any Node >= 18 (macOS, Linux, Windows).
// Usage: node tools/knowledge_drift.mjs [--root knowledge]
// Exit codes: 0 ok (or nothing to check), 1 drift found.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BUNDLE_ROOT = 'knowledge'

// Top-level `key: value` only — the keys this guard reads are all scalars.
function frontmatterScalars(raw) {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  if (!text.startsWith('---')) return {}
  const end = text.indexOf('\n---', 3)
  if (end === -1) return {}
  const meta = {}
  for (const line of text.slice(text.indexOf('\n') + 1, end).split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === '\'' && value.at(-1) === '\''))) {
      value = value.slice(1, -1)
    }
    meta[kv[1]] = value
  }
  return meta
}

// '^4.0.3' / 'v5.5.1' / '>= 2.1.0' -> {major, minor, text}.
// Returns null for anything that pins nothing comparable: compound ranges, '1.x', 'latest',
// 'workspace:*', file/git specifiers.
function normalize(spec) {
  if (typeof spec !== 'string') return null
  const bare = spec.trim().replace(/^[\^~><=]+\s*/, '')
  if (/\s|\|\|/.test(bare)) return null
  const m = bare.replace(/^v/, '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), text: m[0] }
}

function declaredVersions() {
  const declared = new Map()

  if (existsSync('package.json')) {
    let pkg
    try {
      pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    } catch {
      pkg = null
    }
    if (pkg) {
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
          if (!declared.has(name)) declared.set(name, String(spec))
        }
      }
    }
  }

  if (existsSync('go.mod')) {
    let inBlock = false
    for (const raw of readFileSync('go.mod', 'utf-8').split('\n')) {
      const line = raw.replace(/\/\/.*$/, '').trim()
      if (!line) continue
      if (/^require\s*\($/.test(line)) {
        inBlock = true
        continue
      }
      if (inBlock && line === ')') {
        inBlock = false
        continue
      }
      const single = line.match(/^require\s+(\S+)\s+(\S+)$/)
      if (single) {
        if (!declared.has(single[1])) declared.set(single[1], single[2])
        continue
      }
      if (inBlock) {
        const entry = line.match(/^(\S+)\s+(\S+)/)
        if (entry && !declared.has(entry[1])) declared.set(entry[1], entry[2])
      }
    }
  }

  return declared
}

function bundles(root) {
  const dir = join(root, 'libraries')
  let entries
  try {
    if (!statSync(dir).isDirectory()) return []
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const found = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    // OKF v0.2 moved the pin out of the reserved index.md into pin.md. Fall back to the
    // old location so a bundle distilled before the move still gets drift-checked.
    const pin = join(dir, entry.name, 'pin.md')
    const legacy = join(dir, entry.name, 'index.md')
    const path = existsSync(pin) ? pin : legacy
    if (!existsSync(path)) continue
    found.push({ path, legacy: path === legacy, meta: frontmatterScalars(readFileSync(path, 'utf-8')) })
  }
  return found.sort((a, b) => (a.path < b.path ? -1 : 1))
}

function main() {
  const argv = process.argv.slice(2)
  let root = BUNDLE_ROOT
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i]
    else if (argv[i].startsWith('--root=')) root = argv[i].slice('--root='.length)
  }

  const found = bundles(root)
  if (found.length === 0) return 0

  const declared = declaredVersions()
  const errors = []
  const warnings = []
  let checked = 0

  for (const { path, legacy, meta } of found) {
    if (!meta.library || !meta.version) {
      warnings.push(legacy
        ? `${path}: no pin.md in this bundle and index.md carries no 'library'/'version' — cannot check drift`
        : `${path}: missing 'library' or 'version' frontmatter — cannot check drift`)
      continue
    }
    if (legacy) {
      warnings.push(`${path}: pin still lives in the reserved index.md — move it to pin.md (OKF v0.2)`)
    }
    if (!declared.has(meta.library)) {
      warnings.push(`${path}: '${meta.library}' is not a declared dependency — nothing to compare`)
      continue
    }

    const bundled = normalize(meta.version)
    const project = normalize(declared.get(meta.library))
    if (!bundled) {
      warnings.push(`${path}: bundle version '${meta.version}' is not a comparable version`)
      continue
    }
    if (!project) {
      warnings.push(`${path}: declared '${meta.library}' version '${declared.get(meta.library)}' is a range or specifier — cannot compare`)
      continue
    }

    checked++
    if (bundled.major === project.major && bundled.minor === project.minor) continue

    if (meta.drift_ack && normalize(meta.drift_ack)?.text === project.text) continue

    errors.push(
      `${path}: bundle pinned to ${meta.library}@${bundled.text} but the project declares ` +
      `${project.text} — re-distill or re-pin (or set 'drift_ack: ${project.text}' to accept it)`
    )
  }

  for (const msg of errors) console.log(`ERROR ${msg}`)
  for (const msg of warnings) console.log(`WARN ${msg}`)

  if (errors.length) {
    console.log(`\n${errors.length} bundle(s) drifted, ${warnings.length} warning(s)`)
    return 1
  }
  console.log(`\nOK ${checked} bundle(s) in sync, ${warnings.length} warning(s)`)
  return 0
}

process.exit(main())
```
