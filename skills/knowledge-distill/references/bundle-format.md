# Library bundle format

A distilled library bundle is **not a new format**. It is ordinary concept files in the repo's
existing `knowledge/` bundle, living under `knowledge/libraries/<lib>/`. Everything here exists
because `tools/knowledge_validate.mjs` (already installed in the target repo, already wired
into its pre-commit and CI) enforces it. The full bundle spec is the target repo's own
`knowledge/meta/knowledge-bundle-spec.md` — this file only covers what's specific to libraries.

## Layout

```
knowledge/
  index.md                    ← append one line under "## Libraries" per bundle
  libraries/
    nuxt/
      index.md                ← type: Index — the pin, provenance, mental model, deltas
      data-fetching.md        ← type: Domain — one topic
      routing.md              ← type: Domain
      sources.md              ← type: Playbook — topic → source-repo path map
```

- Directory name is the **package** slug, not the repo name: `@pinia/colada` →
  `libraries/pinia-colada/`, with `library: "@pinia/colada"` in frontmatter carrying the real
  name. One bundle per consumable package, so a monorepo yields several.
- Filenames kebab-case, one topic per file.

## Frontmatter — flat keys only

The validator's frontmatter parser handles top-level `key: value`, inline arrays (`[a, b]`),
and `- item` block lists. **It has no nested-map support**: an indented `repo:` under a
`source:` key hits `unparseable frontmatter line` and fails the build. So provenance is flat.

`libraries/<lib>/index.md`:

```yaml
---
type: Index
title: Nuxt 4.0.3 Knowledge
description: Distilled Nuxt 4.0.3 API surface and idioms — read before writing Nuxt code.
tags: [library, nuxt, distilled]
timestamp: 2026-07-30T00:00:00Z
library: nuxt
version: 4.0.3
source_repo: github.com/nuxt/nuxt
source_commit: 7f3c9e1a4b2d8f60c15e9a3b7d4c2e8f1a6b0d93
docs_path: docs/
distilled: 2026-07-30
verified: 2026-07-30
conventions_blended: [.claude/rules/conventions-frontend.md]
---
```

| Key | Required | Notes |
|---|---|---|
| `type` | yes | `Index` for the entry file — this is what makes the bundle self-rooting (below) |
| `title`, `description`, `tags` | recommended | missing `description`/`tags` is a validator **warning**; write them anyway |
| `timestamp` | recommended | must be valid ISO 8601 if present, or it's a hard error |
| `library` | yes | the real package name, including any scope |
| `version` | yes | the exact tag, `v` prefix stripped. Never a range, never `latest` |
| `source_repo`, `source_commit` | yes | the resolved SHA, not just the tag — tags move |
| `docs_path` | yes | where in the source repo this came from |
| `distilled`, `verified` | yes | ISO dates. `verified` is set only by a clean Phase 2 audit |
| `conventions_blended` | yes | inline array of paths; empty array `[]` when none |
| `drift_ack` | no | set by a human to accept a known version divergence — see `drift-guard.md` |

Extension keys are explicitly allowed by the bundle spec as long as they don't collide with
its own keys. Every key above beyond the first five is an extension key.

Topic files use the same recommended keys plus `type: Domain` (or `Playbook` for `sources.md`)
and `resource:` pointing at the upstream doc path they cover.

## Linking

- Bundle-relative links are **root-anchored against `knowledge/`**, not relative to the file:
  from `libraries/nuxt/index.md`, the link to a sibling is `/libraries/nuxt/data-fetching.md`.
  A plain `data-fetching.md` isn't checked at all, and `./data-fetching.md` fails the link check.
- The index links every topic file. This is load-bearing twice over: the validator's
  reachability walk starts from *every* `type: Index` file, so the bundle's own index seeds it —
  but a topic file the index forgot is reported unreachable, and no reader will ever find it.
- The root `knowledge/index.md` links to `/libraries/<lib>/index.md`. Not required by the
  validator (the bundle index self-roots), but it's how a human and the index-first read
  protocol discover the bundle exists.

## Budgets

Enforced by `scripts/count_budget.mjs` before the audit phase:

| File | Lines | Chars |
|---|---|---|
| `index.md` | 60 | 2,400 |
| topic file, `sources.md` | 100 | 4,000 |

Char counts exclude frontmatter, and the `/4` chars-to-tokens estimate is the same one
`tools/context_budget.mjs` uses — nothing here can count real tokens, so don't claim to.

The 100-line topic allowance is a deliberate deviation from the bundle spec's "≤~60 lines,
terse beats complete" guidance. Reason: concept files about our own code are read alongside
each other, while a library topic file is a single on-demand read of a contiguous API surface.
Splitting one surface into two 60-line shards costs more in file-open round-trips than the
shorter files save. `index.md` keeps the 60-line cap, because that one *is* read routinely.

## Citations

Every file ends with a `# Citations` section — required by the bundle spec for any claim
depending on an external source, which is every claim in a distilled bundle:

```markdown
# Citations

- github.com/nuxt/nuxt @ v4.0.3 (7f3c9e1) — `docs/2.guide/2.directory-structure/`
- github.com/nuxt/nuxt @ v4.0.3 (7f3c9e1) — `packages/nuxt/src/app/composables/fetch.ts`
```
