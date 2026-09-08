# Plan: Polyrepo project standard — contract-sync, repo types, story sync, Flutter handoff

Status: approved
Branch: main

Source: `bigin-skills-polyrepo-upgrade.zip` — `SPEC-polyrepo-standard.md` (umbrella),
`SPEC-contract-sync.md`, `SPEC-figma-handoff-flutter.md`, four templates. Those specs are
drafts at spec-gate and **several of their factual claims about this repo are wrong**; the
corrections in "Spec corrections" below are part of the approved scope, not optional
cleanup. Implement against this file, not against the zip.

---

## Spec

**What.** Teach `bigin-skills` the six-repo project standard: a new `contract-sync` skill
that vendors an OpenAPI spec into a consumer repo at a pinned commit and regenerates its
client; three new repo types (`specs`, `contracts`, `qa`) in `bigin-harness-setup`; guards
and a SessionStart staleness notice that keep the one-way flow contracts → consumers
honest; a story-sync script and story lint; and a new `flutter-figma-handoff` skill. The
`project-scaffold` skill named in umbrella §8 is explicitly **not** planned.

**Inputs/outputs.** Input is a consumer repo holding `api-contract.lock` plus, for the
harness work, a repo whose name carries a project suffix. Output is: vendored spec files
and generated client code written only by `contract_sync.mjs`; synced story files stamped
`synced: true`; harness bundles (rules, hooks, CI) selected per repo type; deterministic
`ThemeData` emitted from a Figma fork's variables.

**Edge cases.** A tag re-pointed to a different commit (hard fail, both SHAs named). A
fetched blob whose checksum does not match the lock (abort before any write). Two repos
pinning different `file` values at one `commit`. No network and no token (`check` exits 0
with a skip line; `sync`/`bump` fail loudly). A repo whose name ends in `-api` but belongs
to no polyrepo project (suffix is confirmed, never trusted). A story file with its own
frontmatter (merge, never prepend a second block). Docker absent on a Flutter codegen gate
(skip by name, visibly). A `specs` or `qa` repo, whose users are not developers (plain
language in every guard message, no consumer guards installed).

**Security considerations.** This work introduces the repo's first network calls and its
first credential handling — today nothing in `skills/` or `tools/` fetches anything or
shells out to `gh`. Three surfaces: (1) a token is read from `GITHUB_TOKEN` or
`gh auth token` and must never be logged, echoed into an error message, or written to the
lock; (2) fetched YAML is attacker-relevant input — it is checksum-verified against the
lock *before* any write, and never parsed for anything but the checksum comparison; (3)
the GitHub App private key lives in org secrets and is minted per-run, never a long-lived
PAT in a workflow file. The dispatch payload (`tag`, story ID) is untrusted text and is
used only in a PR title after sanitisation, never in a shell command.

**Testing strategy.** Every phase lands with automated coverage in `tools/regress.mjs`,
which the pre-commit hook already runs: a `contract_sync.mjs` group driven against local
fixtures through a test seam (no network in the suite), a repo-name → repo-type mapping
group, and a group asserting each new guard is registered in **both** `.claude/settings.json`
and `.cursor/hooks.json` for every consumer profile. Guards are additionally tested by hand
against both host payload shapes plus malformed and empty stdin, per
`hook-guard.md → ## Testing a guard by hand`, and linted against the `@stylistic` ruleset
`nuxt-scaffold` ships. `docs_sync.mjs --check`, `context_budget.mjs` and
`site_build.mjs --check` gate every commit as they do today.

**Not in scope.** `project-scaffold` (umbrella §8, deferred). QA repo internals and BA
workflow depth (umbrella §9 placeholders). Breaking-change policy and `oasdiff` gating
(contracts-repo workstream). Package publishing for generated clients (rejected by
design). Auto-merging sync PRs. Spec authoring itself.

---

## Decisions taken (2026-09-08)

| # | Question | Decision |
|---|---|---|
| 1a | Local auth for `contract_sync.mjs` | `GITHUB_TOKEN`, then `gh auth token` fallback. `gh` becomes a documented prerequisite. |
| 1b | Cross-repo dispatch auth | Org-installed **GitHub App**, minting short-lived installation tokens per run. |
| 2 | `acme-api`: authors or vendors its spec | **Mode depends on repo type.** `profile-go.md`'s OpenAPI section becomes one section with a two-row mode table; polyrepo `api` vendors, standalone go authors. |
| 3 | Mobile codegen adapter | `openapi-generator` **dart-dio**, pinned by Docker tag, `serializationLibrary: json_serializable`. |
| 4 | Flutter theming | `ColorScheme.fromSeed` + explicit overrides. The fork owes one seed variable plus a named override set. |
| 5 | How the harness learns repo type | **Repo-name suffix, confirmed not trusted**, as a Phase 0a pre-step *before* the 9-row marker ladder — which is therefore left untouched. |
| 6 | R4 with no BMAD in this repo | Ship the Contract-impact fragment + `story_lint.mjs` on stated assumptions; **rework against the live specs repo** when one exists. |
| 7 | Flutter design handoff | A **new skill**, `flutter-figma-handoff`, not a target inside `nuxt-ui-figma-handoff`. |

Umbrella Q3 ("how a story declares UI") is already answered by the zip's own
`templates/story-contract-impact.md`: an explicit `ui: yes | no` flag. Umbrella Q2
(REPO_MAP sync scope) stays open and non-blocking; default to consumers only.

---

## Spec corrections required before implementation

Each was verified against this repo. Implementing the specs verbatim would ship the defect.

**C1 — umbrella §1 overstates what this repo carries.** No BMAD anything ships (`grep -li
bmad` hits only `CHANGELOG.md`, `.claude/rules/skill-authoring.md` and three
`.claude/memory/*.archive.md`). No flutter scaffold exists
(`references/scaffold-delegation.md:56`). `tools/docs_sync.mjs` is a README table generator
for *this* repo (`:1-13`), not a file distributor, and is not templated into target repos.
The figma skill is `nuxt-ui-figma-handoff`, scoped to theming, with no component-mapping
table and no target concept.

**C2 — every codegen adapter row in contract-sync §6 names the wrong output.** Corrected:

| repo type | command | vendored spec | output |
|---|---|---|---|
| `api` (go) | `make generate` | `openapi.yaml` (root) | `internal/openapi/openapi.gen.go` |
| `web` (nuxt) | `pnpm openapi-types` | `openapi.yaml` (root) | `shared/api-client/schema.d.ts`; `layers/shared/api-client/schema.d.ts` on the `starter` template |
| `mobile` | pinned `openapi-generator` (dart-dio) → `build_runner` | `api/openapi.yaml` | `api/generated/**` |

Evidence: `profile-go.md:17,45,79` + `go-scaffold/scripts/scaffold.mjs:38-41,206`;
`profile-nuxt.md:168-174` + `nuxt-scaffold/scripts/scaffold.mjs:627-636`;
`profile-flutter.md:95,210`.

**C3 — the vendored path differs per profile.** `templates/REPO_MAP.md` hardcodes
`api/openapi.yaml`, which is flutter's. It takes a `{{vendored-spec-path}}` substitution,
and guards resolve the path from C2's table.

**C4 — contract-sync §7's PreToolUse rule is not expressible.** "Block writes unless
invoked by `contract_sync.mjs`" — a hook sees a tool call, not process ancestry, and
`isWriteShaped()` never matches a script's own `node:fs` writes. Corrected rule: deny
`Edit`/`Write`/`MultiEdit` on the vendored spec and `api-contract.lock` **unconditionally**.
The script passes by construction, not exemption. Its invocation is added to each consumer
profile's `permissions.allow`.

**C5 — the SessionStart timing criterion is unmeasured.** `check` makes a network call and
§10 asks for "< 2 s". Corrected: `AbortSignal.timeout(1500)`, at most one fetch per session,
result cached under `.claude/memory/`; on timeout or offline, print the lock line alone.

**C6 — "single-file Node" is half right.** Zero runtime dependencies holds (`node:`
builtins only, `go-scaffold/scripts/scaffold.mjs:23-27`); single-file does not — every
scaffolder ships a `scripts/templates/` tree, as contract-sync §9 itself does. State the
constraint as "zero runtime deps, `node:` builtins only".

**C7 — R2's tool must not be called `docs_sync`.** That name is taken by a tool that gates
every commit in this repo. The story distributor is `story_sync.mjs`, shipped as a
templated script inside the specs/consumer profile bundles, never a `tools/` peer.

**C8 — a scaffolded Nuxt repo currently instructs the dev to do by hand what the guard will
block.** `nuxt-scaffold/scripts/scaffold.mjs:731-732` prints "copy its `api/openapi.yaml`
over it and run `pnpm openapi-types`". Phase 1 updates that text.

**C9 — packaging debt per new skill** (`.claude/rules/skill-authoring.md`,
`tools/context_budget.mjs:26`): `evals/evals.json` with at least one case each way, a
`tools/docs-manifest.json` entry, `description` ≤350 chars, README regenerated via
`docs_sync.mjs`, four version fields across three manifests, a CHANGELOG entry. Two new
skills means twice.

**C10 — a PR opened with Actions' own `GITHUB_TOKEN` does not trigger workflows**, so the
auto-PR's drift-check job would never run. The consumer-side `contract-bump.yml` mints an
App token too, not just the dispatching side.

---

## Phases

Dependency order per umbrella §8: contract-sync first, then R1–R5, then the Flutter handoff.

### Phase 1 — `contract-sync` skill

New `skills/contract-sync/{SKILL.md, scripts/contract_sync.mjs, templates/api-contract.lock.json,
templates/workflows/contract-bump.yml, references/lock-format.md, evals/evals.json}`.
Touches `tools/docs-manifest.json`, `README.md` (generated), `CHANGELOG.md`, the version
fields, and `nuxt-scaffold/scripts/scaffold.mjs:731-732` (C8).

`sync` / `check` / `bump <ref> [--file <path>]` per contract-sync §5, with C2's adapter
table, C3's path resolution, C5's timeouts, and 1a's auth chain. Codegen is always the
repo's own pinned command — the script carries no codegen logic.

**Done when:** the new `regress.mjs` group is green on four cases — checksum mismatch leaves
no partial write; a moved tag fails naming both SHAs; two `file` values at one `commit` both
resolve; offline `check` exits 0 with the skip line — and `docs_sync --check` plus the budget
gate pass.

### Phase 2 — repo types (R1)

Phase 0a in `bigin-harness-setup/SKILL.md`: read the repo-name suffix, show it, allow
correction; `specs`/`contracts`/`qa` short-circuit the marker ladder, `api`/`web`/`mobile`
proceed to today's stack detection and store a role flag. The 9-row ladder and its
`regress.mjs:44-46` transcription are **not** touched.

New `references/profile-specs.md`, `profile-contracts.md`, `profile-qa.md`; rows in
`overlay-matrix.md`; `scaffold-delegation.md` states these three have no scaffolder.
`profile-go.md`'s OpenAPI section becomes decision 2's two-row mode table — one table, not
two prose blocks.

**Done when:** a `regress.mjs` suffix-mapping group covers each type plus "no suffix →
behaviour unchanged", and a harness run on a fresh `-specs` repo installs no consumer guards.

### Phase 3 — guards (R3a) + staleness (R5) + contract-sync §7

One new guard in `hook-guard.md` blocking `synced: true` files, the vendored spec and
`api-contract.lock`, written to C4's rule. `session-resume-check.mjs` is **extended** with
the staleness lines — not joined by a second SessionStart script, which would compete for
the same one-shot context injection. Registered in both host manifests for every consumer
profile, `failClosed: true` on the blocking one. CHANGELOG `patch` blocks —
`mode: create-if-missing` for the new guard — so already-scaffolded repos pick it up.

**Done when:** heredoc payload tests pass on both Claude Code and Cursor shapes plus
malformed and empty stdin; the guard is ESLint-clean under `nuxt-scaffold`'s stylistic
config; the both-hosts registration group is green.

### Phase 4 — story sync (R2)

`story_sync.mjs` (C7) as a templated script in the specs/consumer bundles, plus dispatch
workflow templates in `ci.md`. Stamps `synced: true` on the **consumer copy only** — the
BA's file in `acme-specs` is never modified — merging into existing frontmatter rather than
prepending. Freshness compares a checksum of the body below the frontmatter, since the copy
differs from source by the injected key. `stories/` is generated wholesale (deletes
propagate); `story-meta/` never enters the sync path.

**Done when:** a fixture round-trip proves a deleted story disappears from the consumer, a
story with pre-existing frontmatter gains one key rather than a second block, and a
sidecar under `story-meta/` survives a wholesale regeneration untouched.

### Phase 5 — story template + lint (R4)

Ship `templates/story-contract-impact.md` from the zip plus `story_lint.mjs`, on decision
6's assumptions, all of which live in **one parsing function** with the list written above
it so the rework is localized:

1. Stories are markdown, one per file, `docs/stories/<ID>.md`, same path in consumers.
2. ID shape `ST-<digits>`; the sidecar filename matches it exactly.
3. The section is an H2 spelled `## Contract impact`, holding three `- key: value` lines.
4. `contracts:` is `none` or `<service>.v<major>` with optional ` — <text>`; `breaking:`
   and `ui:` are `yes|no`.
5. Everything else in the story is ignored.

**Done when:** the lint passes the zip's own template, fails on each of a missing section, a
bad `contracts:` value and a missing `ui:` key, and ignores unrelated story content.

### Phase 6 — remaining gates (R3b, R3c, R3d)

Ready-for-dev gate (a story with `ui: yes` needs a sidecar carrying a Figma node-id and
`status: final`), orphan-sidecar CI warning, PR-title/body story-ID lint — as CI steps per
consumer profile in `ci.md`, GitHub and GitLab both.

**Done when:** each gate has a passing and a failing fixture, and the ready-for-dev failure
message names the sidecar path to create, not the story to edit.

### Phase 7 — `flutter-figma-handoff` skill

New sibling skill (decision 7) selected by the `mobile` profile: `references/flutter-mapping.md`
(M3 component → Flutter widget + key props), a token adapter emitting `ColorScheme.fromSeed`
plus the fork's named overrides (decision 4) in deterministic order, and a pruning-list check
that fails by naming the unshipped component. `nuxt-ui-figma-handoff` is not touched, which
is what makes its "behaviour unchanged" criterion true by construction. The ~10-line Figma-URL
preamble is duplicated, not extracted — TemPad Dev is a Nuxt UI plugin with no Flutter
equivalent, so the fallback advice legitimately differs.

Blocked on the forked kit existing as a Figma team library.

**Done when:** a frame from the fork hands off using only mapped widgets; a seed change
alters theme files only; a pruned component fails by name.

---

## Risks

1. **`docs_sync` name collision.** Two tools, one name, one already gating every commit
   here. → C7: the new one is `story_sync.mjs` and never a `tools/` peer.
2. **Decision 2 is a silent breaking change for standalone Go repos.** → The mode table
   ships in the same commit as the repo-type pre-step, with a CHANGELOG `patch` block so
   already-scaffolded repos get the right variant.
3. **The guard surface grows and both hosts must stay in step** — this repo's own history
   says that defect species ships repeatedly. → One body, both payload shapes, tests in the
   same commit, plus a regress group asserting both-host registration per consumer profile.
4. **A network call at session start.** → C5's timeout, cache and one-fetch-per-session
   rule; degrade to the lock line rather than blocking.
5. **Nothing is provable here.** "A story merged in specs produces auto-PRs in all
   consumers" cannot be tested inside `bigin-skills` at all. → Nominate one pilot project,
   gate Phases 4–6 on it, and keep Phase 1 standalone-usable in existing repos as
   contract-sync §8 already assumes.

---

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Apply spec corrections C1–C10 to the three source specs and four templates | Done | Corrected copies live in `docs/polyrepo/`; the flutter spec was renamed to `SPEC-flutter-figma-handoff.md` per decision 7 |
| 2 | `contract-sync`: `contract_sync.mjs` (sync/check/bump, auth chain, checksum + moved-tag failure paths) | Done | 560 lines, `node:` builtins only. Verified against a real repo: moved tag, checksum abort, happy path, multi-contract paths, all adapter-readiness aborts |
| 3 | `contract-sync`: SKILL.md, references/lock-format.md, templates (lock + `contract-bump.yml` with the App-token mint, C10) | Done | Also shipped `contract-drift.yml` (spec §7's CI layer, unassigned in this table) and evals + manifest entry, which `docs_sync --check` requires the moment a SKILL.md exists |
| 4 | `regress.mjs` group for `contract_sync.mjs` (4 cases, local fixtures, no network) | Done | 8 cases via a loopback fixture server; mutation-tested (3 mutations, each caught by its own case). Build group renumbered 7→8 |
| 5 | Update `nuxt-scaffold/scripts/scaffold.mjs:731-732` hint text | Done | Names both flows: hand-copy is still right standalone, contract-sync owns it in a polyrepo |
| 6 | Harness Phase 0a: repo-type from name suffix, confirmed; ladder untouched | Done | Name-based, so it is a pre-step rather than a ladder rung — the 9 rows are byte-identical. Phase 0.5 and Phase 2 updated for the skip and the CLAUDE.md record |
| 7 | `profile-specs.md`, `profile-contracts.md`, `profile-qa.md` + overlay-matrix + scaffold-delegation rows | Done | Gate sets differ per profile (6/8/8 of the nine), argued in overlay-matrix's new section — a gate whose premise is false teaches people to work around gates |
| 8 | Vendored-vs-authored mode statement in `profile-go.md`, `profile-nuxt.md` and `profile-flutter.md` | Done | Shared rule single-sourced as `.claude/rules/vendored-contract.md` in `files-shared.md`; each profile keeps a two-row mode table. Also fixed a live defect: go's `paths:` named `api/openapi.yaml`, a file go repos do not have, so the architecture rule never loaded on the contract |
| 9 | `regress.mjs` suffix-mapping group | Done | Added to group 4 rather than renumbering again: 12 name cases, the ladder-still-nine-rungs assertion, and a cross-check of overlay-matrix's 6/8/8 claim against the settings JSON each profile writes |
| 10 | New synced/vendored-path guard in `hook-guard.md`, both hosts, C4's rule | Done | `vendored-contract-guard.mjs`. Caught a symlink bug in it via regress: git's `--show-toplevel` returns a realpath, `resolve()` does not, so on macOS the guard allowed everything |
| 11 | Extend `session-resume-check.mjs` with staleness lines (C5 budget) | Done | Extended, not duplicated. 2.5 s subprocess backstop on top of the script's own 1500 ms fetch cap; silent on failure, absent lock, or missing script |
| 12 | Register the guard in every consumer profile's `.claude/settings.json` + `.cursor/hooks.json`; CHANGELOG patch blocks | Done | Conditional on `REPO_TYPE`, so it is registered from SKILL.md Phase 5-3 and cursor-parity rather than a static profile block |
| 13 | `regress.mjs` both-hosts guard-registration group | Done | In group 6: parses every guard out of the profile blocks and SKILL.md, diffs against cursor-parity, minus the three documented Claude-only scripts. Mutation-verified |
| 14 | `story_sync.mjs` + dispatch workflow templates in `ci.md` | Done | Consumer-pull, symmetric with contract_sync. Deletes only files carrying the marker it wrote — a hand-added file in a synced directory is kept and reported |
| 15 | `story_lint.mjs` + Contract-impact fragment, assumptions isolated in one function | Done | All five assumptions in `parseContractImpact()` with the list above it. Keys under a later heading do not satisfy the section |
| 16 | R3b/c/d CI gates in `ci.md`, GitHub + GitLab | Done | `story_gate.mjs` with three subcommands. `ready` runs against the stories a PR names, not every story — otherwise it would fail the story-sync PR on the day a story arrives |
| 17 | `flutter-figma-handoff` skill (mapping reference, token adapter, pruning check) | Done | Built against the **stock** M3 kit rather than a fork (2026-09-08 decision), which makes the mapping table itself the pruning list — a component with no row stops the handoff |
| 18 | Flutter profile: collapse the generator "or", two-step `generate:`, Docker-absent skip in both gates | Done | `tool/generate_api.sh` written out with a pinned Docker tag; CI regenerates and diffs it, skipping by name when Docker is absent |
| 19 | Packaging debt for both new skills (C9) | Done | Both skills: evals with cases each way, manifest entries, descriptions at 264 and 293 chars, README and site regenerated |
| 20 | Version bump + CHANGELOG + stale-docs sweep before release | Done | Each release swept at commit time; this final pass fixed six claims the seven releases invalidated and linked docs/polyrepo/, which nothing referenced |
