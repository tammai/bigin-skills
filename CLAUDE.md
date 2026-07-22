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

<!-- gen:skills-table -->
| Skill                   | Purpose                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bigin-harness-setup`   | Scaffolds an AI workflow harness — CLAUDE.md brief, path-scoped rules, and enforcement gates (commit hooks + budget check). Profiles: nuxt, go, nodejs, next. |
| `task-workflow`         | On-demand task workflow (/task-workflow): scope → spec → plan (approved) → implement/verify loop (capped, independent verifier) → review → cleanup.           |
| `nuxt-scaffold`         | Scaffolds a Nuxt 4 BFF app from scratch via a deterministic Node.js script — npm create nuxt@latest + BFF preset + config/sample code. No GitHub clone.       |
| `next-scaffold`         | Scaffolds a Next.js App Router BFF app from scratch via a deterministic Node.js script — create-next-app + BFF preset + shadcn/ui. No GitHub clone.           |
| `go-scaffold`           | Scaffolds a production-ready Go REST API — contract-first (oapi-codegen + sqlc), chi router, Postgres. Runs codegen + build/vet/test itself.                  |
| `nodejs-scaffold`       | Scaffolds a production-ready Node.js REST API — contract-first (openapi-typescript + Drizzle), Fastify, Postgres. Runs codegen + lint/typecheck/test itself.  |
| `sprint-distill`        | End-of-sprint distillation: merged PRs + touched knowledge/ concepts → proposal-first knowledge/ and bigin-skills updates. Compresses, never just appends.    |
| `write-tests`           | On-demand test authoring (/write-tests): style-matches the nearest test file, lists edge cases first, TDD-orders logic, mocks only true I/O boundaries.       |
| `debug-workflow`        | On-demand systematic debugging (/debug-workflow): triage → fast path for obvious bugs, full guarded workflow for flaky/env/repeat-failure bugs.               |
| `model-router`          | Scores task complexity via a deterministic rubric and routes to quick-executor/standard-worker/deep-architect. Routes down as well as up.                     |
| `session-handoff`       | Saves session state (tasks, decisions, uncommitted changes) to SESSION.md and restores it on resume.                                                          |
| `nuxt-ui-figma-handoff` | Turns a Nuxt UI Figma design handoff into code — theme tokens into main.css, component overrides into app.config.ts. Requires a Figma URL.                    |
<!-- /gen:skills-table -->

## Agents

`agents/<name>.md` — plugin-level subagents spawned via the Agent tool (`bigin-skills:<name>`), not invoked as skills.

<!-- gen:agents-table -->
| Agent             | Purpose                                                                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quick-executor`  | haiku/low — mechanical, single-file, low-risk tasks. Routed by `model-router`.                                                                                          |
| `standard-worker` | sonnet/high — default tier, most feature/bug-fix work. Routed by `model-router`.                                                                                        |
| `deep-architect`  | opus/high — architectural decisions, contract/schema changes, full-spec tier. Routed by `model-router`.                                                                 |
| `verifier`        | haiku/low — read-only — audits a diff against `PLAN.md` independently of the implementer's own summary. Spawned fresh each round, alongside whichever tier implemented. |
<!-- /gen:agents-table -->

Details live in each skill's own `SKILL.md` — read it when working on that skill. Authoring conventions are in `.claude/rules/skill-authoring.md` (loads when editing `skills/`).

## Versioning

Version lives in `.claude-plugin/plugin.json`. Bump it when publishing changes and add a `CHANGELOG.md` entry. Before a **major or minor** bump, find and fix all stale docs first — the skills/agents tables in `CLAUDE.md`/`README.md` are generated (run `node tools/docs_sync.mjs`), so sweep only the remaining manual surfaces: prose, cross-references, the README tree diagram, `SKILL.md`s, `marketplace.json`. Patch bumps don't require this sweep. Pre-commit gates: activate once with `git config core.hooksPath scripts/git-hooks` (runs the budget gate + `docs_sync.mjs --check`).

## Session Handoff

When approaching usage limits, use the session-handoff skill to save state to `.claude/memory/SESSION.md`. On session start, if found with `status: in-progress`, prompt to resume or start fresh.
