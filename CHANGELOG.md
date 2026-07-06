# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.23.1] - 2026-07-06

### Fixed

- **The generated `code-reviewer` agent's frontmatter set `agentType: general-purpose`, which is not a field the subagent schema recognizes (valid fields are `name, description, tools, disallowedTools, model, permissionMode, maxTurns, skills, mcpServers, hooks, memory, background, effort, isolation, color, initialPrompt`) — the field is silently ignored, so nothing enforced the agent's own claim of being "Read-only... Never writes or edits files":** Replaced `agentType: general-purpose` with `tools: Read, Grep, Glob, Bash` in the `code-reviewer` agent template (`skills/bigin-harness-setup/references/files-shared.md`), matching `sub-agents.md`'s own read-only reviewer example. Updated the corresponding convention note in `.claude/rules/skill-authoring.md` to describe the `tools:` restriction instead of the non-existent `agentType` field, and to clarify that `agentType` only exists as a call-site option when *invoking* an agent (`Agent` tool, `Workflow`'s `agent()`), never inside a subagent definition's own frontmatter.

  ```patch
  target: .claude/agents/code-reviewer.md
  anchor: agentType: general-purpose
  insert: replace
  ---

  tools: Read, Grep, Glob, Bash
  ```

### Added

- **`sprint-distill`, `task-workflow` had no pinned `effort:` while the other three skills did, and `sprint-distill`'s own Phase 1 self-flagged as an unadopted `context: fork` candidate:** Added `effort: high` to `sprint-distill` (git-log/diff-heavy, sprint-scale) and `effort: low` to `task-workflow` (lightweight phase guidance). Delegated `sprint-distill` Phase 1 steps 1-4 (git log, diff, stale-rules scan) to an Agent-tool subagent returning a summary, keeping step 5's interactive `AskUserQuestion` in the main conversation afterward — implemented via explicit Agent-tool delegation rather than the skill-level `context: fork` frontmatter, since that field would fork the entire skill (including step 5, where `AskUserQuestion` isn't available to subagents).
- **`allowed-tools`** added to `bigin-harness-setup` (`git init`, `git rev-parse`, `chmod +x`, `ln -sf`), `nuxt-scaffold` (`node ${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs`), and `sprint-distill` (`git log`, `git diff`, `node tools/knowledge_validate.mjs`) to pre-approve safe, repeated commands each skill already runs.
- **`evals/evals.json`** added for `bigin-harness-setup`, `nuxt-scaffold`, and `sprint-distill` (12 should-trigger/should-not-trigger cases each, EN + VI), matching `task-workflow`'s existing coverage.
- Moved `bigin-harness-setup`'s Phase 1a (patch-mode procedure) out of `SKILL.md` into `references/patch-mode.md`, trimming the skill body from 464 to 434 lines.

## [1.23.0] - 2026-07-05

### Added

- **`task-workflow`'s trigger description listed phrases about asking about the workflow ("what is the task workflow") instead of phrases a developer naturally says when starting work — which is the moment the skill actually needs to fire / Mô tả kích hoạt của `task-workflow` liệt kê các cụm hỏi về quy trình ("what is the task workflow") thay vì cụm từ mà lập trình viên thực sự nói khi bắt đầu làm việc — đúng thời điểm skill cần kích hoạt:** Rewrote `skills/task-workflow/SKILL.md`'s `description:` to match the sibling skills' "MUST use when user says: '...'" pattern (per `.claude/rules/skill-authoring.md`'s "specific and pushy" rule), leading with natural work-starting phrases in EN + VI ('implement X', 'add a feature', 'build Y', 'fix bug in Z', 'thêm chức năng', 'sửa lỗi', 'làm feature mới') while keeping the existing meta-question phrases ('what is the task workflow', 'spec gate', etc.) as a secondary clause. Measured trigger accuracy with `skill-creator`'s `run_eval.py` trigger-benchmark tool against a new 13-query eval set (`skills/task-workflow/evals/evals.json`, 7 should-trigger + 6 should-not-trigger) comparing the old and new description text head-to-head: both scored 6/13 with zero detected triggers on every should-trigger query under either wording. This is a floor effect in the test harness itself, not a real result — `run_eval.py` registers the skill as a synthetic slash-command file under `.claude/commands/` rather than a genuine plugin skill in the `available_skills` list, so single-shot headless `claude -p` runs never see it as an invokable skill the way a real session (with bigin-skills actually installed) does. The eval set is kept as a fixture for a future, more faithful harness rather than discarded, but no quantitative trigger-accuracy delta is claimed here — the rewrite is justified qualitatively (matches every sibling skill's proven pattern) rather than by this benchmark. / Đã viết lại `description:` của `skills/task-workflow/SKILL.md` theo đúng khuôn mẫu "MUST use when user says: '...'" của các skill anh em (theo quy tắc "cụ thể và pushy" trong `.claude/rules/skill-authoring.md`), dẫn đầu bằng các cụm từ bắt đầu công việc tự nhiên bằng tiếng Anh + tiếng Việt ('implement X', 'add a feature', 'build Y', 'fix bug in Z', 'thêm chức năng', 'sửa lỗi', 'làm feature mới'), đồng thời giữ lại các cụm hỏi về quy trình cũ ('what is the task workflow', 'spec gate', v.v.) như một vế phụ. Đã đo độ chính xác kích hoạt bằng công cụ benchmark `run_eval.py` của `skill-creator` với bộ 13 câu truy vấn mới (`skills/task-workflow/evals/evals.json`, 7 câu nên kích hoạt + 6 câu không nên) so sánh trực tiếp mô tả cũ và mới: cả hai đều đạt 6/13, không câu nào trong nhóm nên-kích-hoạt thực sự kích hoạt được ở cả hai cách viết. Đây là hiệu ứng sàn (floor effect) của chính công cụ kiểm thử, không phải kết quả thật — `run_eval.py` đăng ký skill dưới dạng file slash-command giả trong `.claude/commands/` thay vì một skill plugin thật trong danh sách `available_skills`, nên các lượt chạy `claude -p` một lượt, không có ngữ cảnh, không bao giờ thấy nó như một skill có thể gọi được theo cách một phiên thật (có cài bigin-skills) sẽ thấy. Bộ eval được giữ lại làm fixture cho một công cụ kiểm thử trung thực hơn sau này thay vì bỏ đi, nhưng không có con số chênh lệch độ chính xác kích hoạt nào được khẳng định ở đây — việc viết lại được biện minh về mặt định tính (khớp với khuôn mẫu đã được chứng minh của mọi skill anh em) chứ không phải bằng benchmark này.

- **The spec gate (`.claude/rules/security.md` / `task-workflow`'s step 2) only ever lived as a convention agents could choose to follow — nothing stopped an edit from landing before a spec was approved / Spec gate (`.claude/rules/security.md` / bước 2 của `task-workflow`) trước giờ chỉ là một quy ước mà agent có thể tuỳ ý tuân theo — không có gì ngăn một chỉnh sửa được thực hiện trước khi spec được duyệt:** Added `spec-gate-guard.mjs`, a new `PreToolUse` guard (matcher `Edit|Write|MultiEdit`) that blocks non-trivial edits until `PLAN.md` exists with `Status: approved`. It allows through: edits to `PLAN.md` itself, any `*.md` file, `tests/**`, `.env.example`, common config files (`.eslintrc*`, `eslint.config.*`, `tsconfig*.json`, `vite(st).config.*`, `nuxt.config.*`, `.editorconfig`, `.gitignore`, `.npmrc`), and any edit whose size (line-count delta for `Write`, changed-region size for `Edit`/`MultiEdit`) is ≤20 lines — a heuristic proxy for the skill's own "≤20 lines of logic" spec-gate exemption. New `## spec-gate-guard.mjs` template section in `skills/bigin-harness-setup/references/hook-guard.md` (same stdlib-only, stdin-JSON, exit-2-to-block shape as `bash-guard.mjs`), wired into the `PreToolUse` array next to `bash-guard.mjs` in `profile-nuxt.md`, `profile-go.md`, `profile-nodejs.md`'s `## settings.json Template` sections, and into `bigin-harness-setup/SKILL.md`'s Phase 5-2b (new), Phase 5-3 merge instructions, Created-files list, Output Checklist, and References section. Also added a load-bearing-gate test-case convention note for it in `.claude/rules/skill-authoring.md`, mirroring the existing `bash-guard.mjs` note. / Đã thêm `spec-gate-guard.mjs`, một guard `PreToolUse` mới (matcher `Edit|Write|MultiEdit`) chặn các chỉnh sửa không nhỏ cho đến khi `PLAN.md` tồn tại với `Status: approved`. Guard cho qua: chỉnh sửa chính `PLAN.md`, mọi file `*.md`, `tests/**`, `.env.example`, các file config phổ biến (`.eslintrc*`, `eslint.config.*`, `tsconfig*.json`, `vite(st).config.*`, `nuxt.config.*`, `.editorconfig`, `.gitignore`, `.npmrc`), và bất kỳ chỉnh sửa nào có kích thước (chênh lệch số dòng với `Write`, kích thước vùng thay đổi với `Edit`/`MultiEdit`) ≤20 dòng — một heuristic thay thế cho ngoại lệ "≤20 dòng logic" của chính spec gate trong skill. Đã thêm mục template `## spec-gate-guard.mjs` mới trong `skills/bigin-harness-setup/references/hook-guard.md` (cùng cấu trúc chỉ dùng Node stdlib, đọc JSON từ stdin, exit 2 để chặn như `bash-guard.mjs`), nối vào mảng `PreToolUse` cạnh `bash-guard.mjs` trong các mục `## settings.json Template` của `profile-nuxt.md`, `profile-go.md`, `profile-nodejs.md`, và vào Phase 5-2b (mới), hướng dẫn merge ở Phase 5-3, danh sách file tạo ra, Output Checklist, và mục References của `bigin-harness-setup/SKILL.md`. Cũng đã thêm ghi chú quy ước test-case cho gate trọng yếu này vào `.claude/rules/skill-authoring.md`, tương tự ghi chú sẵn có của `bash-guard.mjs`.

  ```patch
  target: .claude/settings.json
  anchor:
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bash-guard.mjs"
          }
        ]
      }
  insert: after
  ---

  ,
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/spec-gate-guard.mjs"
          }
        ]
      }
  ```

## [1.22.13] - 2026-07-05

### Added

- **The task workflow had no durable checkpoint for an approved spec — it lived only in chat, so it was lost across context compaction or a session break, and there was no live record of which tasks were done / Quy trình task chưa có điểm lưu bền cho spec đã duyệt — spec chỉ tồn tại trong chat nên mất khi nén ngữ cảnh hoặc ngắt phiên, và không có bản ghi tiến độ theo thời gian thực:** discovered while testing a downstream Nuxt app scaffolded by this plugin. `skills/task-workflow/SKILL.md` now writes the approved spec to a `PLAN.md` file (new step 3) with a tasks-tracking table (`# | Task | Status | Notes`, statuses `Not started`/`In progress`/`Done`/`Blocked`), updates that table live during Implement (step 4) instead of batching updates, and deletes `PLAN.md` once every task is `Done` and review is clean (new step 7, Cleanup) — it's a working file, not project documentation. The workflow is now scope → spec → **plan file** → implement → verify → review → **cleanup**. Mirrored the same steps and a `## PLAN.md format` section into the `AI_TASK_GUIDE.md` template (`skills/bigin-harness-setup/references/files-shared.md`) so scaffolded target repos get the identical convention; while there, also added the `Testing strategy` spec-format line that v1.22.9 added to `task-workflow/SKILL.md` but never mirrored into `AI_TASK_GUIDE.md` — a separate, pre-existing drift fixed in the same pass. Updated the three stale "scope → spec → implement → verify → review" mentions in this repo's own `CLAUDE.md` and `README.md` to the new 7-step phrasing. The `## PLAN.md format` section itself (with its nested example code block) doesn't reduce to a single clean anchor patch, so it's new-scaffold-only for target repos — patch mode picks up the renumbered steps and the `Testing strategy` line automatically, but a repo already scaffolded needs a fresh/`new`-mode run (or manual copy) to pick up the `PLAN.md format` reference section. / Phát hiện khi thử nghiệm một app Nuxt downstream được scaffold bởi plugin này. `skills/task-workflow/SKILL.md` giờ ghi spec đã duyệt vào file `PLAN.md` (bước 3 mới) kèm bảng theo dõi task (`# | Task | Status | Notes`, trạng thái `Not started`/`In progress`/`Done`/`Blocked`), cập nhật bảng này theo thời gian thực trong lúc Implement (bước 4) thay vì dồn lại cập nhật một lần, và xoá `PLAN.md` khi mọi task đã `Done` và review sạch (bước 7 mới, Cleanup) — đây là file làm việc, không phải tài liệu dự án. Quy trình giờ là scope → spec → **plan file** → implement → verify → review → **cleanup**. Đã nối các bước tương tự và một mục `## PLAN.md format` vào template `AI_TASK_GUIDE.md` (`skills/bigin-harness-setup/references/files-shared.md`) để các repo scaffold ra có cùng quy ước; nhân tiện cũng thêm dòng `Testing strategy` vào định dạng spec mà v1.22.9 đã thêm vào `task-workflow/SKILL.md` nhưng chưa từng nối vào `AI_TASK_GUIDE.md` — một lỗi lệch pha có sẵn từ trước, được sửa trong cùng lượt này. Đã cập nhật ba chỗ còn ghi "scope → spec → implement → verify → review" cũ trong `CLAUDE.md` và `README.md` của chính repo này sang cách diễn đạt 7 bước mới. Mục `## PLAN.md format` (kèm khối code ví dụ lồng bên trong) không rút gọn được thành một patch với anchor đơn giản, nên chỉ áp dụng cho lần scaffold mới đối với các repo target — patch mode sẽ tự áp dụng các bước đánh số lại và dòng `Testing strategy`, nhưng một repo đã scaffold sẵn cần chạy lại ở chế độ fresh/`new` (hoặc copy tay) để có mục `PLAN.md format`.

  ```patch
  target: AI_TASK_GUIDE.md
  anchor: "the same one found after code review is a rewrite."
  insert: after
  ---

  3. **Plan file** — once the spec/plan is approved, write it to `PLAN.md`: the approved spec followed by a tasks tracking table (see format below).
     If `PLAN.md` already exists with tasks not marked `Done`, stop and ask the user how to proceed (resume, discard, or replace) before writing — never overwrite silently. If it doesn't exist, or every task in it is `Done`, write the new plan over it.
  ```
  ```patch
  target: AI_TASK_GUIDE.md
  anchor: "3. **Implement** — follow `.claude/rules/conventions.md`. Stay in scope."
  insert: replace
  ---
  4. **Implement** — follow `.claude/rules/conventions.md`. Stay in scope. Update `PLAN.md`'s tracking table as each task starts, finishes, or blocks — don't batch updates to the end.
  ```
  ```patch
  target: AI_TASK_GUIDE.md
  anchor: "4. **Verify** — run lint + typecheck + tests. All must pass before marking done."
  insert: replace
  ---
  5. **Verify** — run lint + typecheck + tests. All must pass before marking done.
  ```
  ```patch
  target: AI_TASK_GUIDE.md
  anchor: "5. **Review** — check `AI_REVIEW_CHECKLIST.md`. Mark done only when the checklist is clean."
  insert: replace
  ---
  6. **Review** — check `AI_REVIEW_CHECKLIST.md`. Mark done only when the checklist is clean.
  ```
  ```patch
  target: AI_TASK_GUIDE.md
  anchor: "6. **Review** — check `AI_REVIEW_CHECKLIST.md`. Mark done only when the checklist is clean."
  insert: after
  ---

  7. **Cleanup** — once every task in `PLAN.md` is `Done` and the review checklist is clean, delete `PLAN.md`. It's a working file for the task, not project documentation — nothing to preserve once the task ships.
  ```
  ```patch
  target: AI_TASK_GUIDE.md
  anchor: Security considerations: {who/what is trusted, what input is attacker-controlled, what could go wrong if it's abused
  insert: after
  ---
  Testing strategy: {what will be tested and how — unit/integration/manual, which edge cases get coverage}
  ```

- **Tests were co-located with source (`app/utils/foo.test.ts`) with no shared convention for cross-tree imports or stubbing Nitro auto-imports, so a real project ended up hand-rolling relative-path imports and ad-hoc mocks / Test từng được đặt cạnh source (`app/utils/foo.test.ts`) mà không có quy ước chung cho import xuyên cây thư mục hay stub Nitro auto-imports, khiến một dự án thực tế phải tự chế import bằng đường dẫn tương đối và mock tuỳ tiện:** Adopted the centralized-tests convention from that project: tests move under `tests/`, mirroring `app/`/`server/`, cross-tree imports use the `~~/` root alias instead of relative paths, and `vitest.config.ts`'s `test.include` is scoped to `tests/**/*.test.ts`. Added a new `.claude/rules/testing.md` template (nuxt profile only, `references/profile-nuxt.md`) covering location/mirroring, the `~~/` import rule, and a note on stubbing Nitro auto-imports via a shared `tests/support/` helper — mock only the true I/O boundary (`$fetch`, session read/write), wire real implementations of internal collaborators as globals instead of mocking them. Wired into `SKILL.md` Phase 3 (generation), the repo tree summary, and the review checklist. `nuxt-scaffold`'s own `vitest.config.ts` template now scopes `test.include` to `tests/**/*.test.ts`, and its one sample test file moved from `app/composables/queries/users.test.ts` to `tests/app/composables/queries/users.test.ts` with its import switched to `~~/` — the scaffold's own sample code now follows the rule it ships instead of contradicting it. `testing.md` is a wholly new file with no existing anchor in already-scaffolded repos, so per Phase 1a it's new-scaffold-only (no `patch` block) — already-scaffolded repos get it via a fresh/`new`-mode harness run, not automatic patching. / Đã áp dụng quy ước centralized-tests từ dự án đó: test chuyển vào `tests/`, phản chiếu cấu trúc `app/`/`server/`, import xuyên cây dùng alias gốc `~~/` thay vì đường dẫn tương đối, và `test.include` trong `vitest.config.ts` được giới hạn ở `tests/**/*.test.ts`. Đã thêm template `.claude/rules/testing.md` mới (chỉ profile nuxt, trong `references/profile-nuxt.md`) bao gồm quy tắc vị trí/phản chiếu, quy ước import `~~/`, và một ghi chú về việc stub Nitro auto-imports qua helper dùng chung `tests/support/` — chỉ mock ranh giới I/O thực sự (`$fetch`, đọc/ghi session), còn các collaborator nội bộ thì dùng implementation thật dưới dạng global thay vì mock. Đã nối vào Phase 3 của `SKILL.md` (sinh file), phần tóm tắt cây thư mục, và checklist review. Template `vitest.config.ts` của `nuxt-scaffold` giờ giới hạn `test.include` ở `tests/**/*.test.ts`, và file test mẫu duy nhất của nó chuyển từ `app/composables/queries/users.test.ts` sang `tests/app/composables/queries/users.test.ts` với import đổi sang `~~/` — code mẫu của scaffold giờ tuân theo đúng quy tắc mà nó ban hành thay vì mâu thuẫn với nó. `testing.md` là file hoàn toàn mới, không có anchor sẵn có trong các repo đã scaffold trước đó, nên theo Phase 1a nó chỉ áp dụng cho lần scaffold mới (không có khối `patch`) — các repo đã scaffold sẽ có file này khi chạy lại harness ở chế độ fresh/`new`, không tự động patch.

  ```patch
  target: vitest.config.ts
  anchor: "test: { environment: 'nuxt' }"
  insert: replace
  ---
  test: { environment: 'nuxt', include: ['tests/**/*.test.ts'] }
  ```

## [1.22.10] - 2026-07-04

### Changed

- **Security considerations were only checked at post-implementation review, not required at spec time / rủi ro bảo mật chỉ được kiểm ở bước review sau khi code xong, chưa bắt buộc nêu lúc viết spec:** the spec gate in `skills/task-workflow/SKILL.md` and its mirrored copy in `skills/bigin-harness-setup/references/files-shared.md` (`AI_TASK_GUIDE.md` template) let a feature touching auth, sessions, secrets, PII, or untrusted input reach implementation without ever naming the concrete risk, so threats were only caught (expensively, as a rewrite) at `AI_REVIEW_CHECKLIST.md` time instead of (cheaply, as a sentence) at spec time. Added a `Security considerations` line to both spec-format templates, a spec-gate rule requiring it be filled for security-sensitive features, a first bullet in `AI_REVIEW_CHECKLIST.md`'s Security section verifying every named risk was actually addressed, a first bullet in `security.md` stating the plan-not-just-check principle, and matching language in `knowledge-bundle.md`'s `agent-rules.md` template (Security-sensitive code + Spec-before-code sections). Profile-specific files (`profile-go.md`, `profile-nodejs.md`, `profile-nuxt.md`) only link to `AI_TASK_GUIDE.md` and needed no change. / Spec gate trong `skills/task-workflow/SKILL.md` và bản sao ở `skills/bigin-harness-setup/references/files-shared.md` (template `AI_TASK_GUIDE.md`) từng cho phép một tính năng đụng đến auth, session, secrets, PII, hoặc input không tin cậy đi vào implementation mà chưa từng nêu rủi ro cụ thể, nên các nguy cơ chỉ bị phát hiện (tốn kém, phải viết lại) ở bước `AI_REVIEW_CHECKLIST.md` thay vì (rẻ, chỉ một câu) ngay lúc viết spec. Đã thêm dòng `Security considerations` vào cả hai template định dạng spec, một quy tắc ở spec gate yêu cầu điền dòng này cho các tính năng nhạy cảm về bảo mật, một mục đầu tiên trong phần Security của `AI_REVIEW_CHECKLIST.md` để xác nhận mọi rủi ro đã nêu đều được xử lý, một mục đầu tiên trong `security.md` nêu nguyên tắc lên kế hoạch chứ không chỉ kiểm tra, và nội dung tương ứng trong template `agent-rules.md` của `knowledge-bundle.md` (mục Security-sensitive code và Spec-before-code). Các file theo profile (`profile-go.md`, `profile-nodejs.md`, `profile-nuxt.md`) chỉ link tới `AI_TASK_GUIDE.md` nên không cần sửa.

  ```patch
  target: AI_TASK_GUIDE.md
  anchor: "Skip this for: bug fixes, copy changes, config tweaks, changes ≤20 lines of logic."
  insert: after
  ---
  If the feature touches auth, sessions, secrets, PII, or untrusted input (user-controlled data, URLs, redirects, file paths), the spec's Security considerations must name the concrete risks — see `.claude/rules/security.md`. Don't defer security to the post-implementation review; a threat found at spec time is a sentence, the same one found after code review is a rewrite.
  ```
  ```patch
  target: AI_TASK_GUIDE.md
  anchor: "Edge cases: {anything that could go wrong}"
  insert: after
  ---
  Security considerations: {who/what is trusted, what input is attacker-controlled, what could go wrong if it's abused — or "N/A, no auth/secrets/PII/untrusted-input surface" if genuinely none}
  ```
  ```patch
  target: AI_REVIEW_CHECKLIST.md
  anchor: "## Security"
  insert: after
  ---
  - [ ] Every risk named in the spec's Security considerations section was actually addressed
  ```
  ```patch
  target: .claude/rules/security.md
  anchor: "# Security Rules"
  insert: after
  ---
  - **Plan for it, don't just check for it.** Specs for features touching auth, sessions, secrets, PII, or untrusted input must include a Security considerations section (see `AI_TASK_GUIDE.md`) naming concrete risks before implementation starts — not just at review time.
  ```
  ```patch
  target: knowledge/constraints/agent-rules.md
  anchor: "Anything touching auth, secrets, or PII goes through `.claude/rules/security.md` before merging."
  insert: replace
  ---
  Anything touching auth, secrets, or PII must have its security considerations named in the spec (see `AI_TASK_GUIDE.md`) before implementation starts, and goes through `.claude/rules/security.md` before merging.
  ```
  ```patch
  target: knowledge/constraints/agent-rules.md
  anchor: "Non-trivial features need an approved spec first — see `AI_TASK_GUIDE.md`. Don't start implementation on an unapproved spec."
  insert: replace
  ---
  Non-trivial features need an approved spec first — see `AI_TASK_GUIDE.md`. The spec must include a Security considerations section for features touching auth, secrets, PII, or untrusted input. Don't start implementation on an unapproved spec.
  ```

## [1.22.11] - 2026-07-04

### Added

- **No way to propagate a template change into already-scaffolded repos except full overwrite or hand-editing / không có cách áp dụng thay đổi template vào các repo đã scaffold sẵn ngoài ghi đè toàn bộ hoặc sửa tay:** `bigin-harness-setup`'s Phase 1 only offered `yes` (overwrite every governance file, discarding repo-specific edits) or `new` (skip anything existing, so template fixes never land). Propagating v1.22.10's security-considerations change into an existing repo required manually porting four diffs by hand. Added `INSTALL_MODE=patch` (Phase 1a): reads a new `.claude/harness-version` stamp (written on every fresh/overwrite setup, Phase 5-3c) to find the repo's starting version, walks `CHANGELOG.md` entries up to the current version, and applies only the fenced ` ```patch ` blocks those entries carry — each a `target`/`anchor`/`insert (after|before|replace)`/content operation applied via exact string match, never fuzzy. An anchor that doesn't match (likely hand-edited) is skipped and flagged for manual review rather than guessed at. `.claude/rules/skill-authoring.md` documents the `patch`-block convention for future changelog entries; this entry and v1.22.10's are retrofitted with them as the first working examples. / Phase 1 của `bigin-harness-setup` trước đây chỉ có `yes` (ghi đè toàn bộ file governance, mất hết sửa tay riêng của repo) hoặc `new` (bỏ qua mọi thứ đã tồn tại, nên các fix template không bao giờ được áp dụng). Để áp dụng thay đổi security-considerations của v1.22.10 vào một repo đã có sẵn, phải tự tay port bốn diff. Đã thêm `INSTALL_MODE=patch` (Phase 1a): đọc dấu phiên bản mới `.claude/harness-version` (được ghi ở mỗi lần setup mới/ghi đè, Phase 5-3c) để biết phiên bản khởi điểm của repo, duyệt qua các mục trong `CHANGELOG.md` đến phiên bản hiện tại, và chỉ áp dụng các khối ` ```patch ` mà các mục đó mang theo — mỗi khối là một thao tác `target`/`anchor`/`insert (after|before|replace)`/nội dung, áp dụng bằng khớp chuỗi chính xác, không khớp mờ. Một anchor không khớp (khả năng đã bị sửa tay) sẽ bị bỏ qua và đánh dấu để xem lại thủ công thay vì đoán mò. `.claude/rules/skill-authoring.md` ghi lại quy ước khối `patch` cho các mục changelog sau này; mục này và mục v1.22.10 được bổ sung khối patch làm ví dụ hoạt động đầu tiên.

## [1.22.9] - 2026-07-04

### Changed

- **`task-workflow`'s spec format had no explicit testing guidance / định dạng spec của `task-workflow` chưa có hướng dẫn kiểm thử tường minh:** the spec template in `skills/task-workflow/SKILL.md` covered what/inputs-outputs/edge-cases/not-in-scope but never asked the author to state how the change would be tested, so test coverage was decided ad hoc at Verify time instead of planned up front. Added a `Testing strategy` line to the spec format, requiring the spec to name what gets tested (unit/integration/manual) and which edge cases get coverage before implementation starts. / Template spec trong `skills/task-workflow/SKILL.md` đã có what/inputs-outputs/edge-cases/not-in-scope nhưng chưa yêu cầu nêu rõ cách kiểm thử, nên phạm vi test bị quyết định tuỳ hứng ở bước Verify thay vì lên kế hoạch từ đầu. Đã thêm dòng `Testing strategy` vào định dạng spec, yêu cầu nêu rõ những gì sẽ được test (unit/integration/manual) và edge case nào được bao phủ trước khi bắt đầu implement.

## [1.22.8] - 2026-07-04

### Fixed

- **`ci.md`'s GitHub Actions were pinned by mutable major-version tag, not a commit SHA / Các GitHub Actions trong `ci.md` được pin theo tag phiên bản chính không cố định, không phải SHA commit:** `skills/bigin-harness-setup/references/ci.md` used `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, and `actions/setup-go@v5` — floating tags that can be repointed by the action owner, a supply-chain risk flagged by a `semgrep` scan of a scaffolded project. Phase 5.6 copies this file verbatim into every new project's `.github/workflows/ci.yml`, so the finding reproduced on every harness-setup run. All four are now pinned to the commit SHA of their latest release within the same major line, with a trailing `# vX.Y.Z` comment for readability — no behavior change, same major versions. / `skills/bigin-harness-setup/references/ci.md` dùng `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`, và `actions/setup-go@v5` — các tag không cố định mà chủ action có thể trỏ lại, một rủi ro chuỗi cung ứng được phát hiện qua scan `semgrep` trên một project đã scaffold. Phase 5.6 copy file này y nguyên vào `.github/workflows/ci.yml` của mọi project mới, nên lỗi này lặp lại ở mỗi lần chạy harness-setup. Cả bốn action giờ được pin theo SHA commit của bản release mới nhất trong cùng nhánh phiên bản chính, kèm comment `# vX.Y.Z` để dễ đọc — không thay đổi hành vi, vẫn cùng major version.

## [1.22.7] - 2026-07-04

### Fixed

- **Generated `.mjs` guard/tool scripts needed a manual lint fix on every scaffold / script `.mjs` sinh ra cần sửa lint thủ công mỗi lần scaffold:** `tools/context_budget.mjs`, `tools/knowledge_validate.mjs` (both in `references/knowledge-bundle.md` and `references/budget-gate.md`), and `.claude/guards/bash-guard.mjs` (`references/hook-guard.md`) were written with double-quoted strings and semicolons, but `@nuxt/eslint`'s default (antfu-style) config requires single quotes, no semicolons, and `arrow-parens: as-needed`. Every `bigin-harness-setup` run on a nuxt profile therefore failed `pnpm lint` on these three files immediately after scaffold, forcing a manual `eslint --fix` round-trip. All three templates now match the antfu style exactly, verified with `npx eslint` (exit 0) against a live scaffolded project. / `tools/context_budget.mjs`, `tools/knowledge_validate.mjs` (trong `references/knowledge-bundle.md` và `references/budget-gate.md`), và `.claude/guards/bash-guard.mjs` (`references/hook-guard.md`) được viết với chuỗi nháy kép và dấu chấm phẩy, nhưng cấu hình mặc định của `@nuxt/eslint` (kiểu antfu) yêu cầu nháy đơn, không chấm phẩy, và `arrow-parens: as-needed`. Vì vậy mỗi lần chạy `bigin-harness-setup` trên profile nuxt đều khiến `pnpm lint` fail ngay trên ba file này sau khi scaffold, buộc phải chạy `eslint --fix` thủ công. Cả ba template giờ khớp chính xác kiểu antfu, đã xác minh bằng `npx eslint` (exit 0) trên một project đã scaffold thật.

## [1.22.6] - 2026-07-04

### Changed

- **Sonnet 5 tuning: explicit effort levels and mechanical-skill steering / tinh chỉnh Sonnet 5: mức effort tường minh và chỉ dẫn máy móc:** `nuxt-scaffold` and `session-handoff` now carry `effort: low` frontmatter plus a steering line right after the H1 telling the model not to deliberate — both are mechanical (gather config/state, write it, run or relay). `bigin-harness-setup` now carries `effort: medium`, reflecting its heavier judgment calls (profile detection, conflict handling); `task-workflow` and `sprint-distill` are left without an effort field since they require open-ended judgment throughout. Also added a "Coverage note" to the code-reviewer agent template in `references/files-shared.md` telling it to report borderline findings with a confidence/severity level instead of silently dropping them, flagged `sprint-distill`'s Phase 1 input-gathering as a candidate for `context: fork` (non-interactive, can produce large git log/diff output — untested, not yet adopted), and added a skill-authoring rule that instructions meant to apply to every item (profile/file/case) must say so explicitly rather than being stated once. / `nuxt-scaffold` và `session-handoff` giờ có frontmatter `effort: low` cùng một dòng chỉ dẫn ngay sau tiêu đề H1 yêu cầu model không suy luận — cả hai đều là việc máy móc (thu thập cấu hình/trạng thái, ghi ra, chạy hoặc chuyển tiếp kết quả). `bigin-harness-setup` giờ có `effort: medium`, phản ánh việc phải phán đoán nhiều hơn (nhận diện profile, xử lý xung đột); `task-workflow` và `sprint-distill` không có trường effort vì cần phán đoán mở xuyên suốt. Đồng thời thêm mục "Coverage note" vào template agent code-reviewer trong `references/files-shared.md`, yêu cầu báo cáo các phát hiện chưa chắc chắn kèm mức độ tin cậy/nghiêm trọng thay vì âm thầm bỏ qua; đánh dấu bước thu thập input ở Phase 1 của `sprint-distill` là ứng viên cho `context: fork` (không tương tác, có thể sinh git log/diff lớn — chưa kiểm chứng, chưa áp dụng); và thêm quy tắc skill-authoring yêu cầu chỉ dẫn áp dụng cho mọi mục (profile/file/case) phải nói rõ ràng thay vì chỉ nêu một lần.

## [1.22.5] - 2026-07-03

### Fixed

- **`knowledge_validate.mjs` template needed a manual lint fix on every scaffold / template `knowledge_validate.mjs` cần sửa lint thủ công mỗi lần scaffold:** the Knowledge Bundle validator template in `references/knowledge-bundle.md` used an empty `catch {}` block, which ESLint's `no-empty` rule flags with no autofix available — forcing a manual rewrite during every `bigin-harness-setup` run that opts into the Knowledge Bundle on a nuxt profile. The catch block now assigns `isDir = false` instead of being empty, matching the fix pattern ESLint required, so scaffolded repos pass lint without an extra round-trip. / Template validator Knowledge Bundle trong `references/knowledge-bundle.md` dùng khối `catch {}` rỗng, bị rule `no-empty` của ESLint gắn cờ mà không có autofix — buộc phải sửa thủ công mỗi lần chạy `bigin-harness-setup` có bật Knowledge Bundle trên profile nuxt. Khối catch giờ gán `isDir = false` thay vì để rỗng, khớp với cách sửa mà ESLint yêu cầu, nên repo vừa scaffold pass lint mà không cần sửa thêm.

## [1.22.4] - 2026-07-03

### Changed

- **`nuxt-scaffold` scaffolded apps kept the upstream template's default font / app scaffold ra vẫn giữ font mặc định của template gốc:** every `ui-templates` repo ships its own `--font-sans` (`'Public Sans'` in most, `'Instrument Sans'` in `landing`). `scaffold.mjs` now regex-replaces whatever's quoted after `--font-sans` in `app/assets/css/main.css` with `'Google Sans'` (BigIn brand default), applied uniformly across every template; fails loudly if `--font-sans` isn't found rather than guessing. / Mỗi repo `ui-templates` có `--font-sans` riêng (`'Public Sans'` ở hầu hết, `'Instrument Sans'` ở `landing`). `scaffold.mjs` giờ thay thế giá trị sau `--font-sans` trong `app/assets/css/main.css` thành `'Google Sans'` (font mặc định thương hiệu BigIn), áp dụng đồng nhất cho mọi template; báo lỗi rõ ràng nếu không tìm thấy `--font-sans` thay vì đoán vị trí.

## [1.22.3] - 2026-07-03

### Fixed

- **`bigin-harness-setup` questions scattered across the run, reading as "asks too much" / câu hỏi rải rác trong suốt quá trình chạy, tạo cảm giác "hỏi quá nhiều":** the Knowledge Bundle, CI config, and code-reviewer-agent prompts each fired late, mid-way through file generation — well after the user thought they were done answering. Added a new Phase 1.5 that bundles the Knowledge Bundle and CI config questions (plus the existing-harness conflict question, when it applies) into a single `AskUserQuestion` call, resolved before any file is written; when Phase 0.5's nuxt scaffold also runs, its own question batch and Phase 1.5's fire back-to-back in the same turn. Also dropped the code-reviewer-agent question outright — it's a read-only, low-risk file, now always added and just mentioned in the Phase 7 summary. CI config now pre-selects a default from `git remote get-url origin` (github.com/gitlab.com → that provider; otherwise `both`) instead of a cold, unweighted choice. / Các câu hỏi Knowledge Bundle, CI config, và code-reviewer agent trước đây đều hỏi muộn, giữa lúc đang sinh file — sau khi người dùng tưởng đã trả lời xong. Đã thêm Phase 1.5 gộp câu hỏi Knowledge Bundle và CI config (cùng câu hỏi xung đột harness sẵn có, nếu có) vào một lệnh gọi `AskUserQuestion` duy nhất, giải quyết trước khi ghi bất kỳ file nào; khi Phase 0.5 (scaffold nuxt) cũng chạy, bộ câu hỏi của nó và của Phase 1.5 hỏi liên tiếp trong cùng lượt. Đồng thời bỏ hẳn câu hỏi code-reviewer agent — vì đây là file chỉ đọc, rủi ro thấp, giờ luôn được thêm và chỉ nhắc trong tóm tắt Phase 7. CI config giờ tự chọn sẵn giá trị mặc định từ `git remote get-url origin` (github.com/gitlab.com → nhà cung cấp tương ứng; nếu không xác định được → `both`) thay vì một lựa chọn ngang hàng không gợi ý.
- **`nuxt-scaffold` left Nuxt DevTools enabled in scaffolded apps / `nuxt-scaffold` để Nuxt DevTools bật mặc định trong app vừa scaffold:** the `ui` template ships `devtools: { enabled: true }`; `scaffold.mjs` now flips it to `enabled: false` during the `nuxt.config.ts` merge step (BFF preset convention — devtools off by default), failing loudly if the literal isn't found rather than guessing an insertion point. / Template `ui` mặc định sinh ra `devtools: { enabled: true }`; `scaffold.mjs` giờ tự chuyển thành `enabled: false` trong bước merge `nuxt.config.ts` (quy ước BFF preset — tắt devtools mặc định), báo lỗi rõ ràng nếu không tìm thấy literal này thay vì đoán vị trí chèn.

## [1.22.2] - 2026-07-03

### Fixed

- **`nuxt-scaffold` Step 2 confirm shown as a broken markdown table / bảng xác nhận hiển thị lỗi:** the confirm step told the model to "show a summary table," but `AskUserQuestion`'s question text only renders `**bold**`, not table syntax — pipes and dashes showed up literally in the widget. Reworded to use a bullet list instead. / Bước xác nhận yêu cầu "hiển thị bảng tóm tắt", nhưng vùng câu hỏi của `AskUserQuestion` chỉ render `**in đậm**`, không render cú pháp bảng — dấu `|` và `-` hiển thị nguyên văn trong widget. Đã đổi sang danh sách gạch đầu dòng.

## [1.22.1] - 2026-07-03

### Fixed

- **`nuxt-scaffold` Step 2 still split into two `AskUserQuestion` calls / vẫn tách thành 2 lệnh gọi `AskUserQuestion`:** the numbered 1-4 question list read as "one tool call per item," so even after v1.21.6 bundled everything into one nominal "Call 1," the model kept emitting 2 separate `AskUserQuestion` invocations (2 questions each) in the same turn. Reworded to state the exact single-array shape (`questions: [ {...}, {...}, {...}, {...} ]`) and explicitly forbid a second invocation in the same turn, and dropped the vestigial "Call 1" numbering now that there's no "Call 2" left after v1.22.0. / Danh sách câu hỏi đánh số 1-4 khiến model hiểu là "mỗi mục một lệnh gọi", nên dù v1.21.6 đã gộp vào một "Call 1" trên danh nghĩa, model vẫn phát ra 2 lệnh `AskUserQuestion` riêng trong cùng lượt. Đã viết lại để nêu rõ hình dạng mảng `questions` duy nhất và cấm lệnh gọi thứ hai trong cùng lượt, đồng thời bỏ đánh số "Call 1" thừa vì không còn "Call 2".

## [1.22.0] - 2026-07-03

### Removed

- **`nuxt-scaffold` optional-module opt-in (`image`/`content`) / bỏ tuỳ chọn cài module bổ sung:** dropped Step 2's optional-modules `AskUserQuestion` call, the `optionalModules` config field, and `scaffold.mjs`'s Stage 2b (`nuxi module add image|content`, the `sharp`/`better-sqlite3` build-approval handling). The scaffolder never installs `@nuxt/image` or `@nuxt/content` now — add them by hand later if a project needs them. / Bỏ câu hỏi Step 2 về module tuỳ chọn, trường cấu hình `optionalModules`, và Stage 2b trong `scaffold.mjs`. Bộ scaffold không còn cài `@nuxt/image`/`@nuxt/content` — thêm thủ công sau nếu cần.

## [1.21.6] - 2026-07-03

### Fixed

- **`nuxt-scaffold` Step 2 questions still firing in two lists at once, despite v1.21.1 / câu hỏi Step 2 vẫn hiện hai danh sách cùng lúc dù đã sửa ở v1.21.1:** the v1.21.1 fix only added wording ("exactly one `AskUserQuestion` call per turn") — an executing agent could still, and did, batch two calls into the same turn since nothing structurally prevented it. Restructured Step 2 to bundle the 4 independent questions (template, primary color, neutral color, dependency freshness) into a **single** `AskUserQuestion` call using the tool's native up-to-4-questions-per-call support — one widget, no batching to guard against. Only "optional modules" (which depends on the template answer) remains a separate, conditional second call. / Bản sửa ở v1.21.1 chỉ thêm chỉ dẫn bằng lời ("mỗi lượt chỉ một lệnh gọi") — agent thực thi vẫn có thể gộp hai lệnh gọi vào cùng một lượt, và đã xảy ra. Tái cấu trúc Step 2: gộp 4 câu hỏi độc lập (template, màu chính, màu nền, độ mới phiên bản) vào **một** lệnh gọi `AskUserQuestion` duy nhất (công cụ hỗ trợ tối đa 4 câu hỏi/lệnh gọi) — một widget, không còn nguy cơ gộp lệnh. Chỉ "optional modules" (phụ thuộc câu trả lời template) vẫn là lệnh gọi thứ hai, có điều kiện.

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


