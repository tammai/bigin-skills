# Spec: Polyrepo Project Standard — bigin-skills upgrade

- **Status:** Approved (decisions recorded §11; corrections C1–C10 applied 2026-09-08)
- **Target release:** bigin-skills vNext
- **Owner:** Tam Mai
- **Companion specs:** [SPEC-contract-sync.md](./SPEC-contract-sync.md), [SPEC-figma-handoff-flutter.md](./SPEC-figma-handoff-flutter.md)
- **Implementation plan:** [../../PLAN.md](../../PLAN.md) — that file governs; this one states the requirement.

---

## 1. Problem Statement

BigIn client projects need one repeatable structure for teams of dev, QA, design, and BA, covering webapp + mobile frontends, one or more REST APIs, BMAD specs, manual + automated QA, and Figma design. Today each project improvises its layout, agent sessions have no defined boundaries across repos, and non-dev artifacts (stories, test cases, designs) reach dev sessions ad hoc.

**What bigin-skills actually carries today** (C1 — the draft overstated this, and three of the five named pieces do not exist):

| Building block | Reality |
|---|---|
| Stack profiles + governance overlay | **Exists.** `bigin-harness-setup`, 8 profiles, 9-row detection ladder. |
| Guard hooks | **Exists.** Nine gates plus three non-gates, one body per guard across Claude Code and Cursor via `.claude/guards/lib/hook-io.mjs`. |
| Scaffolders | **Partial.** go, next, nodejs, nuxt, nuxt-marketing. **No flutter scaffold** — `references/scaffold-delegation.md:56` delegates to `flutter create`. |
| Figma handoff | **Partial.** `nuxt-ui-figma-handoff` only, scoped to Nuxt UI theming (`main.css` `@theme`, `app.config.ts` `ui.*`). No component-mapping table, no target concept. |
| BMAD | **Absent.** Nothing ships. No `.bmad-core` seed, no story template, no skill. |
| Cross-repo file sync | **Absent.** `tools/docs_sync.mjs` regenerates *this* repo's README tables and is not templated into target repos. R2 is a new script, not an extension (C7). |

So the standard is mostly new construction on an existing harness, not wiring together pieces that are already there.

## 2. The repo model

Six repos per project, prefix = project slug (examples use `acme`):

| Repo | Owner | Holds | Does NOT hold |
|---|---|---|---|
| `acme-specs` | BA | BMAD docs (`.bmad-core`, prd, architecture, epics, stories, qa gates), `REPO_MAP.md` source, `ux/figma-links.md` | code, test automation |
| `acme-contracts` | dev (BE+FE review) | `openapi/<service>.v<major>.yaml` (3.0.x, versions coexist as files), changelog, lint + `oasdiff` + dispatch CI | generated clients as packages |
| `acme-api` | dev | Go per go-scaffold; vendored spec + lock; `docker-compose` for local full-stack | spec authoring |
| `acme-web` | dev | Nuxt 4 per stack defaults; vendored spec + lock; synced stories + `story-meta/` | spec authoring |
| `acme-mobile` | dev | Flutter per the flutter profile; vendored spec + lock (may pin an older `file`); synced stories + `story-meta/` | spec authoring |
| `acme-qa` | QA | manual test cases, E2E automation, traceability | unit/integration tests (live with code) |

**`acme-api` is the row that changes shipped behaviour.** `profile-go.md:133-134` today makes "write `openapi.yaml`, then `make generate`, then the handler" the central backend rule, with the file authored at api-repo root. Under this standard a polyrepo `api` repo vendors that file instead. Both modes stay supported: the profile's OpenAPI section becomes **one section with a two-row mode table** — polyrepo `api` vendors, standalone Go authors — selected at install time from the repo type, with `api-contract.lock` presence as the detection fallback on re-runs.

Ownership is enforced by CODEOWNERS, split content vs structure: BA/QA own their content and merge without dev approval; dev owns `.github/workflows/`, `.claude/`, sync scripts, and templates in every repo. Content quality is validated by CI, not by dev review.

## 3. Session model

One Claude Code session per repo — hooks, rules, and token budgets all load per project root. The routing rule: **the repo where the output lands is the repo where the session opens.** Cross-cutting stories do not get a parent-folder session; they get a sequence: contracts session first (interface), then api/web/mobile sessions in parallel (Orca worktrees), then qa.

## 4. Data flow between repos

| Flow | Mechanism | Trigger |
|---|---|---|
| story + REPO_MAP → consumers | `story_sync.mjs` (C7 — **not** `docs_sync.mjs`; that name is taken by a tool that gates every commit in bigin-skills) | merge in `acme-specs` → dispatch → auto-PR |
| contract → consumers | `contract_sync.mjs` (companion spec) | merge in `acme-contracts` → dispatch → auto-PR |
| design → dev session | `flutter-figma-handoff` / `nuxt-ui-figma-handoff`, keyed by node-id from `story-meta/` sidecar | dev pulls during implementation |
| staleness signal | SessionStart hook, check-only | session open |

Sync is event-driven; sessions never write on start. SessionStart reports lock vs latest and open sync PRs; the dev decides when to merge — mobile deliberately absorbing contract bumps later than web is a supported state, handled by version files, not by branches.

**Dispatch auth is an org-installed GitHub App** minting short-lived installation tokens per run. Actions' own `GITHUB_TOKEN` cannot fire `repository_dispatch` at another repo, and (C10) a PR opened with it does not trigger workflows — so the *consumer* side mints an App token too, or the auto-PR's own drift check never runs.

## 5. Story metadata — sidecar convention

Synced artifacts are never edited in consumer repos. Dev-side context attaches as a sidecar:

```
docs/stories/ST-042.md        # synced, generated wholesale, read-only
docs/story-meta/ST-042.yaml   # dev-owned, outside the sync path
```

Sidecar schema: [templates/story-meta.schema.yaml](./templates/story-meta.schema.yaml). Separate directories let the sync treat `stories/` as fully generated (deletes propagate) while `story-meta/` never enters the sync path. The same pattern is reserved for `acme-qa` (`test-meta/` linking test cases to stories).

The `synced: true` stamp lands on the **consumer copy only** — the BA's file in `acme-specs` is never modified, so this does not collide with the rule that nothing edits BA-produced artifacts. Two consequences: the sync merges into existing frontmatter rather than prepending a second block, and freshness compares a checksum of the body *below* the frontmatter, since the copy differs from source by the injected key.

## 6. Validation — one script, three tiers

Every format rule ships as a Node script with zero runtime dependencies (`node:` builtins only, < 1 s) and runs three times: PostToolUse hook in-session (the primary feedback loop — the agent fixes findings before the human sees them), pre-commit, and CI as the final net. CI is never the first place an error surfaces.

C6: "single-file" is not part of the convention — every scaffolder in this repo ships a `scripts/templates/` tree beside its script, as `contract-sync` does itself. Zero *runtime dependencies* is the actual rule.

## 7. Requirements on bigin-skills

**R1 — repo type.** Add `repo-type: specs | contracts | api | web | mobile | qa`. There is no existing "harness dimension" to add it alongside (C1): there is one `PROFILE` from a 9-row first-match-wins marker ladder whose ordering is load-bearing and transcribed in three places. So repo type is **detected from the repo-name suffix in a Phase 0a pre-step that runs before the marker ladder** — the standard mandates the naming, the suffix is a stronger signal than any file marker (`qa` has none), and the ladder is left untouched. The suffix is shown and correctable, never silently trusted. `specs`/`contracts`/`qa` short-circuit the ladder; `api`/`web`/`mobile` proceed to today's stack detection and store a role flag. `specs` and `qa` profiles are designed for non-dev users: plain-language guard messages, planning/QA skills only.

**R2 — story sync.** A new `story_sync.mjs` (C7) distributes story files and `REPO_MAP.md` from specs to consumer repos; marks synced files with frontmatter `synced: true` per §5; treats target `stories/` directories as generated wholesale. Shipped as a templated script inside the profile bundles, never as a `tools/` peer in this repo.

**R3 — guards.**
(a) PreToolUse: deny `Edit`/`Write`/`MultiEdit` on files carrying `synced: true` frontmatter, on the vendored contract path, and on `api-contract.lock` — **unconditionally** (C4). "Unless invoked by `contract_sync.mjs`" is not expressible: a hook sees a tool call, not process ancestry, and `isWriteShaped()` never matches a script's own `node:fs` writes. The script passes by construction, not exemption.
(b) Ready-for-dev gate in consumer repos: a story with `ui: yes` but no sidecar carrying a Figma node-id and `status: final` cannot enter a sprint. The failure message names the sidecar path to create, not the story to edit.
(c) Orphan check: sidecar without a matching story → CI warning.
(d) PR lint: title or body must reference a story ID.

**R4 — BMAD story template.** One required section, filled by BA/architect at write time:

```markdown
## Contract impact
- contracts: none | <service>.v<major> — endpoints touched
- breaking: yes | no
- ui: yes | no
```

Design impact is NOT in the template — it lives in the sidecar (§5), filled by dev. A `story_lint.mjs` enforces the section's presence and values at write time; the Figma link is enforced at the ready-for-dev gate instead.

Because no BMAD template ships here to append to, and §9 forbids planning BA workflow depth, R4 ships as the fragment plus the lint, built on **stated assumptions** isolated in one parsing function, for rework against the first live specs repo. The assumptions are listed in `PLAN.md` Phase 5.

**R5 — SessionStart staleness check.** Consumer repo types run `contract_sync.mjs check` plus a story-sync freshness compare; print notices, write nothing, skip silently offline. This **extends `session-resume-check.mjs`** — it does not add a second SessionStart script, which would compete for the same one-shot context injection. Budget per C5: `AbortSignal.timeout(1500)`, at most one fetch per session, result cached under `.claude/memory/`; on timeout or offline, print the lock line alone.

## 8. New skills

| Skill | Status | Scope |
|---|---|---|
| `contract-sync` | spec'd (companion) | first to implement — usable by existing projects |
| `flutter-figma-handoff` | spec'd (companion) | a **new sibling skill**, not a target inside `nuxt-ui-figma-handoff` (see companion §2) |
| `project-scaffold` | deferred | orchestrates go-scaffold + `flutter create` + Nuxt skeleton + `.bmad-core` seed + connective tissue (REPO_MAP, locks, CI workflows); write only after the pieces it assembles are proven in a pilot |

## 9. Placeholders (deliberately unresolved)

- **QA repo internals** — structure exists; skills (`test-cases-from-story`, traceability tooling) wait for alignment with the QA team.
- **BA workflow depth** — specs repo may end up dev-synced from BA artifacts elsewhere; profile `specs` ships minimal until aligned with the BA team.
- **Breaking-change deprecation windows** — policy text lives in REPO_MAP per project; contracts CI enforcement (`oasdiff` scope) is a contracts-repo workstream, out of this release.

## 10. Acceptance criteria

- [ ] Harness setup on a fresh repo reads the name suffix, shows the repo type it inferred, accepts a correction, and installs the matching bundle; `specs` contains no consumer-repo guards; a repo with no suffix behaves exactly as today
- [ ] Story merged in specs produces auto-PRs in all consumer repos with `synced: true` files only
- [ ] Editing a synced story or vendored spec in a session is blocked with a plain-language message naming the correct repo to edit
- [ ] A UI story without a sidecar Figma link fails the ready-for-dev gate; adding the sidecar passes it without touching the story file
- [ ] Deleting a story in specs removes it from consumers on next sync and surfaces the orphaned sidecar as a CI warning
- [ ] SessionStart on a stale consumer repo prints lock/latest versions and any open sync PR, makes at most one network call bounded by a 1500 ms timeout, and on timeout or offline prints the lock line alone (C5 — the draft's "< 2 s" was unmeasurable against an unbounded fetch)

## 11. Decisions and open questions

**Decided 2026-09-08:**

1. **Dispatch auth** — org-installed GitHub App, per §4. Local `contract_sync.mjs` auth is `GITHUB_TOKEN` then `gh auth token`; `gh` becomes a documented prerequisite.
2. **Ready-for-dev gate signal** — the explicit `ui: yes | no` flag in the Contract impact section, which `templates/story-contract-impact.md` already carried.
3. **`acme-api` spec ownership** — mode by repo type, per §2.

**Open:**

1. **REPO_MAP sync scope** (non-blocking): sync to qa/specs repos too, or consumers only? Defaulting to consumers only until asked otherwise. — Tam
