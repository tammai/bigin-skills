# Summary & Checklist Templates

Literal output templates for Phase 6, Phase 7, and the Output Checklist — pure print/verify material, no branching logic, same shape as the other externalized templates in this directory.

---

## Phase 6 README Templates

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

## Phase 7 Summary Template

Print a short summary of what was created and what's next:

```
BigIn harness setup complete for profile: {PROFILE}

[if SCAFFOLDED] Scaffolded the Nuxt 4 BFF app via the `nuxt-scaffold` skill. / Scaffolded the Next.js BFF app via the `next-scaffold` skill.

Created:
  AI_TASK_GUIDE.md
  AI_REVIEW_CHECKLIST.md
  .claude/rules/security.md       (paths: server/**,app/** — nuxt | src/app/**,src/components/**,src/hooks/** — next | **/*.go — go | src/** — nodejs)
  .claude/rules/architecture.md   (paths: same as security)
  .claude/rules/conventions-frontend.md  [nuxt/next only] (paths: app/** — nuxt | src/app/**,src/components/**,src/hooks/** — next)
  .claude/rules/conventions-server.md    [nuxt/next only] (paths: server/** — nuxt | src/app/api/**,src/lib/** — next)
  .claude/rules/testing.md        [nuxt/next only] (paths: tests/**, vitest.config.ts — nuxt | src/**/*.test.ts(x), vitest.config.ts — next)
  .claude/rules/conventions.md    [go/nodejs only] (paths: scoped to source dir)
  .claude/guards/bash-guard.mjs
  .claude/guards/spec-gate-guard.mjs
  .claude/guards/injection-scan-guard.mjs
  .claude/guards/injection-gate-guard.mjs
  .claude/guards/session-resume-check.mjs
  [.claude/guards/lint-fix-file.mjs] (nuxt/next only; skipped if `nuxt-scaffold`/`next-scaffold` already wrote it)
  .claude/settings.json [created/merged]
  tools/context_budget.mjs
  .claude/harness-version [current version stamp]
  CLAUDE.md [created]
  scripts/pre-commit.sh [skipped if a hook manager already exists]
  [Knowledge Bundle: .claude/rules/knowledge.md, knowledge/*, tools/knowledge_validate.mjs] (if opted in)
  [.github/workflows/ci.yml] (if CI_PROVIDER is github/both)
  [.gitlab-ci.yml] (if CI_PROVIDER is gitlab/both)

Enabled:
  git repo [initialized/already present]
  pre-commit gate [scripts/pre-commit.sh hook | existing simple-git-hooks/husky]
  context budget gate (tools/context_budget.mjs — wired into pre-commit)
  session resume prompt (SessionStart hook — deterministic, replaces CLAUDE.md prose)
  [knowledge bundle validation wired into the pre-commit gate] (if opted in)
  [knowledge bundle validation wired into generated CI] (if opted in and CI_PROVIDER != no)
  [sprint-distill available — run it at sprint end to fold merged work into knowledge/ and bigin-skills] (if opted in)

Next steps:
  1. First `claude` run here: accept the workspace trust dialog, or the permissions.allow entries in .claude/settings.json are ignored.
  2. {LINT} && {TYPECHECK} && {TEST}
  3. Read CLAUDE.md + use /task-workflow for the per-task workflow
  4. One scoped task through all gates — confirm the harness works.
  5. Use /code-review and /security-review for code/security review — not scaffolded as project-local agents.
  [6. Add `node tools/knowledge_validate.mjs` to your existing CI — this skill only wires it into CI it generated itself.] (if opted in and CI_PROVIDER=no but foreign CI config detected)
```

---

## Output Checklist

- [ ] **nuxt + empty repo** — `nuxt-scaffold` skill executed (Phase 0.5); `nuxt.config.ts` now present
- [ ] **next + empty repo** — `next-scaffold` skill executed (Phase 0.5d); `next.config.ts` now present
- [ ] `CLAUDE.md` — profile-specific, ≤60 lines
- [ ] **nuxt/next only** — `.claude/rules/conventions-frontend.md` — paths: app/** (nuxt) or src/app/**,src/components/**,src/hooks/** (next) (≤40 lines)
- [ ] **nuxt/next only** — `.claude/rules/conventions-server.md` — paths: server/** (nuxt) or src/app/api/**,src/lib/** (next) (≤40 lines)
- [ ] **nuxt/next only** — `.claude/rules/testing.md` — paths: tests/**, vitest.config.ts (nuxt) or src/**/*.test.ts(x), vitest.config.ts (next) (≤40 lines)
- [ ] **go/nodejs** — `.claude/rules/conventions.md` — paths: scoped to source dir
- [ ] `.claude/rules/security.md` — shared security rules, paths: scoped per profile
- [ ] `.claude/rules/architecture.md` — shared base + profile addendum, paths: scoped per profile
- [ ] `AI_TASK_GUIDE.md` — spec gate + task workflow (human reference; agents use /task-workflow)
- [ ] `AI_REVIEW_CHECKLIST.md` — profile commands filled in
- [ ] `scripts/pre-commit.sh` — lint + typecheck + test + context budget check, executable
- [ ] `.claude/guards/bash-guard.mjs` — blocks `--no-verify` and force-push to main
- [ ] `.claude/guards/spec-gate-guard.mjs` — blocks non-trivial edits until `PLAN.md` is approved
- [ ] `.claude/guards/injection-scan-guard.mjs` — flags likely prompt-injection markers in WebFetch/mcp__/curl-wget Bash output
- [ ] `.claude/guards/injection-gate-guard.mjs` — asks for confirmation before the next risky tool call after a fresh flag
- [ ] `.claude/guards/session-resume-check.mjs` — SessionStart hook, injects a resume prompt when SESSION.md has status: in-progress
- [ ] **nuxt/next only** — `.claude/guards/lint-fix-file.mjs` — ESLint `--fix` scoped to the touched file
- [ ] `.claude/settings.json` — guards wired + profile permissions
- [ ] `tools/context_budget.mjs` — budget gate, executable
- [ ] `.claude/harness-version` — current version stamp (written fresh/overwrite; baseline for patch mode)
- [ ] **patch mode only** — only changelog `patch`-tagged changes since `FROM_VERSION` applied; `.claude/harness-version` advanced to `TO_VERSION`; summary lists applied vs skipped
- [ ] **nuxt/next only** — `.vscode/settings.json` with ESLint format-on-save (Prettier disabled), merged if it existed
- [ ] git repo initialized (if it wasn't one) and `.git/hooks/pre-commit` installed (or foreign hook left untouched with confirmation)
- [ ] `README.md` — AI Onboarding + runtime hygiene + Context Budget table appended (if README existed)
- [ ] **if opted in** — Knowledge Bundle: `.claude/rules/knowledge.md`, `knowledge/{meta,contracts,constraints}/*.md`, `knowledge/index.md`, `knowledge/log.md`, `tools/knowledge_validate.mjs`, wired into the pre-commit gate, `AI_REVIEW_CHECKLIST.md` gets one added line
- [ ] **if CI_PROVIDER = github/both** — `.github/workflows/ci.yml` runs lint + typecheck + test (+ knowledge validator if opted in)
- [ ] **if CI_PROVIDER = gitlab/both** — `.gitlab-ci.yml` runs lint + typecheck + test (+ knowledge validator if opted in)
