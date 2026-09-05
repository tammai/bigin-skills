# Plan: nuxt-marketing stack profile

Status: in-progress
Branch: feat/nuxt-marketing-profile

## Spec

**What:** Add an eighth stack profile for multi-locale Nuxt marketing sites — `@nuxt/content`
collections, Tailwind, Cloudflare Workers with static assets, no auth and no BFF. The seven
current profiles all assume a developer is the only editor: `nuxt` writes BFF-proxy and
Pinia-Colada conventions a marketing site has no use for, and none of them can express the rule
that matters here — a client's content editor may change content files and nothing else. This
profile becomes the Marketing Site Factory's site-repo harness, so that boundary lives here
rather than being duplicated per site.

**Inputs/outputs:** Input is a repo the Factory's template has already scaffolded. Output is the
harness `bigin-harness-setup` writes for it: `CLAUDE.md`, five `.claude/rules/` files,
`.claude/settings.json`, `.vscode/settings.json`, commit-time gates, CI. Detection resolves
`PROFILE=nuxt-marketing` with no question asked.

**Detection** — a new rung *above* `nuxt`, for the same first-match-wins reason `tauri` sits
above it. Four conditions, all required:
1. `nuxt.config.ts`/`.js` present, and
2. `@nuxt/content` in `dependencies`, and
3. `@nuxtjs/i18n` in `dependencies`, and a `content/` directory or `content.config.ts` present, and
4. no auth markers — no `nuxt-auth-utils`, no `@sidebase/nuxt-auth` in dependencies.

Conditions 3 and 4 are the narrowing test: a fullstack Nuxt app with a docs section carries the
first two and must stay on `nuxt`. **`server/api/**` is deliberately not tested.** Form and
newsletter endpoints live in the Nuxt app's own `server/api/`, per the brief's one-Worker-per-site
constraint, so testing for their absence would reclassify a site as `nuxt` the moment it grew a
contact form — correct at install and wrong forever after. The cost is accepted: an auth-less
fullstack app that uses both `@nuxt/content` and `@nuxtjs/i18n` and keeps a `content/` tree would
match, and that is rarer than a marketing site with a form. The empty-repo question is **not** extended — this repo has no
scaffolder for a marketing site, and offering a choice it cannot scaffold is the failure mode
`profile-generic.md` already warns about for Flutter packages.

**Rule files** — new `rule-files.md` matrix row: `conventions-frontend.md` +
`conventions-content.md`, `testing.md` yes, `architecture.md` addendum yes.

`conventions-content.md` is the profile's reason to exist. Scoped to `content/**` and `i18n/**`,
it carries the client-editor boundary: content files and locale bundles are editable; routing,
locale set, block types, collection schemas and deploy config are not. A collection schema and
the content written against it change together. Absent or unreviewed content is hidden, never
substituted with another locale.

**Architecture addendum** — four boundaries every marketing site inherits: content -> pages ->
blocks (blocks never query content); the site is one Worker, and its `server/api/` routes exist
only for forms and newsletter — no BFF proxy, no data layer, no second deployable; no colour, type, spacing or motion literal outside the generated token set;
a locale's missing content is hidden rather than filled from the default locale.

**Commit-time gates** — three greps, each about a string rather than a syntax tree, so none is
expressible as a lint rule:
1. No hex or `rgb()` colour literal under the component and block trees.
2. No `fallbackLocale` in the i18n config — one string that exactly contradicts
   hidden-not-substituted.
3. No raw `<img` outside the allowed asset paths.

**CI** — build, prerender all locales, run the three greps, run the knowledge validator. Deploy
stays out: it belongs to the site's own workflow, which the Factory owns.

**Edge cases:**
- A Tauri app whose frontend uses `@nuxt/content` — `tauri` still wins, being higher on the
  ladder. Leave that rung untouched and test the ordering.
- A `nuxt` fullstack app with a docs section — must resolve to `nuxt`, per conditions 3 and 4.
- `@nuxt/content` in `devDependencies` only — not a match; a marketing site ships it at runtime.
- A marketing site that later grows one authenticated route — no longer this profile; documented
  as a re-run of setup, not a silent reclassification.
- `INSTALL_MODE=new` with existing rule files — every write skips, per the shared rule.
- The skill's own `description:` frontmatter must name the new profile, and
  `tools/context_budget.mjs` caps that field at 350 chars — the edit has to fit.

**Security considerations:** No auth, sessions, PII or untrusted input in the change itself — it
authors templates. Two things the templates must get right, and this is the cheap place to fix
them: the form-route rules must state Turnstile verification, rate limiting and payload
validation as requirements rather than suggestions, and `conventions-content.md` must treat
content as untrusted input, since an agent-driven editor writes it — schema-validated at build,
never rendered as raw HTML unsanitised.

**Testing strategy:** This repo tests skills by eval, not unit test. Add trigger cases to
`skills/bigin-harness-setup/evals/evals.json` covering all four detection outcomes (marketing
markers -> `nuxt-marketing`; fullstack-with-docs -> `nuxt`; Tauri-with-content -> `tauri`;
devDependency-only -> not a match). Then the mechanical gates, which are what actually block a bad
commit: `node tools/context_budget.mjs`, `node tools/docs_sync.mjs --check`,
`node tools/site_build.mjs --check`. Plus a manual detection dry-run against the Factory's
template layout, tracked as its own row.

**Not in scope:**
- A scaffolder for empty repos. Detection-only.
- Any change to the seven existing profiles, including `nuxt`. Condition 3 keeps them untouched.
- The Factory's per-site content-editing skills — that pipeline's deliverable, not the profile's.
- Cloudflare deploy workflow generation.
- Migrating this repo's own harness onto the profile; it harnesses a pipeline, not a site.

**Docs and release:** README's hand-maintained profiles table gains a row; `docs/USER_GUIDE.md`
and `docs/GATES.md` gain the profile and its three gates; the skill `description:` names it;
`CHANGELOG.md` gets a `1.88.0` entry — minor, new surface — with the version mirrored across
`.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json` and both `marketplace.json` files,
which `docs_sync.mjs --check` enforces.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Eval cases first — four detection outcomes in `evals/evals.json` | Done | Four cases added. **The eval format is `query`+`should_trigger` only — it cannot assert which profile resolves.** Detection outcomes are verified by row 15, not here. Amendment 2 |
| 2 | `references/profile-nuxt-marketing.md` — Commands + CLAUDE.md template | Done | Copy section shape from profile-nuxt.md and profile-tauri.md — Detection summary at :5 carried the reverted design — fixed. Amendment 2 |
| 3 | Same file — `conventions-frontend.md` + `conventions-content.md` templates | Done | conventions-content.md is the editor boundary; scope `content/**`, `i18n/**`. Separate-form-Worker wording removed. Amendment 2 |
| 4 | Same file — `testing.md` template + architecture addendum | Done | Boundary 2 rewritten — one Worker per site, `server/api/` for forms and newsletter only. Amendment 2 |
| 5 | Same file — `settings.json` + `.vscode/settings.json` templates | Done | |
| 6 | `references/profile-detection.md` — new rung above `nuxt`, three conditions | Done | Four conditions; `server/api/**` deliberately untested, with the accepted cost stated inline. Empty-repo question still not extended. Amendment 2 |
| 7 | `references/rule-files.md` — matrix row + "what differs" bullet | Done | |
| 8 | `references/hook-guard.md` — the three grep gates | Done | Chain behind an existing hook manager if present, as tauri does |
| 9 | `references/ci.md` — profile CI section | Done | Build + prerender + greps + knowledge validator; no deploy |
| 10 | Profile enumerations: `SKILL.md`, `scaffold-delegation.md`, `overlay-matrix.md`, `summary-checklist.md`, `files-shared.md`, `decision-bundle.md` | Done | Grep for every list of seven profiles; miss one and the profile half-exists — SKILL.md's detection table and its `references/` pointer carried the reverted design — fixed. Amendment 2 |
| 11 | Skill `description:` frontmatter names the profile | Done | Must stay under context_budget's 350-char cap |
| 12 | Docs: README profiles table, `docs/USER_GUIDE.md`, `docs/GATES.md` | Done | README table + GATES carried no condition wording; USER_GUIDE row 97 rewritten to four conditions. Amendment 2 |
| 13 | `CHANGELOG.md` 1.88.0 entry + version mirrored in four manifests | Done | 1.88.0 entry reworded to four conditions; version stays 1.88.0 (correct next minor after 1.87.3). **CHANGELOG still lacks the 1.87.3 entry — comes in on the merge from main.** Amendment 2 |
| 14 | Verify: `context_budget`, `docs_sync --check`, `site_build --check` all pass | Done | Re-run after Amendment 2 sweep — all three pass |
| 15 | Verify: manual detection dry-run against the Factory template layout | Not started | Tracked row — cannot close the plan while open — Dry-run must be re-run against the amended ladder. Amendment 1 |
| 16 | `.claude/rules/skill-authoring.md` — add `nuxt-marketing` to the profiles that lint `.claude/guards/**` | Done | `nuxt-marketing` added to the guard-lint profile list; profile confirmed to lint via `@nuxt/eslint`. Amendment 2 |

## Amendments

- **2026-09-04 — Amendment 1: condition 3 was self-contradictory; forms stay in the Nuxt app.** The
  spec's condition 3 (`no server/api/**`) and its architecture boundary 2 (Worker routes for forms
  and newsletter) described the same directory as forbidden and required. Detection would have been
  correct at install and wrong from the first contact form onward. The implementation resolved it by
  moving forms to a separate Worker; that contradicts the brief's Cloudflare constraint — one
  deployable per site — so the resolution is reversed: forms live in the app's `server/api/`, and
  detection narrows on auth markers plus positive i18n/content markers instead. Rows 1, 3, 4, 6, 12,
  13 and 15 return to `Not started`; row 16 added for the `skill-authoring.md` lint list the
  implementation correctly flagged but could not touch. Rows 2, 5, 7, 8, 9, 10, 11 and 14 stand.
- **2026-09-04 — accepted scope additions.** Two enumerations outside the plan's listed files were
  edited because omitting them would leave the profile half-existing: `profile-generic.md`'s
  fallthrough marker list, and `.claude/skills/harness-audit/SKILL.md`'s "six profile settings.json
  templates" count. Enumeration only; no rule or template content changed.
- **2026-09-05 — Amendment 2: the Amendment 1 sweep, plus two rows it missed.** Amendment 1 reset
  seven rows but left rows 2 and 10 marked Done while both still carried the reverted
  separate-form-Worker design — `profile-nuxt-marketing.md:5` and `SKILL.md`'s detection table, the
  most-read surface of the eight. The design is now consistent across all seven files that state it:
  four conditions (`nuxt.config.ts`, `@nuxt/content`, `@nuxtjs/i18n` + a `content/` tree, no auth
  marker), `server/api/**` deliberately untested, forms and newsletter in the app's own `server/api/`
  at one Worker per site. Rows 1, 3, 4, 6, 12, 13, 14 and 16 close. **Row 15 remains open and still
  blocks the plan** — the manual detection dry-run against the Factory template layout has never been
  run, and it is the only check that can verify a detection outcome, since the eval format asserts
  skill triggering and nothing more.
