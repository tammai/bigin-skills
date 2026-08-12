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
      index.md                ← reserved, no frontmatter — mental model, deltas, links
      pin.md                  ← type: Contract — the pin and its provenance
      data-fetching.md        ← type: Domain — one topic
      routing.md              ← type: Domain
      sources.md              ← type: Playbook — topic → source-repo path map
```

- Directory name is the **package** slug, not the repo name: `@pinia/colada` →
  `libraries/pinia-colada/`, with `library: "@pinia/colada"` in frontmatter carrying the real
  name. One bundle per consumable package, so a monorepo yields several.
- Filenames kebab-case, one topic per file.

## The pin lives in `pin.md`, not the index

OKF v0.2 reserves `index.md` as a directory listing that carries **no frontmatter**, so the
pin gets its own concept file. `libraries/<lib>/pin.md`:

```yaml
---
type: Contract
title: Nuxt 4.0.3 Pin
description: What this bundle is pinned to, and the provenance of every claim in it.
tags: [library, nuxt, pin]
status: stable
library: nuxt
version: 4.0.3
docs_path: docs/
conventions_blended: [.claude/rules/conventions-frontend.md]
generated: { by: knowledge-distill/opus-5, at: 2026-07-30T00:00:00Z }
verified:
  - { by: knowledge-auditor/opus-5, at: 2026-07-30T00:00:00Z }
sources:
  - id: repo
    resource: https://github.com/nuxt/nuxt/tree/7f3c9e1a4b2d8f60c15e9a3b7d4c2e8f1a6b0d93
    title: nuxt/nuxt @ v4.0.3
    last_modified: 2026-07-30
---
```

| Key | Required | Notes |
|---|---|---|
| `type` | yes | `Contract` — the pin is a promise about what the rest of the bundle describes |
| `title`, `description`, `tags` | recommended | missing `description`/`tags` is a validator **warning**; write them anyway |
| `library` | yes | the real package name, including any scope |
| `version` | yes | the exact tag, `v` prefix stripped. Never a range, never `latest` |
| `source_repo`, `source_commit` | yes | the resolved SHA, not just the tag — tags move. Keep both as flat keys: `knowledge_drift.mjs` reads them with a scalar-only parser |
| `docs_path` | yes | where in the source repo this came from |
| `generated` | yes | `{ by: knowledge-distill/<model>, at: <ISO 8601> }` — bumped on every re-distill |
| `verified` | yes | one `{ by, at }` entry per clean Phase 2 audit. Appended only by a passing audit, cleared on re-distill. A `knowledge-auditor/<model>` actor makes the bundle *machine-confirmed*; only a human reviewer writes `human:<id>` |
| `sources` | yes | at least the pinned tree URL; add one entry per docs path the bundle drew on |
| `conventions_blended` | yes | inline array of paths; empty array `[]` when none |
| `drift_ack` | no | set by a human to accept a known version divergence — see `drift-guard.md` |

Extension keys are explicitly allowed by the bundle spec as long as they don't collide with
its own keys. `library`, `version`, `source_repo`, `source_commit`, `docs_path`,
`conventions_blended`, and `drift_ack` are all extension keys.

Topic files use the same recommended keys plus `type: Domain` (or `Playbook` for `sources.md`),
`resource:` pointing at the upstream doc path they cover, and their own `sources`.

`index.md` itself carries nothing — it opens with the `# <Lib> <version>` heading and holds
the mental model, decision tables, deltas from the previous major, and the links.

## Linking

- Bundle-relative links are **root-anchored against `knowledge/`**, not relative to the file:
  from `libraries/nuxt/index.md`, the link to a sibling is `/libraries/nuxt/data-fetching.md`.
  A plain `data-fetching.md` isn't checked at all, and `./data-fetching.md` fails the link check.
- The index links `pin.md` and every topic file. This is load-bearing twice over: the
  validator's reachability walk starts from *every* `index.md`, so the bundle's own index seeds
  it — but a file the index forgot is reported unreachable, and no reader will ever find it.
- The root `knowledge/index.md` links to `/libraries/<lib>/index.md`. Not required by the
  validator (the bundle index self-roots), but it's how a human and the index-first read
  protocol discover the bundle exists.

## Budgets

Enforced by `scripts/count_budget.mjs` before the audit phase:

| File | Lines | Chars |
|---|---|---|
| `index.md` | 60 | 2,400 |
| topic file, `sources.md`, `pin.md` | 100 | 4,000 |

Char counts exclude frontmatter, and the `/4` chars-to-tokens estimate is the same one
`tools/context_budget.mjs` uses — nothing here can count real tokens, so don't claim to.

The 100-line topic allowance is a deliberate deviation from the bundle spec's "≤~60 lines,
terse beats complete" guidance. Reason: concept files about our own code are read alongside
each other, while a library topic file is a single on-demand read of a contiguous API surface.
Splitting one surface into two 60-line shards costs more in file-open round-trips than the
shorter files save. `index.md` keeps the 60-line cap, because that one *is* read routinely.

## Sources

Every concept file carries a `sources:` key — required by the bundle spec for any claim
depending on an external source, which is every claim in a distilled bundle. One entry per
path the file was derived from, `resource` required on each:

```yaml
sources:
  - id: dir-structure
    resource: https://github.com/nuxt/nuxt/blob/7f3c9e1/docs/2.guide/2.directory-structure/
    title: nuxt/nuxt @ v4.0.3 — directory structure
    last_modified: 2026-07-30
  - id: use-fetch
    resource: https://github.com/nuxt/nuxt/blob/7f3c9e1/packages/nuxt/src/app/composables/fetch.ts
    title: nuxt/nuxt @ v4.0.3 — useFetch implementation
    last_modified: 2026-07-30
```

Pin the URL to the **SHA**, not the tag — a tag-pinned link rots the same way `latest` does.
`index.md` is reserved and carries no frontmatter, so its sources live in `pin.md`.

The v0.1 form was a `# Citations` body section. It still parses, and the validator warns on it
until it's migrated.
