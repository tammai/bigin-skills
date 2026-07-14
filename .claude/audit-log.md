# Harness Audit Log

## 2026-07-06

Docs checked: skills.md, best-practices.md, hooks.md, plugins-reference.md, sub-agents.md, memory.md — all fetched successfully, no failures.

New findings (initial run): 6 actionable (2 drift, 4 opportunity) + 1 informational note.
- drift: `code-reviewer` agent template set `agentType: general-purpose`, not a real subagent frontmatter field — inert, and left the "read-only" claim unenforced (`skills/bigin-harness-setup/references/files-shared.md`)
- drift: `effort:` inconsistently pinned — `sprint-distill` and `task-workflow` inherited session effort while the other 3 skills pinned it
- opportunity: `sprint-distill` Phase 1 self-flagged as an unadopted `context: fork` candidate (large git log/diff scans)
- opportunity: no skill used `allowed-tools` to pre-approve safe repeated commands
- opportunity: `bigin-harness-setup/SKILL.md` at 464 lines, over the ~400-line heuristic
- opportunity: only `task-workflow` had `evals/evals.json`; `bigin-harness-setup`, `nuxt-scaffold`, `sprint-distill` lacked should-trigger/should-not-trigger coverage

Closed this run (re-verified after fixes applied same day):
- `code-reviewer` template now sets `tools: Read, Grep, Glob, Bash`; `skill-authoring.md` convention updated to match — Closed
- `effort:` pinned on all 5 skills (`sprint-distill: high`, `task-workflow: low`) — Closed
- `sprint-distill` Phase 1 steps 1-4 delegated to an Agent-tool subagent (not skill-level `context: fork`, which would have broken step 5's `AskUserQuestion`); step 5 runs after in the main conversation — Closed
- `allowed-tools` added to `bigin-harness-setup`, `nuxt-scaffold`, `sprint-distill` — Closed
- `evals/evals.json` added for `bigin-harness-setup`, `nuxt-scaffold`, `sprint-distill` — Closed
- `bigin-harness-setup/SKILL.md` reduced 464→434 lines (Phase 1a moved to `references/patch-mode.md`) — Improved, not fully closed: still above the ~400 heuristic; remaining content (Phase 5 enforcement, Phase 7 summary template) judged to be core per-run instructions rather than reference material, so not moved further. Re-flag only if it grows again or a genuinely reference-shaped section emerges.

Deferred (logged, not acted on): none.

## 2026-07-13

Docs checked: skills.md, best-practices.md, hooks.md, plugins-reference.md, sub-agents.md, memory.md — all fetched successfully, no failures.

New findings: 5 actionable (1 drift, 4 opportunity).
- drift: `session-handoff` was the only skill (of 8) with no `evals/evals.json`
- opportunity: `session-handoff` had no `allowed-tools` despite fixed repeated commands (`git status`, `git diff --stat`, `mv SESSION.md ...`)
- opportunity: nuxt profile's `settings.json` template omitted `Bash(git push:*)`, present in go/nodejs templates — inconsistent permission friction across profiles
- opportunity (low): `bigin-harness-setup/SKILL.md` grew 434→442 lines since the 2026-07-06 audit, still over the ~400-line heuristic
- opportunity: no dedicated security-reviewer subagent, despite `sub-agents.md`'s own worked example being exactly that pattern; only a generic `code-reviewer` agent was generated, with security review enforced solely as spec-time prose

Closed this run:
- `session-handoff/evals/evals.json` added (7 should-trigger / 5 should-not-trigger cases) — Closed
- `allowed-tools: Bash(git status) Bash(git diff --stat) Bash(mv SESSION.md *)` added to `session-handoff/SKILL.md` — Closed
- `Bash(git push:*)` added to the nuxt profile `settings.json` template (`references/profile-nuxt.md`) and `nuxt-scaffold`'s `claude-settings.json` merge template, matching go/nodejs — Closed
- New opt-in `security-reviewer` agent: `SECURITY_REVIEWER` decision added to Phase 1.5 (and Phase 0.5's nuxt-empty-repo batch), generation wired at Phase 5-4b, template added to `references/files-shared.md` (`model: opus`, `tools: Read, Grep, Glob, Bash`, scoped to auth/session/secrets/PII), Idempotency Rules + Output Checklist + Phase 7 summary updated, `skill-authoring.md`'s model-convention line updated to name this as an explicit exception (`security-reviewer` also gets `opus`) — Closed

Deferred (logged, not acted on):
- `bigin-harness-setup/SKILL.md` size (442 lines) — user chose to leave as-is; re-flag only if it grows further or a genuinely reference-shaped section emerges (same standing criterion as the 2026-07-06 note).

Not yet done: CHANGELOG.md entry + version bump for the security-reviewer addition — deferred to the next commit per this repo's own pre-commit convention (scan stale docs → changelog → version bump → confirm → commit), not done mid-audit.

## 2026-07-13 (follow-up)

Docs checked: skills.md, best-practices.md, hooks.md, plugins-reference.md, sub-agents.md, memory.md — all fetched successfully, no failures.

New findings: 5 actionable (all opportunity, no drift).
- opportunity: `bigin-harness-setup/SKILL.md` regressed 442→454 lines since the same-day earlier audit — the deferred item's own "re-flag if it grows further" criterion was met (git log confirmed the growth was legitimate new phases, not bloat, but two pure literal templates — Phase 7 summary, Output Checklist — were still safely externalizable)
- opportunity: `task-workflow` Step 5 (Verify) enforced "show actual output" via prose only; `best-practices.md` documents a `Stop` hook as the deterministic version of exactly this ask, and every other load-bearing rule in this harness already has a hook behind it
- opportunity: session-handoff's "check for in-progress SESSION.md on session start" was `CLAUDE.md` prose only; `hooks.md` documents `SessionStart` with an `additionalContext` output built for exactly this
- opportunity: `profile-nodejs.md` pre-approved `pnpm type-check` but not `pnpm typecheck`, while nuxt pre-approved both — same category as the git-push gap fixed in the prior audit, one instance slipped through
- opportunity (low): `code-reviewer`/`security-reviewer` agent templates didn't use the now-documented `memory: project` subagent field, re-discovering the same recurring findings every review

Closed this run (user approved all 5, one at a time):
- Extracted Phase 7 summary template + Output Checklist from `bigin-harness-setup/SKILL.md` into new `references/summary-checklist.md` — 454→390 lines (further grew slightly from 376 after wiring in the two new hooks below) — Closed
- Added `verify-gate.mjs` `Stop` hook (pnpm + go variants), skips on a clean tree, blocks (exit 2) on lint/typecheck/test failure; wired into all 3 profiles' `settings.json`, Phase 5-2e, `references/hook-guard.md`; `task-workflow`/`AI_TASK_GUIDE.md` Step 5 wording updated to point at it — Closed
- Added `session-resume-check.mjs` `SessionStart` hook, checks `.claude/memory/SESSION.md` for `status: in-progress`, injects `additionalContext`; wired into all 3 profiles' `settings.json`, Phase 5-2d, `references/hook-guard.md` — Closed
- Added `"Bash(pnpm typecheck:*)"` to `profile-nodejs.md`'s `permissions.allow` — Closed
- Added `memory: project` + a persistence-guidance sentence to both `code-reviewer` and `security-reviewer` agent templates (`files-shared.md`) — Closed

Verification: all 3 new/edited `settings.json` templates re-parsed as valid JSON with the expected `hooks` keys (`PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`); all 3 new guard scripts passed `node --check`; `session-resume-check.mjs` and the pnpm `verify-gate.mjs` functionally tested in a scratch git repo (no-SESSION.md / in-progress / complete states; clean-tree skip; dirty-tree block with exit 2 and failing-command output) — all behaved as designed.

CHANGELOG.md entry added and version bumped to 1.30.0 in the same pass (not deferred this time).

Deferred (logged, not acted on): none — all 5 findings from this run were approved and applied.

Noted but out of scope (not one of the 5 approved findings, not acted on): `skills/session-handoff/SKILL.md`'s "Integration with Harness Workflow" section (lines ~195-227) describes a "Phase 3 Stack Verification" / "architect, frontend-dev, qa agent roles" model that doesn't match `bigin-harness-setup`'s actual current Phase 0-8 structure or agent set (`code-reviewer`/`security-reviewer`) at all — looks like leftover drift from an older harness design. Flag for a future pass.

## 2026-07-15

Docs checked: skills.md, best-practices.md, hooks.md, plugins-reference.md, sub-agents.md, memory.md — all fetched successfully, no failures (though `hooks.md`/`hooks-guide.md` fetches were summarized/truncated on one specific point — see Verified note below).

Context: earlier the same day, `code-reviewer` and `security-reviewer` (both the `bigin-harness-setup`-scaffolded downstream templates and this repo's own plugin-level `agents/security-reviewer.md`) were removed entirely in favor of the built-in `/code-review`/`/security-review` skills — a deliberate decision made in conversation, not an audit finding. Several previously-Closed findings in this log that reference those agent templates (2026-07-06, 2026-07-13, 2026-07-13 follow-up) are now moot: the files they applied to no longer exist. Not re-litigated here.

New findings: 3 actionable (2 drift, 1 opportunity) + 1 verified-correct (no drift).
- drift: `bigin-harness-setup/SKILL.md` regrown 442→467 lines since the 2026-07-13 follow-up's re-flag threshold — the standing criterion was met again
- drift: `session-handoff/SKILL.md`'s "Integration with Harness Workflow" section (flagged out-of-scope last audit) — confirmed still wrong, and now additionally references an agent set (`code-reviewer`/`security-reviewer`) that no longer exists at all
- opportunity: `agents/standard-worker.md` referenced `debug-workflow`/`write-tests` by name in prose but didn't preload them via the subagent `skills:` frontmatter field, despite running in an isolated context that doesn't see the main conversation
- verified, no drift: `injection-scan-guard.mjs`'s use of `tool_response` for the PostToolUse tool-output field — official docs fetches couldn't confirm this field name (truncated each time), so confirmed directly against the installed Claude Code binary instead (`strings ~/.local/share/claude/versions/2.1.209 | grep tool_response` → `"tool_response": { "success": true }  // PostToolUse only`)

Also recorded, not a drift: docs' canonical subagent worked example (`best-practices.md`, `sub-agents.md`) is still a `security-reviewer` agent — this repo now deliberately diverges from that default pattern (see context above). Informational only.

Closed this run (user approved all 3, applied same pass):
- Extracted Phase 6's README-append templates from `bigin-harness-setup/SKILL.md` into `references/summary-checklist.md` (`## Phase 6 README Templates`) — 467→433 lines. Still above the ~400 heuristic; remaining content (Phase 5 enforcement, Phase 7 summary) judged core per-run instructions, same standing call as the 2026-07-13 follow-up — Closed
- `session-handoff/SKILL.md`'s stale "Integration with Harness Workflow" section replaced with a short "Mid-workflow saves" note (record the step in plain language, resumed skill re-derives progress from disk) — Closed
- Added `skills: [debug-workflow, write-tests]` to `agents/standard-worker.md` frontmatter (YAML list form, matching the documented example exactly rather than the untested comma-separated shorthand) — Closed

CHANGELOG.md entry added and version bumped to 1.35.1 in the same pass.

Deferred (logged, not acted on): none — all 3 findings from this run were approved and applied.
