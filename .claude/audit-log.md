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
