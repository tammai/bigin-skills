# Knowledge Bundle Templates

Templates for the optional internal Knowledge Bundle convention — our profile of [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md). We own this profile; there is no OKF tooling dependency. Scaffolded by `SKILL.md` Phase 5.5 when the user opts in.

Before writing, replace `{DATE}` with today's date in ISO 8601 (`YYYY-MM-DD`) in every template below.

---

## knowledge.md

```markdown
# Knowledge Bundle Rules

`knowledge/` holds domain knowledge — what the system is and why. Rules (`.claude/rules/`) hold how we work. Don't mix the two.

## Before non-trivial changes
Read `knowledge/index.md`. The one-line summaries there are usually sufficient. Open a concept file only when the index summary is insufficient for the change at hand — don't read concept files preemptively.

## Writing or updating a concept file
- One concept per file, kebab-case name, under `knowledge/<folder>/`.
- `index.md` and `log.md` are reserved — a directory listing and a change log. They carry no frontmatter, so never make one a concept file.
- Frontmatter is required on every other file: `type` (one of Contract, System, Domain, Table, Metric, Playbook, Constraint), plus `title`, `description`, `tags`.
- Record who wrote it and when with `generated: { by, at }`, and who confirmed it with `verified`. Actors are `human:<id>`, `process:<id>`, or `<producer>/<version>`.
- External claims go in the `sources` frontmatter key, not a `# Citations` section.
- Link relationships with bundle-relative Markdown links (e.g. `/contracts/openapi-contract.md`).
- Keep it under ~60 lines. Terse beats complete.

## Link, don't copy
Concept files point to sources of truth (`openapi.yaml`, `.claude/rules/`, source code) — they never duplicate that content. If you're about to paste code or a schema into `knowledge/`, link to it instead.

## Staleness
A PR that meaningfully changes behavior updates the related concept file(s) in the same PR. Add one entry to `knowledge/log.md` per sprint. Set `stale_after: <YYYY-MM-DD>` on anything with a known expiry.

Full spec: `knowledge/meta/knowledge-bundle-spec.md`.
```

---

## knowledge/meta/knowledge-bundle-spec.md

```markdown
---
type: Constraint
title: Knowledge Bundle Spec
description: Frontmatter schema, folder layout, linking, and staleness rules for the knowledge/ bundle.
tags: [knowledge-bundle, meta, spec]
status: stable
generated: { by: process:bigin-harness-setup, at: {DATE}T00:00:00Z }
sources:
  - id: okf
    resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
    title: Open Knowledge Format v0.2
    last_modified: {DATE}
---

# Knowledge Bundle Spec

Our profile of [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md). We own this profile — no OKF tooling dependency.

## Purpose
`knowledge/` answers "what the system is and why." Skills/rules (`.claude/rules/`) answer "how we work." Don't mix the two.

## Structure
- One concept per Markdown file, under `knowledge/` (the bundle root).
- **Reserved filenames:** `index.md` (directory listing) and `log.md` (change history). They carry **no frontmatter** — except the bundle-root `index.md`, which declares `okf_version: "0.2"` and nothing else.
- **Every other** `.md` file under `knowledge/` is a concept file with valid frontmatter — no freeform docs, no exceptions.
- Folders group by kind: `contracts/`, `domains/`, `constraints/`, `meta/`, etc. Add folders as needed.
- Filenames: kebab-case, singular concept per file (`openapi-contract.md`, not `contracts.md`).
- Bundle-relative links resolve against `knowledge/` (e.g. `/contracts/openapi-contract.md` = `knowledge/contracts/openapi-contract.md`).

## Frontmatter schema
Required:
- `type` — one of: `Contract`, `System`, `Domain`, `Table`, `Metric`, `Playbook`, `Constraint`

Recommended:
- `title`, `description`, `resource` (external URL/path this concept documents), `tags` (array)

Trust and lifecycle (all optional; absence is meaningful):
- `generated: { by, at }` — who produced the content and when it last meaningfully changed. Replaces v0.1's `timestamp`.
- `verified: [{ by, at }]` — independent confirmations. A bare `{ by, at }` mapping counts as one. No `verified` = unverified; non-human actors only = machine-confirmed; a `human:` actor = human-reviewed.
- `status` — `draft`, `stable`, or `deprecated`. Absent means `stable`.
- `stale_after: <YYYY-MM-DD>` — the concept needs re-verification on or after this date.
- `sources: [{ id, resource, title, author, usage_count, last_modified }]` — what the concept derives from. `resource` is required per entry. `usage_window: { from, to }` frames any `usage_count`.

**Actors** (`generated.by`, `verified[].by`) take one of three forms: `human:<id>`, `process:<id>`, or `<producer>/<version>`.

Extension keys are allowed but must not collide with the above.

## Linking & provenance
- Relationships between concepts = bundle-relative Markdown links.
- Concept files **add context and point to sources of truth** (`openapi.yaml`, `.claude/rules/`, source code) — never duplicate their content. Link, don't copy.
- Any claim depending on an external source (paper, RFC, vendor doc, incident report) goes in `sources`. The v0.1 `# Citations` section is deprecated; the validator warns on it.

## Staleness policy
- Any PR that meaningfully changes behavior must update the related concept file(s) in the same PR.
- `knowledge/log.md` gets one entry per sprint summarizing what changed in the bundle.
- Concept files not linked from an `index.md` are stale by definition — the validator warns on these.
- A passed `stale_after` date is a warning, not a failure. Re-verify and bump it, or let it keep nagging.

## Validation
`tools/knowledge_validate.mjs` enforces: valid frontmatter + `type` on every non-reserved file, `type` in the allowed list, all bundle-relative links resolve, and well-formed `generated`/`verified`/`status`/`stale_after`/`sources` when present. Missing `description`/`tags`, index-unreachable files, leftover v0.1 keys, and passed `stale_after` dates are warnings.

**Where we're stricter than OKF:** the spec tells *consumers* to tolerate unknown `type` values and broken links. We're the producer, so both are hard failures here — a typo'd link in our own bundle is a bug, not forward compatibility.
```

---

## knowledge/index.md

The index is the primary read target — one-line summaries must be self-sufficient for routine work. Open a concept file only when the summary is insufficient. It is a reserved file: `okf_version` is the only key it may carry.

```markdown
---
okf_version: "0.2"
---

# Knowledge Bundle

Root map of everything under `knowledge/`. Read this before non-trivial changes. Format: `* [Title](path) - one-line summary (sufficient for routine reads)`.

## Meta
* [Knowledge Bundle Spec](/meta/knowledge-bundle-spec.md) - frontmatter schema, folder layout, linking, and staleness rules

## Contracts
* [OpenAPI Contract](/contracts/openapi-contract.md) - openapi.yaml is the source of truth; FE types generated from it, breaking changes require a version bump

## Constraints
* [Agent Rules](/constraints/agent-rules.md) - what agents must check before touching handlers, migrations, or security-sensitive code
```

---

## knowledge/contracts/openapi-contract.md

```markdown
---
type: Contract
title: OpenAPI Contract
description: openapi.yaml is the source of truth for the API surface between frontend and backend.
resource: openapi.yaml
tags: [api, contract, openapi]
status: stable
generated: { by: process:bigin-harness-setup, at: {DATE}T00:00:00Z }
sources:
  - id: contract
    resource: openapi.yaml
    title: The checked-in contract itself
    last_modified: {DATE}
  - id: architecture-rule
    resource: .claude/rules/architecture.md
    title: Dependency direction + contract policy
    last_modified: {DATE}
---

# OpenAPI Contract

`openapi.yaml` (repo root) is the source of truth for every route, request, and response shape between the frontend and backend. See `.claude/rules/architecture.md` for the additive-first change policy.

## Rules
- Backend leads with backward-compatible (additive) changes.
- Breaking change = version bump (`/v2/`). Frontend adopts after backend ships.
- Frontend generates types from `openapi.yaml` — never hand-write response shapes.

## Drift gate
CI (or the local gate) fails if generated frontend types don't match the checked-in `openapi.yaml`. See the type-generation step in the build/CI config for the exact command.
```

---

## knowledge/constraints/agent-rules.md

```markdown
---
type: Constraint
title: Agent Rules
description: Boundaries agents must respect in this repo, beyond what lint/tests catch.
tags: [agents, constraints, guardrails]
status: stable
generated: { by: process:bigin-harness-setup, at: {DATE}T00:00:00Z }
sources:
  - id: conventions
    resource: .claude/rules/conventions.md
    title: Enforced conventions
    last_modified: {DATE}
  - id: security
    resource: .claude/rules/security.md
    title: Enforced security rules
    last_modified: {DATE}
---

# Agent Rules

## Before touching handlers/routes
Read `knowledge/contracts/openapi-contract.md` and confirm the change stays additive, or that a version bump is the explicit plan.

## Never edit a merged migration
Write a new migration instead. See `.claude/rules/conventions.md` for the migration pattern.

## Security-sensitive code
Anything touching auth, secrets, or PII must have its security considerations named in the spec (`/task-workflow` has the format) before implementation starts, and goes through `.claude/rules/security.md` before merging.

## Spec-before-code
Non-trivial features need an approved spec first — run `/task-workflow`. The spec must include a Security considerations section for features touching auth, secrets, PII, or untrusted input. Don't start implementation on an unapproved spec. `AI_TASK_GUIDE.md` is the human-facing pointer to that workflow.
```

---

## knowledge/log.md

Reserved file — no frontmatter. Newest entry first, one date heading per sprint.

```markdown
# Knowledge Bundle Log

## {DATE}
* **Creation**: Established the bundle — [index](/index.md), [OpenAPI Contract](/contracts/openapi-contract.md), [Agent Rules](/constraints/agent-rules.md), [Knowledge Bundle Spec](/meta/knowledge-bundle-spec.md). Validator added at `tools/knowledge_validate.mjs`.
```

---

## tools/knowledge_validate.mjs

```javascript
#!/usr/bin/env node
// Validate the knowledge/ bundle against our OKF v0.2 profile: frontmatter,
// allowed types, reserved files, trust/lifecycle keys, link resolution.
// Zero dependencies — runs on any Node >= 18 (macOS, Linux, Windows).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

const BUNDLE_ROOT = 'knowledge'
const OKF_VERSION = '0.2'

// Reserved by OKF v0.2 §8-§9: index.md is a directory listing, log.md is an
// update history. Neither carries frontmatter — except the bundle-root
// index.md, which may declare okf_version and nothing else.
const RESERVED = new Set(['index.md', 'log.md'])

const ALLOWED_TYPES = new Set([
  'Contract', 'System', 'Domain', 'Table',
  'Metric', 'Playbook', 'Constraint'
])

// v0.1 types for the two files v0.2 reserves. Accepted so an existing bundle
// keeps validating, warned so it gets migrated.
const LEGACY_TYPES = new Set(['Index', 'Log'])

const STATUSES = new Set(['draft', 'stable', 'deprecated'])

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g
const ACTOR_RE = /^(human:.+|process:.+|[^/\s]+\/[^/\s]+)$/

// --- YAML subset parser ------------------------------------------------------
// Handles what our frontmatter actually uses: block maps, block lists, inline
// flow maps/lists, and nesting of those. Not a general YAML implementation —
// no anchors, no multi-line scalars, no tabs.

function stripQuotes(s) {
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === '\'' && s.at(-1) === '\''))) {
    return s.slice(1, -1)
  }
  return s
}

function splitTopLevel(text, sep) {
  const out = []
  let depth = 0
  let quote = null
  let cur = ''
  for (const ch of text) {
    if (quote) {
      cur += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === '\'') {
      quote = ch
      cur += ch
      continue
    }
    if (ch === '[' || ch === '{') depth++
    if (ch === ']' || ch === '}') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim()).filter(s => s !== '')
}

function parseFlow(raw) {
  const text = raw.trim()
  if (text.startsWith('[') && text.endsWith(']')) {
    return splitTopLevel(text.slice(1, -1), ',').map(parseFlow)
  }
  if (text.startsWith('{') && text.endsWith('}')) {
    const map = {}
    for (const part of splitTopLevel(text.slice(1, -1), ',')) {
      const kv = part.match(/^([A-Za-z0-9_-]+)\s*:\s*([\s\S]*)$/)
      if (!kv) throw new Error(`unparseable flow entry: '${part}'`)
      map[kv[1]] = parseFlow(kv[2])
    }
    return map
  }
  return stripQuotes(text)
}

function isListLine(text) {
  return text === '-' || text.startsWith('- ')
}

// Returns [value, nextIndex]. `lines` are pre-tokenized {indent, text, no}.
function parseBlock(lines, start, indent) {
  if (isListLine(lines[start].text)) {
    const items = []
    let i = start
    while (i < lines.length && lines[i].indent === indent && isListLine(lines[i].text)) {
      const rest = lines[i].text.slice(1).trim()
      const cont = []
      let j = i + 1
      while (j < lines.length && lines[j].indent > indent) {
        cont.push(lines[j])
        j++
      }
      if (rest === '') {
        if (!cont.length) throw new Error(`empty list item on line ${lines[i].no}`)
        const [value] = parseBlock(cont, 0, cont[0].indent)
        items.push(value)
      } else if (rest.startsWith('[') || rest.startsWith('{')) {
        if (cont.length) throw new Error(`unparseable frontmatter line: '${cont[0].text}'`)
        items.push(parseFlow(rest))
      } else if (/^[A-Za-z0-9_-]+\s*:/.test(rest)) {
        // Block map whose first key sits on the dash line.
        const mapIndent = cont.length ? Math.min(...cont.map(l => l.indent)) : indent + 2
        const [value] = parseBlock([{ indent: mapIndent, text: rest, no: lines[i].no }, ...cont], 0, mapIndent)
        items.push(value)
      } else {
        if (cont.length) throw new Error(`unparseable frontmatter line: '${cont[0].text}'`)
        items.push(stripQuotes(rest))
      }
      i = j
    }
    return [items, i]
  }

  const map = {}
  let i = start
  while (i < lines.length && lines[i].indent === indent && !isListLine(lines[i].text)) {
    const kv = lines[i].text.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!kv) throw new Error(`unparseable frontmatter line: '${lines[i].text}'`)
    const key = kv[1]
    const value = kv[2].trim()
    if (value === '') {
      const next = lines[i + 1]
      const nested = next && (next.indent > indent || (next.indent === indent && isListLine(next.text)))
      if (nested) {
        const [child, ni] = parseBlock(lines, i + 1, next.indent)
        map[key] = child
        i = ni
      } else {
        // Bare `key:` — an empty list, matching the v0.1 parser's behavior.
        map[key] = []
        i++
      }
    } else if (value.startsWith('[') || value.startsWith('{')) {
      map[key] = parseFlow(value)
      i++
    } else {
      map[key] = stripQuotes(value)
      i++
    }
  }
  return [map, i]
}

function parseFrontmatter(raw) {
  // charCodeAt check, not a \uFEFF regex literal in source: an LLM
  // transcribing this file into a target repo can render that escape as
  // the actual BOM character, tripping the target's own lint rule.
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  if (!text.startsWith('---')) return { meta: null, body: text, error: null, absent: true }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { meta: null, body: text, error: 'unterminated frontmatter block' }
  const header = text.slice(text.indexOf('\n') + 1, end)
  const bodyStart = text.indexOf('\n', end + 1)
  const body = bodyStart === -1 ? '' : text.slice(bodyStart + 1)

  const lines = []
  let no = 0
  for (const line of header.split('\n')) {
    no++
    if (!line.trim() || line.trim().startsWith('#')) continue
    if (/^\s*\t/.test(line)) return { meta: null, body, error: `tab indentation on line ${no}` }
    lines.push({ indent: line.length - line.trimStart().length, text: line.trim(), no })
  }
  if (!lines.length) return { meta: {}, body, error: null }
  if (lines[0].indent !== 0) return { meta: null, body, error: `unexpected indentation on line ${lines[0].no}` }

  try {
    const [meta, next] = parseBlock(lines, 0, 0)
    if (next < lines.length) {
      return { meta: null, body, error: `unparseable frontmatter line: '${lines[next].text}'` }
    }
    return { meta, body, error: null }
  } catch (err) {
    return { meta: null, body, error: err.message }
  }
}

// --- helpers -----------------------------------------------------------------

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function iso8601(value) {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(value)) return false
  return !Number.isNaN(Date.parse(value))
}

function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

// A bare `verified: {by, at}` mapping is one verification event (OKF v0.2 §11).
function asList(value) {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function bundleRelativeLinks(content) {
  const links = []
  for (const match of content.matchAll(LINK_RE)) {
    const target = match[1].trim()
    if (target.startsWith('/')) links.push(target.split('#')[0])
  }
  return links
}

function loadBundle(root) {
  const files = new Map()
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.md')) {
        files.set('/' + relative(root, full).split('\\').join('/'), full)
      }
    }
  }
  walk(root)
  return new Map([...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)))
}

// --- per-file checks ---------------------------------------------------------

function checkReserved(path, rel, meta, errors, warnings) {
  const keys = Object.keys(meta ?? {})
  if (rel === '/index.md') {
    const extra = keys.filter(key => key !== 'okf_version')
    if (extra.length) {
      warnings.push(`${path}: OKF v0.2 reserves index.md — only 'okf_version' belongs in its frontmatter, drop ${extra.map(k => `'${k}'`).join(', ')}`)
    }
    if (meta?.okf_version === undefined) {
      warnings.push(`${path}: bundle root does not declare okf_version: "${OKF_VERSION}"`)
    } else if (String(meta.okf_version) !== OKF_VERSION) {
      warnings.push(`${path}: declares okf_version '${meta.okf_version}', this validator implements ${OKF_VERSION}`)
    }
    return
  }
  if (keys.length) {
    warnings.push(`${path}: OKF v0.2 reserves ${basename(path)} — it carries no frontmatter, drop all ${keys.length} key(s)`)
  }
}

function checkTrust(path, meta, errors, warnings) {
  if ('timestamp' in meta) {
    if (!iso8601(String(meta.timestamp))) {
      errors.push(`${path}: timestamp '${meta.timestamp}' is not valid ISO 8601`)
    }
    if (!('generated' in meta)) {
      warnings.push(`${path}: 'timestamp' is the v0.1 key — replace with generated: { by, at }`)
    }
  }

  if ('generated' in meta) {
    if (!isPlainObject(meta.generated)) {
      errors.push(`${path}: 'generated' must be a mapping of { by, at }`)
    } else {
      if (!meta.generated.by) errors.push(`${path}: 'generated' requires 'by'`)
      else if (!ACTOR_RE.test(String(meta.generated.by))) {
        warnings.push(`${path}: generated.by '${meta.generated.by}' is not an OKF actor (human:<id>, process:<id>, or <producer>/<version>)`)
      }
      if (meta.generated.at !== undefined && !iso8601(String(meta.generated.at))) {
        errors.push(`${path}: generated.at '${meta.generated.at}' is not valid ISO 8601`)
      }
    }
  }

  for (const [i, event] of asList(meta.verified).entries()) {
    if (!isPlainObject(event)) {
      errors.push(`${path}: verified[${i}] must be a mapping of { by, at }`)
      continue
    }
    if (!event.by) errors.push(`${path}: verified[${i}] requires 'by'`)
    else if (!ACTOR_RE.test(String(event.by))) {
      warnings.push(`${path}: verified[${i}].by '${event.by}' is not an OKF actor (human:<id>, process:<id>, or <producer>/<version>)`)
    }
    if (event.at !== undefined && !iso8601(String(event.at))) {
      errors.push(`${path}: verified[${i}].at '${event.at}' is not valid ISO 8601`)
    }
  }
}

function checkLifecycle(path, meta, errors, warnings, today) {
  if ('status' in meta && !STATUSES.has(String(meta.status))) {
    errors.push(`${path}: status '${meta.status}' not in allowed list (${[...STATUSES].join(', ')})`)
  }
  if ('stale_after' in meta) {
    if (!isDate(meta.stale_after)) {
      errors.push(`${path}: stale_after '${meta.stale_after}' is not a YYYY-MM-DD date`)
    } else if (today >= String(meta.stale_after)) {
      warnings.push(`${path}: stale — stale_after ${meta.stale_after} has passed, re-verify or bump it`)
    }
  }
}

function checkSources(path, meta, body, errors, warnings) {
  if ('sources' in meta) {
    const sources = Array.isArray(meta.sources) ? meta.sources : [meta.sources]
    for (const [i, source] of sources.entries()) {
      if (!isPlainObject(source)) {
        errors.push(`${path}: sources[${i}] must be a mapping with at least 'resource'`)
        continue
      }
      if (!source.resource) errors.push(`${path}: sources[${i}] requires 'resource'`)
      if (source.last_modified !== undefined && !isDate(source.last_modified)) {
        errors.push(`${path}: sources[${i}].last_modified '${source.last_modified}' is not a YYYY-MM-DD date`)
      }
      if (source.usage_count !== undefined && !/^\d+$/.test(String(source.usage_count))) {
        warnings.push(`${path}: sources[${i}].usage_count '${source.usage_count}' is not a number`)
      }
    }
  }

  if ('usage_window' in meta) {
    if (!isPlainObject(meta.usage_window)) {
      errors.push(`${path}: 'usage_window' must be a mapping of { from, to }`)
    } else {
      for (const key of ['from', 'to']) {
        if (meta.usage_window[key] !== undefined && !isDate(meta.usage_window[key])) {
          errors.push(`${path}: usage_window.${key} '${meta.usage_window[key]}' is not a YYYY-MM-DD date`)
        }
      }
    }
  }

  if (/^#+\s+Citations\s*$/m.test(body) && !('sources' in meta)) {
    warnings.push(`${path}: '# Citations' is the v0.1 provenance form — move it to the 'sources' frontmatter key`)
  }
}

// --- main --------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2)
  let root = BUNDLE_ROOT
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i]
    else if (argv[i].startsWith('--root=')) root = argv[i].slice('--root='.length)
  }

  const errors = []
  const warnings = []
  const today = new Date().toISOString().slice(0, 10)

  let isDir
  try {
    isDir = statSync(root).isDirectory()
  } catch {
    isDir = false
  }
  if (!isDir) {
    console.log(`ERROR ${root}: bundle root does not exist`)
    return 1
  }

  const files = loadBundle(root)
  if (files.size === 0) {
    console.log(`ERROR ${root}: no .md files found in bundle`)
    return 1
  }

  const parsed = new Map()
  const indexRels = []

  for (const [rel, path] of files) {
    const reserved = RESERVED.has(basename(path))
    if (reserved && basename(path) === 'index.md') indexRels.push(rel)

    const { meta, body, error, absent } = parseFrontmatter(readFileSync(path, 'utf-8'))
    if (error) {
      errors.push(`${path}: invalid frontmatter (${error})`)
      continue
    }

    parsed.set(rel, { meta: meta ?? {}, body })

    if (reserved) {
      checkReserved(path, rel, meta, errors, warnings)
    } else if (absent) {
      errors.push(`${path}: missing frontmatter block`)
    } else {
      if (!('type' in meta)) {
        errors.push(`${path}: missing required frontmatter key 'type'`)
      } else if (LEGACY_TYPES.has(meta.type)) {
        warnings.push(`${path}: type '${meta.type}' belongs to a file OKF v0.2 reserves (index.md / log.md) — rename the file or pick a concept type`)
      } else if (!ALLOWED_TYPES.has(meta.type)) {
        errors.push(`${path}: type '${meta.type}' not in allowed list (${[...ALLOWED_TYPES].sort().join(', ')})`)
      }

      checkTrust(path, meta, errors, warnings)
      checkLifecycle(path, meta, errors, warnings, today)
      checkSources(path, meta, body, errors, warnings)

      if (!meta.description) warnings.push(`${path}: missing recommended key 'description'`)
      if (!meta.tags || meta.tags.length === 0) warnings.push(`${path}: missing recommended key 'tags'`)
    }

    for (const link of bundleRelativeLinks(body)) {
      if (!files.has(link)) {
        errors.push(`${path}: broken link '${link}' (no file at ${root}${link})`)
      }
    }
  }

  if (indexRels.length === 0) {
    warnings.push(`${root}: no index.md found — cannot check reachability`)
  } else {
    const reachable = new Set(indexRels)
    const stack = [...indexRels]
    while (stack.length) {
      const doc = parsed.get(stack.pop())
      if (!doc) continue
      for (const link of bundleRelativeLinks(doc.body)) {
        if (files.has(link) && !reachable.has(link)) {
          reachable.add(link)
          stack.push(link)
        }
      }
    }
    for (const [rel, path] of files) {
      if (!reachable.has(rel) && basename(path) !== 'log.md') {
        warnings.push(`${path}: not reachable from an index.md`)
      }
    }
  }

  for (const msg of errors) console.log(`ERROR ${msg}`)
  for (const msg of warnings) console.log(`WARN ${msg}`)

  if (errors.length) {
    console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`)
    return 1
  }
  console.log(`\n0 errors, ${warnings.length} warning(s)`)
  return 0
}

process.exit(main())
```
