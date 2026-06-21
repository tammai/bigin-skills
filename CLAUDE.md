# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **Claude Code plugin** — a collection of skills and agent definitions that are installed into other projects, not executed here. There is no build step, test suite, or dev server. All work is authoring markdown files in the right structure.

## Plugin structure

```
.claude-plugin/
  plugin.json        ← plugin metadata (name, version, author, keywords)
  marketplace.json   ← marketplace registry entry (used by /plugin marketplace)
skills/
  bigin-webapp-harness/   ← the main harness factory skill (globally registered)
    SKILL.md              ← 8-phase workflow (the core logic)
    references/           ← spec files loaded on demand during the workflow
```

All `references/` paths in SKILL.md are relative to `skills/bigin-webapp-harness/references/`.

## How the harness skill works

`skills/bigin-webapp-harness/SKILL.md` is an 8-phase workflow:

| Phase | What happens                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------- |
| 0     | Detect empty repo → set `scaffold_needed` flag                                                        |
| 1     | User picks project type (Fullstack MVP / SPA / Go Backend)                                            |
| 2     | User selects agent roles from the catalog                                                             |
| 3     | Confirm stack + optional services (D1, R2, KV, auth)                                                  |
| 3.5   | Scaffold empty repo from `references/scaffold.md` (if needed)                                         |
| 4     | Generate `.claude/agents/{role}.md` files in the target project                                       |
| 5     | Install library skills into target project via `find-skills`; generate project-specific skills inline |
| 6     | Generate orchestrator skill at target `.claude/skills/webapp-harness/SKILL.md`                        |
| 7     | Validate structure, trigger tests, dry-run                                                            |

## Key reference files

- `references/agent-roles.md` — full role catalog + agent file templates per project type
- `references/scaffold.md` — exact files to create for each project type when scaffolding
- `references/skill-manifest.md` — which skills get installed per project type (via find-skills)
- `references/orchestrator-template.md` — sub-agent orchestrator templates (A/B/C variants)
- `references/fullstack-mvp.md`, `references/spa-frontend.md`, `references/backend-go.md` — canonical stack specs

## Conventions when editing skills

**SKILL.md files:**

- Keep body ≤ 500 lines; move supporting detail into `references/`
- The `description:` frontmatter field is the trigger — make it specific and "pushy" (lists exact phrases that should activate it)
- Use bilingual section headers: `## Section Name / Tên phần`

**Agent definition files** (generated into target projects, but templated here):

- `architect` always gets `model: opus`; all other agents get `model: sonnet`
- QA agents must use `agentType: general-purpose` (not `Explore` — Explore is read-only)

**Scaffold rules (Phase 3.5) — Nuxt types:**

- Scaffold uses `pnpm create nuxt@latest . --template ui --packageManager pnpm --no-gitInit --no-install` then adds packages and writes configs on top
- Ask customization questions (app name, primary color, neutral color, font) **before** running any commands
- Runs `pnpm install` automatically at the end — project is ready to develop after scaffold
- `nuxt-auth-utils` is optional: add only when user enables auth in Phase 3
- Non-interactive flags required (no TTY in Claude's bash): `--no-gitInit`, `--no-install`; fallback: `--gitInit=false`

**Skill install rules (Phase 5):**

- Skills are **found and installed** via `Skill('find-skills', '{name}')` — never copied from a bundle
- Always prefer `affaan-m/everything-claude-code` as the find-skills source registry; fall back to other sources only if not found there
- If `find-skills` reports a skill is already installed, skip it silently
- Go Backend projects get no library skills — all skills are generated inline from the `backend-go.md` spec
- `drizzle` and `nuxt-auth-utils` are optional: install only when the user enables D1 or auth respectively

**Phase 7 skill trigger tests:**

- For each generated skill, produce 5 **should-trigger** queries (explicit + implicit, EN + VI) and 5 **should-NOT-trigger** near-miss queries (similar topic, wrong skill)
- A good near-miss: "Update the color theme" (ui-development vs state-management). A bad near-miss: "Write a poem" — obviously irrelevant, no test value.

**Orchestrator sub-agent pattern (generated into target projects):**

- `_workspace/` in the project root holds intermediate outputs; file naming: `{phase}_{agent}_{artifact}.{ext}` (e.g. `02_builder_components.md`)
- Setup agent runs sequentially first; builder agents run in parallel; QA agent runs last (sequential)

## Versioning

Version is in `.claude-plugin/plugin.json`. Bump it when publishing changes.

## Session Handoff / Chuyển tiếp phiên

When approaching usage limits or needing to pause work, use the session-handoff skill to save state.

**Auto-load at session start:**

- Check for `~/.claude/memory/SESSION.md`
- If found with `status: in-progress`, prompt: "Resume previous session or start fresh?"
- Display saved context (tasks, decisions, uncommitted changes) on resume

**Manual triggers:**

- `/save-session` — Save current state (tasks, decisions, uncommitted changes) to SESSION.md
- `/load-session` — Load and display SESSION.md
- `/complete-session` — Archive session as complete after work is done

**SESSION.md location:**

```
~/.claude/projects/-Users/tammai-bigin-bigin-skills/memory/SESSION.md
```

**During harness execution:**

- SESSION.md includes harness-specific state (current phase, project type, selected agents, progress)
- On resume, harness continues from the next uncompleted phase

## Installation commands (for users of this plugin)

```
/plugin marketplace add tammai/bigin-webapp-harness
/plugin install bigin-webapp-harness@bigin
```

Direct copy (global skill only):

```bash
cp -r skills/bigin-webapp-harness ~/.claude/skills/bigin-webapp-harness
```
