# Knowledge Bundle migration — OKF v0.1 → v0.2

One-shot migrator for repos scaffolded before v1.62.0. **Not part of the Phase 5.5 install
list** — a fresh bundle is already on v0.2, so never write this into a new scaffold. It ships
to existing repos through the v1.62.0 CHANGELOG `create-if-missing` patch block, and is written
by hand into a repo that patch mode skipped.

## What it fixes

The v1.62.0 format change is soft in one direction and hard in the other:

- **Soft:** an untouched v0.1 bundle still validates (exit 0, warnings only). Nothing breaks
  at commit time, so a team can migrate whenever.
- **Hard:** a library bundle's pin lived in `libraries/<lib>/index.md` frontmatter, and v0.2
  reserves that file. Until the pin moves to `pin.md`, `knowledge_drift.mjs` is reading it out
  of the legacy location on a fallback path, and a re-distill would write a *second* pin next
  to the old one.

## Running it

```bash
node tools/knowledge_migrate_okf.mjs          # dry run — prints the plan, writes nothing
node tools/knowledge_migrate_okf.mjs --write  # apply
node tools/knowledge_validate.mjs             # confirm, and see what's left
```

It is idempotent: a second run on a migrated bundle reports nothing to do. It never touches a
bundle that already has `pin.md`.

## What it does and doesn't touch

| Transform | Handled |
|---|---|
| `libraries/<lib>/index.md` pin frontmatter → `pin.md` (`type: Contract`) | yes |
| Link `pin.md` from the library index, so it isn't unreachable | yes |
| Legacy `distilled`/`timestamp` → `generated: { by, at }` | yes |
| Legacy `verified: <date>` → one `{ by: process:knowledge-auditor, at }` event | yes |
| `source_repo` + `source_commit` → a `sources` entry pinned to the SHA | yes |
| Strip frontmatter from reserved `index.md` / `log.md`; keep `okf_version` at bundle root | yes |
| Per-concept `timestamp` → `generated` on ordinary concept files | **no** — validator warns |
| `# Citations` body sections → `sources` frontmatter | **no** — validator warns |

The last two are deliberate. Both need a judgment call the script can't make — who the author
was, which source backs which claim — and both are warnings, not failures. Migrate them by hand
as each file is next edited, or let a re-distill rewrite them.

`process:knowledge-auditor` is the honest actor for a migrated `verified` date: the legacy key
recorded that a clean audit passed, but not which model ran it. It still reads as
machine-confirmed rather than human-reviewed, which is what it was.

## tools/knowledge_migrate_okf.mjs

```javascript
#!/usr/bin/env node
// One-shot migration of an existing knowledge/ bundle from the OKF v0.1 layout to v0.2.
// Two transforms, both idempotent:
//   1. Library pins move out of the reserved libraries/<lib>/index.md into a sibling pin.md.
//   2. Reserved files (index.md, log.md) drop their frontmatter; the bundle-root index.md
//      keeps only okf_version.
// Legacy `timestamp`/`distilled` become generated.at, and a legacy `verified: <date>` becomes
// one verified event. Body prose is never touched, and `# Citations` sections are left alone —
// the validator warns on those, and rewriting prose is not this script's job.
// Zero dependencies — runs on any Node >= 18 (macOS, Linux, Windows).
// Usage: node tools/knowledge_migrate_okf.mjs [--root knowledge] [--write]
// Defaults to a dry run; pass --write to apply. Exit codes: 0 ok, 1 nothing parseable.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BUNDLE_ROOT = 'knowledge'

// Keys that belong to the pin, in the order they should appear in pin.md.
const PIN_KEYS = [
  'library', 'version', 'source_repo', 'source_commit',
  'docs_path', 'conventions_blended', 'drift_ack'
]

// Legacy pins were flat by construction — the v0.1 parser had no nested-map support — so a
// scalar/inline-array reader is sufficient here.
function splitFrontmatter(raw) {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  if (!text.startsWith('---')) return { meta: null, header: '', body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { meta: null, header: '', body: text }
  const header = text.slice(text.indexOf('\n') + 1, end)
  const bodyStart = text.indexOf('\n', end + 1)
  const body = bodyStart === -1 ? '' : text.slice(bodyStart + 1)

  const meta = {}
  for (const line of header.split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (value.length >= 2 && ((value[0] === '"' && value.at(-1) === '"') || (value[0] === '\'' && value.at(-1) === '\''))) {
      value = value.slice(1, -1)
    }
    meta[kv[1]] = value
  }
  return { meta, header, body }
}

function buildPin(meta) {
  const library = meta.library ?? 'unknown'
  const version = meta.version ?? 'unknown'
  const lines = ['---', 'type: Contract']
  lines.push(`title: ${meta.title ?? `${library} ${version} Pin`}`)
  lines.push(`description: ${meta.description ?? `What this bundle is pinned to, and the provenance of every claim in it.`}`)
  const tags = meta.tags && meta.tags !== '[]' ? meta.tags.replace(/]$/, ', pin]') : `[library, ${library}, pin]`
  lines.push(`tags: ${tags}`)
  lines.push('status: stable')
  for (const key of PIN_KEYS) {
    if (meta[key] !== undefined) lines.push(`${key}: ${meta[key]}`)
  }

  const generatedAt = meta.distilled ?? meta.timestamp
  if (generatedAt) lines.push(`generated: { by: process:knowledge-distill, at: ${generatedAt} }`)

  // A legacy `verified: <date>` recorded that a clean audit passed, but not which model ran
  // it. process:knowledge-auditor keeps that honest — machine-confirmed, actor unspecified.
  if (meta.verified) {
    lines.push('verified:')
    lines.push(`  - { by: process:knowledge-auditor, at: ${meta.verified} }`)
  }

  if (meta.source_repo) {
    const tree = meta.source_commit
      ? `https://${meta.source_repo.replace(/^https?:\/\//, '')}/tree/${meta.source_commit}`
      : `https://${meta.source_repo.replace(/^https?:\/\//, '')}`
    lines.push('sources:')
    lines.push('  - id: repo')
    lines.push(`    resource: ${tree}`)
    lines.push(`    title: ${meta.source_repo} @ ${version}`)
    if (generatedAt) lines.push(`    last_modified: ${String(generatedAt).slice(0, 10)}`)
  }

  lines.push('---', '', `# ${library} ${version} Pin`, '')
  lines.push(`This bundle describes \`${library}\` at \`${version}\`. Re-distill with \`/knowledge-distill\` to move the pin.`)
  return lines.join('\n') + '\n'
}

// The index must link pin.md or the validator reports it unreachable.
function linkPin(body, library) {
  if (/\(\/libraries\/[^)]*\/pin\.md\)/.test(body)) return body
  const link = `* [Pin](/libraries/${library}/pin.md) - what this bundle is pinned to, and its provenance`
  const lines = body.split('\n')
  const heading = lines.findIndex(line => /^#\s/.test(line))
  if (heading === -1) return `${link}\n\n${body}`
  lines.splice(heading + 1, 0, '', link)
  return lines.join('\n')
}

function migrateLibraries(root, changes) {
  const dir = join(root, 'libraries')
  let entries
  try {
    if (!statSync(dir).isDirectory()) return
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const indexPath = join(dir, entry.name, 'index.md')
    const pinPath = join(dir, entry.name, 'pin.md')
    if (!existsSync(indexPath)) continue
    if (existsSync(pinPath)) continue

    const { meta, body } = splitFrontmatter(readFileSync(indexPath, 'utf-8'))
    if (!meta || (!meta.library && !meta.version)) continue

    changes.push({ path: pinPath, content: buildPin(meta), what: 'create pin.md from index.md frontmatter' })
    changes.push({
      path: indexPath,
      content: linkPin(body.replace(/^\n+/, ''), meta.library ?? entry.name),
      what: 'strip frontmatter, link pin.md'
    })
  }
}

function migrateReserved(root, changes) {
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (entry.name !== 'index.md' && entry.name !== 'log.md') continue
      // Library indexes are handled by migrateLibraries, which also adds the pin link.
      if (/libraries[/\\][^/\\]+[/\\]index\.md$/.test(full)) continue

      const { meta, body } = splitFrontmatter(readFileSync(full, 'utf-8'))
      if (!meta) continue

      const isRootIndex = full === join(root, 'index.md')
      const keys = Object.keys(meta)
      if (isRootIndex && keys.length === 1 && keys[0] === 'okf_version') continue

      const kept = isRootIndex ? `---\nokf_version: "0.2"\n---\n\n` : ''
      changes.push({
        path: full,
        content: kept + body.replace(/^\n+/, ''),
        what: isRootIndex ? 'reduce frontmatter to okf_version' : 'strip frontmatter'
      })
    }
  }
  walk(root)
}

function main() {
  const argv = process.argv.slice(2)
  let root = BUNDLE_ROOT
  let write = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i]
    else if (argv[i].startsWith('--root=')) root = argv[i].slice('--root='.length)
    else if (argv[i] === '--write') write = true
  }

  try {
    if (!statSync(root).isDirectory()) throw new Error('not a directory')
  } catch {
    console.log(`ERROR ${root}: bundle root does not exist`)
    return 1
  }

  const changes = []
  migrateLibraries(root, changes)
  migrateReserved(root, changes)

  if (changes.length === 0) {
    console.log(`OK ${root}: already on the OKF v0.2 layout, nothing to migrate`)
    return 0
  }

  for (const change of changes) {
    console.log(`${write ? 'WRITE' : 'PLAN '} ${change.path} — ${change.what}`)
    if (write) writeFileSync(change.path, change.content)
  }

  if (write) {
    console.log(`\n${changes.length} file(s) migrated. Run 'node tools/knowledge_validate.mjs' next.`)
  } else {
    console.log(`\n${changes.length} file(s) would change. Re-run with --write to apply.`)
  }
  return 0
}

process.exit(main())
```
