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
  nuxt/                   ← bundled library skills (copied into target projects)
  nuxt-ui/
  pinia/
  pinia-colada/
  vue/
  vue-best-practices/
  vue-testing-best-practices/
  vitest/
  vueuse-functions/
  pnpm/
  cloudflare-pages/
  drizzle/
  nuxt-auth-utils/
  github-actions/
```

## How the harness skill works

`skills/bigin-webapp-harness/SKILL.md` is an 8-phase workflow:

| Phase | What happens |
|-------|-------------|
| 0 | Detect empty repo → set `scaffold_needed` flag |
| 1 | User picks project type (Fullstack MVP / SPA / Go Backend) |
| 2 | User selects agent roles from the catalog |
| 3 | Confirm stack + optional services (D1, R2, KV, auth) |
| 3.5 | Scaffold empty repo from `references/scaffold.md` (if needed) |
| 4 | Generate `.claude/agents/{role}.md` files in the target project |
| 5 | Copy bundled skills from this plugin's `skills/` into target project's `.claude/skills/` |
| 6 | Generate orchestrator skill at target `.claude/skills/webapp-harness/SKILL.md` |
| 7 | Validate structure, trigger tests, dry-run |

## Key reference files

- `references/agent-roles.md` — full role catalog + agent file templates per project type
- `references/scaffold.md` — exact files to create for each project type when scaffolding
- `references/skill-manifest.md` — which bundled skills get installed for each project type
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

**Skill install rules (Phase 5):**
- Skills are **copied**, never generated — always copy from `skills/{name}/` into target `.claude/skills/{name}/`
- Never overwrite an existing skill directory in the target project
- Go Backend projects get no bundled skills — they are generated inline from the `backend-go.md` spec

## Versioning

Version is in `.claude-plugin/plugin.json`. Bump it when publishing changes.

## Installation commands (for users of this plugin)

```
/plugin marketplace add tammai/bigin-webapp-harness
/plugin install bigin-webapp-harness@bigin
```

Direct copy (global skill only):
```bash
cp -r skills/bigin-webapp-harness ~/.claude/skills/bigin-webapp-harness
```
