# Knowledge Bundle Templates

Templates for the optional internal Knowledge Bundle convention (inspired by [Open Knowledge Format v0.1](https://openknowledgeformat.com) — we own this spec, no OKF tooling dependency). Scaffolded by `SKILL.md` Phase 5.5 when the user opts in.

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
- Frontmatter is required: `type` (one of Index, Contract, System, Domain, Table, Metric, Playbook, Constraint, Log), plus `title`, `description`, `tags`, `timestamp` when relevant.
- Link relationships with bundle-relative Markdown links (e.g. `/contracts/openapi-contract.md`).
- Claims from an external source get a `# Citations` section.
- Keep it under ~60 lines. Terse beats complete.

## Link, don't copy
Concept files point to sources of truth (`openapi.yaml`, `.claude/rules/`, source code) — they never duplicate that content. If you're about to paste code or a schema into `knowledge/`, link to it instead.

## Staleness
A PR that meaningfully changes behavior updates the related concept file(s) in the same PR. Add one entry to `knowledge/log.md` per sprint.

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
timestamp: {DATE}T00:00:00Z
---

# Knowledge Bundle Spec

Internal convention inspired by [Open Knowledge Format v0.1](https://openknowledgeformat.com). We own this spec — no OKF tooling dependency.

## Purpose
`knowledge/` answers "what the system is and why." Skills/rules (`.claude/rules/`) answer "how we work." Don't mix the two.

## Structure
- One concept per Markdown file, under `knowledge/` (the bundle root).
- **Every** `.md` file under `knowledge/` is a concept file with valid frontmatter — no freeform docs, no exceptions.
- Folders group by kind: `contracts/`, `domains/`, `constraints/`, `meta/`, etc. Add folders as needed.
- Filenames: kebab-case, singular concept per file (`openapi-contract.md`, not `contracts.md`).
- Bundle-relative links resolve against `knowledge/` (e.g. `/contracts/openapi-contract.md` = `knowledge/contracts/openapi-contract.md`).

## Frontmatter schema
Required:
- `type` — one of: `Index`, `Contract`, `System`, `Domain`, `Table`, `Metric`, `Playbook`, `Constraint`, `Log`

Recommended:
- `title`, `description`, `resource` (external URL/path this concept documents), `tags` (array), `timestamp` (ISO 8601, bumped on meaningful edits)

Extension keys are allowed but must not collide with the above.

## Linking & citations
- Relationships between concepts = bundle-relative Markdown links.
- Concept files **add context and point to sources of truth** (`openapi.yaml`, `.claude/rules/`, source code) — never duplicate their content. Link, don't copy.
- Any claim depending on an external source (paper, RFC, vendor doc, incident report) gets a `# Citations` section listing the source.

## Staleness policy
- Any PR that meaningfully changes behavior must update the related concept file(s) in the same PR.
- `knowledge/log.md` (type: Log) gets one entry per sprint summarizing what changed in the bundle.
- Concept files not linked from `knowledge/index.md` are stale by definition — the validator warns on these.

## Validation
`tools/knowledge_validate.mjs` enforces: valid frontmatter + `type` on every file, `type` in the allowed list, all bundle-relative links resolve, `timestamp` is valid ISO 8601 when present. Missing `description`/`tags` and index-unreachable files are warnings, not failures.
```

---

## knowledge/index.md

The index is the primary read target — one-line summaries must be self-sufficient for routine work. Open a concept file only when the summary is insufficient.

```markdown
---
type: Index
title: Knowledge Bundle Index
description: Root map of all concept files in this bundle. Read this first — summaries are self-sufficient for most changes; open a concept file only when you need more detail.
tags: [knowledge-bundle, index]
timestamp: {DATE}T00:00:00Z
---

# Knowledge Bundle

Root map of everything under `knowledge/`. Read this before non-trivial changes. Format: `- [Title](path) — one-line summary (sufficient for routine reads)`.

## Meta
- [Knowledge Bundle Spec](/meta/knowledge-bundle-spec.md) — frontmatter schema, folder layout, linking, and staleness rules

## Contracts
- [OpenAPI Contract](/contracts/openapi-contract.md) — openapi.yaml is the source of truth; FE types generated from it, breaking changes require a version bump

## Constraints
- [Agent Rules](/constraints/agent-rules.md) — what agents must check before touching handlers, migrations, or security-sensitive code

## Log
- [Bundle Log](/log.md) — one entry per sprint summarizing changes to the bundle
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
timestamp: {DATE}T00:00:00Z
---

# OpenAPI Contract

`openapi.yaml` (repo root) is the source of truth for every route, request, and response shape between the frontend and backend. See `.claude/rules/architecture.md` for the additive-first change policy.

## Rules
- Backend leads with backward-compatible (additive) changes.
- Breaking change = version bump (`/v2/`). Frontend adopts after backend ships.
- Frontend generates types from `openapi.yaml` — never hand-write response shapes.

## Drift gate
CI (or the local gate) fails if generated frontend types don't match the checked-in `openapi.yaml`. See the type-generation step in the build/CI config for the exact command.

## Citations
- `openapi.yaml` — repo root, the actual contract
- `.claude/rules/architecture.md` — dependency direction + contract policy
```

---

## knowledge/constraints/agent-rules.md

```markdown
---
type: Constraint
title: Agent Rules
description: Boundaries agents must respect in this repo, beyond what lint/tests catch.
tags: [agents, constraints, guardrails]
timestamp: {DATE}T00:00:00Z
---

# Agent Rules

## Before touching handlers/routes
Read `knowledge/contracts/openapi-contract.md` and confirm the change stays additive, or that a version bump is the explicit plan.

## Never edit a merged migration
Write a new migration instead. See `.claude/rules/conventions.md` for the migration pattern.

## Security-sensitive code
Anything touching auth, secrets, or PII must have its security considerations named in the spec (see `AI_TASK_GUIDE.md`) before implementation starts, and goes through `.claude/rules/security.md` before merging.

## Spec-before-code
Non-trivial features need an approved spec first — see `AI_TASK_GUIDE.md`. The spec must include a Security considerations section for features touching auth, secrets, PII, or untrusted input. Don't start implementation on an unapproved spec.

## Citations
- `.claude/rules/conventions.md`, `.claude/rules/security.md` — enforced rule files
- `AI_TASK_GUIDE.md` — spec gate workflow
```

---

## knowledge/log.md

```markdown
---
type: Log
title: Knowledge Bundle Log
description: One entry per sprint summarizing changes to the knowledge bundle.
tags: [knowledge-bundle, log]
timestamp: {DATE}T00:00:00Z
---

# Knowledge Bundle Log

## {DATE}
Bundle created: `index.md`, `contracts/openapi-contract.md`, `constraints/agent-rules.md`, `meta/knowledge-bundle-spec.md`. Validator added at `tools/knowledge_validate.mjs`.
```

---

## tools/knowledge_validate.mjs

```javascript
#!/usr/bin/env node
// Validate the knowledge/ bundle: frontmatter, allowed types, link resolution, timestamps.
// Zero dependencies — runs on any Node >= 18 (macOS, Linux, Windows).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const BUNDLE_ROOT = 'knowledge'

const ALLOWED_TYPES = new Set([
  'Index', 'Contract', 'System', 'Domain', 'Table',
  'Metric', 'Playbook', 'Constraint', 'Log'
])

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g

// Minimal YAML-subset parser for concept-file frontmatter: top-level
// `key: value` pairs, inline arrays ([a, b]), and `- item` block lists.
function parseFrontmatter(raw) {
  const text = raw.replace(/^\uFEFF/, '')
  if (!text.startsWith('---')) return { meta: null, body: text, error: 'missing frontmatter block' }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { meta: null, body: text, error: 'unterminated frontmatter block' }
  const header = text.slice(text.indexOf('\n') + 1, end)
  const bodyStart = text.indexOf('\n', end + 1)
  const body = bodyStart === -1 ? '' : text.slice(bodyStart + 1)

  const meta = {}
  let listKey = null
  for (const line of header.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const item = line.match(/^\s+-\s*(.*)$/)
    if (item && listKey) {
      meta[listKey].push(stripQuotes(item[1].trim()))
      continue
    }
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (!kv) return { meta: null, body, error: `unparseable frontmatter line: '${line.trim()}'` }
    const value = kv[2].trim()
    if (value === '') {
      meta[kv[1]] = []
      listKey = kv[1]
    } else if (value.startsWith('[') && value.endsWith(']')) {
      meta[kv[1]] = value.slice(1, -1).split(',').map(s => stripQuotes(s.trim())).filter(Boolean)
      listKey = null
    } else {
      meta[kv[1]] = stripQuotes(value)
      listKey = null
    }
  }
  return { meta, body, error: null }
}

function stripQuotes(s) {
  if (s.length >= 2 && ((s[0] === '"' && s.at(-1) === '"') || (s[0] === '\'' && s.at(-1) === '\''))) {
    return s.slice(1, -1)
  }
  return s
}

function iso8601(value) {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(value)) return false
  return !Number.isNaN(Date.parse(value))
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

function main() {
  const argv = process.argv.slice(2)
  let root = BUNDLE_ROOT
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i]
    else if (argv[i].startsWith('--root=')) root = argv[i].slice('--root='.length)
  }

  const errors = []
  const warnings = []

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
    const { meta, body, error } = parseFrontmatter(readFileSync(path, 'utf-8'))
    if (error) {
      errors.push(`${path}: invalid frontmatter (${error})`)
      continue
    }

    parsed.set(rel, { meta, body })

    if (!('type' in meta)) {
      errors.push(`${path}: missing required frontmatter key 'type'`)
    } else if (!ALLOWED_TYPES.has(meta.type)) {
      errors.push(`${path}: type '${meta.type}' not in allowed list (${[...ALLOWED_TYPES].sort().join(', ')})`)
    } else if (meta.type === 'Index') {
      indexRels.push(rel)
    }

    if ('timestamp' in meta && !iso8601(String(meta.timestamp))) {
      errors.push(`${path}: timestamp '${meta.timestamp}' is not valid ISO 8601`)
    }

    for (const link of bundleRelativeLinks(body)) {
      if (!files.has(link)) {
        errors.push(`${path}: broken link '${link}' (no file at ${root}${link})`)
      }
    }

    if (!meta.description) warnings.push(`${path}: missing recommended key 'description'`)
    if (!meta.tags || meta.tags.length === 0) warnings.push(`${path}: missing recommended key 'tags'`)
  }

  if (indexRels.length === 0) {
    warnings.push(`${root}: no file with type 'Index' found — cannot check reachability`)
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
      if (!reachable.has(rel)) warnings.push(`${path}: not reachable from an Index file`)
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
