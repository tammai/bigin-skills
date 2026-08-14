# CLAUDE.md

## What this repo is

A **plugin** (`bigin-skills`) for **Claude Code and Cursor** — a collection of skills installed into other projects, not executed here. No build step, test suite, or dev server. All work is authoring markdown (and small guard scripts) in the right structure.

## Structure

```
.claude-plugin/           ← plugin.json (version lives here) + marketplace.json
.cursor-plugin/           ← Cursor's manifests; declare paths into skills/ + agents/, no second copy
.claude/rules/            ← this repo's own path-scoped authoring rules
skills/<name>/SKILL.md    ← one skill per directory
skills/<name>/references/ ← supporting templates, relative to that skill
agents/<name>.md          ← plugin-level subagent definitions (spawned via Agent tool, not invoked as skills)
tools/context_budget.mjs   ← budget gate (also templated for target repos)
scripts/git-hooks/        ← pre-commit running the budget gate
```

Every skill's `description:` frontmatter is already loaded on every turn, so there's no inventory table here — the generated skills/agents tables live in [README.md](README.md), and each `SKILL.md` covers how that skill works. Authoring conventions: `.claude/rules/skill-authoring.md` (loads when editing `skills/` or `agents/`).

## Gotchas

- A `skills/*/SKILL.md` `description:` is always-loaded context for every session in every repo that installs this plugin. The budget gate caps it at 350 chars.
- `references/*.md` under `bigin-harness-setup` is copied **verbatim** into target repos. Changing one needs a CHANGELOG `patch` block, or already-scaffolded repos never receive it.
- Generated `AI_TASK_GUIDE.md` is deliberately just a pointer to `task-workflow`. Don't grow it back into a second copy of the workflow — that's how the two drifted before.
- The guard scripts in `references/hook-guard.md` are load-bearing, and one body serves both Claude Code and Cursor via `lib/hook-io.mjs` — never fork a guard per host. `.claude/rules/skill-authoring.md` lists the exact cases each one must still block and allow, on both payload shapes.

## Versioning

Version lives in `.claude-plugin/plugin.json` and is the source of truth for the other three manifests (`.cursor-plugin/plugin.json`, both `marketplace.json`s) — bump them together; `docs_sync.mjs --check` fails the commit on a mismatch. Bump when publishing changes and add a `CHANGELOG.md` entry. **Docs-only passes are exempt** — copy edits, restructuring, link fixes: ship them as a `docs:` commit with no bump and no changelog entry, and let the commit message be the record. Before a **major or minor** bump, find and fix all stale docs first — the skills/agents tables in `README.md` are generated (run `node tools/docs_sync.mjs`), so sweep only the remaining manual surfaces: prose, cross-references, the README tree diagram, `SKILL.md`s, and both `marketplace.json`s. Patch bumps don't require this sweep. Pre-commit gates: activate once with `git config core.hooksPath scripts/git-hooks` (runs the budget gate + `docs_sync.mjs --check`).

## Session Handoff

When approaching usage limits, use the session-handoff skill to save state to `.claude/memory/SESSION.md`. On session start, if found with `status: in-progress`, prompt to resume or start fresh.
