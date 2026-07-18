---
name: bigin-harness-setup
description: "Scaffolds BigIn AI workflow harness into a repo — CLAUDE.md, governance rules, and enforcement gates. MUST use when user says: 'set up harness', 'add AI rules', 'scaffold harness', 'add CLAUDE.md', 'initialize AI workflow', 'set up claude rules', 'thiết lập harness', 'cài harness', 'thêm AI rules', or when onboarding an existing repo for structured AI-assisted development. Supports nuxt, go, nodejs, next profiles."
effort: medium
allowed-tools: Bash(git init) Bash(git rev-parse *) Bash(chmod +x *) Bash(ln -sf *)
---

# bigin-harness-setup

Sets up a standardized AI workflow harness: governance files, path-scoped rules, and enforcement gates. Idempotent — re-running on an already-set-up repo is safe.

---

## Phase 0: Detect Stack Profile

Check for stack indicators:
1. `nuxt.config.ts` or `nuxt.config.js` → profile = `nuxt`
2. `go.mod` → profile = `go`
3. `package.json` with express/fastify/hono/koa in dependencies → profile = `nodejs`
4. `next.config.ts`, `next.config.js`, or `next.config.mjs` → profile = `next`
5. None found or ambiguous → ask:

```
Which stack profile?
1. nuxt   — Nuxt 4 fullstack (Cloudflare Pages): Nuxt UI, Pinia + Colada, VueUse, nuxt-auth-utils, Vitest, Zod — BFF proxy layer, no direct DB access
2. go     — Go REST API backend
3. nodejs — Node.js TypeScript REST API backend
4. next   — Next.js App Router fullstack (Vercel): shadcn/ui, Zustand, TanStack Query, iron-session, Vitest, Zod — BFF proxy layer, no direct DB access

Type 1, 2, 3, or 4.
```

Store result as `PROFILE`. Load `references/profile-{PROFILE}.md` for all template content.

---

## Phase 0.5: Nuxt Project Scaffold

**nuxt profile only.** If `PROFILE = nuxt` **and** the repo has no `nuxt.config.ts`:

Scaffolding is done by the `nuxt-scaffold` skill's deterministic script — **not** conversationally. Three steps, and **all questions happen up front, in one batch; zero prompts once scaffolding starts**:

1. **Gather every scaffold decision now**, in the same turn, back-to-back with this skill's own remaining decisions: ask `skills/nuxt-scaffold/SKILL.md` → Step 2 (project name, primary/neutral theme colors, version policy), then immediately ask Phase 1.5's bundle below (Knowledge Bundle/Graphify + CI config — an empty repo can't hit Phase 1's conflict path, so only those two apply here). Confirm the scaffold summary once. Store `KNOWLEDGE_BUNDLE` / `GRAPH` / `CI_PROVIDER` now — Phase 1.5 is a no-op later in this branch since they're already decided.
2. **Write the config JSON** (schema in `skills/nuxt-scaffold/SKILL.md` → Step 3) to a temp file outside the repo, with `"packageManager": "pnpm"`.
3. **Run the script and stream its output** (several minutes — installs + verify gates):
   ```sh
   node skills/nuxt-scaffold/scripts/scaffold.mjs --config <path>
   ```
   Exit 0 = scaffolded, verified (lint/type-check/test), committed. Non-zero → report the script's last `[scaffold] ERROR:` line and stop; do not improvise the remaining steps by hand.

**No GitHub template clone, no embedded skill copy.** Do not write any project files yourself while it runs.

Set `SCAFFOLDED = true` when the script exits 0 (the governance overlay reconciles with what the scaffold provides — see Phases 1 and 5).

Skip this phase entirely if `nuxt.config.ts` already exists (onboarding an existing repo) or for the `go` / `nodejs` / `next` profiles.

---

## Phase 0.5b: Go Project Scaffold

**go profile only.** If `PROFILE = go` **and** the repo has no `go.mod`:

Scaffolding is done by the `go-scaffold` skill's deterministic script — **not** conversationally. All questions happen up front, in one batch; zero prompts once scaffolding starts:

1. **Gather every scaffold decision now**, in the same turn, back-to-back with this skill's own remaining decisions: ask `skills/go-scaffold/SKILL.md` → Step 2 (module path, project name), then immediately ask Phase 1.5's bundle below (Knowledge Bundle/Graphify + CI config — an empty repo can't hit Phase 1's conflict path, so only those two apply here). Confirm the scaffold summary once. Store `KNOWLEDGE_BUNDLE` / `GRAPH` / `CI_PROVIDER` now — Phase 1.5 is a no-op later in this branch since they're already decided.
2. **Run the script and stream its output** (roughly a minute — first run downloads/builds `oapi-codegen` + `sqlc`, then `go mod tidy`, `go vet`, `go build`, `go test`):
   ```sh
   node skills/go-scaffold/scripts/scaffold.mjs --module <module-path> --dir . [--project <name>]
   ```
   Exit 0 = scaffolded, verified (build/vet/test), committed. Non-zero → report the script's last `[scaffold] ERROR:` line and stop; do not improvise the remaining steps by hand.

If `CI_PROVIDER` includes `github`, note that `go-scaffold` already wrote `.github/workflows/ci.yml` — Phase 5.6's own pre-existence check handles that the same as any other already-there CI file; no special-casing needed here.

**No GitHub template clone, no embedded skill copy.** Do not write any project files yourself while it runs.

Set `SCAFFOLDED = true` when the script exits 0 (the governance overlay reconciles with what the scaffold provides — see Phases 1 and 5).

Skip this phase entirely if `go.mod` already exists (onboarding an existing repo) or for the `nuxt` / `nodejs` / `next` profiles.

---

## Phase 0.5c: Node.js Project Scaffold

**nodejs profile only.** If `PROFILE = nodejs` **and** the repo has no `package.json`:

Scaffolding is done by the `nodejs-scaffold` skill's deterministic script — **not** conversationally. All questions happen up front, in one batch; zero prompts once scaffolding starts:

1. **Gather every scaffold decision now**, in the same turn, back-to-back with this skill's own remaining decisions: ask `skills/nodejs-scaffold/SKILL.md` → Step 2 (project name), then immediately ask Phase 1.5's bundle below (Knowledge Bundle/Graphify + CI config — an empty repo can't hit Phase 1's conflict path, so only those two apply here). Confirm the scaffold summary once. Store `KNOWLEDGE_BUNDLE` / `GRAPH` / `CI_PROVIDER` now — Phase 1.5 is a no-op later in this branch since they're already decided.
2. **Run the script and stream its output** (a couple of minutes — `pnpm add` for deps then devDeps, then `openapi-typescript` + `drizzle-kit generate`, then lint/typecheck/build/test):
   ```sh
   node skills/nodejs-scaffold/scripts/scaffold.mjs --project <name> --dir .
   ```
   Exit 0 = scaffolded, verified (lint/typecheck/build/test), committed. Non-zero → report the script's last `[scaffold] ERROR:` line and stop; do not improvise the remaining steps by hand.

If `CI_PROVIDER` includes `github`, note that `nodejs-scaffold` already wrote `.github/workflows/ci.yml` — Phase 5.6's own pre-existence check handles that the same as any other already-there CI file; no special-casing needed here.

**No GitHub template clone, no embedded skill copy.** Do not write any project files yourself while it runs.

Set `SCAFFOLDED = true` when the script exits 0 (the governance overlay reconciles with what the scaffold provides — see Phases 1 and 5).

Skip this phase entirely if `package.json` already exists (onboarding an existing repo) or for the `nuxt` / `go` / `next` profiles.

---

## Phase 0.5d: Next Project Scaffold

**next profile only.** If `PROFILE = next` **and** the repo has no `next.config.*`:

Scaffolding is done by the `next-scaffold` skill's deterministic script — **not** conversationally. Three steps, and **all questions happen up front, in one batch; zero prompts once scaffolding starts** (same config-JSON shape as Phase 0.5's nuxt branch, since `next-scaffold` has multiple decisions like `nuxt-scaffold` does — not the single-flag CLI style of the go/nodejs branches):

1. **Gather every scaffold decision now**, in the same turn, back-to-back with this skill's own remaining decisions: ask `skills/next-scaffold/SKILL.md` → Step 2 (project name, template, version policy), then immediately ask Phase 1.5's bundle below (Knowledge Bundle/Graphify + CI config — an empty repo can't hit Phase 1's conflict path, so only those two apply here). Confirm the scaffold summary once. Store `KNOWLEDGE_BUNDLE` / `GRAPH` / `CI_PROVIDER` now — Phase 1.5 is a no-op later in this branch since they're already decided.
2. **Write the config JSON** (schema in `skills/next-scaffold/SKILL.md` → Step 3) to a temp file outside the repo, with `"packageManager": "pnpm"`.
3. **Run the script and stream its output** (several minutes — installs + shadcn/ui + verify gates):
   ```sh
   node skills/next-scaffold/scripts/scaffold.mjs --config <path>
   ```
   Exit 0 = scaffolded, verified (lint/type-check/test), committed. Non-zero → report the script's last `[scaffold] ERROR:` line and stop; do not improvise the remaining steps by hand.

**No GitHub template clone, no embedded skill copy.** Do not write any project files yourself while it runs.

Set `SCAFFOLDED = true` when the script exits 0 (the governance overlay reconciles with what the scaffold provides — see Phases 1 and 5).

Skip this phase entirely if `next.config.*` already exists (onboarding an existing repo) or for the `nuxt` / `go` / `nodejs` profiles.

---

## Phase 1: Detect Existing Harness

If `SCAFFOLDED = true` from the nuxt branch, the `nuxt-scaffold` skill already brought `nuxt.config.ts`, `app/`, `server/`, `eslint.config.mjs`, `.claude/settings.json` (permissions + a `PostToolUse` lint-fix hook), `.vscode/settings.json`, and a `simple-git-hooks` pre-commit gate. Treat those as pre-existing (do not clobber) and skip straight to adding the BigIn guardrails the scaffold lacks: `bash-guard.mjs`, `spec-gate-guard.mjs`, the `injection-scan-guard.mjs` / `injection-gate-guard.mjs` pair (+ their `PreToolUse`/`PostToolUse` hooks), `canary-seed.mjs` (+ its `SessionStart` hook), governance rules, and AI files.

If `SCAFFOLDED = true` from the go branch instead, `go-scaffold` brought `go.mod`, `cmd/`, `internal/`, `db/migrations/`, `Makefile`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, and an initial git commit — but **no** `.claude/` anything (it has no governance overlay, unlike nuxt-scaffold). Treat those as pre-existing (do not clobber) and continue through Phases 2 onward normally; there's no partial-guardrail merge to do here since nothing `.claude/`-related exists yet to merge against.

If `SCAFFOLDED = true` from the nodejs branch instead, `nodejs-scaffold` brought `package.json`, `src/`, `drizzle/`, `Dockerfile`, `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, and an initial git commit — but, like the go branch, **no** `.claude/` anything. Treat those as pre-existing (do not clobber) and continue through Phases 2 onward normally.

If `SCAFFOLDED = true` from the next branch instead, `next-scaffold` already brought `next.config.ts`, `src/app/`, `components.json`, `.claude/settings.json` (permissions + a `PostToolUse` lint-fix hook), `.vscode/settings.json`, and a `simple-git-hooks` pre-commit gate — same shape as the nuxt branch, not the go/nodejs one. Treat those as pre-existing (do not clobber) and skip straight to adding the BigIn guardrails the scaffold lacks: `bash-guard.mjs`, `spec-gate-guard.mjs`, the `injection-scan-guard.mjs` / `injection-gate-guard.mjs` pair (+ their `PreToolUse`/`PostToolUse` hooks), `canary-seed.mjs` (+ its `SessionStart` hook), governance rules, and AI files.

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

Skip this phase entirely if `KNOWLEDGE_BUNDLE`, `GRAPH`, and `CI_PROVIDER` are already set (Phase 0.5/0.5b asked them alongside the nuxt-scaffold/go-scaffold batch for the empty-repo branch).

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
2. **CI config** (github/gitlab/both/no) — auto-detect a default first: run `git remote get-url origin 2>/dev/null`; if it matches `github.com` preselect `github`, if `gitlab.com` preselect `gitlab`; if undetermined (no remote, unrecognized host, or ambiguous) preselect `both`. Present the preselected option first/labeled as detected, but let the user override:
   ```
   Add CI config? (github/gitlab/both/no)
   Generates a workflow that runs {LINT} && {TYPECHECK} && {TEST} on push to main and on merge/pull requests.
   ```
3. **Install mode** — only if Phase 1 detected an existing-harness conflict in this run: the overwrite/new/cancel question from Phase 1 above.

Store `KNOWLEDGE_BUNDLE`, `GRAPH`, `CI_PROVIDER` (and `INSTALL_MODE` if included). Code and security review are not scaffolded as project-local agents — point the user at the `/code-review` and `/security-review` skills instead (see Phase 7 summary).

---

## Phase 2: Generate CLAUDE.md

Read the content from `references/profile-{PROFILE}.md` → `## CLAUDE.md Template` section.

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

---

## Phase 4: Generate AI Files

**AI_TASK_GUIDE.md** — from `references/files-shared.md` → `## AI_TASK_GUIDE.md`. Write to project root. This file is for human reference; CLAUDE.md already points agents to `/task-workflow` (the on-demand skill).

**AI_REVIEW_CHECKLIST.md** — from `references/files-shared.md` → `## AI_REVIEW_CHECKLIST.md`. Replace `{COMMANDS}` with the profile's lint/typecheck/test commands (from `references/profile-{PROFILE}.md` → `## Commands`).

Skip each if `INSTALL_MODE=new` and file already exists.

---

## Phase 5: Generate Enforcement

### 5-1. Pre-commit hook

**First check for an existing git-hook manager.** If the repo already gates commits via `simple-git-hooks` or `husky` (key in `package.json`), a `.husky/` dir, or an existing `.git/hooks/pre-commit` → **do NOT create `scripts/pre-commit.sh`**. The existing mechanism is the gate; skip to 5-2. (This is the case for `SCAFFOLDED = true` nuxt/next repos — the template uses `simple-git-hooks` → `pnpm lint-staged`.)

Otherwise (go / nodejs, or a nuxt/next repo without a hook manager): read `references/hook-guard.md` → `## pre-commit: {PROFILE}`. Write to `scripts/pre-commit.sh`, then `chmod +x scripts/pre-commit.sh`, and continue to 5-1b.

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

### 5-2c. Prompt-injection gate (stage 1: flags; stage 2 lives in injection-gate-guard.mjs, extended by 5-2e's canary)

Read from `references/hook-guard.md` → `## injection-scan-guard.mjs` and `## injection-gate-guard.mjs`. Write to `.claude/guards/injection-scan-guard.mjs` and `.claude/guards/injection-gate-guard.mjs` respectively. Applies to all profiles.

### 5-2d. Session resume check (deterministic resume prompt)

Read from `references/hook-guard.md` → `## session-resume-check.mjs`. Write to `.claude/guards/session-resume-check.mjs`. Applies to all profiles — replaces the previous CLAUDE.md-prose-only "check for SESSION.md on session start" instruction with a `SessionStart` hook. If `graphify-out/graph.json` exists, this same hook also surfaces its presence and freshness (a cheap `git log` comparison against everything outside `graphify-out/`) — this is the mechanism for the graphify freshness-warn behavior; it runs here, once per session, rather than as a `Stop` hook, since `Stop` hooks can only force continuation (`decision: "block"`) or stay silent — there's no documented non-blocking, user-visible `Stop` output.

### 5-2e. Canary exfiltration seed (stage 3 of the injection gate)

Read from `references/hook-guard.md` → `## canary-seed.mjs`. Write to `.claude/guards/canary-seed.mjs`. Applies to all profiles — seeds a per-session canary token via a `SessionStart` hook; `injection-gate-guard.mjs`'s stage-3 check denies any tool call whose input contains it.

### 5-3. .claude/settings.json

For **nuxt** / **next** (same merge shape, different scaffold skill):
- **If `SCAFFOLDED = true`**: the `nuxt-scaffold`/`next-scaffold` skill already wrote `.claude/settings.json` with `permissions.allow` + a `PostToolUse` `lint-fix-file.mjs` hook (and the script itself). Merge the `PreToolUse` `bash-guard.mjs` + `spec-gate-guard.mjs` + `injection-gate-guard.mjs` hooks (matcher `Bash|Write|Edit|WebFetch|mcp__.*`), a `SessionStart` block with both `canary-seed.mjs` and `session-resume-check.mjs` hooks, any missing `permissions.allow` entries, **and** a second `PostToolUse` entry for `injection-scan-guard.mjs` alongside the existing `lint-fix-file.mjs` one — do not replace or duplicate the existing `lint-fix-file.mjs` entry. Merge per-event; show additions before writing.
- **Otherwise** (onboarding an existing nuxt or next repo): write `.claude/guards/lint-fix-file.mjs` per 5-2's note above if missing, then read the full settings.json template from `references/profile-nuxt.md` or `references/profile-next.md` → `## settings.json Template`. If `.claude/settings.json` exists, merge the `hooks` block + missing `permissions.allow` entries (per-event, never drop the user's); if not, write fresh.

For **go** / **nodejs**: read the template from `references/profile-{PROFILE}.md` → `## settings.json Template`. If the file exists, merge the `hooks` block + missing `permissions.allow` entries (per-event); otherwise write fresh.

### 5-3b. .vscode/settings.json (nuxt / next only)

Editor format-on-save via ESLint. Read `references/profile-nuxt.md` or `references/profile-next.md` → `## .vscode/settings.json Template`.

- If `.vscode/settings.json` exists: **merge** the keys in (never overwrite; show additions first).
- If not: write fresh.

Other profiles (go, nodejs — backend-only, no editor-format concern): skip.

### 5-3c. Harness version marker

Write `.claude/harness-version` containing the current version from this plugin's own `.claude-plugin/plugin.json` (plain text, just the version string, e.g. `1.22.11`) — the baseline Phase 1a's patch mode diffs against later.

- `INSTALL_MODE=yes` (or a fresh install) → always write/overwrite; every generated file now matches current templates.
- `INSTALL_MODE=new` → only write if the marker doesn't already exist. Files skipped as pre-existing may still be older than the recorded version — a later patch run reports those as "anchor not found" rather than corrupting them, so this is a safe degradation, not a correctness bug.

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

The knowledge.md rule file uses the index-first read protocol: agents read the index summary and only open a concept file when the summary is insufficient. This keeps per-session context load low even as the bundle grows.

If false, skip everything above — no other phase depends on it.

---

## Phase 5.6: CI Config (optional)

Decided in Phase 1.5 (`CI_PROVIDER`, auto-detected default from `git remote get-url origin`). Skip everything below if `no`.

Read templates from `references/ci.md`.

1. **GitHub** (if `CI_PROVIDER` is `github` or `both`): if `.github/workflows/ci.yml` already exists, treat like any other idempotency check — under `INSTALL_MODE=new` skip it silently; under `yes` show it and confirm before overwriting. Otherwise write `## github: {PROFILE}` to `.github/workflows/ci.yml`.
2. **GitLab** (if `CI_PROVIDER` is `gitlab` or `both`): same existence check for `.gitlab-ci.yml`. Otherwise write `## gitlab: {PROFILE}` to `.gitlab-ci.yml`.
3. **If `KNOWLEDGE_BUNDLE = true`** (decided in Phase 1.5): before writing each file above, merge in `## knowledge-validate step: github` / `## knowledge-validate step: gitlab` respectively, so the generated CI file validates the knowledge bundle in the same run — no separate manual step needed.

This phase only ever writes CI files it generates itself. It never edits a pre-existing, hand-written CI config — see Phase 5.5 step 6 for that case.

---

## Phase 5.7: Graphify (optional)

Decided in Phase 1.5 (`GRAPH`). If false, skip everything below — no graph files, no gitignore entries, no `graphify-out/` expectations exist anywhere in the harness.

1. **Write templates** from `references/graph.md`: `## .claude/rules/graph.md` → `.claude/rules/graph.md`, `## docs/graph-usage.md` → `docs/graph-usage.md`. Skip each if `INSTALL_MODE=new` and it already exists.
2. **Gitignore contract**: append `graphify-out/cost.json` and `graphify-out/cache/` (per-file AST cache, populated on every index run) to `.gitignore` — idempotent, check before appending. Never add `graphify-out/` itself; that directory is committed.
3. **Install check**: run `graphify --version`. If not found, open the tool's own README (github.com/Graphify-Labs/graphify) and follow its current install instructions verbatim — do not hardcode a command from memory, and note explicitly that the package name is `graphifyy` (double-y) to avoid a typosquat lookalike. Prompt the user to install; this is the only point in the harness that prompts for a graphify install.
4. **Propose the initial index**: skip entirely if `graphify-out/graph.json` already exists — nothing to propose, the graph is already built (this keeps a re-run on an already-compliant repo a no-op, same as the rest of this phase). Otherwise, once installed, propose (don't auto-run) `graphify update .` (headless, AST-only, zero API cost) or `/graphify .`. After it runs, replace `{GRAPHIFY_VERSION}` in `docs/graph-usage.md` with the output of `graphify --version`.

---

## Phase 6: Update README

Check for `README.md`. If found, check whether it already contains `## AI Onboarding`. If not present, append the templates from `references/summary-checklist.md` → `## Phase 6 README Templates` (replace `{LINT}`, `{TYPECHECK}`, `{TEST}` with profile commands). If no `README.md` exists: skip this phase (do not create one).

---

## Phase 7: Summary

Read `references/summary-checklist.md` → `## Phase 7 Summary Template`. Substitute `{PROFILE}`/`{LINT}`/`{TYPECHECK}`/`{TEST}` and the bracketed conditional lines, then print verbatim.

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
- Nuxt scaffold (Phase 0.5) — only if `PROFILE=nuxt` and no `nuxt.config.ts`; delegates to the `nuxt-scaffold` skill (no clone, no embedded copy into the target). When `SCAFFOLDED`, do not overwrite the scaffold's `.vscode/settings.json` or pre-commit — overlay additively.
- Go scaffold (Phase 0.5b) — only if `PROFILE=go` and no `go.mod`; delegates to the `go-scaffold` skill. Unlike nuxt-scaffold, it writes no `.claude/` anything and no pre-commit hook manager — Phases 5-1 and 5-3 proceed through their normal go/nodejs branches unchanged once `SCAFFOLDED=true`.
- Node.js scaffold (Phase 0.5c) — only if `PROFILE=nodejs` and no `package.json`; delegates to the `nodejs-scaffold` skill. Like go-scaffold, it writes no `.claude/` anything and no pre-commit hook manager — Phases 5-1 and 5-3 proceed through their normal go/nodejs branches unchanged once `SCAFFOLDED=true`.
- Next scaffold (Phase 0.5d) — only if `PROFILE=next` and no `next.config.*`; delegates to the `next-scaffold` skill (no clone, no embedded copy into the target). Same shape as nuxt-scaffold, not go/nodejs-scaffold — when `SCAFFOLDED`, do not overwrite the scaffold's `.vscode/settings.json` or pre-commit — overlay additively.
- Knowledge Bundle (Phase 5.5) — opt-in only, decided once in Phase 1.5 (`KNOWLEDGE_BUNDLE`); skip entirely if declined. Never edit unknown CI config automatically — only note it's needed.
- CI Config (Phase 5.6) — opt-in only, decided once in Phase 1.5 (`CI_PROVIDER`, auto-detected default); skip entirely if `no`. Only ever writes/overwrites CI files this skill generated; never edits pre-existing, hand-written CI config.
- Graphify (Phase 5.7) — opt-in only, decided once in Phase 1.5 (`GRAPH`); skip entirely if declined. Never auto-runs the initial index — always proposed. Install prompting happens here only, never in a consuming skill.
- All user-facing questions (profile ambiguity, harness conflicts, Knowledge Bundle, CI, foreign pre-commit hook) resolve before any file is written — see Phase 1.5.
- Never delete files not part of the harness.
- `.claude/harness-version` — written on every fresh/overwrite setup (Phase 5-3c) as a baseline for future patch runs; `new` mode only writes it if absent, since skipped pre-existing files may be older than the recorded version.
- Patch mode (Phase 1a) — only touches files/lines named in a changelog entry's `patch` block; never guesses at an anchor match; always advances `.claude/harness-version` even on partial application, logging what still needs manual review.

---

## Output Checklist

Read `references/summary-checklist.md` → `## Output Checklist` and verify every item against what was actually written this run.

---

## References

- `references/profile-nuxt.md` — templates for nuxt profile (CLAUDE.md, conventions-frontend, conventions-server, testing, architecture addendum, settings.json, .vscode/settings.json)
- `references/profile-next.md` — templates for next profile (same shape as profile-nuxt.md)
- `skills/next-scaffold/SKILL.md` — empty-repo next scaffold (Phase 0.5d): create-next-app + BFF preset (Zustand, TanStack Query, shadcn/ui, iron-session)
- `references/profile-go.md` — templates for go profile
- `skills/go-scaffold/SKILL.md` — empty-repo go scaffold (Phase 0.5b): contract-first (oapi-codegen + sqlc), chi, Postgres
- `references/profile-nodejs.md` — templates for nodejs profile
- `skills/nodejs-scaffold/SKILL.md` — empty-repo nodejs scaffold (Phase 0.5c): contract-first (openapi-typescript + Drizzle/drizzle-kit), Fastify, Postgres
- `references/files-shared.md` — shared files: security, architecture, AI task guide, review checklist, paths substitutions per profile
- `references/patch-mode.md` — Phase 1a: version diffing + CHANGELOG patch-block application for `INSTALL_MODE=patch`
- `references/hook-guard.md` — bash-guard.mjs, spec-gate-guard.mjs, injection-scan-guard.mjs, injection-gate-guard.mjs, session-resume-check.mjs, canary-seed.mjs scripts + pre-commit scripts per profile
- `references/budget-gate.md` — context_budget.mjs script (context budget gate)
- `references/knowledge-bundle.md` — optional Knowledge Bundle: rule file, spec, starter concept files, validator script
- `references/graph.md` — optional Graphify: rule file, usage doc, install/gitignore contract
- `references/ci.md` — optional CI config: GitHub Actions + GitLab CI templates per profile, plus the knowledge-validate step
- `references/summary-checklist.md` — Phase 7 summary print template + Output Checklist
