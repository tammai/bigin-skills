# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **Claude Code plugin** (`bigin-skills`) — a collection of skills installed into other projects, not executed here. There is no build step, test suite, or dev server. All work is authoring markdown (and a small guard script) in the right structure.

## Plugin structure

```
.claude-plugin/
  plugin.json        ← plugin metadata (name: bigin-skills, version, author, keywords)
  marketplace.json   ← marketplace registry entry (used by /plugin marketplace)
skills/
  bigin-harness-setup/   ← scaffolds an AI workflow harness into a target repo
    SKILL.md             ← phased workflow (stack profile + optional knowledge bundle)
    references/          ← per-profile templates + shared files + hook/guard scripts + knowledge bundle
  nuxt-scaffold/         ← scaffolds a Nuxt 4 BFF app (npm create nuxt, no clone)
    SKILL.md
    references/          ← bootstrap, modules, artifacts
  session-handoff/       ← session state persistence (SESSION.md)
    SKILL.md
```

All `references/` paths in a SKILL.md are relative to that skill's own `references/` directory.

## Skills

### bigin-harness-setup

Scaffolds a standardized AI workflow harness into a target repo: `CLAUDE.md`, `.claude/rules/`, `AI_TASK_GUIDE.md`, `AI_REVIEW_CHECKLIST.md`, enforcement hooks (`scripts/pre-commit.sh` + `.claude/guards/bash-guard.py`), and `.claude/settings.json`. Three stack profiles: `nuxt`, `go`, `nodejs`.

Core philosophy baked into what it generates:

1. **Guidance defines intent; gates enforce it mechanically.** The value is in the gates, not more docs.
2. **Single source of truth.** Reference shared rules, never duplicate.
3. **No overhead.** Lean, scannable markdown. Cut anything that doesn't change behavior.
4. **Additive-first cross-repo contract.** Backend leads with backward-compatible changes; breaking change = version bump.
5. **`openapi.yaml` is the contract source of truth.** Frontend generates types from it.

Key reference files:

- `references/profile-{nuxt,go,nodejs}.md` — per-profile `CLAUDE.md`, `conventions.md`, architecture addendum, `settings.json`, commands
- `references/files-shared.md` — `security.md`, `architecture.md` base, `AI_TASK_GUIDE.md`, `AI_REVIEW_CHECKLIST.md`, optional `code-reviewer` agent
- `references/hook-guard.md` — `bash-guard.py` + per-profile `pre-commit.sh`
- `references/knowledge-bundle.md` — optional Knowledge Bundle: `.claude/rules/knowledge.md`, `knowledge/` starter concept files, `tools/knowledge_validate.py`

The skill is **idempotent** — re-running on a set-up repo never clobbers without confirmation; `settings.json` is merged, `README.md` is append-only.

### nuxt-scaffold

Scaffolds a Nuxt 4 BFF app **from scratch** into an empty repo — no GitHub template clone. The skill runs: non-interactive `npm create nuxt@latest` (`--template ui`, `--packageManager pnpm`, `--gitInit`, `--force`) → install the BFF preset (`pinia`, `nuxt-auth-utils`, `@vueuse/nuxt`, `@pinia/colada`, `zod`, `vitest`, `@nuxt/test-utils`, `simple-git-hooks`, `lint-staged`, `openapi-typescript`) → apply config + sample BFF code. Optional module extras (`image`, `content`) and an opt-in Drizzle + Cloudflare D1 layer. Invoked by `bigin-harness-setup` Phase 0.5; also usable standalone.

**Ownership split:** `nuxt-scaffold` owns the Nuxt project (config, sample code, `simple-git-hooks`, `.claude/settings.json` with permissions + a `PostToolUse` lint-fix hook). Governance (`CLAUDE.md`, `.claude/rules/`, `bash-guard.py` + its `PreToolUse` hook) stays with `bigin-harness-setup`.

Key reference files:

- `references/bootstrap.md` — the canonical init + module-install + verify command sequence
- `references/modules.md` — BFF preset, optional-modules menu, Drizzle opt-in
- `references/artifacts.md` — every file written/merged into the project

### session-handoff

Saves/restores session state to `.claude/memory/SESSION.md`. Triggers: `/save-session`, `/load-session`, `/complete-session`, "near limit".

## Conventions when editing skills

**SKILL.md files:**

- Keep body ≤ 500 lines; move supporting detail into `references/`
- The `description:` frontmatter field is the trigger — make it specific and "pushy" (list exact phrases that should activate it)
- Use bilingual section headers: `## Section Name / Tên phần`

**Generated files (templated in `references/`, written into target repos):**

- Keep each generated file SHORT — terse, scannable, no verbose prose. A rule nobody reads is worse than no rule.
- Never duplicate rule content across generated files; reference the single source.
- `bash-guard.py` is the load-bearing gate — if you change its regexes, test them (block `--no-verify`, `git commit -n`, `git push --force`; allow `--force-with-lease`, normal commits, and commit messages that merely contain `-n`).
- `architect`-style agents get `model: opus`; all other agents get `model: sonnet`. QA/reviewer agents use `agentType: general-purpose` (not `Explore` — read-only, cannot run scripts).

## Versioning

Version lives in `.claude-plugin/plugin.json`. Bump it when publishing changes, and add a `CHANGELOG.md` entry.

## Session Handoff / Chuyển tiếp phiên

When approaching usage limits or needing to pause, use the session-handoff skill to save state to `.claude/memory/SESSION.md`. On session start, if found with `status: in-progress`, prompt to resume or start fresh.

## Installation (for users of this plugin)

```
/plugin marketplace add tammai/bigin-skills
/plugin install bigin-skills@bigin
```

Direct copy (single skill):

```bash
cp -r skills/bigin-harness-setup ~/.claude/skills/bigin-harness-setup
```
