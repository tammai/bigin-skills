# Polyrepo project standard — corrected specs

Source: `bigin-skills-polyrepo-upgrade.zip`. These are the **corrected** copies — the zip's
drafts asserted several things about this repo that are not true, and implementing them
verbatim would ship the defect. Corrections C1–C10 are recorded in
[`../../PLAN.md`](../../PLAN.md), which governs; each spec marks where one was applied.

| Path | What it is |
|---|---|
| [`SPEC-polyrepo-standard.md`](./SPEC-polyrepo-standard.md) | Umbrella: repo model, session model, sidecar convention, R1–R5. Read first. |
| [`SPEC-contract-sync.md`](./SPEC-contract-sync.md) | New skill: lock format, sync/check/bump, codegen adapters, guards, dispatch flow. |
| [`SPEC-flutter-figma-handoff.md`](./SPEC-flutter-figma-handoff.md) | New sibling skill (renamed from `SPEC-figma-handoff-flutter.md`); M3 Design Kit fork as the shared design base. |
| [`templates/REPO_MAP.md`](./templates/REPO_MAP.md) | System map, seeded into `<project>-specs` and synced everywhere. |
| [`templates/story-contract-impact.md`](./templates/story-contract-impact.md) | BMAD story template addition (R4). |
| [`templates/story-meta.schema.yaml`](./templates/story-meta.schema.yaml) | Dev-owned sidecar linking a story to Figma + component context. |
| [`templates/api-contract.lock.json`](./templates/api-contract.lock.json) | Lock file shape consumed by `contract_sync.mjs`. |
| [`PILOT.md`](./PILOT.md) | The six-repo pilot that validated all of the above, and the thirteen defects it found. |

## What changed from the drafts

| # | Correction |
|---|---|
| C1 | Umbrella §1 overstated what ships. No BMAD, no flutter scaffold; `docs_sync.mjs` is a README generator, not a distributor; the figma skill is Nuxt-UI-theming-only with no component mapping. |
| C2 | Every codegen adapter row named an output this repo does not produce. Corrected against the profiles and scaffolders, with file evidence. |
| C3 | The vendored spec path differs per repo type; `REPO_MAP.md` hardcoded flutter's. Now a `{{vendored-spec-path}}` substitution. |
| C4 | "Block writes unless invoked by `contract_sync.mjs`" is not expressible in a PreToolUse hook. The deny is unconditional; the script passes by construction. |
| C5 | "SessionStart adds < 2 s" was unmeasurable against an unbounded fetch. Now a 1500 ms timeout, one fetch per session, cached. |
| C6 | "Single-file Node" — zero *runtime dependencies* is the real convention; every scaffolder ships a templates tree. |
| C7 | R2's script cannot be called `docs_sync`; that name gates every commit here. It is `story_sync.mjs`. |
| C8 | A scaffolded Nuxt repo currently tells the dev to hand-copy the spec — the exact edit the new guard blocks. Phase 1 fixes that text. |
| C9 | Packaging debt per new skill: evals, manifest entry, ≤350-char description, README regeneration, four version fields, CHANGELOG. Twice, for two skills. |
| C10 | A PR opened with Actions' own `GITHUB_TOKEN` triggers no workflows, so the consumer side mints a GitHub App token too or its drift check never runs. |

## Decisions taken 2026-09-08

Local auth `GITHUB_TOKEN` → `gh auth token`; dispatch via an org-installed GitHub App;
`acme-api` spec ownership by repo-type mode; mobile codegen `openapi-generator` dart-dio
pinned by Docker tag; Flutter theming `ColorScheme.fromSeed` + overrides; repo type from
the confirmed repo-name suffix in a Phase 0a pre-step; R4 shipped on stated assumptions for
rework; Flutter handoff as a new sibling skill. Rationale for each: `PLAN.md` → Decisions.

**Still open, both non-blocking:** REPO_MAP sync scope (defaulting to consumers only), and
whether the lock file carries a `contractSync` override block.
