---
name: bigin-harness-setup
description: "Scaffolds BigIn's AI workflow harness into a repo — CLAUDE.md brief, path-scoped .claude/rules/, commit-time gates (guard hooks + context-budget check). Profiles: nuxt, go, nodejs, next, generic. Triggers: 'set up harness', 'add AI rules', 'add CLAUDE.md', 'migrate off Spec Kit'."
effort: medium
allowed-tools: Bash(git init) Bash(git rev-parse *) Bash(chmod +x *) Bash(ln -sf *)
---

# bigin-harness-setup

Sets up a standardized AI workflow harness — the `CLAUDE.md` agent brief, path-scoped rules, and commit-time enforcement gates (guard hooks + a context-budget check). Idempotent — re-running on an already-set-up repo is safe.

---

## Phase 0: Detect Stack Profile

Check for stack indicators, first match wins:
1. `nuxt.config.ts` or `nuxt.config.js` → profile = `nuxt`
2. `go.mod` → profile = `go`
3. `package.json` with express/fastify/hono/koa in dependencies → profile = `nodejs`
4. `next.config.ts`, `next.config.js`, or `next.config.mjs` → profile = `next`
5. **Empty repo** (no source files, no manifest of any kind) → ask, since the answer picks the scaffold Phase 0.5 runs:

```
Which stack profile?
1. nuxt   — Nuxt 4 fullstack (Cloudflare Pages): Nuxt UI, Pinia + Colada, VueUse, nuxt-auth-utils, Vitest, Zod — BFF proxy layer, no direct DB access
2. go     — Go REST API backend
3. nodejs — Node.js TypeScript REST API backend
4. next   — Next.js App Router fullstack (Vercel): shadcn/ui, Zustand, TanStack Query, iron-session, Vitest, Zod — BFF proxy layer, no direct DB access

Type 1, 2, 3, or 4.
```

6. **Existing code, no marker matched** → `PROFILE = generic`. Do **not** ask and do not offer the four above — an existing repo that isn't one of them won't become one, and forcing a pick writes conventions for a stack that isn't there. Say one line ("no matching stack profile — installing the stack-neutral harness") and continue to the next phase.

Store result as `PROFILE`. Load `references/profile-{PROFILE}.md` for all template content — `references/profile-generic.md` for `generic`, which states up front what that profile installs and skips.

---

## Phase 0.5: Project Scaffold (empty repo only)

Runs when the repo lacks the marker file for `PROFILE` — `nuxt.config.ts` (nuxt), `next.config.*` (next), `go.mod` (go), `package.json` (nodejs). Skip the phase entirely otherwise; that's onboarding an existing repo. Also skip it entirely for `PROFILE = generic` — there's no scaffold skill for an unknown stack, and generic is only ever reached from a repo that already has code.

Scaffolding is delegated to that profile's own skill and its deterministic script — **not** done conversationally. All questions happen up front, in one batch; zero prompts once scaffolding starts. Per-profile invocation, decisions to gather, and the full procedure: `references/scaffold-delegation.md`.

Set `SCAFFOLDED = true` when the script exits 0; the governance overlay then reconciles with what it provided (Phases 1 and 5).

---

## Phase 0.7: Detect Spec Kit

Runs before Phase 1 — the outcome changes what Phase 1 finds. Check for [GitHub Spec Kit](https://github.com/github/spec-kit) markers (`.specify/`, `.claude/skills/speckit[-.]*`, `.claude/commands/speckit[-.]*`, `specs/<nnn>-<slug>/spec.md`). None present → set `SPECKIT = none` and skip this phase entirely; it's the common case.

Present → read `references/speckit-migration.md` for the layout table, the `migrate | coexist | leave` decision (folded into Phase 1.5's bundle, never asked standalone), the ordered migration procedure, the workflow mapping, and the read-only `tools/speckit-triage.mjs` classifier. Never delete anything before the user has seen the triage table.

---

## Phase 1: Detect Existing Harness

If `SCAFFOLDED = true`, `references/scaffold-delegation.md` → "What each scaffold leaves behind" lists what that profile's script already wrote and how to reconcile: treat it all as pre-existing, and for nuxt/next merge the governance guards the scaffold lacks into the `.claude/settings.json` it created (`bash-guard.mjs`, `spec-gate-guard.mjs`, `bugfix-test-guard.mjs`, `commit-msg-guard.mjs`, the `injection-scan-guard.mjs` / `injection-gate-guard.mjs` pair, `canary-seed.mjs`, governance rules, AI files) rather than writing fresh. For go/nodejs there is no `.claude/` to merge against — continue through Phases 2 onward normally.

Check for existing harness files:
```
CLAUDE.md | AI_TASK_GUIDE.md | AI_REVIEW_CHECKLIST.md | .claude/rules/
```

If any exist, show what was found and ask:
```
Found existing harness files: [list them]

Overwrite all? (yes) / Create missing only? (new) / Patch to latest? (patch) / Cancel? (cancel)
```

- `yes` → overwrite all (show what will be replaced before writing)
- `new` → create only files that don't exist; skip existing ones silently
- `patch` → apply only the specific changes introduced since this repo's harness was last updated (see Phase 1a) — leaves everything else, including hand edits, untouched
- `cancel` → stop immediately

Store choice as `INSTALL_MODE`. If `INSTALL_MODE=patch`, skip directly to Phase 1a — do not fold this question into Phase 1.5's bundle, patch mode needs no further decisions. Otherwise, if this question fires, fold it into Phase 1.5's bundle below as a third question instead of asking it standalone here — resolve it in the same `AskUserQuestion` call.

---

## Phase 1a: Patch Mode (`INSTALL_MODE=patch` only)

Self-contained — skip Phases 1.5 through 8 entirely when this runs; it ends with its own summary. Full procedure in `references/patch-mode.md` (read version, collect eligible `patch` blocks from CHANGELOG.md, apply each by anchor match, write `.claude/harness-version`, print summary).

---

## Phase 1.5: Gather Remaining Decisions

Skip this phase entirely if `KNOWLEDGE_BUNDLE`, `GRAPH`, `CI_PROVIDER`, and `MODEL_ROUTING` are already set (Phase 0.5/0.5b asked them alongside the nuxt-scaffold/go-scaffold batch for the empty-repo branch).

Otherwise, ask **one bundled `AskUserQuestion` call**, before writing any files, combining:

1. **Knowledge Bundle & Graphify** (four-way):
   ```
   Add structured knowledge tracking? (knowledge+graphify / knowledge only / graphify only / none)
   1. knowledge + graphify (default) — knowledge/ concept bundle (decisions, invariants, "why") plus a graphify structural graph of this repo (graphify-out/, query-only navigation aid — see docs/graph-usage.md)
   2. knowledge only — knowledge/ concept bundle, no graph
   3. graphify only — structural graph, no knowledge/ bundle
   4. none — skip both
   See references/knowledge-bundle.md and references/graph.md for what each writes.
   ```
   Store `KNOWLEDGE_BUNDLE` (true for options 1/2) and `GRAPH` (true for options 1/3) — `KNOWLEDGE_BUNDLE` semantics are unchanged from the old yes/no ask.
2. **CI config** (github/gitlab/both/no) — **omit this question entirely if `PROFILE = generic`**; set `CI_PROVIDER = no` and say in the Phase 7 summary that CI wasn't generated (`references/profile-generic.md` → `## CI` has the reason and what to put in a job by hand). Otherwise auto-detect a default first: run `git remote get-url origin 2>/dev/null`; if it matches `github.com` preselect `github`, if `gitlab.com` preselect `gitlab`; if undetermined (no remote, unrecognized host, or ambiguous) preselect `both`. Present the preselected option first/labeled as detected, but let the user override:
   ```
   Add CI config? (github/gitlab/both/no)
   Generates a workflow that runs {LINT} && {TYPECHECK} && {TEST} on push to main and on merge/pull requests.
   ```
3. **Model routing profile** (opus-centric/frontier/lean) — which model ladder `model-router` and `task-workflow` spawn subagents on. Written to `.claude/model-routing.json` at Phase 5-3d:
   ```
   Which model ladder should subagents use? (opus-centric/frontier/lean)
   1. opus-centric (default) — quick=sonnet/low, standard=opus/medium, deep=opus/high, verifier=sonnet/high. Matches an Opus-default session; the deep tier escalates on effort, not on model.
   2. frontier — quick=sonnet/low, standard=opus/high, deep=fable/high, verifier=sonnet/high. Everything above quick at full effort, deep on the top model.
   3. lean — quick=sonnet/low, standard=sonnet/high, deep=opus/high, verifier=sonnet/medium. Cost-first, trading model capability for effort on the standard tier; deep still escalates to opus.
   Per-tier overrides and the full schema: bigin-skills skills/model-router/references/model-profiles.md.
   ```
   Store `MODEL_ROUTING` (the profile name).
4. **Install mode** — only if Phase 1 detected an existing-harness conflict in this run: the overwrite/new/cancel question from Phase 1 above.
5. **Spec Kit handling** — only if Phase 0.7 found Spec Kit: the `migrate | coexist | leave` question, worded in `references/speckit-migration.md` → "The decision". On `migrate`, `KNOWLEDGE_BUNDLE` stops being a free choice — it's where the `specs/` rationale lands, so if the user declines both, say the "why" has nowhere to go before accepting it.

Store `KNOWLEDGE_BUNDLE`, `GRAPH`, `CI_PROVIDER`, `MODEL_ROUTING` (and `INSTALL_MODE` / `SPECKIT` if included). Run the chosen Spec Kit path immediately after this phase resolves and before Phase 2 — `migrate` must finish removing Spec Kit before any harness file is written, and `leave` stops the run here. Code and security review are not scaffolded as project-local agents — point the user at the `/code-review` and `/security-review` skills instead (see Phase 7 summary).

---

## Phase 2: Generate CLAUDE.md

Read the content from `references/profile-{PROFILE}.md` → `## CLAUDE.md Template` section.

For `generic`, that template needs `{STACK}` plus the `{LINT}`/`{TYPECHECK}`/`{TEST}` commands detected per `references/profile-generic.md` → `## Commands`; detect them once here and reuse the same values in Phases 4, 5-1 and 7.

Write to `CLAUDE.md` in the project root.
Skip if `INSTALL_MODE=new` and `CLAUDE.md` already exists.

(Neither `nuxt-scaffold` nor `next-scaffold` writes a `CLAUDE.md` — governance is this skill's job — so for `SCAFFOLDED = true` nuxt/next repos there is no existing `CLAUDE.md` to preserve; write it fresh.)

---

## Phase 3: Generate .claude/rules/

Create `.claude/rules/` if it doesn't exist.

**For nuxt** — generate five files (each: skip if `INSTALL_MODE=new` and already exists):

- **conventions-frontend.md** — from `references/profile-nuxt.md` → `## conventions-frontend.md Template`. Includes `paths:` frontmatter scoping it to `app/**` etc.
- **conventions-server.md** — from `references/profile-nuxt.md` → `## conventions-server.md Template`. Includes `paths:` frontmatter scoping it to `server/**`.
- **testing.md** — from `references/profile-nuxt.md` → `## testing.md Template`. Includes `paths:` frontmatter scoping it to `tests/**` + `vitest.config.ts`. Centralized-tests convention: `tests/` mirrors `app/`/`server/`, cross-tree imports use the `~~/` root alias, Nitro auto-imports stubbed via `tests/support/`.
- **security.md** — from `references/files-shared.md` → `## security.md`. **Prepend** the nuxt paths frontmatter from `## paths substitutions` in `references/files-shared.md` before the content.
- **architecture.md** — from `references/files-shared.md` → `## architecture.md`, then append the profile block from `references/profile-nuxt.md` → `## architecture addendum`. **Prepend** the nuxt paths frontmatter from `## paths substitutions` before the content.

**For next** — generate five files, same shape as nuxt (a frontend+backend split app, not a single-tree backend) — each: skip if `INSTALL_MODE=new` and already exists:

- **conventions-frontend.md** — from `references/profile-next.md` → `## conventions-frontend.md Template`. Includes `paths:` frontmatter scoping it to `src/app/**`, `src/components/**`, `src/hooks/**`, `src/stores/**`.
- **conventions-server.md** — from `references/profile-next.md` → `## conventions-server.md Template`. Includes `paths:` frontmatter scoping it to `src/app/api/**`, `src/lib/**`, `src/proxy.ts`.
- **testing.md** — from `references/profile-next.md` → `## testing.md Template`. Includes `paths:` frontmatter scoping it to `src/**/*.test.ts(x)` + `vitest.config.ts`. Co-located-tests convention (unlike nuxt's centralized `tests/` tree): tests sit next to the source they cover.
- **security.md** — from `references/files-shared.md` → `## security.md`. **Prepend** the next paths frontmatter from `## paths substitutions` in `references/files-shared.md` before the content.
- **architecture.md** — from `references/files-shared.md` → `## architecture.md`, then append the profile block from `references/profile-next.md` → `## architecture addendum`. **Prepend** the next paths frontmatter from `## paths substitutions` before the content.

**For go / nodejs** — generate three files (each: skip if `INSTALL_MODE=new` and already exists):

- **conventions.md** — from `references/profile-{PROFILE}.md` → `## conventions.md Template`. The template already includes `paths:` frontmatter.
- **security.md** — from `references/files-shared.md` → `## security.md`. **Prepend** the profile-specific paths frontmatter from `## paths substitutions` in `references/files-shared.md`.
- **architecture.md** — from `references/files-shared.md` → `## architecture.md`, then append the profile block from `references/profile-{PROFILE}.md` → `## architecture addendum`. **Prepend** the profile-specific paths frontmatter.

**For generic** — generate two files only, no conventions and no testing rule (there is no known stack to write conventions for; `CLAUDE.md`'s "match the surrounding code" rule stands in for them). Each: skip if `INSTALL_MODE=new` and already exists:

- **security.md** — from `references/files-shared.md` → `## security.md`. **Prepend** the `generic` paths frontmatter from `## paths substitutions`.
- **architecture.md** — from `references/files-shared.md` → `## architecture.md` with **no** addendum appended (`references/profile-generic.md` → `## architecture addendum` explains why). **Prepend** the `generic` paths frontmatter.

---

## Phase 4: Generate AI Files

**AI_TASK_GUIDE.md** — from `references/files-shared.md` → `## AI_TASK_GUIDE.md`. Write to project root. Human orientation only — a pointer to `/task-workflow`, which owns the actual steps and formats. Never expand it back into a second copy of the workflow; the two drift the moment `task-workflow` changes.

**AI_REVIEW_CHECKLIST.md** — from `references/files-shared.md` → `## AI_REVIEW_CHECKLIST.md`. Replace `{COMMANDS}` with the profile's lint/typecheck/test commands (from `references/profile-{PROFILE}.md` → `## Commands`). For `generic`, use the commands detected in Phase 2 and keep any undetected one as its literal `TODO: <lint|typecheck|test> command` placeholder — visible gap, not a guess.

Skip each if `INSTALL_MODE=new` and file already exists.

---

## Phase 5: Generate Enforcement

### 5-1. Pre-commit hook

**First check for an existing git-hook manager.** If the repo already gates commits via `simple-git-hooks` or `husky` (key in `package.json`), a `.husky/` dir, or an existing `.git/hooks/pre-commit` → **do NOT create `scripts/pre-commit.sh`**. The existing mechanism is the gate; skip to 5-2. (This is the case for `SCAFFOLDED = true` nuxt/next repos — the template uses `simple-git-hooks` → `pnpm lint-staged`.)

Otherwise (go / nodejs / generic, or a nuxt/next repo without a hook manager): read `references/hook-guard.md` → `## pre-commit: {PROFILE}`. Write to `scripts/pre-commit.sh`, then `chmod +x scripts/pre-commit.sh`, and continue to 5-1b. The `generic` template carries the Phase 2 commands, with each undetected one degraded to a no-op `echo` per that section's note.

### 5-1b. Initialize git + install the hook

Only when 5-1 created `scripts/pre-commit.sh`. The hook lives in `.git/hooks/`, so a git repo must exist first.

1. **Ensure a git repo.** Check with `git rev-parse --is-inside-work-tree 2>/dev/null`.
   - If it fails (not a repo), run `git init` and tell the user a repo was initialized.
   - If it already is a repo, do nothing.

2. **Install the hook** (idempotent — never clobber a foreign hook silently):
   - If `.git/hooks/pre-commit` does not exist, or is already a symlink to `../../scripts/pre-commit.sh` → install/refresh it:
     ```sh
     ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit
     ```
   - If `.git/hooks/pre-commit` exists and is **not** our symlink (a real file or a different target) → do NOT overwrite. Show it and ask:
     ```
     A pre-commit hook already exists at .git/hooks/pre-commit.
     Replace it with the harness hook? (yes / no — leave it and I'll note it in the summary)
     ```

3. Confirm to the user that the hook is installed (or was left untouched).

> Note: `.git/hooks/` is not version-controlled, so each fresh clone still needs this step — that's why Phase 6 keeps it in the README onboarding for teammates.

### 5-1c. Context budget gate

Read `references/budget-gate.md` → `## tools/context_budget.mjs`. Write to `tools/context_budget.mjs`, then `chmod +x tools/context_budget.mjs`.

Skip if `INSTALL_MODE=new` and `tools/context_budget.mjs` already exists.

If `scripts/pre-commit.sh` was created in 5-1, the budget check step is already included in the template (it's guarded with `if [ -f tools/context_budget.mjs ]`). No further action needed.

### 5-2. Bash guard (blocks gate bypass)

Read from `references/hook-guard.md` → `## bash-guard.mjs`. Write to `.claude/guards/bash-guard.mjs`.

> nuxt/next auto-format also needs a guard script — `.claude/guards/lint-fix-file.mjs`, ESLint `--fix` scoped to the single touched file (a blanket `pnpm lint --fix` would rewrite every pre-existing lint violation in the repo on the first edit). If `SCAFFOLDED = true`, `nuxt-scaffold`/`next-scaffold` already wrote it. Otherwise (onboarding an existing nuxt or next repo), copy it now from `skills/nuxt-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs` (nuxt) or `skills/next-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs` (next) — same script body in both, single source of truth per profile, don't duplicate it here.

### 5-2b. Spec gate guard (blocks non-trivial edits before plan approval)

Read from `references/hook-guard.md` → `## spec-gate-guard.mjs`. Write to `.claude/guards/spec-gate-guard.mjs`. Applies to all profiles.

If `SPECKIT = coexist`, still write the script but **don't register its hook** in 5-3's `settings.json` — it reads root `PLAN.md` only and would block every Spec Kit implementation edit. Note the omission in the Phase 7 summary.

### 5-2c. Prompt-injection gate (stage 1: flags; stage 2 lives in injection-gate-guard.mjs, extended by 5-2e's canary)

Read from `references/hook-guard.md` → `## injection-scan-guard.mjs` and `## injection-gate-guard.mjs`. Write to `.claude/guards/injection-scan-guard.mjs` and `.claude/guards/injection-gate-guard.mjs` respectively. Applies to all profiles.

### 5-2d. Session resume check (deterministic resume prompt)

Read from `references/hook-guard.md` → `## session-resume-check.mjs`. Write to `.claude/guards/session-resume-check.mjs`. Applies to all profiles — replaces the previous CLAUDE.md-prose-only "check for SESSION.md on session start" instruction with a `SessionStart` hook. If `graphify-out/graph.json` exists, this same hook also surfaces its presence and freshness (a cheap `git log` comparison against everything outside `graphify-out/`) — this is the mechanism for the graphify freshness-warn behavior; it runs here, once per session, rather than as a `Stop` hook, since `Stop` hooks can only force continuation (`decision: "block"`) or stay silent — there's no documented non-blocking, user-visible `Stop` output.

### 5-2e. Canary exfiltration seed (stage 3 of the injection gate)

Read from `references/hook-guard.md` → `## canary-seed.mjs`. Write to `.claude/guards/canary-seed.mjs`. Applies to all profiles — seeds a per-session canary token via a `SessionStart` hook; `injection-gate-guard.mjs`'s stage-3 check denies any tool call whose input contains it.

### 5-2f. Bugfix test guard (blocks fix commits with no regression test)

Read from `references/hook-guard.md` → `## bugfix-test-guard.mjs`. Write to `.claude/guards/bugfix-test-guard.mjs`. Applies to all profiles — enforces `debug-workflow`'s "every bug fix ships a regression test" requirement at commit time rather than relying on prose.

### 5-2g. Commit message guard (blocks non-Conventional-Commit messages)

Enforces the Conventional Commits subject line that `bugfix-test-guard.mjs`'s `fix:` detection depends on. Applies to all profiles. Two entry points into **one** script — the `PreToolUse` hook catches commits Claude makes, the git `commit-msg` hook catches everyone's.

1. **Write the guard.** Read from `references/hook-guard.md` → `## commit-msg-guard.mjs`. Write to `.claude/guards/commit-msg-guard.mjs`. Phase 5-3 registers its `PreToolUse` entry.

2. **Install the git `commit-msg` hook.** Requires a git repo — if 5-1b didn't run (no `scripts/pre-commit.sh` was created), check `git rev-parse --is-inside-work-tree 2>/dev/null` first and `git init` if it fails. Then, matching whatever already gates commits in this repo:
   - **`simple-git-hooks`** (key in `package.json`) → add `"commit-msg": "node .claude/guards/commit-msg-guard.mjs $1"` to that object, then re-run `pnpm simple-git-hooks` (or `npx simple-git-hooks`) so it's written into `.git/hooks/`. This is the `SCAFFOLDED = true` nuxt/next case.
   - **`husky`** (`.husky/` dir) → write `.husky/commit-msg` containing `node .claude/guards/commit-msg-guard.mjs "$1"`, then `chmod +x .husky/commit-msg`.
   - **Plain git** (go / nodejs / generic, or any repo with no hook manager) → read `references/hook-guard.md` → `## commit-msg: all profiles`, write `scripts/commit-msg.sh`, `chmod +x scripts/commit-msg.sh`, then install it the same way 5-1b installs pre-commit — `ln -sf ../../scripts/commit-msg.sh .git/hooks/commit-msg` if that path is absent or already our symlink; if it exists and is **not** ours, show it and ask before replacing, exactly as 5-1b does. Never clobber a foreign hook silently.

   Say which of the three paths was taken in the Phase 7 summary. As with pre-commit, `.git/hooks/` isn't version-controlled — Phase 6's README onboarding covers the fresh-clone step.

### 5-2h. Precompact snapshot (autosaves session state before compaction)

Read from `references/hook-guard.md` → `## precompact-snapshot.mjs`. Write to `.claude/guards/precompact-snapshot.mjs`. Applies to all profiles — the `PreCompact` hook in every profile's `settings.json` template points at this script, so it must be written or that hook dangles. Autosaves in-flight state to `.claude/memory/SESSION.md` (in `session-handoff`'s template shape) before a manual or automatic compaction, so `session-resume-check.mjs` can recover it.

### 5-3. .claude/settings.json

For **nuxt** / **next** (same merge shape, different scaffold skill):
- **If `SCAFFOLDED = true`**: the `nuxt-scaffold`/`next-scaffold` skill already wrote `.claude/settings.json` with `permissions.allow` + a `PostToolUse` `lint-fix-file.mjs` hook (and the script itself). Merge the `PreToolUse` `bash-guard.mjs` + `spec-gate-guard.mjs` + `injection-gate-guard.mjs` hooks (matcher `Bash|Write|Edit|WebFetch|mcp__.*`), `PreToolUse` `bugfix-test-guard.mjs` + `commit-msg-guard.mjs` hooks (matcher `Bash`, alongside `bash-guard.mjs`), a `SessionStart` block with both `canary-seed.mjs` and `session-resume-check.mjs` hooks, any missing `permissions.allow` entries, **and** a second `PostToolUse` entry for `injection-scan-guard.mjs` alongside the existing `lint-fix-file.mjs` one — do not replace or duplicate the existing `lint-fix-file.mjs` entry. Merge per-event; show additions before writing.
- **Otherwise** (onboarding an existing nuxt or next repo): write `.claude/guards/lint-fix-file.mjs` per 5-2's note above if missing, then read the full settings.json template from `references/profile-nuxt.md` or `references/profile-next.md` → `## settings.json Template`. If `.claude/settings.json` exists, merge the `hooks` block + missing `permissions.allow` entries (per-event, never drop the user's); if not, write fresh.

For **go** / **nodejs** / **generic**: read the template from `references/profile-{PROFILE}.md` → `## settings.json Template`. If the file exists, merge the `hooks` block + missing `permissions.allow` entries (per-event); otherwise write fresh. The `generic` template pre-approves git commands only — an unknown toolchain gets no blanket allowlist; let the user approve its commands as they come up.

### 5-3b. .vscode/settings.json (nuxt / next only)

Editor format-on-save via ESLint. Read `references/profile-nuxt.md` or `references/profile-next.md` → `## .vscode/settings.json Template`.

- If `.vscode/settings.json` exists: **merge** the keys in (never overwrite; show additions first).
- If not: write fresh.

Other profiles (go, nodejs — backend-only, no editor-format concern; generic — formatter unknown): skip.

### 5-3c. Harness version marker

Write `.claude/harness-version` containing the current version from this plugin's own `.claude-plugin/plugin.json` (plain text, just the version string, e.g. `1.22.11`) — the baseline Phase 1a's patch mode diffs against later.

- `INSTALL_MODE=yes` (or a fresh install) → always write/overwrite; every generated file now matches current templates.
- `INSTALL_MODE=new` → only write if the marker doesn't already exist. Files skipped as pre-existing may still be older than the recorded version — a later patch run reports those as "anchor not found" rather than corrupting them, so this is a safe degradation, not a correctness bug.

### 5-3d. Model routing config

Write `.claude/model-routing.json` from `references/files-shared.md` → `## model-routing.json`, substituting `{MODEL_ROUTING}` with the profile decided in Phase 1.5. This is what `model-router`'s `classify.mjs` reads to resolve each subagent tier's model, effort, and which agent file carries that effort.

- `INSTALL_MODE=yes` (or a fresh install) → write/overwrite.
- `INSTALL_MODE=new` → skip if the file exists — a hand-tuned ladder (including per-tier `models` overrides) is the user's, not ours to reset.

---

## Phase 5.5: Knowledge Bundle (optional)

Decided in Phase 1.5 (`KNOWLEDGE_BUNDLE`). If true, read all templates from `references/knowledge-bundle.md`. Replace `{DATE}` with today's date in ISO 8601 (`YYYY-MM-DD`) in every template before writing.

1. **Rule file** — `## knowledge.md` → write to `.claude/rules/knowledge.md`. Skip if `INSTALL_MODE=new` and it exists.
2. **Starter bundle** — write each (skip existing under `INSTALL_MODE=new`):
   - `## knowledge/meta/knowledge-bundle-spec.md` → `knowledge/meta/knowledge-bundle-spec.md`
   - `## knowledge/index.md` → `knowledge/index.md`
   - `## knowledge/contracts/openapi-contract.md` → `knowledge/contracts/openapi-contract.md`
   - `## knowledge/constraints/agent-rules.md` → `knowledge/constraints/agent-rules.md`
   - `## knowledge/log.md` → `knowledge/log.md`
3. **Validator** — `## tools/knowledge_validate.mjs` → `tools/knowledge_validate.mjs`. Zero-dependency Node script — no chmod, no package install.
4. **Wire into the enforcement gate.** If `scripts/pre-commit.sh` exists (created in Phase 5-1), append a step running `node tools/knowledge_validate.mjs`. If the repo instead uses `simple-git-hooks`/`husky` (Phase 5-1 skipped creating our script), add the same command to that existing hook config rather than creating a second script.
5. **Wire into AI_REVIEW_CHECKLIST.md.** Append one line to the `## Scope` section (written in Phase 4): `- [ ] Behavior-changing PR → related knowledge/ concept updated?`
6. If Phase 5.6 generates new CI config in this same run, it includes the validator step automatically (see Phase 5.6). If the repo already has **foreign** CI config (not generated by this skill), do **not** edit it automatically — note in the Phase 7 summary that `node tools/knowledge_validate.mjs` should also be added as a CI job/step there.
7. **Suggest library bundles — suggest only, write nothing.** Name the project's core runtime dependencies (from `package.json`/`go.mod`) that an agent is most likely to get wrong, and say that `/knowledge-distill` distills any of them into a version-pinned `knowledge/libraries/<lib>/` bundle. One line, no `AskUserQuestion`, no files, no `libraries/` directory: a bundle takes a clone, a topic-list decision, and a verification pass, so it belongs in its own invocation rather than buried in a scaffold run. Nothing else in the harness depends on a bundle existing.

The knowledge.md rule file uses the index-first read protocol: agents read the index summary and only open a concept file when the summary is insufficient. This keeps per-session context load low even as the bundle grows.

**Steps 1–3 are the canonical bundle-install list.** `knowledge-distill`'s Phase 0a reuses them verbatim to bootstrap a repo that has no bundle, and deliberately does not restate the file list. If you add or remove a starter file here, that bootstrap follows automatically — but note the index template links to the other starter files, so a file dropped from step 2 without also editing `## knowledge/index.md` becomes a broken link and a validator error.

If false, skip everything above — no other phase depends on it.

---

## Phase 5.6: CI Config (optional)

Decided in Phase 1.5 (`CI_PROVIDER`, auto-detected default from `git remote get-url origin`). Skip everything below if `no` — which includes every `PROFILE = generic` run, since `references/ci.md` has no generic template and an inferred workflow for an unknown stack would be wrong more often than right.

Read templates from `references/ci.md`.

0. **Clear the spec gate first, if it's active.** `spec-gate-guard.mjs` blocks any `Write` outside its trivial allowlist, and a CI workflow isn't on that list — so on a repo that *already* has the guard registered (a second harness run, or a first run where CI was declined and is being added later) every write below dies with `PLAN.md missing or not approved`. Two non-fixes to rule out: reordering this phase ahead of Phase 5 doesn't help, because a `PreToolUse` block is `exit 2` that nothing in this run can override and on a re-run the guard is live from the session's first tool call; and widening the guard's allowlist is worse than the bug, since a workflow file executes with access to CI secrets and defines which gates run at all — it's the single file most worth gating.

   Check for `.claude/guards/spec-gate-guard.mjs` **and** its `PreToolUse` registration in `.claude/settings.json`. If either is missing, nothing is gating — go to step 1.

   If it is active:
   - **`PLAN.md` already exists** — never clobber it; it may govern a task in flight. If its `Status:` is `approved` and its `Branch:` matches `HEAD`, the gate already passes: go to step 1 and leave the file alone. Otherwise skip this phase entirely, tell the user CI was skipped because `PLAN.md` is mid-task, and point them at re-running once it's cleared.
   - **No `PLAN.md`** — write a minimal one: `Status: approved`, `Branch: {git branch --show-current}`, a one-line spec naming the provider, profile, and exact target paths, and one task row per file to be written. Then do steps 1–3, and **delete `PLAN.md`** immediately after, reporting both the creation and the delete in the Phase 7 summary.

   That last move is narrow on purpose. It is not a self-approval and must never be generalized into one: the user already approved CI in Phase 1.5, and this only records that existing decision in the form the guard can read. It applies to the CI paths in this phase and nothing else, and the plan is deleted the moment they're written — an approved `PLAN.md` left behind would hold the gate open for whatever the user does next.

1. **GitHub** (if `CI_PROVIDER` is `github` or `both`): if `.github/workflows/ci.yml` already exists, treat like any other idempotency check — under `INSTALL_MODE=new` skip it silently; under `yes` show it and confirm before overwriting. Otherwise write `## github: {PROFILE}` to `.github/workflows/ci.yml`.
2. **GitLab** (if `CI_PROVIDER` is `gitlab` or `both`): same existence check for `.gitlab-ci.yml`. Otherwise write `## gitlab: {PROFILE}` to `.gitlab-ci.yml`.
3. **If `KNOWLEDGE_BUNDLE = true`** (decided in Phase 1.5): before writing each file above, merge in `## knowledge-validate step: github` / `## knowledge-validate step: gitlab` respectively, so the generated CI file validates the knowledge bundle in the same run — no separate manual step needed.

This phase only ever writes CI files it generates itself. It never edits a pre-existing, hand-written CI config — see Phase 5.5 step 6 for that case.

---

## Phase 5.7: Graphify (optional)

Decided in Phase 1.5 (`GRAPH`). If false, skip everything below — none of the scaffolding is written: no rule file, no `docs/graph-usage.md`, no gitignore entries, no install prompt, no proposed index.

This decision governs **scaffolding only, not skill behavior.** `task-workflow`, `debug-workflow`, `model-router`, and `sprint-distill` each key off whether `graphify-out/graph.json` exists on disk — none of them reads the `GRAPH` answer. A repo scaffolded with `GRAPH = false` that later acquires a graph gets those integrations anyway, minus the `.claude/rules/graph.md` guardrails (query-don't-read, `INFERRED` is not confirmation, a source read wins). Don't "simplify" those skills to a config flag: file existence is what makes the degradation path silent.

1. **Write templates** from `references/graph.md`: `## .claude/rules/graph.md` → `.claude/rules/graph.md`, `## docs/graph-usage.md` → `docs/graph-usage.md`. Skip each if `INSTALL_MODE=new` and it already exists.
2. **Gitignore contract**: append `graphify-out/cost.json` and `graphify-out/cache/` (per-file AST cache, populated on every index run) to `.gitignore` — idempotent, check before appending. Never add `graphify-out/` itself; that directory is committed.
3. **Install check**: run `graphify --version`. If not found, open the tool's own README (github.com/Graphify-Labs/graphify) and follow its current install instructions verbatim — do not hardcode a command from memory, and note explicitly that the package name is `graphifyy` (double-y) to avoid a typosquat lookalike. Prompt the user to install; this is the only point in the harness that prompts for a graphify install.
4. **Propose the initial index**: skip entirely if `graphify-out/graph.json` already exists — nothing to propose, the graph is already built (this keeps a re-run on an already-compliant repo a no-op, same as the rest of this phase). Otherwise, once installed, propose (don't auto-run) `graphify update .` (headless, AST-only, zero API cost) or `/graphify .`. After it runs, replace `{GRAPHIFY_VERSION}` in `docs/graph-usage.md` with the output of `graphify --version`.

---

## Phase 6: Update README

Check for `README.md`. If found, check whether it already contains `## AI Onboarding`. If not present, append the templates from `references/summary-checklist.md` → `## Phase 6 README Templates` (replace `{LINT}`, `{TYPECHECK}`, `{TEST}` with profile commands). If no `README.md` exists: skip this phase (do not create one).

---

## Phase 7: Summary

Read `references/summary-checklist.md` → `## Phase 7 Summary Template`. Substitute `{PROFILE}`/`{LINT}`/`{TYPECHECK}`/`{TEST}`/`{MODEL_ROUTING}` and the bracketed conditional lines, then print verbatim.

---

## Phase 8: Measure Context Budget

After the summary, instruct the user:

```
Harness installed. Now measure its token footprint:

1. Run `/context` in Claude Code — look for CLAUDE.md and .claude/rules/ in the breakdown.
   Record the result in README.md → Context Budget table: today's date, estimated harness tokens, Pass/Fail.

2. Run `node tools/context_budget.mjs` for the automated verdict.
   Pass = within the ~3 000-token always-loaded budget.
   Fail = one or more files need trimming (see output for which).

The path-scoped rule files (conventions-frontend.md, conventions-server.md, security.md,
architecture.md) only load when matching files are in context — they don't count against
the always-loaded budget unless you're editing those paths.
```

---

## Idempotency Rules

- Check existence before writing every file.
- `INSTALL_MODE=yes` → overwrite. `INSTALL_MODE=new` → skip existing.
- `.claude/settings.json` — always merge (never full overwrite if file exists).
- `README.md` — append only; never overwrite; check for `## AI Onboarding` first.
- `git init` — only if not already a repo (never re-init).
- pre-commit hook — skip if a hook manager (simple-git-hooks/husky) or hook already exists; otherwise install only if absent or already ours, confirming before replacing a foreign hook.
- Project scaffold (Phase 0.5) — only when the profile's marker file is absent; always delegated to that profile's scaffold skill, never a clone or an embedded copy. Whatever the script wrote is pre-existing: overlay additively, never overwrite. Per-profile detail: `references/scaffold-delegation.md`.
- Knowledge Bundle (Phase 5.5) — opt-in only, decided once in Phase 1.5 (`KNOWLEDGE_BUNDLE`); skip entirely if declined. Never edit unknown CI config automatically — only note it's needed.
- CI Config (Phase 5.6) — opt-in only, decided once in Phase 1.5 (`CI_PROVIDER`, auto-detected default); skip entirely if `no`. Only ever writes/overwrites CI files this skill generated; never edits pre-existing, hand-written CI config.
- Graphify (Phase 5.7) — opt-in only, decided once in Phase 1.5 (`GRAPH`); skip entirely if declined. Never auto-runs the initial index — always proposed. Install prompting happens here only, never in a consuming skill.
- `.claude/model-routing.json` (Phase 5-3d) — decided once in Phase 1.5 (`MODEL_ROUTING`); `new` mode never overwrites an existing ladder. Deleting the file is safe: `model-router` falls back to the `opus-centric` default.
- Spec Kit (Phase 0.7) — detection only; `none` is the common case and skips the phase. On `migrate`, nothing is deleted until the user has seen the triage table, `git tag pre-harness-migration` is set first, and contract fragments are reconciled before `specs/` goes. On `coexist`, the spec-gate hook is left unregistered rather than the guard left unwritten. Never migrate a repo that didn't ask.
- Profile detection (Phase 0) — the four-way question is asked **only** for an empty repo, where it picks the scaffold. Existing code that matches no marker is `PROFILE = generic`, never a question: it skips Phase 0.5, the conventions/testing rules, `.vscode/settings.json`, and Phase 5.6 CI, and installs everything else. Commands are detected, and an undetected one stays a visible `TODO` rather than a guess.
- All user-facing questions (empty-repo profile choice, harness conflicts, Knowledge Bundle, CI, model routing profile, Spec Kit handling, foreign pre-commit hook) resolve before any file is written — see Phase 1.5.
- Never delete files not part of the harness.
- `.claude/harness-version` — written on every fresh/overwrite setup (Phase 5-3c) as a baseline for future patch runs; `new` mode only writes it if absent, since skipped pre-existing files may be older than the recorded version.
- Patch mode (Phase 1a) — only touches files/lines named in a changelog entry's `patch` block; never guesses at an anchor match; always advances `.claude/harness-version` even on partial application, logging what still needs manual review.

---

## Output Checklist

Read `references/summary-checklist.md` → `## Output Checklist` and verify every item against what was actually written this run.

---

## References

- `references/scaffold-delegation.md` — Phase 0.5: per-profile scaffold script, decisions to gather, and what each one leaves behind for Phase 1 to reconcile
- `references/speckit-migration.md` — Phase 0.7: GitHub Spec Kit detection (both layouts), the migrate/coexist/leave decision, the ordered migration procedure, workflow mapping, and the `speckit-triage.mjs` classifier
- `references/profile-nuxt.md` — templates for nuxt profile (CLAUDE.md, conventions-frontend, conventions-server, testing, architecture addendum, settings.json, .vscode/settings.json)
- `references/profile-next.md` — templates for next profile (same shape as profile-nuxt.md)
- `references/profile-go.md` — templates for go profile
- `references/profile-nodejs.md` — templates for nodejs profile
- `references/profile-generic.md` — fallback profile for a stack that matches none of the four: what it installs and skips, command detection, CLAUDE.md + settings.json templates, why no CI
- `references/files-shared.md` — shared files: security, architecture, AI task guide pointer, review checklist, paths substitutions per profile
- `references/patch-mode.md` — Phase 1a: version diffing + CHANGELOG patch-block application for `INSTALL_MODE=patch`
- `references/hook-guard.md` — bash-guard.mjs, spec-gate-guard.mjs, bugfix-test-guard.mjs, commit-msg-guard.mjs, injection-scan-guard.mjs, injection-gate-guard.mjs, session-resume-check.mjs, canary-seed.mjs, precompact-snapshot.mjs scripts + pre-commit scripts per profile
- `references/budget-gate.md` — context_budget.mjs script (context budget gate)
- `references/knowledge-bundle.md` — optional Knowledge Bundle: rule file, spec, starter concept files, validator script
- `references/knowledge-migration.md` — one-shot OKF v0.1 → v0.2 migrator for pre-v1.62.0 bundles. **Not** part of the Phase 5.5 install list — a fresh scaffold is already v0.2
- `references/graph.md` — optional Graphify: rule file, usage doc, install/gitignore contract
- `references/ci.md` — optional CI config: GitHub Actions + GitLab CI templates per profile, plus the knowledge-validate step
- `references/summary-checklist.md` — Phase 7 summary print template + Output Checklist
