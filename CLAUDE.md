# CLAUDE.md

## What this repo is

A **Claude Code plugin** (`bigin-skills`) — a collection of skills installed into other projects, not executed here. No build step, test suite, or dev server. All work is authoring markdown (and small guard scripts) in the right structure.

## Structure

```
.claude-plugin/           ← plugin.json (version lives here) + marketplace.json
.claude/rules/            ← this repo's own path-scoped authoring rules
skills/<name>/SKILL.md    ← one skill per directory
skills/<name>/references/ ← supporting templates, relative to that skill
agents/<name>.md          ← plugin-level subagent definitions (spawned via Agent tool, not invoked as skills)
tools/context_budget.mjs   ← budget gate (also templated for target repos)
scripts/git-hooks/        ← pre-commit running the budget gate
```

## Skills

| Skill | Purpose |
|---|---|
| `bigin-harness-setup` | Scaffolds AI workflow harness into target repos (nuxt/go/nodejs/next); three-tier loading; idempotent |
| `task-workflow` | On-demand task workflow: scope → spec → plan file → implement → verify → review → cleanup (Tier 3) |
| `nuxt-scaffold` | Scaffolds Nuxt 4 BFF app from scratch via `npm create nuxt@latest` |
| `next-scaffold` | Scaffolds Next.js App Router BFF app from scratch via `create-next-app` + shadcn/ui |
| `go-scaffold` | Scaffolds a contract-first Go REST API (oapi-codegen + sqlc + chi + Postgres); runs codegen + build/vet/test itself |
| `nodejs-scaffold` | Scaffolds a contract-first Node.js REST API (openapi-typescript + Drizzle/drizzle-kit + Fastify + Postgres); runs codegen + lint/typecheck/build/test itself |
| `nuxt-ui-figma-handoff` | Extracts a Nuxt UI Figma design handoff into main.css theme tokens + app.config.ts component overrides |
| `sprint-distill` | End-of-sprint distillation into `knowledge/` + bigin-skills; compresses, never appends |
| `session-handoff` | Session state persistence to `.claude/memory/SESSION.md` |
| `write-tests` | On-demand test authoring: style-match, scope, edge-case list, TDD ordering, no unnecessary mocking |
| `debug-workflow` | On-demand systematic debugging: root cause → pattern analysis → hypothesis → fix+validation (Tier 3) |
| `model-router` | Scores task complexity via a deterministic rubric and routes execution to one of three subagents (`quick-executor`/`standard-worker`/`deep-architect`) spawned via the Agent tool |

## Agents

`agents/<name>.md` — plugin-level subagents spawned via the Agent tool (`bigin-skills:<name>`), not invoked as skills.

| Agent | Purpose |
|---|---|
| `quick-executor` | haiku/low — mechanical, single-file, low-risk tasks. Routed by `model-router`. |
| `standard-worker` | sonnet/medium — default tier, most feature/bug-fix work. Routed by `model-router`. |
| `deep-architect` | opus/high — architectural decisions, contract/schema changes, full-spec tier. Routed by `model-router`. |
| `security-reviewer` | opus/high, read-only (`Read, Grep, Glob, Bash`) — auth/session/secrets/PII review. Opt-in: spawn explicitly, not routed by `model-router`. |

Details live in each skill's own `SKILL.md` — read it when working on that skill. Authoring conventions are in `.claude/rules/skill-authoring.md` (loads when editing `skills/`).

## Versioning

Version lives in `.claude-plugin/plugin.json`. Bump it when publishing changes and add a `CHANGELOG.md` entry. Before a **major or minor** bump, find and fix all stale docs first (file lists, counts, cross-references in `README.md`, `CLAUDE.md`, `SKILL.md`s, `marketplace.json`) — patch bumps don't require this sweep. Pre-commit budget gate: activate once with `git config core.hooksPath scripts/git-hooks`.

## Session Handoff

When approaching usage limits, use the session-handoff skill to save state to `.claude/memory/SESSION.md`. On session start, if found with `status: in-progress`, prompt to resume or start fresh.
