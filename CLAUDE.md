# CLAUDE.md

## What this repo is

A **Claude Code plugin** (`bigin-skills`) — a collection of skills installed into other projects, not executed here. No build step, test suite, or dev server. All work is authoring markdown (and small guard scripts) in the right structure.

## Structure

```
.claude-plugin/           ← plugin.json (version lives here) + marketplace.json
.claude/rules/            ← this repo's own path-scoped authoring rules
skills/<name>/SKILL.md    ← one skill per directory
skills/<name>/references/ ← supporting templates, relative to that skill
tools/context_budget.mjs   ← budget gate (also templated for target repos)
scripts/git-hooks/        ← pre-commit running the budget gate
```

## Skills

| Skill | Purpose |
|---|---|
| `bigin-harness-setup` | Scaffolds AI workflow harness into target repos (nuxt/go/nodejs); three-tier loading; idempotent |
| `task-workflow` | On-demand task workflow: scope → spec → implement → verify → review (Tier 3) |
| `nuxt-scaffold` | Scaffolds Nuxt 4 BFF app from scratch via `npm create nuxt@latest` |
| `sprint-distill` | End-of-sprint distillation into `knowledge/` + bigin-skills; compresses, never appends |
| `session-handoff` | Session state persistence to `.claude/memory/SESSION.md` |

Details live in each skill's own `SKILL.md` — read it when working on that skill. Authoring conventions are in `.claude/rules/skill-authoring.md` (loads when editing `skills/`).

## Versioning

Version lives in `.claude-plugin/plugin.json`. Bump it when publishing changes and add a `CHANGELOG.md` entry. Pre-commit budget gate: activate once with `git config core.hooksPath scripts/git-hooks`.

## Session Handoff

When approaching usage limits, use the session-handoff skill to save state to `.claude/memory/SESSION.md`. On session start, if found with `status: in-progress`, prompt to resume or start fresh.
