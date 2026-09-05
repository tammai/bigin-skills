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
3. Install git hooks. **Claude Code does this for you** on your first run here, via the `Setup` hook — it symlinks whichever of the two scripts this repo has, and tells you if a manager owns them instead. To do it by hand (or if you work in Cursor, which has no `Setup` event):
   ```sh
   ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit && chmod +x scripts/pre-commit.sh
   ln -sf ../../scripts/commit-msg.sh .git/hooks/commit-msg && chmod +x scripts/commit-msg.sh
   ```
   (Skip either line whose script this repo doesn't have — where `simple-git-hooks` or `husky` is in use, run its own install step instead.)
4. Verify gates pass: `{LINT} && {TYPECHECK} && {TEST}`
5. Read `CLAUDE.md`, then `AI_TASK_GUIDE.md` for what `/task-workflow` will ask of you.
6. Do one scoped task end-to-end through all gates to confirm the setup works.

### Working in Cursor

This repo carries a Cursor mirror: `AGENTS.md` and `.cursor/rules/*.mdc` are **generated** from `CLAUDE.md` and `.claude/rules/`, and `.cursor/hooks.json` runs the same guards Claude Code does. Edit the canonical file and re-run the generator — never edit the mirror:

```sh
node tools/cursor_mirror.mjs          # regenerate after changing CLAUDE.md or .claude/rules/
node tools/cursor_mirror.mjs --check  # what the pre-commit gate runs
```

The skills work in Cursor too: install the `bigin-skills` plugin there (`/add-plugin`, or Customize → Plugins), and any skills this repo defines under `.claude/skills/` are picked up with no extra step. The subagent ladder is the one Claude-Code-only piece — in Cursor you drive `/task-workflow`'s implement/verify loop yourself.

(Delete this section if the repo didn't install Cursor parity.)

### Runtime hygiene
- Delegate broad scans (grep across the repo, full test suites) to subagents rather than running them inline — the result comes back without the intermediate output.
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

[if PROFILE=generic] No stack profile matched (not nuxt/nuxt-marketing/go/nodejs/next/flutter/tauri), so the stack-neutral harness was installed: no conventions/testing rules, no .vscode settings, no CI generated. Commands detected: lint={LINT}, typecheck={TYPECHECK}, test={TEST} — any shown as TODO need filling in, in CLAUDE.md, AI_REVIEW_CHECKLIST.md, and scripts/pre-commit.sh. For CI, run those commands plus `node tools/context_budget.mjs` in your own workflow.

[if SCAFFOLDED] Scaffolded the Nuxt 4 BFF app via the `nuxt-scaffold` skill. / Scaffolded the Next.js BFF app via the `next-scaffold` skill. / Scaffolded the Nuxt SPA frontend via `nuxt-scaffold`, then the Rust half with `pnpm tauri init --ci` (pinned flags) — `identifier` set off `com.tauri.dev`, `ssr: false` merged in, the scaffold's `server/` deleted; no capability set beyond the default, no keychain, store, API client or updater yet, all of which are the first slice's. / Created the Flutter app with `flutter create` (pinned args) — no flavors, state layer, local store, generated client or boundary lint config yet; those are the first slice's, and the generated gates skip the unconfigured lint plugins by name until then. Nothing is committed: this harness install is the first commit.

Created:
  AI_TASK_GUIDE.md
  AI_REVIEW_CHECKLIST.md
  .claude/rules/security.md       (paths: server/**,app/** — nuxt | app/**,content/**,i18n/**,content.config.ts — nuxt-marketing | src/app/**,src/components/**,src/hooks/** — next | **/*.go — go | src/** — nodejs | lib/**,api/openapi.yaml — flutter | app/**,src-tauri/** — tauri | source-extension glob — generic)
  .claude/rules/architecture.md   (paths: same as security; no profile addendum for generic)
  .claude/rules/conventions-frontend.md  [nuxt/nuxt-marketing/next/tauri only] (paths: app/** — nuxt | app/**,nuxt.config.ts,content.config.ts — nuxt-marketing | src/app/**,src/components/**,src/hooks/** — next | app/**,shared/**,nuxt.config.ts — tauri)
  .claude/rules/conventions-server.md    [nuxt/next only] (paths: server/** — nuxt | src/app/api/**,src/lib/** — next)
  .claude/rules/conventions-content.md   [nuxt-marketing only] (paths: content/**, i18n/** — the content-editor boundary: those two trees are editable, routing/locale set/block types/collection schemas/deploy config are not)
  .claude/rules/conventions-rust.md      [tauri only] (paths: src-tauri/**)
  .claude/rules/testing.md        [nuxt/nuxt-marketing/next/flutter/tauri only] (paths: tests/**, vitest.config.ts — nuxt and nuxt-marketing | src/**/*.test.ts(x), vitest.config.ts — next | test/**, integration_test/** — flutter | tests/**, src-tauri/tests/**, vitest.config.ts — tauri)
  .claude/rules/conventions.md    [go/nodejs/flutter only] (paths: scoped to source dir; flutter adds pubspec.yaml + analysis_options.yaml)
  .claude/rules/comments.md       (all profiles; paths: source-extension glob, not profile-substituted)
  .claude/rules/product.md        (all profiles; paths: docs/product/**, not profile-substituted)
  .claude/guards/lib/hook-io.mjs  (two-host payload adapter — every guard imports it)
  .claude/guards/bash-guard.mjs
  .claude/guards/spec-gate-guard.mjs
  .claude/guards/bugfix-test-guard.mjs
  .claude/guards/commit-msg-guard.mjs
  .claude/guards/injection-scan-guard.mjs
  .claude/guards/injection-gate-guard.mjs
  .claude/guards/session-resume-check.mjs
  .claude/guards/canary-seed.mjs
  .claude/guards/precompact-snapshot.mjs   (registered on PreCompact *and* SessionEnd)
  .claude/guards/install-hooks.mjs         (Setup hook — installs this clone's git hooks; Claude Code only, no Cursor Setup event)
  .claude/guards/instructions-trace.mjs    (opt-in, registered by no profile — needs CLAUDE_HARNESS_TRACE=1)
  [.claude/guards/lint-fix-file.mjs] (nuxt/nuxt-marketing/next/tauri only; skipped if `nuxt-scaffold`/`next-scaffold` already wrote it — never skipped on nuxt-marketing, which has no scaffold here)
  .claude/settings.json [created/merged]
  tools/context_budget.mjs
  .claude/harness-version [current version stamp]
  .claude/model-routing.json [subagent model + effort ladder: {MODEL_ROUTING}]
  CLAUDE.md [created]
  scripts/pre-commit.sh [skipped if a hook manager already exists]
  scripts/commit-msg.sh [skipped if a hook manager already exists]
  [Knowledge Bundle: .claude/rules/knowledge.md, knowledge/*, tools/knowledge_validate.mjs] (if opted in)
  [Cursor mirror: AGENTS.md, .cursor/rules/*.mdc, .cursor/hooks.json, tools/cursor_mirror.mjs] (if AGENT_HOSTS includes cursor)
  [analysis_options.yaml — analyzer: exclude for generated code merged in / already present] (flutter only)
  [rust-toolchain.toml — written from the local `rustc --version` / not written, Rust not on PATH (the generated CI reads it)] (tauri only)
  [.vscode/settings.json — rust-analyzer.linkedProjects: src-tauri/Cargo.toml merged in, alongside the ESLint keys] (tauri only)
  [src-tauri/tauri.conf.json — NOT written; identifier / app.security.csp / app.withGlobalTauri checked and reported below] (tauri only)
  [.fvmrc — written from the local Flutter version so the CI action can resolve an SDK / not written, Flutter not on PATH] (flutter + CI_PROVIDER github/both)
  [.github/workflows/ci.yml] (if CI_PROVIDER is github/both)
  [.gitlab-ci.yml] (if CI_PROVIDER is gitlab/both)
  [PLAN.md — created to clear the active spec gate for the CI writes above, then deleted] (Phase 5.6 step 0 only)
  [CI skipped — PLAN.md is mid-task and the spec gate blocks the write; re-run once it's cleared] (Phase 5.6 step 0 only)

Enabled:
  git repo [initialized/already present]
  pre-commit gate [scripts/pre-commit.sh hook | existing simple-git-hooks/husky | tauri and nuxt-marketing: scripts/pre-commit.sh chained behind pnpm lint-staged, since the manager runs ESLint and none of that profile's grep gates]
  commit-msg gate [scripts/commit-msg.sh hook | simple-git-hooks | husky]
  context budget gate (tools/context_budget.mjs — wired into pre-commit)
  session resume prompt (SessionStart hook — deterministic, replaces CLAUDE.md prose)
  canary exfiltration gate (SessionStart seeds a per-session token; injection-gate-guard.mjs denies any tool call whose input contains it)
  precompact autosave (PreCompact **and SessionEnd** hooks write in-flight state to .claude/memory/SESSION.md — a closed terminal now loses no more than a compaction does)
  clone bootstrap (Setup hook installs this clone's git hooks on the first Claude Code run — .git/hooks/ isn't tracked, so a teammate's clone was previously ungated with nothing saying so; Cursor has no Setup event, so a Cursor-only teammate still runs the README snippet)
  subagent model routing ({MODEL_ROUTING} ladder — sets each tier's model and effort; model-router/task-workflow read .claude/model-routing.json, edit it to change tiers)
  [knowledge bundle validation wired into the pre-commit gate] (if opted in)
  [knowledge bundle validation wired into generated CI] (if opted in and CI_PROVIDER != no)
  [sprint-distill available — run it at sprint end to fold merged work into knowledge/ and bigin-skills] (if opted in)
  [Cursor parity — same nine guards run under .cursor/hooks.json; CLAUDE.md/.claude/rules/ stay canonical and tools/cursor_mirror.mjs --check is wired into the pre-commit gate (and generated CI) so the mirror can't drift. One behavior differs: Cursor's preToolUse has no "ask", so the injection gate's heuristic stage denies instead of prompting] (if AGENT_HOSTS includes cursor)

Next steps:
  1. First `claude` run here: accept the workspace trust dialog, or the permissions.allow entries in .claude/settings.json are ignored.
  2. {LINT} && {TYPECHECK} && {TEST}
  3. Read CLAUDE.md + use /task-workflow for the per-task workflow
  4. One scoped task through all gates — confirm the harness works.
  5. Use /code-review and /security-review for code/security review — not scaffolded as project-local agents.
  [6. Flutter + CI: pin `subosito/flutter-action@v2` to a commit SHA — it is a third-party action with full access to the job. On GitLab, move `image: ghcr.io/cirruslabs/flutter:stable` to the same version as .fvmrc; `stable` is a moving target.] (if PROFILE=flutter and CI_PROVIDER != no)
  [7. Flutter: two gates are off until you configure them, and both say so when they skip — `dart run import_lint` (the *only* check on the layer/feature import boundaries; needs Dart 3.10+/Flutter 3.38+) and the CI codegen diff (needs build_runner, freezed, json_serializable and friends on exact versions, not caret ranges).] (if PROFILE=flutter)
  [8. Tauri: three values in src-tauri/tauri.conf.json were checked, not written — `identifier` (still com.tauri.dev means Tauri refuses to bundle at all, and changing it after a release orphans every installed user's local data), `app.security.csp` (unset or null means no policy — the gate fails on both) and `app.withGlobalTauri` (true puts the IPC bridge on window). Fix each before the first build.] (if PROFILE=tauri)
  [9. Tauri: the pre-commit gate carries the Rust half and the four security greps that `pnpm lint-staged` does not — no URL literal in app/, no secret in web storage, no server/ directory, no dangerous capability. First `cargo clippy` on a cold target/ takes minutes; later runs are seconds.] (if PROFILE=tauri)
  [10. Tauri + CI: pin `dtolnay/rust-toolchain` and `Swatinem/rust-cache` to commit SHAs — both are third-party actions with full access to the job. The workflow builds no installers on purpose: that is a three-OS matrix needing your signing and notarization secrets, and belongs in a release workflow once you have certificates.] (if PROFILE=tauri and CI_PROVIDER != no)
  [11. Nuxt marketing: the pre-commit gate carries three greps `pnpm lint-staged` does not — no hex or rgb() colour literal under app/components (escape hatch: token-ok), no `fallbackLocale` anywhere in the i18n config (no escape hatch — it is the one string that contradicts hidden-not-substituted), and no raw <img> outside app/components/media/ (escape hatch: img-ok). CI adds a build, because on this profile the build is the locale prerender, and asserts one prerendered entry point per locale bundle. No deploy step is generated: that is the site's own workflow.] (if PROFILE=nuxt-marketing)
  [12. Add `node tools/knowledge_validate.mjs` to your existing CI — this skill only wires it into CI it generated itself.] (if opted in and CI_PROVIDER=no but foreign CI config detected)
  [13. Optional: `InstructionsLoaded` tracing is written but off. To answer "did that path-scoped rule actually load?", register `.claude/guards/instructions-trace.mjs` per `hook-guard.md` and set CLAUDE_HARNESS_TRACE=1. Left off by default because that event fires on every rule load. Add `.claude/instructions-trace.log` to .gitignore if you turn it on.]
  [14. Working in Cursor: edit CLAUDE.md / .claude/rules/ and re-run `node tools/cursor_mirror.mjs` — never edit AGENTS.md or .cursor/rules/*.mdc directly. Add `node tools/cursor_mirror.mjs --check` to your existing CI if this skill didn't generate it.] (if AGENT_HOSTS includes cursor)
```

---

## Output Checklist

- [ ] **nuxt + empty repo** — `nuxt-scaffold` skill executed (Phase 0.5); `nuxt.config.ts` now present
- [ ] **next + empty repo** — `next-scaffold` skill executed (Phase 0.5); `next.config.ts` now present
- [ ] **tauri + empty repo** — `nuxt-scaffold` executed, then `pnpm tauri init --ci` with pinned flags (Phase 0.5); `src-tauri/tauri.conf.json` now present, `identifier` set off `com.tauri.dev`, `ssr: false` merged into `nuxt.config.ts`, the scaffold's `server/` deleted
- [ ] **if PROFILE=tauri** — `scripts/pre-commit.sh` written **even though `simple-git-hooks` already existed**, and chained behind `pnpm lint-staged` (the manager gates the frontend only); `rust-toolchain.toml` present or its absence reported; `rust-analyzer.linkedProjects` merged into `.vscode/settings.json`; the three `tauri.conf.json` values checked and reported, none rewritten
- [ ] **tauri only** — the pre-commit gate carries the Rust half **and** the four grep gates (no URL literal in `app/`, no secret in web storage, no `server/` directory, no dangerous capability incl. an unset-or-null `app.security.csp`); every `cargo fmt` in a gate carries `--check`, or it rewrites the tree mid-commit instead of checking it
- [ ] **if PROFILE=nuxt-marketing** — Phase 0.5 skipped (no marketing-site scaffolder exists, and the empty-repo question does not offer this profile); `scripts/pre-commit.sh` written **even though `simple-git-hooks` already existed**, chained behind `pnpm lint-staged`, and carrying all three greps; `.claude/guards/lint-fix-file.mjs` written (nothing here wrote it first)
- [ ] **nuxt-marketing only** — the pre-commit gate and generated CI both run the three greps (no hex/`rgb()` under `app/components`, no `fallbackLocale` in the i18n config, no raw `<img` outside `app/components/media/`), and **every grep tests its search root first** — `grep` exits 2 on a missing path even when it matched, and an exit 2 inside `if` is false, so one absent argument turns the step green over a repo full of violations
- [ ] **nuxt-marketing + CI** — the workflow **builds**, and asserts one prerendered entry point per `i18n/locales/*.json` (at most one locale may resolve at the root); **no deploy step is generated**
- [ ] **flutter + empty repo** — `flutter create` executed with pinned args (Phase 0.5); `pubspec.yaml` now present, nothing committed, `analysis_options.yaml` left as `flutter create` wrote it
- [ ] **existing repo matching no profile** — `PROFILE = generic`, no profile question asked; Phase 0.5, conventions/testing rules, `.vscode/settings.json` and CI all skipped
- [ ] **re-run on a repo that already has the guards** (adding CI that was declined the first time) — Phase 5.6 step 0 clears the active spec gate with a throwaway `PLAN.md`, the CI files land, and `PLAN.md` is gone afterwards; with a mid-task `PLAN.md` present, CI is skipped instead and the summary says why
- [ ] `CLAUDE.md` — profile-specific, ≤60 lines (generic: `{STACK}` line + detected commands, undetected ones dropped from the table)
- [ ] **nuxt/nuxt-marketing/next/tauri only** — `.claude/rules/conventions-frontend.md` — paths: app/** (nuxt) or app/**,nuxt.config.ts,content.config.ts (nuxt-marketing) or src/app/**,src/components/**,src/hooks/** (next) or app/**,shared/**,nuxt.config.ts (tauri) (≤40 lines)
- [ ] **nuxt/next only** — `.claude/rules/conventions-server.md` — paths: server/** (nuxt) or src/app/api/**,src/lib/** (next) (≤40 lines)
- [ ] **nuxt/nuxt-marketing/next/tauri only** — `.claude/rules/testing.md` — paths: tests/**, vitest.config.ts (nuxt and nuxt-marketing) or src/**/*.test.ts(x), vitest.config.ts (next) or tests/**, src-tauri/tests/**, vitest.config.ts (tauri) (≤40 lines)
- [ ] **nuxt-marketing only** — `.claude/rules/conventions-content.md` — paths: `content/**`, `i18n/**` (≤40 lines); the five closed-to-a-content-change items, the schema-and-content-change-together rule, content-as-untrusted-input, and hidden-not-substituted all present
- [ ] **tauri only** — `.claude/rules/conventions-rust.md` — paths: `src-tauri/**` (≤40 lines); the IPC-boundary, error-mapping, main-thread and keychain rules present
- [ ] **go/nodejs/flutter** — `.claude/rules/conventions.md` — paths: scoped to source dir (flutter: `lib/**`, `api/**`, `pubspec.yaml`, `analysis_options.yaml`)
- [ ] **flutter only** — `.claude/rules/testing.md` — paths: `test/**`, `integration_test/**`; goldens' pinned-platform rule and the migration-test requirement both present
- [ ] `.claude/rules/security.md` — shared security rules, paths: scoped per profile
- [ ] `.claude/rules/architecture.md` — shared base + profile addendum, paths: scoped per profile
- [ ] `.claude/rules/comments.md` — all profiles including generic, verbatim with its own source-extension `paths:` (no substitution)
- [ ] `.claude/rules/product.md` — all profiles including generic, verbatim with its own `paths: ["docs/product/**"]` (no substitution)
- [ ] `AI_TASK_GUIDE.md` — human-facing pointer to /task-workflow (not a second copy of the workflow)
- [ ] `AI_REVIEW_CHECKLIST.md` — profile commands filled in
- [ ] `scripts/pre-commit.sh` — lint + typecheck + test + context budget check, executable
- [ ] `scripts/commit-msg.sh` — Conventional Commits check, executable (or the equivalent entry added to simple-git-hooks/husky)
- [ ] `.claude/guards/lib/hook-io.mjs` — two-host payload adapter, written on **every** install (`AGENT_HOSTS = claude` included); every guard and bootstrap imports it, so a missing copy breaks all of them
- [ ] `.claude/guards/bash-guard.mjs` — blocks `--no-verify` and force-push to main
- [ ] `.claude/guards/spec-gate-guard.mjs` — blocks non-trivial edits until `PLAN.md` is approved, and on a `Branch:` mismatch
- [ ] `.claude/guards/bugfix-test-guard.mjs` — blocks fix-shaped commits with no staged test file
- [ ] `.claude/guards/commit-msg-guard.mjs` — blocks commits whose subject is not a Conventional Commit
- [ ] `.claude/guards/injection-scan-guard.mjs` — flags likely prompt-injection markers in WebFetch/mcp__/curl-wget Bash output
- [ ] `.claude/guards/injection-gate-guard.mjs` — asks for confirmation before the next risky tool call after a fresh flag
- [ ] `.claude/guards/session-resume-check.mjs` — SessionStart hook, injects a resume prompt when SESSION.md has status: in-progress
- [ ] `.claude/guards/canary-seed.mjs` — SessionStart hook, seeds a per-session canary token; `injection-gate-guard.mjs` denies any tool call whose input contains it
- [ ] `.claude/guards/precompact-snapshot.mjs` — autosaves in-flight state to `.claude/memory/SESSION.md`, registered on **both** `PreCompact` and `SessionEnd` (a closed terminal loses no more than a compaction does)
- [ ] `.claude/guards/install-hooks.mjs` — `Setup` hook; installs this clone's `pre-commit`/`commit-msg` symlinks, defers to simple-git-hooks/husky with the command to run, never clobbers a foreign hook
- [ ] `.claude/guards/instructions-trace.mjs` — written but **registered by no profile**; the summary points at the opt-in snippet rather than turning it on
- [ ] **nuxt/nuxt-marketing/next/tauri only** — `.claude/guards/lint-fix-file.mjs` — ESLint `--fix` scoped to the touched file
- [ ] `.claude/settings.json` — guards wired + profile permissions
- [ ] `tools/context_budget.mjs` — budget gate, executable
- [ ] `.claude/harness-version` — current version stamp (written fresh/overwrite; baseline for patch mode)
- [ ] `.claude/model-routing.json` — subagent model ladder set to the Phase 1.5 `MODEL_ROUTING` profile (`new` mode: existing file left untouched)
- [ ] **patch mode only** — only changelog `patch`-tagged changes since `FROM_VERSION` applied; `.claude/harness-version` advanced to `TO_VERSION`; summary lists applied vs skipped
- [ ] **verify mode only** — nothing installed and `.claude/harness-version` untouched; `CLAUDE.md` no larger than it started (a grown file is a bug); summary leads with any recorded command that no longer runs, and quotes every claim corrected or removed alongside the rows kept because they ran and failed
- [ ] **nuxt/nuxt-marketing/next/tauri only** — `.vscode/settings.json` with ESLint format-on-save (Prettier disabled), merged if it existed — skipped for go/nodejs/flutter/generic; **tauri also carries `rust-analyzer.linkedProjects: ["src-tauri/Cargo.toml"]`**, without which rust-analyzer finds no project and the whole Rust half sits unanalyzed in the editor
- [ ] **flutter only** — the pre-commit gate and generated CI run **both** `dart run custom_lint` and `dart run import_lint`, each skipped-with-a-named-message when unconfigured; the base-URL grep and (CI only) the regenerate-and-diff step are present, the latter skipping-with-a-message rather than failing when the generators aren't exactly pinned
- [ ] **flutter only** — every `dart format` in a gate carries `--output=none`; without it the gate rewrites the working tree mid-commit instead of checking it
- [ ] **flutter only** — `analysis_options.yaml` has an `analyzer: exclude:` covering `*.g.dart` / `*.freezed.dart` / `api/generated/**`, merged into the existing file rather than overwriting it; `flutter analyze --fatal-infos` fails on generated code without it
- [ ] **flutter + CI github/both** — `.fvmrc` exists (written from the local Flutter version if it didn't), or the summary says it was skipped because Flutter isn't on PATH
- [ ] git repo initialized (if it wasn't one) and `.git/hooks/pre-commit` installed (or foreign hook left untouched with confirmation)
- [ ] `.git/hooks/commit-msg` installed via symlink, simple-git-hooks, or husky — and which one is named in the summary
- [ ] `README.md` — AI Onboarding + runtime hygiene + Context Budget table appended (if README existed)
- [ ] **if opted in** — Knowledge Bundle: `.claude/rules/knowledge.md`, `knowledge/{meta,contracts,constraints}/*.md`, `knowledge/index.md`, `knowledge/log.md`, `tools/knowledge_validate.mjs`, wired into the pre-commit gate, `AI_REVIEW_CHECKLIST.md` gets one added line
- [ ] **if CI_PROVIDER = github/both** — `.github/workflows/ci.yml` runs lint + typecheck + test (+ knowledge validator and cursor-mirror check if opted in)
- [ ] **if CI_PROVIDER = gitlab/both** — `.gitlab-ci.yml` runs lint + typecheck + test (+ knowledge validator and cursor-mirror check if opted in)
- [ ] **if AGENT_HOSTS includes cursor** — `AGENTS.md` + `.cursor/rules/*.mdc` **generated** by `node tools/cursor_mirror.mjs` (never hand-written), one `.mdc` per `.claude/rules/*.md` with `paths:` translated to comma-separated `globs:` and brace sets expanded; `.cursor/hooks.json` registers all nine guards with no matchers and `failClosed: true` on the five blocking ones; `tools/cursor_mirror.mjs --check` wired into the pre-commit gate; `node tools/cursor_mirror.mjs --check` exits 0 on the freshly-scaffolded repo
- [ ] **if AGENT_HOSTS = claude** — no `AGENTS.md`, no `.cursor/`, no `tools/cursor_mirror.mjs`; `tools/context_budget.mjs` prints only the Claude Code line

---

# Phase 8: Measure Context Budget

After the summary, print this verbatim:

```
Harness installed. Now measure its token footprint:

1. Run `/context` in Claude Code — look for CLAUDE.md and .claude/rules/ in the breakdown.
   Record the result in README.md → Context Budget table: today's date, estimated harness tokens, Pass/Fail.

2. Run `node tools/context_budget.mjs` for the automated verdict.
   Pass = within the ~3 000-token always-loaded budget.
   Fail = one or more files need trimming (see output for which).

The path-scoped rule files (conventions-frontend.md, conventions-server.md, conventions-content.md,
security.md, architecture.md, comments.md, product.md) only load when matching files are in context — they don't count against
the always-loaded budget unless you're editing those paths.

With Cursor parity installed the gate prints one line per host — Claude Code (CLAUDE.md +
unscoped .claude/rules/ + skill descriptions) and Cursor (AGENTS.md + always-applied
.cursor/rules/) — and each is capped separately, since only one loads in any given session.
```
