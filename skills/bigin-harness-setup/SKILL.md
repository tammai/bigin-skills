---
name: bigin-harness-setup
description: "Scaffolds BigIn's AI workflow harness into a repo — CLAUDE.md brief, path-scoped .claude/rules/, commit-time guard + context-budget gates, optional Cursor mirror. Profiles: nuxt, nuxt-marketing, next, go, nodejs, flutter, tauri, generic. Triggers: 'set up harness', 'add AI rules', 'add Cursor support', 'migrate off Spec Kit'."
effort: medium
allowed-tools: Bash(git init) Bash(git rev-parse *) Bash(chmod +x *) Bash(ln -sf *)
---

# bigin-harness-setup

Sets up a standardized AI workflow harness — the `CLAUDE.md` agent brief, path-scoped rules, and commit-time enforcement gates (guard hooks + a context-budget check). Idempotent — re-running on an already-set-up repo is safe.

---

## Phase 0: Detect Stack Profile

Check for stack indicators, **first match wins**:

| # | Marker | Profile |
|---|---|---|
| 1 | `src-tauri/tauri.conf.json` | `tauri` |
| 2 | `nuxt.config.ts` / `.js` **plus** `@nuxt/content` and `@nuxtjs/i18n` in `dependencies` **plus** a `content/` tree **plus** no auth marker | `nuxt-marketing` |
| 3 | `nuxt.config.ts` / `.js` | `nuxt` |
| 4 | `go.mod` | `go` |
| 5 | `package.json` with express/fastify/hono/koa in dependencies | `nodejs` |
| 6 | `next.config.ts` / `.js` / `.mjs` | `next` |
| 7 | `pubspec.yaml` **plus both Flutter-app checks** | `flutter` |
| 8 | empty repo — no source files, no manifest | **ask** (the answer picks the scaffold Phase 0.5 runs) |
| 9 | existing code, nothing matched | `generic` |

**Rows 1 and 2 are above row 3 on purpose and must never be reordered.** Both carry row 3's `nuxt.config.ts` marker as well as their own, so on first-match-wins each has to precede it. A Tauri desktop app with a Nuxt frontend matched as `nuxt` gets onboarded as a web app — SSR left on, a `server/` BFF that does not exist at runtime, and no rule about capabilities, the IPC trust boundary, the updater key or code signing. A multi-locale marketing site matched as `nuxt` gets BFF-proxy, sealed-session and Pinia-Colada conventions for a repo with no server half and no auth, and no way to say the one thing that matters there — that a client's content editor may change content files and locale bundles and nothing else.

**Row 2's third condition is the narrowing test, and it is what keeps row 3 untouched.** A Nuxt fullstack app that ships a docs section satisfies the first two conditions and must stay on `nuxt`. `@nuxt/content` in `devDependencies` only is likewise not a match.

Row 7 is deliberately narrower than "has a `pubspec.yaml`" and narrower again than "is Flutter": a Dart package, a Flutter package and a Flutter plugin must all fall through to `generic`. Row 9 **never asks** — an existing repo that isn't one of these won't become one, so say one line ("no matching stack profile — installing the stack-neutral harness") and continue.

Row 2's four conditions and the two Flutter checks in full, and the exact wording of row 8's question — which deliberately does **not** offer `nuxt-marketing`, since no scaffolder for it exists here: **`references/profile-detection.md`**.

Store result as `PROFILE`. Load `references/profile-{PROFILE}.md` for all template content — `references/profile-generic.md` for `generic`, which states up front what that profile installs and skips.

---

## Phase 0.5: Project Scaffold (empty repo only)

Runs when the repo lacks the marker file for `PROFILE` — `nuxt.config.ts` (nuxt, nuxt-marketing), `next.config.*` (next), `go.mod` (go), `package.json` (nodejs), `pubspec.yaml` (flutter), `src-tauri/tauri.conf.json` (tauri). Skip the phase entirely otherwise; that's onboarding an existing repo — which is the usual case for `nuxt-marketing`, whose repos arrive from the Marketing Site Factory's template with a `nuxt.config.ts` already in place. An **empty** `nuxt-marketing` repo is scaffolded like any other: it is option 7 of row 8's question, and this phase delegates it to `nuxt-marketing-scaffold`. Also skip the phase entirely for `PROFILE = generic` — there's no scaffold skill for an unknown stack, and generic is only ever reached from a repo that already has code.

Scaffolding is delegated to a deterministic script — that profile's own scaffold skill for five of the seven scaffolded profiles, and the stack's own CLI for the other two: `flutter create` for `flutter`, and `nuxt-scaffold` followed by `pnpm tauri init` for `tauri`, since neither a `flutter-scaffold` nor a `tauri-scaffold` skill exists (`references/scaffold-delegation.md` says what each would have to add and why that isn't a template yet). Either way it is a pinned command line, **not** done conversationally. All questions happen up front, in one batch; zero prompts once scaffolding starts. Per-profile invocation, decisions to gather, and the full procedure: `references/scaffold-delegation.md`.

Set `SCAFFOLDED = true` when the script exits 0; the governance overlay then reconciles with what it provided (Phases 1 and 5).

---

## Phase 0.7: Detect Spec Kit

Runs before Phase 1 — the outcome changes what Phase 1 finds. Check for [GitHub Spec Kit](https://github.com/github/spec-kit) markers (`.specify/`, `.claude/skills/speckit[-.]*`, `.claude/commands/speckit[-.]*`, `specs/<nnn>-<slug>/spec.md`). None present → set `SPECKIT = none` and skip this phase entirely; it's the common case.

Present → read `references/speckit-migration.md` for the layout table, the `migrate | coexist | leave` decision (folded into Phase 1.5's bundle, never asked standalone), the ordered migration procedure, the workflow mapping, and the read-only `tools/speckit-triage.mjs` classifier. Never delete anything before the user has seen the triage table.

---

## Phase 1: Detect Existing Harness

If `SCAFFOLDED = true`, everything the scaffold wrote is **pre-existing** — overlay additively, never fresh. `references/scaffold-delegation.md` → "What each scaffold leaves behind" is the per-profile table: what each brings, whether a `.claude/` already exists to merge into (nuxt/next/tauri yes, go/nodejs/flutter no), and the two files the overlay must merge into rather than rewrite — flutter's `analysis_options.yaml` and tauri's `tauri.conf.json`.

Check for existing harness files:
```
CLAUDE.md | AI_TASK_GUIDE.md | AI_REVIEW_CHECKLIST.md | .claude/rules/
```

If any exist, show what was found and ask:
```
Found existing harness files: [list them]

Overwrite all? (yes) / Create missing only? (new) / Patch to latest? (patch) / Re-verify what's there? (verify) / Cancel? (cancel)
```

- `yes` → overwrite all (show what will be replaced before writing)
- `new` → create only files that don't exist; skip existing ones silently
- `patch` → apply only the specific changes introduced since this repo's harness was last updated (see Phase 1a) — leaves everything else, including hand edits, untouched
- `verify` → install nothing; re-check every claim in the existing `CLAUDE.md` against this repo and correct or remove what no longer holds (see Phase 1b)
- `cancel` → stop immediately

Store choice as `INSTALL_MODE`. If `INSTALL_MODE=patch`, skip directly to Phase 1a; if `INSTALL_MODE=verify`, skip directly to Phase 1b — do not fold this question into Phase 1.5's bundle for either one, neither mode needs any further decision. Otherwise, if this question fires, fold it into Phase 1.5's bundle below instead of asking it standalone here (it's question 5 of the six there) — resolve it in the same `AskUserQuestion` call.

---

## Phase 1a: Patch Mode (`INSTALL_MODE=patch` only)

Self-contained — skip Phases 1.5 through 8 entirely when this runs; it ends with its own summary. Full procedure in `references/patch-mode.md` (read version, collect eligible `patch` blocks from CHANGELOG.md, apply each by anchor match, write `.claude/harness-version`, print summary).

---

## Phase 1b: Verify Mode (`INSTALL_MODE=verify` only)

Self-contained — skip Phases 1.5 through 8 entirely when this runs; it ends with its own summary. Installs nothing: the only file it may edit is the repo's `CLAUDE.md`, and `.claude/harness-version` is left as it is because no version changed.

Full procedure in **`references/verify-mode.md`**: inventory the checkable claims (`Stack:`-style header lines, each Commands row, every path the file names), re-run the recorded lint/typecheck/test commands one at a time within that file's execution bound, then correct or remove what no longer holds **in place** — a verify pass may shrink `CLAUDE.md` or leave it the same size, and one that grows it is a bug. The distinction that reference states in full and that decides every rewrite: a command that *cannot run* is a stale claim and gets rewritten to the `TODO:` placeholder that reference defines; a command that *runs and fails* is the repo's current state, so it is reported and the row is kept.

---

## Phase 1.5: Gather Remaining Decisions

Skip this phase entirely if `KNOWLEDGE_BUNDLE`, `GRAPH`, `CI_PROVIDER`, `MODEL_ROUTING`, and `AGENT_HOSTS` are already set (Phase 0.5/0.5b asked them alongside the nuxt-scaffold/go-scaffold batch for the empty-repo branch).

Otherwise ask **one bundled `AskUserQuestion` call**, before writing any files. The six questions, their auto-detected defaults, and the exact option wording are in **`references/decision-bundle.md`**. `AskUserQuestion` accepts at most four per call, so when more than four apply, split into two back-to-back calls keeping that file's order — still no file written until all of them are answered.

Two of the six are conditional: **install mode** only if Phase 1 found an existing-harness conflict, and **Spec Kit handling** only if Phase 0.7 found Spec Kit. The CI question is **omitted entirely** for `PROFILE = generic` (set `CI_PROVIDER = no` and say so in the Phase 7 summary).

Store `KNOWLEDGE_BUNDLE`, `GRAPH`, `CI_PROVIDER`, `MODEL_ROUTING`, `AGENT_HOSTS` (and `INSTALL_MODE` / `SPECKIT` if included). Run the chosen Spec Kit path immediately after this phase resolves and before Phase 2 — `migrate` must finish removing Spec Kit before any harness file is written, and `leave` stops the run here. Code and security review are not scaffolded as project-local agents — point the user at the `/code-review` and `/security-review` skills instead (see Phase 7 summary).

---

## Phase 2: Generate CLAUDE.md

Read the content from `references/profile-{PROFILE}.md` → `## CLAUDE.md Template` section.

For `generic`, that template needs `{STACK}` plus the `{LINT}`/`{TYPECHECK}`/`{TEST}` commands detected per `references/profile-generic.md` → `## Commands`; detect them once here and reuse the same values in Phases 4, 5-1 and 7.

**Run each command before writing it down — every profile, not just `generic`.** Detection and a fixed template are both claims about this repo, and the seven stack profiles that name a stack ship a template that has checked nothing. Before `CLAUDE.md` is written, execute the **lint, typecheck and test** rows of that profile's Commands table, one at a time and non-interactively. Never execute a `dev`, `build`, `format`, `start`, `watch` or `deploy` row — those wait, rewrite the tree, or run forever; write them as the template has them and say in the Phase 7 summary that they were not checked.

The distinction is the same one verify mode turns on (`references/verify-mode.md` states it in full, and Phase 1b is how an already-installed repo re-runs this):

- The command **cannot run** (no such script/target/task, binary not on `PATH`) → a stale claim. Write the row's command as the `TODO:` placeholder instead — one notation, stated once in `references/verify-mode.md` → `## The TODO: placeholder` and not re-spelled here. For `generic`, that row is then dropped from the table per `references/profile-generic.md`, so the gap surfaces in the Phase 7 summary rather than as a placeholder row.
- The command **runs and fails** (red tests, lint errors) → the repo's current state, not a false claim. Write the row exactly as the template has it and report the failure in the Phase 7 summary. Never delete a repo's test command because the suite is red.

Same discipline for `{STACK}` and any header line naming a runtime, package manager or framework: read it from the manifests, claim only what a manifest actually says, and name in the Phase 7 summary every command run, every one rewritten to `TODO:`, and every one not checked.

For `tauri`, the template is substitution-free, but its `lint` and `test` rows are each **two commands** — a pnpm one and a `cargo` one. Run both halves separately in the verification pass above and report them separately: `cargo` missing from `PATH` is a different fact from a red `pnpm test`, and collapsing them hides which half of the app is unchecked. There is deliberately no Rust typecheck row — `cargo clippy` type-checks as it lints, so a `cargo check` beside it recompiles the same graph for no new finding (`references/profile-tauri.md` → `## Commands`).

For `flutter`, the template is substitution-free but its Commands table carries the dev command with a flavor entrypoint (`-t lib/main_dev.dart --dart-define-from-file=config/dev.json`). On a repo that has no flavors yet — anything straight out of `flutter create` — write it as the template has it anyway: it states the convention the first slice must satisfy, and `flutter run` with no flavor is exactly the habit the "no URL literal in `lib/`" rule exists to prevent.

Write to `CLAUDE.md` in the project root.
Skip if `INSTALL_MODE=new` and `CLAUDE.md` already exists.

(Neither `nuxt-scaffold` nor `next-scaffold` writes a `CLAUDE.md` — governance is this skill's job — so for `SCAFFOLDED = true` nuxt/next/tauri repos there is no existing `CLAUDE.md` to preserve; write it fresh.)

---

## Phase 3: Generate .claude/rules/

Create `.claude/rules/` if it doesn't exist, then write that profile's rule files per **`references/rule-files.md`** — a per-profile matrix (which conventions files, whether a `testing.md` exists, whether an architecture addendum is appended) plus the four files every profile gets: `security.md`, `architecture.md`, `comments.md`, `product.md`.

Two things that catch people, both stated there in full: `security.md` and `architecture.md` need the profile's `paths:` frontmatter **prepended** from `references/files-shared.md` → `## paths substitutions`, while `comments.md` and `product.md` are taken verbatim because their frontmatter is deliberately stack-agnostic. Every file: skip if `INSTALL_MODE=new` and it already exists.

---

## Phase 4: Generate AI Files

**AI_TASK_GUIDE.md** — from `references/files-shared.md` → `## AI_TASK_GUIDE.md`. Write to project root. Human orientation only — a pointer to `/task-workflow`, which owns the actual steps and formats. Never expand it back into a second copy of the workflow; the two drift the moment `task-workflow` changes.

**AI_REVIEW_CHECKLIST.md** — from `references/files-shared.md` → `## AI_REVIEW_CHECKLIST.md`. Replace `{COMMANDS}` with the profile's lint/typecheck/test commands (from `references/profile-{PROFILE}.md` → `## Commands`). For `flutter`, list both lint CLIs (`dart run custom_lint` **and** `dart run import_lint`) — they are separate analyzer-plugin mechanisms and only the second one checks the import boundaries, so collapsing them to one line is the exact mistake the profile warns about. For `tauri`, the lint and test rows are each two commands (pnpm plus `cargo`) and both belong on the checklist — a reviewer who runs only `pnpm lint` has checked the frontend and none of the Rust. For `generic`, use the commands detected in Phase 2 and keep any undetected one as its literal `TODO: <lint|typecheck|test> command` placeholder — visible gap, not a guess.

Skip each if `INSTALL_MODE=new` and file already exists.

---

## Phase 5: Generate Enforcement

### 5-1. Pre-commit hook

**`tauri` and `nuxt-marketing` branch here and are handled first** — they are the two profiles that write a gate even when a hook manager already exists, and for the same structural reason: `pnpm lint-staged` runs ESLint over staged files, which for `tauri` leaves the Rust half and its four security greps ungated, and for `nuxt-marketing` leaves all three of its grep gates ungated. Both chain behind the manager rather than rivalling it. Full branch and reasoning: `references/overlay-matrix.md` → `## 5-1`.

**Every other profile: first check for an existing git-hook manager.** If the repo already gates commits via `simple-git-hooks` or `husky` (key in `package.json`), a `.husky/` dir, or an existing `.git/hooks/pre-commit` → **do NOT create `scripts/pre-commit.sh`**. The existing mechanism is the gate; skip to 5-2. (This is the case for `SCAFFOLDED = true` nuxt/next repos — the template uses `simple-git-hooks` → `pnpm lint-staged`.)

Otherwise (go / nodejs / flutter / generic, or a nuxt/next repo without a hook manager): read `references/hook-guard.md` → `## pre-commit: {PROFILE}`. Write to `scripts/pre-commit.sh`, then `chmod +x scripts/pre-commit.sh`, and continue to 5-1b. The `generic` template carries the Phase 2 commands, with each undetected one degraded to a no-op `echo` per that section's note.

### 5-1b. Initialize git + install the hook

Only when 5-1 created `scripts/pre-commit.sh`. The hook lives in `.git/hooks/`, so a git repo must exist first.

1. **Ensure a git repo.** Check with `git rev-parse --is-inside-work-tree 2>/dev/null`.
   - If it fails (not a repo), run `git init` and tell the user a repo was initialized.
   - If it already is a repo, do nothing.

2. **Install the hook** (idempotent — never clobber a foreign hook silently). Absent, or already a symlink to `../../scripts/pre-commit.sh` → `ln -sf ../../scripts/pre-commit.sh .git/hooks/pre-commit`. Anything else → do **not** overwrite: show the existing hook, ask whether to replace it, and record the answer in the summary.

3. Confirm to the user that the hook is installed (or was left untouched).

> `.git/hooks/` is not version-controlled, so a teammate's fresh clone starts with no gates at all. Phase 5-2i installs the `Setup` hook that fixes that on their first Claude Code run; Phase 6's README block stays the fallback for anyone not using it.

### 5-1c. Context budget gate

Read `references/budget-gate.md` → `## tools/context_budget.mjs`. Write to `tools/context_budget.mjs`, then `chmod +x tools/context_budget.mjs`.

Skip if `INSTALL_MODE=new` and `tools/context_budget.mjs` already exists.

If `scripts/pre-commit.sh` was created in 5-1, the budget check step is already included in the template (it's guarded with `if [ -f tools/context_budget.mjs ]`). No further action needed.

### 5-1d. Guard host adapter

Read `references/hook-guard.md` → `## lib/hook-io.mjs`. Write to `.claude/guards/lib/hook-io.mjs`. Applies to all profiles, and to `AGENT_HOSTS = claude` as well — **every guard below imports it**, so skipping it leaves nine broken scripts. Not executable on its own: no shebang, no `chmod`.

It normalizes the payload-field and response-envelope differences between Claude Code and Cursor so one guard body serves both hosts. There is no Cursor-specific copy of any guard anywhere; if you find yourself writing one, the difference belongs in this module instead.

### 5-2. Bash guard (blocks gate bypass)

Read from `references/hook-guard.md` → `## bash-guard.mjs`. Write to `.claude/guards/bash-guard.mjs`.

> `flutter` deliberately gets no `PostToolUse` formatter hook — `dart format` has no configuration to get wrong, and it runs in the pre-commit gate and CI (`references/profile-flutter.md` → `## settings.json Template` states this at the call site).
>
> nuxt/next/tauri auto-format also needs a guard script — `.claude/guards/lint-fix-file.mjs`, ESLint `--fix` scoped to the single touched file (a blanket `pnpm lint --fix` would rewrite every pre-existing lint violation in the repo on the first edit). If `SCAFFOLDED = true`, `nuxt-scaffold`/`next-scaffold` already wrote it. Otherwise (onboarding an existing nuxt, next or tauri repo, or any `nuxt-marketing` repo — nothing here ever scaffolds one), copy it now from `skills/nuxt-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs` (nuxt, nuxt-marketing, and tauri — all three frontends are Nuxt) or `skills/next-scaffold/scripts/templates/files/.claude/guards/lint-fix-file.mjs` (next) — same script body in both, single source of truth per profile, don't duplicate it here.

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
   - **Plain git** (go / nodejs / flutter / generic, or any repo with no hook manager — including `tauri` if `nuxt-scaffold` did not run) → read `references/hook-guard.md` → `## commit-msg: all profiles`, write `scripts/commit-msg.sh`, `chmod +x scripts/commit-msg.sh`, then install it the same way 5-1b installs pre-commit — `ln -sf ../../scripts/commit-msg.sh .git/hooks/commit-msg` if that path is absent or already our symlink; if it exists and is **not** ours, show it and ask before replacing, exactly as 5-1b does. Never clobber a foreign hook silently.

   Say which of the three paths was taken in the Phase 7 summary. As with pre-commit, `.git/hooks/` isn't version-controlled — Phase 6's README onboarding covers the fresh-clone step.

### 5-2h. Precompact snapshot (autosaves session state before compaction)

Read from `references/hook-guard.md` → `## precompact-snapshot.mjs`. Write to `.claude/guards/precompact-snapshot.mjs`. Applies to all profiles — the `PreCompact` hook in every profile's `settings.json` template points at this script, so it must be written or that hook dangles. Autosaves in-flight state to `.claude/memory/SESSION.md` (in `session-handoff`'s template shape) before a manual or automatic compaction, so `session-resume-check.mjs` can recover it.

### 5-2i. Clone bootstrap + the opt-in instructions trace

**`install-hooks.mjs`** — from `references/hook-guard.md` → `## install-hooks.mjs`, write to `.claude/guards/install-hooks.mjs`. All profiles. A bootstrap, not a gate: registered on `Setup`, it installs the `pre-commit` / `commit-msg` symlinks on a fresh clone, defers to `simple-git-hooks`/`husky` with the one command to run rather than fighting the manager, and never touches a foreign hook. It exists because `.git/hooks/` isn't tracked, so without it a teammate's first commit is gated by nothing and nothing says so. Cursor has no `Setup` equivalent — Claude Code side only, and the summary says so rather than implying parity.

**`instructions-trace.mjs`** — same file, `## instructions-trace.mjs`, write to `.claude/guards/instructions-trace.mjs`. All profiles, **registered by none**: `InstructionsLoaded` fires on every rule load, so wiring it by default spends a Node process per load in every installed repo to serve someone debugging. That section carries the registration snippet and the `CLAUDE_HARNESS_TRACE=1` switch — point the user at it in the summary instead of turning it on, and add `.claude/instructions-trace.log` to `.gitignore`.

### 5-3. .claude/settings.json

Two shapes. **nuxt / next / tauri with `SCAFFOLDED = true`** already have a `.claude/settings.json` from the scaffold — merge the governance hooks into it per event, never replacing the existing `lint-fix-file.mjs` `PostToolUse` entry. **Everything else** — `nuxt-marketing` always among it, since nothing here scaffolds one — reads the whole template from `references/profile-{PROFILE}.md` → `## settings.json Template` and merges per event if the file exists, or writes fresh.

Both shapes register seven events: `PreToolUse`, `PostToolUse`, `SessionStart`, `PreCompact`, `SessionEnd`, `Setup` (and `PostToolUse` lint-fix on nuxt/nuxt-marketing/next/tauri). The exact per-event merge list and the two allowlist exceptions: `references/overlay-matrix.md` → `## 5-3`.

### 5-3b. Editor + per-stack config files

Three steps that only some profiles run. Each one's procedure, and why the others skip it, is in `references/overlay-matrix.md`:

| Step | Profiles | What |
|---|---|---|
| `.vscode/settings.json` | nuxt, nuxt-marketing, next, tauri | ESLint format-on-save; tauri also gets `rust-analyzer.linkedProjects` (its `Cargo.toml` isn't at the repo root, so without it the Rust half is unanalyzed) |
| `analysis_options.yaml` | flutter | merge one `analyzer: exclude:` block; never overwrite |
| `rust-toolchain.toml` + `tauri.conf.json` | tauri | write the first if absent; the second is **read-only** — check three values, rewrite none |

All three **merge into** what the repo already has and report what they found in the Phase 7 summary. The `tauri.conf.json` check in particular reports and never fixes: a silently-written `identifier` orphans every installed user's local data if the guess is wrong.

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

Decided in Phase 1.5 (`KNOWLEDGE_BUNDLE`). If true, read all templates from `references/knowledge-bundle.md`. Replace `{DATE}` with today's date in ISO 8601 (`YYYY-MM-DD`) in every template before writing, and `{CONVENTIONS_RULE}` with this profile's conventions rule path from `references/rule-files.md`'s matrix — dropping the entries that name it on `generic`, which has no conventions rule (see the agent-rules template).

1. **Rule file** — `## knowledge.md` → write to `.claude/rules/knowledge.md`. Skip if `INSTALL_MODE=new` and it exists.
2. **Starter bundle** — write each (skip existing under `INSTALL_MODE=new`):
   - `## knowledge/meta/knowledge-bundle-spec.md` → `knowledge/meta/knowledge-bundle-spec.md`
   - `## knowledge/index.md` → `knowledge/index.md`
   - `## knowledge/contracts/openapi-contract.md` → `knowledge/contracts/openapi-contract.md`, **only if a contract file exists** (`openapi.yaml`/`openapi.json` at the repo root or under `api/`). A repo with no contract gets no contract concept, and the index's `## Contracts` section is omitted with it — an indexed concept describing an API surface the repo does not have is read as settled truth by every later agent, and its `resource:` points at nothing.
   - `## knowledge/constraints/agent-rules.md` → `knowledge/constraints/agent-rules.md`
   - `## knowledge/implementation/index.md` → `knowledge/implementation/index.md` (empty of records — `task-workflow` and `epic-workflow` append to it at cleanup)
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

Read templates from `references/ci.md`. Four profiles need more than a straight copy — `flutter` (write `.fvmrc` first or the action errors), `tauri` (two jobs, no installer build), `nuxt-marketing` (the workflow builds, because there the build is the locale prerender, and generates no deploy step) and `generic` (no CI at all). The procedure for each, plus the two actions per profile that ship tag-referenced and want a SHA, is in `references/overlay-matrix.md` → `## 5.6`. Name those in the Phase 7 summary.

0. **Clear the spec gate first, if it's active.** A CI workflow isn't on `spec-gate-guard.mjs`'s trivial allowlist, so on a repo where the guard is already registered every write below dies with `PLAN.md missing or not approved`. Check for `.claude/guards/spec-gate-guard.mjs` **and** its `PreToolUse` registration in `.claude/settings.json`; if either is missing, nothing is gating — go to step 1. If it is active, follow `references/ci.md` → `## Clearing the spec gate before writing CI`: never clobber an existing `PLAN.md`, write a minimal approved one only when there is none, and delete it immediately after step 3. That reference also records why the two obvious alternatives (reordering the phase, widening the allowlist) are worse, and why this must never be generalized into self-approval.

1. **GitHub** (if `CI_PROVIDER` is `github` or `both`): if `.github/workflows/ci.yml` already exists, treat like any other idempotency check — under `INSTALL_MODE=new` skip it silently; under `yes` show it and confirm before overwriting. Otherwise write `## github: {PROFILE}` to `.github/workflows/ci.yml`.
2. **GitLab** (if `CI_PROVIDER` is `gitlab` or `both`): same existence check for `.gitlab-ci.yml`. Otherwise write `## gitlab: {PROFILE}` to `.gitlab-ci.yml`.
3. **If `KNOWLEDGE_BUNDLE = true`** (decided in Phase 1.5): before writing each file above, merge in `## knowledge-validate step: github` / `## knowledge-validate step: gitlab` respectively, so the generated CI file validates the knowledge bundle in the same run — no separate manual step needed.

This phase only ever writes CI files it generates itself. It never edits a pre-existing, hand-written CI config — see Phase 5.5 step 6 for that case.

---

## Phase 5.7: Graphify (optional)

Decided in Phase 1.5 (`GRAPH`). If false, skip everything below — none of the scaffolding is written: no rule file, no `docs/graph-usage.md`, no gitignore entries, no install prompt, no proposed index.

This decision governs **scaffolding only, not skill behavior.** `task-workflow`, `epic-workflow`, `debug-workflow`, `model-router`, and `sprint-distill` each key off whether `graphify-out/graph.json` exists on disk — none of them reads the `GRAPH` answer. A repo scaffolded with `GRAPH = false` that later acquires a graph gets those integrations anyway, minus the `.claude/rules/graph.md` guardrails (query-don't-read, `INFERRED` is not confirmation, a source read wins). Don't "simplify" those skills to a config flag: file existence is what makes the degradation path silent.

1. **Write templates** from `references/graph.md`: `## .claude/rules/graph.md` → `.claude/rules/graph.md`, `## docs/graph-usage.md` → `docs/graph-usage.md`. Skip each if `INSTALL_MODE=new` and it already exists.
2. **Gitignore contract**: append `graphify-out/cost.json` and `graphify-out/cache/` (per-file AST cache, populated on every index run) to `.gitignore` — idempotent, check before appending. Never add `graphify-out/` itself; that directory is committed.
3. **Install check**: run `graphify --version`. If not found, open the tool's own README (github.com/Graphify-Labs/graphify) and follow its current install instructions verbatim — do not hardcode a command from memory, and note explicitly that the package name is `graphifyy` (double-y) to avoid a typosquat lookalike. Prompt the user to install; this is the only point in the harness that prompts for a graphify install.
4. **Propose the initial index**: skip entirely if `graphify-out/graph.json` already exists — nothing to propose, the graph is already built (this keeps a re-run on an already-compliant repo a no-op, same as the rest of this phase). Otherwise, once installed, propose (don't auto-run) `graphify update .` (headless, AST-only, zero API cost) or `/graphify .`. After it runs, replace `{GRAPHIFY_VERSION}` in `docs/graph-usage.md` with the output of `graphify --version`.

---

## Phase 5.8: Cursor Parity (optional)

Decided in Phase 1.5 (`AGENT_HOSTS`). Skip everything if it doesn't include `cursor`.

Generates the Cursor half of the harness: `AGENTS.md`, `.cursor/rules/*.mdc`, `.cursor/hooks.json`, and `tools/cursor_mirror.mjs`. Full procedure, templates, and rationale: `references/cursor-parity.md` → `## Procedure (Phase 5.8)`.

**Runs here, last of the file-writing phases, on purpose.** The mirror is generated from whatever `.claude/rules/` ended up containing, so it has to run after Phase 3 (base rules), Phase 5.5 (`knowledge.md`) and Phase 5.7 (`graph.md`) — move it earlier and those two rules silently never reach Cursor.

Three things this phase never does:
- **Hand-write a mirror file.** Always run `node tools/cursor_mirror.mjs` and let it write them. A hand-written `.mdc` that differs from what the script would produce fails `--check` on the very next commit.
- **Mirror the guards.** One script body serves both hosts (`lib/hook-io.mjs`, Phase 5-1d). `.cursor/hooks.json` registers the same `.mjs` files `.claude/settings.json` does.
- **Treat the Cursor tree as a source.** `.claude/` is canonical. If a rule needs changing, change it there and re-run the mirror.

---

## Phase 6: Update README

Check for `README.md`. If found, check whether it already contains `## AI Onboarding`. If not present, append the templates from `references/summary-checklist.md` → `## Phase 6 README Templates` (replace `{LINT}`, `{TYPECHECK}`, `{TEST}` with profile commands). If no `README.md` exists: skip this phase (do not create one).

---

## Phase 7: Summary

Read `references/summary-checklist.md` → `## Phase 7 Summary Template`. Substitute `{PROFILE}`/`{LINT}`/`{TYPECHECK}`/`{TEST}`/`{MODEL_ROUTING}` and the bracketed conditional lines, then print verbatim.

---

## Phase 8: Measure Context Budget

After the summary, print the measurement instructions from `references/summary-checklist.md` → `## Phase 8: Measure Context Budget` verbatim — `/context` for the breakdown, `node tools/context_budget.mjs` for the automated verdict, and where to record it in `README.md`.

---

## Idempotency Rules

Three that get broken most often: **check existence before writing every file** (`INSTALL_MODE=yes` overwrites, `new` skips existing); **never full-overwrite `.claude/settings.json` or `.cursor/hooks.json`** — merge per event; **`README.md` is append-only**, after checking for `## AI Onboarding`. Never delete a file that isn't part of the harness.

The full contract — every optional phase's skip guarantee, what patch and verify mode may touch, and which scaffolds neither verify nor commit — is `references/idempotency.md`.

---

## Output Checklist

Read `references/summary-checklist.md` → `## Output Checklist` and verify every item against what was actually written this run.

---

## References

Phase order, then the cross-cutting ones:

- `profile-detection.md` — Phase 0 ladder (incl. why `tauri` and `nuxt-marketing` both outrank `nuxt`), the two-stage Flutter app test, the empty-repo question
- `scaffold-delegation.md` — Phase 0.5: per-profile scaffold command, decisions to gather, what each leaves behind
- `speckit-migration.md` — Phase 0.7: Spec Kit detection, the migrate/coexist/leave decision, the ordered procedure
- `patch-mode.md` / `verify-mode.md` — Phase 1a / 1b: changelog patch-block application; re-checking every `CLAUDE.md` claim
- `profile-nuxt.md`, `profile-nuxt-marketing.md`, `profile-next.md`, `profile-go.md`, `profile-nodejs.md`, `profile-flutter.md`, `profile-tauri.md`, `profile-generic.md` — one per profile, loaded as `references/profile-{PROFILE}.md`. Each carries that profile's every template: commands, `CLAUDE.md`, conventions, testing, architecture addendum, `settings.json`, and any per-stack config file
- `files-shared.md` — security, architecture, AI task guide, review checklist, and the `paths:` block per profile
- `rule-files.md` — Phase 3: which `.claude/rules/` files each profile gets
- `overlay-matrix.md` — Phase 5's five branching steps: the matrix plus the argued reason for each exception
- `hook-guard.md` — `lib/hook-io.mjs` (the two-host adapter every guard imports), the nine gates, the two Claude-only bootstraps (`install-hooks.mjs`, `instructions-trace.mjs`), and the pre-commit + commit-msg scripts per profile
- `budget-gate.md` — `context_budget.mjs`
- `knowledge-bundle.md` / `knowledge-migration.md` — Phase 5.5 templates; migrating an existing `knowledge/`
- `graph.md` — Phase 5.7 graphify convention
- `ci.md` — Phase 5.6 workflows per profile and provider
- `cursor-parity.md` — Phase 5.8: the generated mirror, the event map, and testing it
- `decision-bundle.md` — Phase 1.5 question wording
- `idempotency.md` — the full overwrite/skip contract
- `summary-checklist.md` — Phase 6 README templates, the Phase 7 summary, the Output Checklist
