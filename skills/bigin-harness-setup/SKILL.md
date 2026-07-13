---
name: bigin-harness-setup
description: "Scaffolds BigIn AI workflow harness into a repo — CLAUDE.md, governance rules, and enforcement gates. MUST use when user says: 'set up harness', 'add AI rules', 'scaffold harness', 'add CLAUDE.md', 'initialize AI workflow', 'set up claude rules', 'thiết lập harness', 'cài harness', 'thêm AI rules', or when onboarding an existing repo for structured AI-assisted development. Supports nuxt, go, nodejs profiles."
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
4. None found or ambiguous → ask:

```
Which stack profile?
1. nuxt   — Nuxt 4 fullstack (Cloudflare Pages): Nuxt UI, Pinia + Colada, VueUse, nuxt-auth-utils, Vitest, Zod — BFF proxy layer, no direct DB access
2. go     — Go REST API backend
3. nodejs — Node.js TypeScript REST API backend

Type 1, 2, or 3.
```

Store result as `PROFILE`. Load `references/profile-{PROFILE}.md` for all template content.

---

## Phase 0.5: Nuxt Project Scaffold

**nuxt profile only.** If `PROFILE = nuxt` **and** the repo has no `nuxt.config.ts`:

Scaffolding is done by the `nuxt-scaffold` skill's deterministic script — **not** conversationally. Three steps, and **all questions happen up front, in one batch; zero prompts once scaffolding starts**:

1. **Gather every scaffold decision now**, in the same turn, back-to-back with this skill's own remaining decisions: ask `skills/nuxt-scaffold/SKILL.md` → Step 2 (project name, primary/neutral theme colors, version policy), then immediately ask Phase 1.5's bundle below (Knowledge Bundle + CI config + Security reviewer — an empty repo can't hit Phase 1's conflict path, so only those three apply here). Confirm the scaffold summary once. Store `KNOWLEDGE_BUNDLE` / `CI_PROVIDER` / `SECURITY_REVIEWER` now — Phase 1.5 is a no-op later in this branch since they're already decided. `CODE_REVIEWER` needs no question (see Phase 1.5).
2. **Write the config JSON** (schema in `skills/nuxt-scaffold/SKILL.md` → Step 3) to a temp file outside the repo, with `"packageManager": "pnpm"`.
3. **Run the script and stream its output** (several minutes — installs + verify gates):
   ```sh
   node skills/nuxt-scaffold/scripts/scaffold.mjs --config <path>
   ```
   Exit 0 = scaffolded, verified (lint/type-check/test), committed. Non-zero → report the script's last `[scaffold] ERROR:` line and stop; do not improvise the remaining steps by hand.

**No GitHub template clone, no embedded skill copy.** Do not write any project files yourself while it runs.

Set `SCAFFOLDED = true` when the script exits 0 (the governance overlay reconciles with what the scaffold provides — see Phases 1 and 5).

Skip this phase entirely if `nuxt.config.ts` already exists (onboarding an existing repo) or for the `go` / `nodejs` profiles.

---

## Phase 1: Detect Existing Harness

If `SCAFFOLDED = true`, the `nuxt-scaffold` skill already brought `nuxt.config.ts`, `app/`, `server/`, `eslint.config.mjs`, `.claude/settings.json` (permissions + a `PostToolUse` lint-fix hook), `.vscode/settings.json`, and a `simple-git-hooks` pre-commit gate. Treat those as pre-existing (do not clobber) and skip straight to adding the BigIn guardrails the scaffold lacks: `bash-guard.mjs`, `spec-gate-guard.mjs`, and the `injection-scan-guard.mjs` / `injection-gate-guard.mjs` pair (+ their `PreToolUse`/`PostToolUse` hooks), governance rules, and AI files.

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

Skip this phase entirely if `KNOWLEDGE_BUNDLE` and `CI_PROVIDER` are already set (Phase 0.5 asked them alongside the nuxt-scaffold batch for the empty-repo branch).

Otherwise, ask **one bundled `AskUserQuestion` call**, before writing any files, combining:

1. **Knowledge Bundle** (yes/no):
   ```
   Add the Knowledge Bundle convention? (yes/no)
   Structured domain knowledge under knowledge/ — concept files with frontmatter, linked from an index, validated by a script. See references/knowledge-bundle.md for the spec.
   ```
2. **CI config** (github/gitlab/both/no) — auto-detect a default first: run `git remote get-url origin 2>/dev/null`; if it matches `github.com` preselect `github`, if `gitlab.com` preselect `gitlab`; if undetermined (no remote, unrecognized host, or ambiguous) preselect `both`. Present the preselected option first/labeled as detected, but let the user override:
   ```
   Add CI config? (github/gitlab/both/no)
   Generates a workflow that runs {LINT} && {TYPECHECK} && {TEST} on push to main and on merge/pull requests.
   ```
3. **Security reviewer** (yes/no):
   ```
   Add an opt-in security-reviewer agent? (yes/no)
   A read-only subagent (Read/Grep/Glob/Bash, opus) focused on auth, session, secrets, and PII handling — for an extra adversarial review pass on top of code-reviewer when a repo or feature touches those surfaces. See references/files-shared.md for the template.
   ```
4. **Install mode** — only if Phase 1 detected an existing-harness conflict in this run: the overwrite/new/cancel question from Phase 1 above.

Store `KNOWLEDGE_BUNDLE`, `CI_PROVIDER`, `SECURITY_REVIEWER` (and `INSTALL_MODE` if included). Set `CODE_REVIEWER = true` unconditionally — no question; it's a read-only, low-risk agent file (mentioned in the Phase 7 summary so the user knows it's there).

---

## Phase 2: Generate CLAUDE.md

Read the content from `references/profile-{PROFILE}.md` → `## CLAUDE.md Template` section.

Write to `CLAUDE.md` in the project root.
Skip if `INSTALL_MODE=new` and `CLAUDE.md` already exists.

(The `nuxt-scaffold` skill does **not** write a `CLAUDE.md` — governance is this skill's job — so for `SCAFFOLDED = true` nuxt repos there is no existing `CLAUDE.md` to preserve; write it fresh.)

---

## Phase 3: Generate .claude/rules/

Create `.claude/rules/` if it doesn't exist.

**For nuxt** — generate five files (each: skip if `INSTALL_MODE=new` and already exists):

- **conventions-frontend.md** — from `references/profile-nuxt.md` → `## conventions-frontend.md Template`. Includes `paths:` frontmatter scoping it to `app/**` etc.
- **conventions-server.md** — from `references/profile-nuxt.md` → `## conventions-server.md Template`. Includes `paths:` frontmatter scoping it to `server/**`.
- **testing.md** — from `references/profile-nuxt.md` → `## testing.md Template`. Includes `paths:` frontmatter scoping it to `tests/**` + `vitest.config.ts`. Centralized-tests convention: `tests/` mirrors `app/`/`server/`, cross-tree imports use the `~~/` root alias, Nitro auto-imports stubbed via `tests/support/`.
- **security.md** — from `references/files-shared.md` → `## security.md`. **Prepend** the nuxt paths frontmatter from `## paths substitutions` in `references/files-shared.md` before the content.
- **architecture.md** — from `references/files-shared.md` → `## architecture.md`, then append the profile block from `references/profile-nuxt.md` → `## architecture addendum`. **Prepend** the nuxt paths frontmatter from `## paths substitutions` before the content.

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

**First check for an existing git-hook manager.** If the repo already gates commits via `simple-git-hooks` or `husky` (key in `package.json`), a `.husky/` dir, or an existing `.git/hooks/pre-commit` → **do NOT create `scripts/pre-commit.sh`**. The existing mechanism is the gate; skip to 5-2. (This is the case for `SCAFFOLDED = true` nuxt repos — the template uses `simple-git-hooks` → `pnpm lint-staged`.)

Otherwise (go / nodejs, or a nuxt repo without a hook manager): read `references/hook-guard.md` → `## pre-commit: {PROFILE}`. Write to `scripts/pre-commit.sh`, then `chmod +x scripts/pre-commit.sh`, and continue to 5-1b.

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

> nuxt auto-format also needs a guard script — `.claude/guards/lint-fix-file.mjs`, ESLint `--fix` scoped to the single touched file (a blanket `pnpm lint --fix` would rewrite every pre-existing lint violation in the repo on the first edit). If `SCAFFOLDED = true`, `nuxt-scaffold` already wrote it. Otherwise (onboarding an existing nuxt repo), copy it now from `skills/nuxt-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs` — single source of truth, don't duplicate the script body here.

### 5-2b. Spec gate guard (blocks non-trivial edits before plan approval)

Read from `references/hook-guard.md` → `## spec-gate-guard.mjs`. Write to `.claude/guards/spec-gate-guard.mjs`. Applies to all profiles.

### 5-2c. Prompt-injection gate (two-stage, flags then confirms)

Read from `references/hook-guard.md` → `## injection-scan-guard.mjs` and `## injection-gate-guard.mjs`. Write to `.claude/guards/injection-scan-guard.mjs` and `.claude/guards/injection-gate-guard.mjs` respectively. Applies to all profiles.

### 5-2d. Session resume check (deterministic resume prompt)

Read from `references/hook-guard.md` → `## session-resume-check.mjs`. Write to `.claude/guards/session-resume-check.mjs`. Applies to all profiles — replaces the previous CLAUDE.md-prose-only "check for SESSION.md on session start" instruction with a `SessionStart` hook.

### 5-2e. Verify gate (deterministic Stop hook for lint+typecheck+test)

Read from `references/hook-guard.md` → `## verify-gate.mjs: nuxt / nodejs` (nuxt and nodejs profiles) or `## verify-gate.mjs: go` (go profile). Write to `.claude/guards/verify-gate.mjs`. Replaces task-workflow Step 5's prose-only "show the actual output" enforcement with a hard `Stop` gate — skips entirely on a clean working tree, otherwise blocks turn-end until lint+typecheck+test pass.

### 5-3. .claude/settings.json

For **nuxt**:
- **If `SCAFFOLDED = true`**: the `nuxt-scaffold` skill already wrote `.claude/settings.json` with `permissions.allow` + a `PostToolUse` `lint-fix-file.mjs` hook (and the script itself). Merge the `PreToolUse` `bash-guard.mjs` + `spec-gate-guard.mjs` + `injection-gate-guard.mjs` hooks, a `SessionStart` `session-resume-check.mjs` hook, a `Stop` `verify-gate.mjs` hook, any missing `permissions.allow` entries, **and** a second `PostToolUse` entry for `injection-scan-guard.mjs` alongside the existing `lint-fix-file.mjs` one — do not replace or duplicate the existing `lint-fix-file.mjs` entry. Merge per-event; show additions before writing.
- **Otherwise** (onboarding an existing nuxt repo): write `.claude/guards/lint-fix-file.mjs` per 5-2's note above if missing, then read the full settings.json template from `references/profile-nuxt.md` → `## settings.json Template`. If `.claude/settings.json` exists, merge the `hooks` block + missing `permissions.allow` entries (per-event, never drop the user's); if not, write fresh.

For **go** / **nodejs**: read the template from `references/profile-{PROFILE}.md` → `## settings.json Template`. If the file exists, merge the `hooks` block + missing `permissions.allow` entries (per-event); otherwise write fresh.

### 5-3b. .vscode/settings.json (nuxt only)

Editor format-on-save via ESLint. Read `references/profile-nuxt.md` → `## .vscode/settings.json Template`.

- If `.vscode/settings.json` exists: **merge** the keys in (never overwrite; show additions first).
- If not: write fresh.

Other profiles: skip.

### 5-3c. Harness version marker

Write `.claude/harness-version` containing the current version from this plugin's own `.claude-plugin/plugin.json` (plain text, just the version string, e.g. `1.22.11`) — the baseline Phase 1a's patch mode diffs against later.

- `INSTALL_MODE=yes` (or a fresh install) → always write/overwrite; every generated file now matches current templates.
- `INSTALL_MODE=new` → only write if the marker doesn't already exist. Files skipped as pre-existing may still be older than the recorded version — a later patch run reports those as "anchor not found" rather than corrupting them, so this is a safe degradation, not a correctness bug.

### 5-4. code-reviewer agent

`CODE_REVIEWER` is always `true` (decided in Phase 1.5 — no question). Read from `references/files-shared.md` → `## code-reviewer agent`. Write to `.claude/agents/code-reviewer.md`.

### 5-4b. security-reviewer agent (optional)

Decided in Phase 1.5 (`SECURITY_REVIEWER`). If true, read from `references/files-shared.md` → `## security-reviewer agent`. Write to `.claude/agents/security-reviewer.md`. If false, skip — no other phase depends on it.

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

## Phase 6: Update README

Check for `README.md`. If found, check whether it already contains `## AI Onboarding`.

If not present, append the following block (replace `{LINT}`, `{TYPECHECK}`, `{TEST}` with profile commands):

```markdown
## AI Onboarding

1. Clone the repo and install dependencies.
2. Run `claude` in the repo root and accept the workspace trust dialog — this repo ships a `.claude/settings.json` with pre-approved permissions, which Claude Code only applies after you trust the folder. (If the dialog doesn't appear, or you're on a headless/non-interactive setup, set `hasTrustDialogAccepted: true` for this path in `~/.claude.json`.)
3. Install git hook:
   ```sh
   ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x scripts/pre-commit.sh
   ```
4. Verify gates pass: `{LINT} && {TYPECHECK} && {TEST}`
5. Read `CLAUDE.md` → use `/task-workflow` (or read `AI_TASK_GUIDE.md`) for the per-task workflow.
6. Do one scoped task end-to-end through all gates to confirm the setup works.

### Runtime hygiene
- Run `/clear` between unrelated tasks to reset context and avoid token accumulation.
- Pipe long command output: `long-cmd | head -50` to avoid flooding context.
- Delegate broad scans (grep across the repo, full test suites) to subagents rather than running them inline.
```

Also append the Context Budget table if not already present:

```markdown
## Context Budget

Run `/context` after setup and record the harness token footprint. Run `node tools/context_budget.mjs` for the automated budget check.

| Date | Always-loaded tokens (est.) | Budget status |
|------|-----------------------------|---------------|
```

If no `README.md` exists: skip this phase (do not create one).

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
- Knowledge Bundle (Phase 5.5) — opt-in only, decided once in Phase 1.5 (`KNOWLEDGE_BUNDLE`); skip entirely if declined. Never edit unknown CI config automatically — only note it's needed.
- security-reviewer agent (Phase 5-4b) — opt-in only, decided once in Phase 1.5 (`SECURITY_REVIEWER`); skip entirely if declined.
- CI Config (Phase 5.6) — opt-in only, decided once in Phase 1.5 (`CI_PROVIDER`, auto-detected default); skip entirely if `no`. Only ever writes/overwrites CI files this skill generated; never edits pre-existing, hand-written CI config.
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
- `references/profile-go.md` — templates for go profile
- `references/profile-nodejs.md` — templates for nodejs profile
- `references/files-shared.md` — shared files: security, architecture, AI task guide, review checklist, code-reviewer agent, paths substitutions per profile
- `references/patch-mode.md` — Phase 1a: version diffing + CHANGELOG patch-block application for `INSTALL_MODE=patch`
- `references/hook-guard.md` — bash-guard.mjs, spec-gate-guard.mjs, injection-scan-guard.mjs, injection-gate-guard.mjs, session-resume-check.mjs, verify-gate.mjs scripts + pre-commit scripts per profile
- `references/budget-gate.md` — context_budget.mjs script (context budget gate)
- `references/knowledge-bundle.md` — optional Knowledge Bundle: rule file, spec, starter concept files, validator script
- `references/ci.md` — optional CI config: GitHub Actions + GitLab CI templates per profile, plus the knowledge-validate step
- `references/summary-checklist.md` — Phase 7 summary print template + Output Checklist
