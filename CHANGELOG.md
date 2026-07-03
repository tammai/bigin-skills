# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.21.5] - 2026-07-03

### Fixed

- **Stale Drizzle/D1 references left over from the v1.21.3 removal / sót tham chiếu Drizzle/D1 sau khi đã bỏ ở v1.21.3:** `README.md` still called Drizzle + D1 "an opt-in" in the "What gets generated" section and the repo-tree comment for `modules.md`; `bigin-harness-setup/SKILL.md` still listed "Drizzle + D1 id" as a scaffold decision to gather in Phase 0.5 Step 1; `session-handoff/SKILL.md`'s example mid-harness `SESSION.md` still showed `Optional Services: D1 enabled, auth disabled`. All four corrected to match the BFF-proxy-only, no-DB reality. / Sửa 4 chỗ còn nhắc Drizzle/D1 như một tính năng đang tồn tại, khớp lại với thực tế chỉ còn lớp BFF proxy, không có DB.

## [1.21.4] - 2026-07-03

### Fixed

- **`bigin-harness-setup` — dropped the invalid `"statusline": {"items": [...]}` settings.json key / bỏ key `"statusline"` sai schema:** that key doesn't match Claude Code's actual settings schema (the real key is `statusLine`, which requires a `command` script — there's no such script in this repo to point to), so onboarding runs generated a `settings.json` block that Claude Code would ignore or reject. Removed it from all three profile templates (`profile-nuxt.md`, `profile-go.md`, `profile-nodejs.md`) and the corresponding SKILL.md merge instructions / checklist item and README diagram, leaving just the `PreToolUse` `bash-guard.mjs` hook wiring. / Xoá key `"statusline"` sai schema khỏi cả 3 template profile và các chỗ tham chiếu trong SKILL.md/README, vì Claude Code không nhận key này.

## [1.21.3] - 2026-07-03

### Removed

- **`nuxt-scaffold` — dropped the Drizzle + Cloudflare D1 opt-in / bỏ tuỳ chọn Drizzle + Cloudflare D1:** the scaffolder is BFF-proxy only now — no database layer question, no `drizzle` config field, no `db:*` scripts, no `templates/drizzle/` files. Applies uniformly across all templates (`starter`, `saas`, `dashboard`, and the rest) — the backend, not the Nuxt app, owns data persistence. / Bộ scaffold giờ chỉ dùng lớp BFF proxy — bỏ câu hỏi database, field config `drizzle`, các script `db:*`, và thư mục `templates/drizzle/`.

## [1.21.2] - 2026-07-03

### Changed

- **`nuxt-scaffold` Step 2 — template/color pickers list every option by name / liệt kê đủ tên các lựa chọn còn lại:** reverted the template question back to `AskUserQuestion` (was briefly changed to plain free text since it has 9 possible values against the tool's 4-option cap). All three affected questions (template, primary color, neutral color) now use a 4th option — labeled `Other templates` / `Other colors`, never literally "Other" since the tool adds that automatically — whose description spells out every remaining value by name, so the user knows exactly what to type into the tool's own free-text "Other" instead of guessing. / Đưa câu hỏi chọn template về lại dạng `AskUserQuestion`; lựa chọn thứ 4 (không đặt tên "Other") liệt kê đầy đủ tên các giá trị còn lại để người dùng biết chính xác cần gõ gì.

## [1.21.1] - 2026-07-03

### Fixed

- **`nuxt-scaffold` Step 2 questions fired in parallel / các câu hỏi bị hỏi song song:** SKILL.md said to ask "step by step" but didn't override the general tool-batching guidance ("independent calls can run in parallel"), so an executing agent could read the numbered question list and issue two `AskUserQuestion` calls in the same turn — showing the user two question widgets at once, with the second not waiting on the first. Added an explicit instruction: exactly one `AskUserQuestion` call per turn, wait for the answer before the next. / Bổ sung chỉ dẫn rõ: mỗi lượt chỉ được gọi một `AskUserQuestion`, phải chờ câu trả lời trước khi hỏi câu tiếp theo — tránh hiển thị hai danh sách câu hỏi cùng lúc.

## [1.21.0] - 2026-07-03

### Added

- **`nuxt-scaffold` template picker / chọn template khi scaffold nuxt:** new `template` config field (`starter` default, `saas`, `dashboard`, `landing`, `docs`, `portfolio`, `chat`, `changelog`, `editor`) covering every Nuxt-flavored template on [ui.nuxt.com/templates](https://ui.nuxt.com/templates). `starter` keeps today's from-scratch `npm create nuxt@latest` path (no clone); every other value clones the matching `github.com/nuxt-ui-templates/<slug>` repo via `nuxi init` and layers the BFF preset (Pinia, Pinia Colada, `nuxt-auth-utils`, VueUse, Vitest, git hooks) on top. `saas` additionally gets a demo-auth-gated private `/dashboard` (`nuxt-auth-utils`, no real backend — `server/api/login.post.ts`/`signup.post.ts` stub credentials instead of proxying) since the official template ships only non-functional login/signup mockups and no private area. Verified end-to-end (lint/type-check/test/commit all green) for both `starter` and `saas`; the remaining 7 slugs rely on the same generic safety checks that already guard template-shape drift. / Thêm trường cấu hình `template` để chọn 1 trong 9 template chính thức của ui.nuxt.com; `starter` giữ nguyên hành vi cũ, các template khác clone repo gốc rồi phủ BFF preset lên trên; riêng `saas` có thêm khu vực `/dashboard` riêng tư với xác thực giả lập.

### Changed

- **`nuxt-scaffold` Step 2 config gathering — step-by-step instead of one bundled message / hỏi cấu hình từng bước thay vì gộp một tin nhắn:** enum/boolean choices (template, theme colors, optional modules, dependency freshness, Drizzle opt-in) now go through `AskUserQuestion` one at a time; project name and the D1 UUID stay plain conversational free text since they're regex-validated and don't fit an option list.
- **`nuxt-scaffold` no longer wires an auth flow unconditionally / không còn tự động cài đặt xác thực:** `server/api/login.post.ts`, `server/middleware/auth.ts`, `app/middleware/auth.global.ts`, and the session query composable moved out of the base preset (previously written for every scaffold regardless of need) — the base `starter` template now ships an unauthenticated BFF proxy sample only. The auth flow lives under the new `saas` template instead, as a demo implementation. The base Vitest sanity test moved from `session.test.ts` to `users.test.ts` (the composable it exercises) so `pnpm test` still has something to run.

### Fixed

- **`.claude/guards/lint-fix-file.mjs` template and sample `users.ts` failed the scaffold's own lint gate / mẫu guard và `users.ts` không qua được chính lint gate của scaffold:** the guard template used double quotes + semicolons and `users.ts` had a trailing comma, both violating the `@stylistic` config the scaffold itself writes (`quotes: 'single'`, `semi: false`, `commaDangle: 'never'`) — meaning every `starter` scaffold's `pnpm lint` was failing out of the box. Found while verifying this release's `template` picker end-to-end; fixed in the template source.

## [1.20.0] - 2026-07-03

### Added

- **`profile-nuxt.md` — Server State: Pinia Colada convention / quy ước Server State: Pinia Colada:** new hard-rule section in the `conventions-frontend.md` template: server data goes through Colada query/mutation composables only (never wrapped in a Pinia store), one file per domain (`composables/queries/<domain>.ts`) with `defineQueryOptions()` factories and keys defined once, an escape hatch to split into a `<domain>/` folder with an `index.ts` re-export once a file grows unwieldy (never split by type across domains), mutations colocated as `use<Action><Domain>()` with cache invalidation inside the mutation, components consuming query composables only, and types sourced from openapi-typescript in the query layer only. / Thêm quy ước bắt buộc: dữ liệu server chỉ đi qua composable Colada (không bọc trong Pinia store), một file cho mỗi domain, tách theo domain chứ không tách theo loại (query/mutation).

### Fixed

- **`nuxt-scaffold` sample composables violated the new Colada convention / mẫu composable vi phạm quy ước Colada mới:** `app/composables/useUsers.ts` (`useFetch`) and `app/stores/session.ts` (`useQuery` wrapped inside a Pinia store — the exact anti-pattern the new rule bans) replaced with `app/composables/queries/users.ts` (`userQueries.list` via `defineQueryOptions()`) and `app/composables/queries/session.ts` (`sessionQueries.me` + `useMe` via `defineQuery()`). Test moved and rewritten accordingly. `artifacts.md` descriptions updated to match.
- **`@pinia/colada-nuxt` module never installed or registered / thiếu cài đặt module `@pinia/colada-nuxt`:** `bootstrap.md`/`artifacts.md` previously described `@pinia/colada` as a plain package needing no Nuxt module registration, and referenced a non-existent package name (`@pinia/colada/nuxt`). Per the [official Nuxt guide](https://pinia-colada.esm.dev/nuxt.html), `@pinia/colada-nuxt` is required — without it `useQuery`/`useMutation` throw at runtime. `scaffold.mjs`'s `stage2Preset()` now installs it and registers it into `nuxt.config.ts`'s `modules` via the existing `ensureModuleRegistered()` helper; `bootstrap.md`/`modules.md`/`artifacts.md` updated to match. / Bổ sung cài đặt và đăng ký module `@pinia/colada-nuxt` — thiếu module này khiến `useQuery`/`useMutation` lỗi khi chạy.

## [1.19.1] - 2026-07-03

### Fixed

- **`profile-nuxt.md` settings template drift / lệch template settings:** removed `"Bash(git push:*)"` from the `settings.json` template — the source of truth (`nuxt-scaffold`'s `templates/merge/claude-settings.json`) never pre-approves `git push`, and the sync rule in SKILL.md requires the two to match. Found by a full stale-docs audit; everything else verified current. / Bỏ quyền `git push` pre-approved khỏi template settings của profile nuxt cho khớp với nguồn chuẩn — push không nên được tự phê duyệt.

## [1.19.0] - 2026-07-03

### Changed

- **Guard & gate scripts: Python → Node.js / script guard & gate: Python → Node.js:** `bash-guard.py`, `lint-fix-file.py`, and `context_budget.py` are now `bash-guard.mjs`, `lint-fix-file.mjs`, and `context_budget.mjs` — dependency-free Node scripts. Reason: teammates on Windows, where `python3` doesn't exist by default (and `python` is often the Microsoft Store stub); Node is already guaranteed by the nuxt/nodejs profiles and Git Bash runs it fine. All hook commands (`node .claude/guards/…`), pre-commit templates, CI references, profile docs, and this repo's own `tools/` + git hook updated. Regex behavior of `bash-guard.mjs` verified against the skill-authoring test matrix (block `--no-verify` / `git commit -n` / `git push --force`; allow `--force-with-lease`, normal commits, messages containing `-n`). / Chuyển toàn bộ script guard/gate từ Python sang Node.js vì team có người dùng Windows (không có sẵn `python3`); Node đã được đảm bảo bởi các profile nuxt/nodejs.
- **`knowledge_validate.py` → `knowledge_validate.mjs`:** the Knowledge Bundle validator template is now a zero-dependency Node script too — no `uv`/Python needed in target repos at all. Same checks and output format (frontmatter + allowed `type`, bundle-relative link resolution, ISO 8601 timestamps, description/tags/reachability warnings), verified against a synthetic bundle. Gate command is now `node tools/knowledge_validate.mjs`; GitHub CI drops the `setup-uv` step (runners ship Node), GitLab go-profile CI installs `nodejs` via apt instead of `uv`. `sprint-distill` falls back to the legacy `.py` validator in repos scaffolded before this version. / Validator của Knowledge Bundle cũng chuyển sang Node không phụ thuộc — repo đích không cần `uv`/Python nữa; `sprint-distill` vẫn nhận diện bản `.py` cũ.

**Migration for repos already set up / nâng cấp repo đã cài harness:** re-run `bigin-harness-setup` (idempotent), or manually: delete `.claude/guards/*.py`, `tools/context_budget.py`, and `tools/knowledge_validate.py`, re-copy the `.mjs` versions from the templates, and update the `hooks` commands in `.claude/settings.json`, the budget line in `scripts/pre-commit.sh`, and any `uv run tools/knowledge_validate.py` step in pre-commit/CI to `node tools/knowledge_validate.mjs`.

## [1.18.0] - 2026-07-03

### Added

- **`nuxt-scaffold` — deterministic scaffold script / script scaffold tất định:** the mechanical scaffolding moved from conversational SKILL.md steps into `skills/nuxt-scaffold/scripts/scaffold.mjs` — a single-file, cross-platform (macOS/Windows) Node.js script, stdlib only (`node:fs`/`node:path`/`node:child_process`), no npm dependencies, no prompts. All decisions arrive pre-resolved via `--config <json>` (project name, `packageManager: pnpm`, theme, optional modules, version policy, Drizzle + D1 id, resume, gitCommit); the script validates strictly (exit 2 on bad config), fails fast on an already-scaffolded directory (exit 1), and streams plain-stdout progress. / Toàn bộ bước scaffold cơ học chuyển từ SKILL.md hội thoại sang script Node.js đa nền tảng, một file, chỉ dùng stdlib, không prompt — mọi quyết định truyền qua file config JSON.
- **`skills/nuxt-scaffold/scripts/templates/`:** source of truth for every file written/merged into scaffolded projects (previously inline code blocks in `references/artifacts.md`). / Nguồn chuẩn cho mọi file được ghi/merge vào project scaffold.

### Changed

- **`nuxt-scaffold/SKILL.md`:** now only detects state, gathers config in one batch, writes the config JSON, runs the script, and reports — no step-by-step scaffolding instructions. Includes a maintainer section for manual cross-platform validation. / SKILL.md giờ chỉ thu thập config, chạy script và báo kết quả.
- **`bigin-harness-setup/SKILL.md` Phase 0.5:** gathers all scaffold decisions upfront in one batch, writes the config file, and calls `scaffold.mjs` directly — zero prompts once scaffolding starts; `lint-fix-file.py` reference now points at the template file. / Phase 0.5 hỏi hết một lượt rồi gọi script trực tiếp — không còn prompt xen kẽ khi scaffold chạy.
- **`references/artifacts.md`** slimmed to rationale + merge semantics (bodies live in `scripts/templates/`); **`references/bootstrap.md`** marked as the maintenance reference for the script's command sequence.

### Notes

- Windows: `npm`/`npx`/`pnpm` resolve to `.cmd` shims and are spawned with `shell: true` (argument arrays only, per-arg cmd.exe quoting — never concatenated command strings) to avoid the post-CVE-2024-27980 `EINVAL`; semver carets (`pkg@^4`) are quote-protected; subprocess output decoded as utf8; all writes use LF.

## [1.17.0] - 2026-07-03

### Added

- **Dogfooding — this repo now follows its own context budget:** `CLAUDE.md` slimmed 107 → 36 lines (~1,650 → ~700 always-loaded tokens); authoring conventions moved to path-scoped `.claude/rules/skill-authoring.md` (`paths: skills/**`); new unscoped `.claude/rules/context-hygiene.md` (output discipline + session practices to keep the context window clean); `tools/context_budget.py` + `scripts/git-hooks/pre-commit` enforce the budget here too (activate: `git config core.hooksPath scripts/git-hooks`).

- **`task-workflow` skill (new):** AI task workflow (`scope → spec → implement → verify → review`) promoted to an on-demand `/task-workflow` skill. Agents invoke it only when needed; generated `CLAUDE.md` collapses the old 3-line Spec Gate section to a single pointer. `AI_TASK_GUIDE.md` is still generated in target repos for human reference.
- **`tools/context_budget.py` (generated in target repos):** budget gate script checking `CLAUDE.md` ≤60 lines, unscoped `.claude/rules/*.md` ≤40 lines, and total always-loaded content ≤12 000 chars (~3 000 tokens). Wired into the generated `scripts/pre-commit.sh` for all profiles. Template lives in `references/budget-gate.md`.
- **Three-tier loading for generated rules:** all `.claude/rules/*.md` files now carry `paths:` frontmatter so they load only when matching files are in context (Tier 2), not on every session start. Nuxt `conventions.md` is split into `conventions-frontend.md` (`paths: app/**`) and `conventions-server.md` (`paths: server/**`); go/nodejs `conventions.md` gains `paths:` scoped to their source directories. `security.md` and `architecture.md` get per-profile path scoping from a new `## paths substitutions` section in `references/files-shared.md`.
- **`# Compact instructions` in generated `CLAUDE.md`:** all three profile templates now include a 3-line Compact instructions section (preserve code changes/decisions, drop tool output, use `/clear` between tasks).
- **Runtime hygiene in generated `README.md`:** AI Onboarding section gains a Runtime hygiene block covering `/clear` between tasks, `head -50` for long output, and delegating scans/tests to subagents. A Context Budget table is appended for tracking token footprint over time.
- **Phase 8 — Measurement step (bigin-harness-setup):** after setup, the skill instructs the user to run `/context` and `python3 tools/context_budget.py`, then record the result in the README Context Budget table.
- **`statusline` key in generated `settings.json`:** adds token-usage display to the Claude Code status bar (`"statusline": {"items": ["tokenUsage"]}`).

### Changed

- **`bigin-harness-setup/SKILL.md`:** Phase 3 updated for split nuxt conventions and per-profile `paths:` prepending; Phase 5 adds step 5-1c (budget gate); Phase 6 README generation expanded with runtime hygiene + Context Budget table; Output Checklist updated.
- **`sprint-distill/SKILL.md`:** added Phase 1 stale-rules scan (flags rules untouched for 2+ sprints as deletion candidates), net-neutral constraint in Phase 2 (additions must name what they replace or cite headroom), Compression check in Phase 3 proposal, and global "distillation compresses, never just appends" principle.
- **`knowledge-bundle.md`:** `knowledge.md` rule updated to index-first read protocol (open concept files only when index summary is insufficient); `knowledge/index.md` template strengthened with explicit summary format.
- **Vietnamese stripped from all SKILL.md bodies** (bigin-harness-setup, sprint-distill, session-handoff, nuxt-scaffold): bilingual section headers and body italic lines removed from model-facing files. VI trigger phrases in frontmatter `description:` fields are kept.

## [1.16.3] - 2026-07-02

### Fixed

- **`nuxt-scaffold` / `bigin-harness-setup` (nuxt profile):** the `PostToolUse` auto-format hook ran `pnpm lint --fix --cache` — ESLint's whole-repo `.` target — on every single Write/Edit/MultiEdit. Confirmed in the field: a routine edit to one file triggered a repo-wide reformat of 10 unrelated pre-existing files (848 lines in one). This is especially dangerous for `bigin-harness-setup`'s existing-repo onboarding path (Phase 5-3), which by design can start with pre-existing lint debt. Replaced with `.claude/guards/lint-fix-file.py`, a small hook script that reads the touched file's path from the `PostToolUse` stdin JSON and ESLint-`--fix`es only that file. Written in Python (matching `bash-guard.py`'s existing convention) rather than Node, since this is Claude Code harness tooling, not a project dependency. `nuxt-scaffold` writes the script; `bigin-harness-setup` writes it too when onboarding an existing nuxt repo that skipped `nuxt-scaffold`.

### Changed

- **`bigin-harness-setup` / `nuxt-scaffold` docs:** the documented ESLint stylistic config only ever listed the template's one explicit override (`commaDangle: 'never'`, plus a redundant `braceStyle: '1tbs'`) — now also spells out the other rules actually in effect (`indent: 2`, `quotes: 'single'`, `semi: false`), which come from `@stylistic/eslint-plugin`'s own defaults rather than anything the template writes. No generated file changed — `nuxt.config.ts` still only sets `commaDangle`/`braceStyle`, as verified against a fresh `create-nuxt@latest --template ui` scaffold.

## [1.16.2] - 2026-07-02

### Changed

- **`nuxt-scaffold`:** unpinned `create-nuxt` from `@3.36.1` to `@latest` in Stage 1 (and its `nuxi` fallbacks) per updated policy — re-verify Stage 1 reactively if it starts failing, rather than tracking a pinned version.

### Fixed

- Added a registration check right after Stage 1's `--modules` install (mirroring the existing Stage 2b check for the optional `image` module) — an unpinned `create-nuxt@latest` changing `--modules` semantics would otherwise fail silently and only surface confusingly at Stage 5 or later.
- Guarded Stage 1b's package-refresh script against a future `create-nuxt@latest` dropping/renaming one of the 9 hardcoded template packages — it now stops with a clear message instead of an uncaught `ENOENT` stack trace.
- Extended Stage 1b's safety check to also assert the template shape Stage 3's merge instructions depend on (`app/app.config.ts`, `eslint.config.mjs`, `nuxt.config.ts` keys), not just the Nuxt major version.
- Caveated the remaining template-content assumptions in `artifacts.md` (`nuxt.config.ts` key order, `tsconfig.json` shape) and `modules.md` as last verified against `create-nuxt@3.36.1`, now that Stage 1 runs unpinned.

## [1.16.1] - 2026-07-02

### Fixed

- **`bigin-harness-setup`:** scaffolded repos now surface the Claude Code workspace-trust step, which was previously undocumented and caused the `.claude/settings.json` `permissions.allow` entries to be silently ignored on first run in a new/moved workspace. Phase 6's `## AI Onboarding` README block adds a step to accept the trust dialog (or set `hasTrustDialogAccepted` in `~/.claude.json` for headless setups); Phase 7's summary calls it out as next step 1.

## [1.16.0] - 2026-07-02

### Added

- **`sprint-distill` skill:** new standalone skill (`skills/sprint-distill/`) that replaces a manual NotebookLM end-of-sprint pass with a git-native distillation step: merged PRs + `knowledge/log.md` cursor → sprint-distill → `knowledge/` + `bigin-skills` updates → knowledge validator gate. Determines sprint scope from the last `knowledge/log.md` entry (asks for a start date if undeterminable, or falls back to a skills-only mode if the repo has no Knowledge Bundle at all). Gathers merged PRs, touched concept files, current `.claude/rules/`, and any pasted out-of-repo material. Classifies every candidate with a strict sorting rule — WHAT/WHY → `knowledge/`, HOW-we-work → `bigin-skills`, neither → dropped and reported, never both, link don't copy — then proposes the full change set and **stops for approval** before writing anything. On approval: applies changes, runs `tools/knowledge_validate.py` best-effort (never blocks on missing tooling), appends the log entry last. First-class stale-concept detection (diff-touched resources whose concept file wasn't updated; index-unreachable concepts). Explicitly does not trigger on single-PR/single-change review — that stays `/code-review`.
- **`bigin-harness-setup` wiring:** Phase 5.5 step 5's conditional CLAUDE.md append (when `KNOWLEDGE_BUNDLE = true`) now also points at `sprint-distill`; Phase 7's summary notes its availability under the same condition.

## [1.15.1] - 2026-07-02

### Fixed

`nuxt-scaffold` no longer inherits a stale `create-nuxt@3.36.1` template snapshot, and 10 real bugs (all found and confirmed via actual end-to-end scaffold runs, not just review) are fixed:

- **Dependency freshness:** new Stage 1b re-pins `nuxt`, `@nuxt/ui`, `@nuxt/eslint`, `eslint`, `tailwindcss`, `vue-tsc`, `typescript`, `@pinia/nuxt`, `nuxt-auth-utils`, `@vueuse/nuxt` to current releases right after init, per a new `VERSION_POLICY` choice in Phase 2 (`capped` — stay on the currently-installed major, default; `latest` — allow a future major). Fixes scaffolds silently shipping on Tailwind/Nuxt UI releases old enough to predate current features (e.g. Tailwind's `mauve`/`olive`/`mist`/`taupe` neutral palettes, now listed as Phase 2 options).
- Rewrote the refresh step as a single `node -e` script using `execFileSync` with an argument array — the previous shell `for` loop relied on word-splitting zsh doesn't do by default, and plain `require('<pkg>/package.json')` throws on packages with a restrictive `exports` map.
- Removed the stale `compatibilityVersion: 4` key from the `nuxt.config.ts` merge template — a Nuxt 3→4 migration opt-in flag that current Nuxt versions reject and strip; scaffolds already install Nuxt 4 directly.
- Fixed the `nuxt.config.ts` `runtimeConfig` merge to respect `nuxt/nuxt-config-keys-order` and `@stylistic/no-multi-spaces` (correct key position, comment on its own line).
- Removed a stale `tsconfig.json` merge instruction that broke `pnpm type-check` (`TS6306`/`TS6310`) against the current solution-style config — `.nuxt/tsconfig.shared.json` already covers `shared/**/*` automatically.
- Added `happy-dom` to the preset install — `@nuxt/test-utils`'s `environment: 'nuxt'` fails without it.
- Documented and sequenced pnpm 10+'s build-script approval gate correctly: `pnpm add` for a gated package exits 1 with `ERR_PNPM_IGNORED_BUILDS` but still installs (non-fatal, expected) — `simple-git-hooks`, `better-sqlite3` (`@nuxt/content`), and `esbuild`/`workerd` (`wrangler`) each get an immediate, separate `pnpm approve-builds <pkg> || true` (naming a non-pending package fails the whole call if combined).
- `@nuxt/content`: pre-install and approve `better-sqlite3` before `nuxi module add content`, or the command hangs forever on a non-interactive prompt.
- `@nuxt/image`: dropped an ineffective "pre-install `sharp`" step (doesn't prevent `nuxi` from hitting its own gate on an internally-resolved `sharp` version) in favor of a mandatory post-hoc check that `'@nuxt/image'` actually landed in `nuxt.config.ts`'s `modules` array, plus a required `pnpm approve-builds sharp || true` — without it, every subsequent `pnpm` command fails, not just the registration.
- The `create-nuxt@3.36.1` template's `nuxt.config.ts` ships without a trailing newline on every scaffold (not just when `image` is chosen) — `@stylistic/eol-last` fails `pnpm lint` until it's fixed; the Stage 3 merge now ensures the file ends with `\n`.
- Corrected a false claim that `--gitInit` creates an initial commit — it only runs `git init`.

## [1.15.0] - 2026-07-02

### Added

- **CI config (`bigin-harness-setup` Phase 5.6, optional):** generates a GitHub Actions workflow (`.github/workflows/ci.yml`) and/or a GitLab CI pipeline (`.gitlab-ci.yml`) that run the profile's lint + typecheck + test commands on push to `main` and on merge/pull requests. Asks `github/gitlab/both/no`. New `references/ci.md` holds the per-profile templates (nuxt/nodejs via pnpm, go via `actions/setup-go`/`golang` image + staticcheck).
- If the Knowledge Bundle convention (Phase 5.5) was also opted into, the generated CI file automatically gets a `uv run tools/knowledge_validate.py` step wired in — no manual follow-up needed. Phase 5.5's step 7 note now only applies to pre-existing, hand-written CI config this skill didn't generate.

## [1.14.0] - 2026-07-02

### Added

- **Knowledge Bundle convention (`bigin-harness-setup` Phase 5.5, optional):** an internal knowledge-management format inspired by Open Knowledge Format v0.1 (no OKF tooling dependency). Scaffolds `knowledge/` — one concept file per Markdown file, required `type` frontmatter (`Index`, `Contract`, `System`, `Domain`, `Table`, `Metric`, `Playbook`, `Constraint`, `Log`), bundle-relative linking, link-don't-copy pointing to sources of truth (`openapi.yaml`, `.claude/rules/`, source code). New `references/knowledge-bundle.md` holds the templates: `.claude/rules/knowledge.md` rule file, `knowledge/meta/knowledge-bundle-spec.md`, starter `knowledge/index.md` + `knowledge/contracts/openapi-contract.md` + `knowledge/constraints/agent-rules.md` + `knowledge/log.md`, and `tools/knowledge_validate.py` — a PEP 723 (`uv run`-compatible) validator that hard-fails on missing/invalid frontmatter, disallowed `type`, or broken bundle-relative links, and warns on missing description/tags or files unreachable from the index.
- When opted in, the validator is wired into the existing pre-commit gate, and one line each is appended to `CLAUDE.md` (pointer to `knowledge/index.md`) and `AI_REVIEW_CHECKLIST.md` (behavior-changing PR → concept file updated). CI wiring is never done automatically — the setup summary flags it if CI config is detected.

## [1.13.0] - 2026-07-01

### Added

- **`nuxt-scaffold` skill:** New standalone skill (`skills/nuxt-scaffold/`) that scaffolds a Nuxt 4 BFF app **from scratch** — non-interactive `npm create nuxt@latest` (`--template ui`, `--packageManager pnpm`, `--gitInit`, `--force`), then the BFF preset modules (`pinia`, `nuxt-auth-utils`, `@vueuse/nuxt`, `@pinia/colada`, `zod`, `vitest`, `@nuxt/test-utils`, `simple-git-hooks`, `lint-staged`, `openapi-typescript`), then config + sample BFF code (proxy route, Pinia store, `vitest.config.ts`, `openapi.yaml` stub). Optional module extras (`image`, `content`) and an opt-in Drizzle + Cloudflare D1 layer. No GitHub template clone. Usable standalone and invoked by `bigin-harness-setup` Phase 0.5.

### Changed

- **bigin-harness-setup — Phase 0.5 delegates to the `nuxt-scaffold` skill** instead of cloning `tammai/nuxt-fullstack-template` and embedding a scaffold skill into the target. No more SSH/clone dependency; the project starts from a clean `npm create nuxt` base with `--gitInit`.
- **Ownership split (prevents drift):** `bash-guard.py` + its `PreToolUse` hook remain governance (harness). `nuxt-scaffold` writes `.claude/settings.json` with only `permissions` + a `PostToolUse` lint-fix hook; the harness Phase 5-3 merges the `PreToolUse` bash-guard hook on top (preserving the scaffold's `PostToolUse`). `profile-nuxt.md`'s `## settings.json Template` is now documented as the governance superset (used when onboarding an existing nuxt repo).
- **Phase 2 (CLAUDE.md):** the SCAFFOLDED "append pointer to the template's CLAUDE.md" special-case is removed — the scaffold no longer ships a `CLAUDE.md`, so the harness writes it fresh.
- **profile-nuxt.md:** line 5 now points to the `nuxt-scaffold` skill; the stale "matches nuxt-fullstack-template" note updated.

### Removed

- **`references/scaffold-nuxt.md`** (clone-based embedded scaffold) — superseded by the standalone `nuxt-scaffold` skill. The `git clone tammai/nuxt-fullstack-template` step is gone from the scaffold flow.

---

## [1.12.2] - 2026-06-30

### Fixed

- **nuxt scaffold — reset git history after clone:** Step 3 now removes `.git` and runs `git init` after copying the template files. The project starts with a clean repo with no template history.

---

## [1.12.1] - 2026-06-30

### Fixed

- **nuxt scaffold — remove all Wrangler references:** `wrangler.toml` is now deleted during scaffold (Step 4) — it's not used by the BFF layer. Removed the `wrangler.toml name` customization step that referenced it.
- **nuxt scaffold — ask for customization inputs upfront:** new Step 2 collects project name and theme (primary/neutral colors) before cloning, shows a summary, and asks the user to confirm before proceeding. Previously customization happened inline during Step 3 without a consolidated prompt.

---

## [1.12.0] - 2026-06-30

### Changed

- **bigin-harness-setup — Nuxt scaffold generates a project skill instead of depending on local skills:** Phase 0.5 no longer relies on the locally-installed `nuxt-fullstack-scaffold` skill or any local template codebase. Instead it:
  1. Generates `.claude/skills/nuxt-scaffold/SKILL.md` in the target project (self-contained skill, no external dependencies) from `references/scaffold-nuxt.md`.
  2. Immediately executes that skill's steps to scaffold the Nuxt app.
  The generated skill is preserved in the project so teammates can re-run it without needing `bigin-skills` installed. Idempotent: skill file is skipped if it already exists.
- **`references/scaffold-nuxt.md`** restructured as a SKILL.md template (frontmatter + steps) rather than a prose reference. Removed the cross-reference to `nuxt-fullstack-scaffold` skill.

---

## [1.11.0] - 2026-06-30

### Changed

- **nuxt profile — remove D1/KV/R2/Drizzle (BFF layer, not direct-DB):** The Nuxt app is a BFF proxy — the backend owns data persistence. Removed from all surfaces:
  - Stack listing in SKILL.md, profile-nuxt.md, README.md: `Drizzle/D1` dropped; profile now reads "BFF proxy layer, no D1/KV/R2".
  - `scaffold-nuxt.md`: after cloning `tammai/nuxt-fullstack-template`, a new cleanup step removes Drizzle deps (`drizzle-orm`, `drizzle-kit`), `server/db/`, `drizzle.config.ts`, D1/KV blocks in `wrangler.toml`, and `db:*` scripts from `package.json`. Wrangler itself stays (still needed for Cloudflare Pages deployment).
  - `profile-nuxt.md`: stack header updated.

---

## [1.10.1] - 2026-06-30

### Fixed

- **nuxt profile — stale SPA-era architecture docs:** Added `[Nuxt] BFF Boundary` section to the generated `architecture.md` addendum (sole backend caller is `server/api/`, token stays server-side, openapi types generated server-side at `server/types/api.d.ts`). Removed "frontend repos" wording from the shared `AI_REVIEW_CHECKLIST.md` contract item (now "API surface changed" — profile-neutral and correct for the BFF model).

---

## [1.10.0] - 2026-06-30

### Added

- **bigin-harness-setup — Nuxt project scaffolding (nuxt profile):** running setup harness on an empty/non-Nuxt repo now scaffolds the full app, not just governance. New **Phase 0.5** scaffolds in-place from `tammai/nuxt-fullstack-template` (via the `nuxt-fullstack-scaffold` flow: `nuxt.config.ts`, modules, `eslint.config.mjs`, `app/`, `server/`, Drizzle/Wrangler, `simple-git-hooks`), then the harness layer is overlaid additively. New `references/scaffold-nuxt.md`.

### Changed

- **nuxt profile — BFF proxy architecture:** Conventions now document the Nuxt server (`server/api/`) as the sole backend caller. The backend access token lives in the `nuxt-auth-utils` sealed session and never touches the browser. Client-side code calls same-origin `/api/*` only (no auth headers). `openapi.yaml` types are generated server-side (`server/types/api.d.ts`). The old `plugins/api.ts` browser-side Bearer pattern is replaced by a `server/api/` proxy example. CLAUDE.md hard rules updated accordingly.
- **Governance overlay reconciles with the scaffolded template:** when `SCAFFOLDED`, the skill does not overwrite the template's `CLAUDE.md` (appends a pointer) or `.vscode/settings.json` (merges), and **skips `scripts/pre-commit.sh`** when a hook manager (`simple-git-hooks`/`husky`) already gates commits. It adds only the BigIn guardrails the template lacks: `.claude/guards/bash-guard.py`, `.claude/settings.json` (permissions + PreToolUse bash-guard + PostToolUse `pnpm lint --fix`), `AI_TASK_GUIDE.md`, `AI_REVIEW_CHECKLIST.md`, `.claude/rules/{security,architecture}.md`.
- **nuxt profile relabeled SPA → fullstack (Cloudflare)** across the Phase 0 menu, README, and profile spec, to match what actually gets scaffolded.

---

## [1.9.1] - 2026-06-30

### Changed

- **bigin-harness-setup:** The skill now initializes git and installs the pre-commit hook itself instead of printing the command for the user to run. New Phase 5-1b: ensure a git repo exists (`git init` only if not already one), then symlink `.git/hooks/pre-commit` → `scripts/pre-commit.sh`. Idempotent — never re-inits, and never clobbers a pre-existing foreign hook without confirming. Phase 7 summary and Output Checklist updated; README onboarding step retained for fresh clones (`.git/hooks/` is not version-controlled).
- **nuxt profile — auto-format on every edit (aligned with `nuxt-fullstack-template`):** ESLint via `@nuxt/eslint` is the single formatter, Prettier disabled. The generated `.claude/settings.json` wires a `PostToolUse` hook (`Write|Edit|MultiEdit`) running `pnpm lint --fix` for the agent; a generated `.vscode/settings.json` gives humans the same via ESLint format-on-save. New `conventions.md` formatting section documents the stylistic config (`commaDangle: 'never'`, `braceStyle: '1tbs'`), `eslint.config.mjs` `withNuxt()`, and `lint-staged` (`"*.{ts,vue,js,mjs}": "eslint --fix"`). No custom script.
- **nuxt profile — `nuxt-auth-utils` added to the stack:** session/auth standardized on the module. New Auth section in the generated `conventions.md` (`useUserSession`, `setUserSession`, `requireUserSession`, `hashPassword`/`verifyPassword`, `NUXT_SESSION_PASSWORD`), plus a hard rule in `CLAUDE.md` (auth via `nuxt-auth-utils` only). Stack lines in README and the profile spec updated.

---

## [1.9.0] - 2026-06-30

### Added

- **bigin-harness-setup skill:** New skill that scaffolds a standardized AI workflow harness into any repo — CLAUDE.md, scoped governance rules, enforcement hooks, and per-stack conventions. Supports `nuxt`, `go`, and `nodejs` profiles. Idempotent re-runs are safe.
  - `SKILL.md`: 8-phase workflow (detect profile → detect existing → generate CLAUDE.md + rules + AI files → enforcement → README update → summary)
  - `references/profile-nuxt.md`: Nuxt 4 SPA templates (CLAUDE.md, conventions with centralized `plugins/api.ts` Bearer pattern + openapi-typescript, settings.json)
  - `references/profile-go.md`: Go/Gin templates (CLAUDE.md, conventions with handler pattern + openapi-first, settings.json)
  - `references/profile-nodejs.md`: Node.js TypeScript templates (CLAUDE.md, conventions with Zod boundary validation + openapi-typescript, settings.json)
  - `references/files-shared.md`: Shared templates (security.md, architecture.md, AI_TASK_GUIDE.md with spec gate, AI_REVIEW_CHECKLIST.md, optional code-reviewer agent)
  - `references/hook-guard.md`: `bash-guard.py` (blocks `--no-verify` and force-push) + pre-commit scripts per profile

### Changed

- **BREAKING — Plugin and repo renamed `bigin-webapp-harness` → `bigin-skills`.** The plugin is now a collection of skills rather than a single harness factory. Install commands change to `/plugin marketplace add tammai/bigin-skills` and `/plugin install bigin-skills@bigin`. GitHub auto-redirects the old `tammai/bigin-webapp-harness` URL, but existing installs should re-add the marketplace and reinstall under the new name.
  - GitHub repo renamed `tammai/bigin-webapp-harness` → `tammai/bigin-skills`.
  - `plugin.json` / `marketplace.json`: `name` updated to `bigin-skills`; homepage/repository URLs, description, and keywords updated.
  - `README.md` / `CLAUDE.md`: rewritten around the skill collection.

### Removed

- **bigin-webapp-harness skill** (`skills/bigin-webapp-harness/` — SKILL.md + 7 reference files) — the Nuxt/Go agent-team harness factory. Removed in favor of `bigin-harness-setup`. Historical changelog entries below are retained.

---

## [1.8.1] - 2026-06-22

### Fixed

- **README.md:** Backend project type description still said "chi router" — updated to "Gin router" (chi was removed in v1.8.0)
- **fullstack-mvp.md:** Local dev and deploy code blocks used `npm` instead of `pnpm` (`npm install -D` → `pnpm add -D`, `npm run build` → `pnpm build`, `npm run deploy` → `pnpm deploy`)
- **fullstack-mvp.md:** `compatibilityDate` and `wrangler.toml` `compatibility_date` were `2025-01-01` — aligned to `2025-01-15` to match `scaffold.md`; added missing `compatibility_flags = ["nodejs_compat"]` to canonical `wrangler.toml`
- **backend-go.md:** Makefile had target `dev` and a `lint` target that do not exist in the scaffold — renamed `dev` → `run` and removed `lint` to match `scaffold.md`
- **SKILL.md + skill-manifest.md:** Aligned skill names (`nuxt` → `nuxt4-patterns`, `vueuse-functions` → `vueuse`, `cloudflare-pages` → `wrangler`); added explicit create-on-not-found fallback (Phase 5-2); renumbered downstream phases (5-2 → 5-3, etc.)
- **Version:** Bumped to `1.8.1`

---

## [1.8.0] - 2026-06-21

### Changed

- **Go backend stack:** Switched the HTTP router from `chi` to **Gin** (`github.com/gin-gonic/gin`) across `references/backend-go.md`, `references/scaffold.md`, and `references/agent-roles.md`
  - `backend-go.md`: rewritten `main.go`, handler, testing sections for Gin (`*gin.Context`, `c.JSON`, `c.Param`); added new sections for **Request binding & validation** (`c.ShouldBindJSON` + `binding:"..."` tags), **Route Registration** (`r.Group("/api/v1")`), and **Middleware Pattern** (`gin.HandlerFunc` + `c.Next()`/`c.AbortWithStatusJSON`)
  - `scaffold.md`: `cmd/server/main.go` now uses `gin.Default()` + `r.Run()`; added `internal/middleware/` to the created-directories list
  - `agent-roles.md`: `backend-dev` stack knowledge updated to Gin (routing, binding, `c.Request.Context()`); `qa` testing note now mentions `gin.SetMode(gin.TestMode)` + `r.ServeHTTP(w, req)`
  - Service/repository layers and project layout are unchanged (framework-agnostic)
- **Version:** Bumped to `1.8.0`

---

## [1.7.0] - 2026-06-21

### Removed

- **Skill manifest:** Removed `vue`, `vue-best-practices`, `vue-testing-best-practices`, and `github-actions` from the Phase 5 install list for both Nuxt types (Fullstack MVP and SPA Frontend)
  - Fullstack MVP: 16 → 12 skills (10 base + drizzle optional + nuxt-auth-utils optional)
  - SPA Frontend: 14 → 10 skills (9 base + nuxt-auth-utils optional)

### Changed

- **Session handoff:** Standardized `SESSION.md` location to `.claude/memory/SESSION.md` (project-relative) across `session-handoff/SKILL.md` and `CLAUDE.md` — previously inconsistent (`~/.claude/memory/`, `~/.claude/projects/<project-id>/memory/`)
- **Version:** Bumped to `1.7.0`

### Fixed

- **CHANGELOG.md:** Removed duplicate `[1.6.0]` entry that appeared twice
- **spa-frontend.md:** Added missing `runtimeConfig.public.apiBase` to the canonical `nuxt.config.ts` — the spec referenced `useRuntimeConfig().public.apiBase` without defining it
- **SKILL.md:** Phase 5 summary table was missing `session-handoff` for all project types — added to all three
- **README.md:** Plugin structure diagram listed library skill directories (`nuxt/`, `pinia/`, etc.) that do not exist in this repo — corrected to show only `bigin-webapp-harness/` and `session-handoff/`; renamed "Bundled Skills" heading to "Skills Installed at Harness-Time"

---

## [1.6.0] - 2026-06-21

### Added

- **Scaffold refactor:** Nuxt projects (Types 1 & 2) now use `pnpm create nuxt@latest . --template ui --packageManager pnpm --no-gitInit --no-install` instead of manual file writing
- **Scaffold:** `pnpm install` now runs automatically for Nuxt projects — projects are ready to develop immediately after scaffold
- **Scaffold:** Customization prompt now asks for app name, primary color, neutral color, and font before scaffold runs
- **Scaffold:** New config files added to all Nuxt projects:
  - `vitest.config.ts` — Vitest configuration with Nuxt test environment
  - `.vscode/settings.json` — ESLint as default formatter, format on save
  - `.editorconfig` — Consistent editor settings (2 spaces, LF, UTF-8)
- **Scaffold:** Git hooks now added to all Nuxt projects:
  - `simple-git-hooks` — Pre-commit hook for linting
  - `lint-staged` — Run ESLint on staged `.ts`, `.vue`, `.js`, `.mjs` files
- **Scaffold:** New devDependencies for all Nuxt types:
  - `@vitest/coverage-v8` — V8 coverage provider for Vitest
- **Dependencies:** `github-actions` skill added to Phase 5 install list for both Nuxt types (was missing from inline summary)

### Changed

- **Scaffold:** `nuxt.config.ts` template for Fullstack MVP now explicitly includes `ssr: false` (was accidentally removed in refactor)
- **Scaffold:** Step 3 now explicitly states that nuxi-generated files must be overwritten if scaffold.md lists them
- **SKILL.md:** Phase 3.5 rules updated to clarify that nuxi-generated files are replaced, not preserved
- **SKILL.md:** Phase 3.5 now references the "Announce" block in scaffold.md instead of hardcoding a file list
- **SKILL.md:** Phase 0 empty repo message updated to reflect automatic package installation
- **CLAUDE.md:** Added scaffold rules explaining the nuxi init approach, customization prompt, and auto-install
- **Version:** Bumped to `1.6.0`

### Fixed

- **SKILL.md Phase 3.5:** Contradictory rule "Do NOT run pnpm install" — corrected to require auto-install for Nuxt types
- **scaffold.md:** Fullstack MVP `nuxt.config.ts` was missing `ssr: false` — restored to match canonical spec in `fullstack-mvp.md`
- **scaffold.md:** `@vitest/coverage-v8` was missing from devDependencies for both Type 1 and Type 2 — added to both
- **agent-roles.md:** All three QA agent templates (Fullstack, SPA, Go) were missing `agentType: general-purpose` frontmatter — added to all three
- **SKILL.md:** "Never overwrite a file that already exists" rule conflicted with new scaffold approach — clarified that nuxi files must be replaced
- **SKILL.md:** Stale scaffold summary block listed removed files (`.npmrc`) and wrong path (`assets/css` vs `app/assets/css`) — replaced with reference to scaffold.md Announce block
- **SKILL.md:** Phase 5 skills table was missing `github-actions` for both Nuxt types — added to both
- **agent-roles.md:** Type 2 (SPA Frontend) architect role was marked "Recommended" instead of "Always" — changed to `✅ Always` for consistency
- **skill-manifest.md:** Install instructions missing registry qualifier — added `from affaan-m/everything-claude-code` to example
- **scaffold.md:** Added explicit note to substitute `{app-name}` placeholder in `db:migrate` script before writing
- **skill-manifest.md:** Base skill count comment said "12 base" but list actually has 13 — corrected to "13 base"

### Technical Notes

- **nuxi init flags:** Non-interactive mode (no TTY in Claude's bash) requires: `--template ui`, `--packageManager pnpm`, `--no-gitInit`, `--no-install`
- **CSS path:** `~/assets/css/main.css` in nuxt.config.ts is correct — `~` resolves to `app/` in Nuxt
- **Go Backend:** Unchanged by this refactor — still uses file-based scaffold with no package install
- **Coverage:** QA agents enforce 70% V8 coverage threshold — now functional with `@vitest/coverage-v8` installed
- **QA agents:** Now correctly generated with `agentType: general-purpose` so they can run scripts and write test files (Explore is read-only and would break the workflow)

---

## [1.5.0] - 2026-06-20

### Added

- **ESLint integration:** Added `@nuxt/eslint` to all Nuxt project types with stylistic config (commaDangle, braceStyle)
- **Zod skill:** Added `zod` to skill manifest for schema validation and type inference
- **PostToolUse hook:** Added `.claude/settings.json` with auto-ESLint on write for `.vue`, `.ts`, `.js`, `.mjs` files

### Fixed

- **Spec-scaffold drift:** Fixed inconsistencies between canonical stack specs and scaffold templates
- **Dependency references:** Fixed incorrect `@pinia/colada` references in documentation

---

## [1.4.0] - 2026-06-20

### Added

- **nuxt-auth-utils skill:** Added authentication skill for sessions, OAuth, password hashing, and WebAuthn
- **Skill manifest:** Updated `skill-manifest.md` to include `nuxt-auth-utils` as an optional skill for Fullstack MVP and SPA Frontend

### Changed

- **Agent roles:** Updated QA agents to reference auth testing patterns
- **Version:** Bumped to `1.4.0`

---

## [1.3.0] - 2026-06-20

### Added

- **CLAUDE.md:** Added comprehensive project documentation for Claude Code
- **Vitest skill:** Added unit testing skill with Vue Test Utils, happy-dom, and coverage support
- **Harness references:** Expanded `references/` with detailed specs for each project type

### Changed

- **Agent templates:** Updated QA agents to include Vitest testing patterns and coverage enforcement
- **Plugin structure:** Reorganized skills directory with reference files for progressive disclosure
- **Version:** Bumped to `1.3.0`

---

## [1.2.1] - 2026-06-20

### Fixed

- **plugin.json:** Added missing `author` metadata (name, email)
- **plugin.json:** Restored `skills` entry that was missing from plugin metadata
- **Skill description:** Improved `bigin-webapp-harness` skill description for better discoverability

---

## [1.2.0] - 2026-06-20

### Added

- **Initial release:** First public version of bigin-webapp-harness plugin
- **8-phase harness workflow:** Complete scaffold → agents → skills → orchestrator pipeline
- **Three project types:**
  - Type 1: Fullstack MVP (Nuxt v4 + Cloudflare Pages)
  - Type 2: SPA Frontend (Nuxt v4, SSR disabled)
  - Type 3: Backend (Go with chi router)
- **Agent role catalog:** Pre-configured templates for architect, frontend-dev, api-dev, database-dev, deployment, state-dev, backend-dev, qa
- **Skill generation:** Automatic generation of project-specific skills and orchestrator
- **Library skills:** Integrated find-skills for installing community skills
- **Scaffold templates:** File templates for each project type with proper Nuxt UI, Pinia, and Tailwind setup
- **Plugin metadata:** Marketplace-ready plugin.json with keywords and description

### Technical Notes

- **Stack conventions:** All Nuxt types use Google Sans font, primary blue, neutral slate theme, `ssr: false`
- **Agent model assignment:** `architect` uses Opus, all other agents use Sonnet
- **QA agent type:** Must use `general-purpose` (not Explore — read-only)
- **Skill discovery:** Uses `affaan-m/everything-claude-code` as preferred registry


