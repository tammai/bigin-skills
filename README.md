# bigin-skills

**BigIn's collection of Claude Code skills**
_Bộ skill Claude Code của BigIn_

Skills for standardized, AI-assisted development across BigIn's stacks.

---

## Skills

| Skill                  | Purpose                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **bigin-harness-setup** | Scaffolds an AI workflow harness into a repo — `CLAUDE.md`, path-scoped rules, and enforcement gates. Profiles: `nuxt`, `go`, `nodejs`. |
| **task-workflow**       | On-demand task workflow skill (`/task-workflow`): scope → spec → implement → verify → review. Loaded only when invoked, not on every session start. |
| **nuxt-scaffold**       | Scaffolds a Nuxt 4 BFF app from scratch via a deterministic Node.js script (`scripts/scaffold.mjs`, config-driven, zero prompts, macOS/Windows) — `npm create nuxt@latest` + BFF preset + config/sample code. No GitHub clone. / Scaffold app Nuxt 4 BFF bằng script Node.js tất định — không prompt khi chạy. |
| **sprint-distill**      | End-of-sprint distillation: merged PRs + touched `knowledge/` concepts → proposal-first `knowledge/` and `bigin-skills` updates. Compresses, never just appends. |
| **session-handoff**     | Saves session state (tasks, decisions, uncommitted changes) to `SESSION.md` and restores it on resume.   |

---

## bigin-harness-setup

Sets up a consistent "harness level" on any repo so team members of mixed skill levels produce consistent, maintainable output.

### Principles

- **Guidance defines intent; gates enforce it mechanically.** Anything left to judgment varies by skill level — so the value is in the gates, not more docs.
- **Single source of truth.** Reference shared rules, never duplicate them.
- **No overhead.** Lean, scannable markdown — a rule nobody reads is worse than no rule.
- **Additive-first cross-repo contract.** `openapi.yaml` is the contract between frontend and backend. Backend leads with backward-compatible changes; a breaking change requires a version bump. Frontend generates types from `openapi.yaml` — never hardcoded.
- **Three-tier loading.** CLAUDE.md is always loaded (≤60 lines). Rule files in `.claude/rules/` carry `paths:` frontmatter so they load only when matching files are in context. On-demand skills (like `/task-workflow`) load only when invoked. Always-loaded target: ~600 tokens for CLAUDE.md alone; worst-case with active paths ~1,750 tokens.

### Profiles

| Profile  | Stack                                                                          |
| -------- | ------------------------------------------------------------------------------ |
| `nuxt`   | Nuxt 4 fullstack (Cloudflare Pages), Nuxt ESLint, Pinia + Pinia Colada, VueUse, Nuxt UI, nuxt-auth-utils, Zod, Vitest — BFF proxy layer (no D1/KV/R2; backend owns data). Empty repo → scaffolded by the `nuxt-scaffold` skill (`npm create nuxt@latest`, no clone) |
| `go`     | Go REST API (Gin)                                                              |
| `nodejs` | Node.js TypeScript REST API                                                    |

### What gets generated

**nuxt on an empty repo:** the full app is first scaffolded **by the `nuxt-scaffold` skill's deterministic script** — all decisions gathered upfront into a config JSON, then `node scripts/scaffold.mjs --config <path>` runs `npm create nuxt@latest` + the BFF preset modules + config and sample code (`nuxt.config.ts`, `eslint.config.mjs`, `app/`, `server/`, `simple-git-hooks`) with zero prompts. The Nuxt app is a BFF proxy layer (no DB by default — the backend owns data persistence; Drizzle + D1 is an opt-in). The harness governance layer is then overlaid additively.

```
your-repo/
├── CLAUDE.md                           ← Tier 1: always loaded, ≤60 lines
├── AI_TASK_GUIDE.md                    ← human reference; agents use /task-workflow
├── AI_REVIEW_CHECKLIST.md              ← definition of done (profile commands filled in)
├── .claude/
│   ├── rules/
│   │   ├── conventions-frontend.md     ← Tier 2: paths: app/** (nuxt only)
│   │   ├── conventions-server.md       ← Tier 2: paths: server/** (nuxt only)
│   │   ├── conventions.md              ← Tier 2: paths: src/** or **/*.go (go/nodejs)
│   │   ├── security.md                 ← Tier 2: paths: scoped per profile
│   │   └── architecture.md             ← Tier 2: paths: scoped per profile
│   ├── guards/
│   │   └── bash-guard.py               ← blocks --no-verify and force-push to main
│   ├── settings.json                   ← pre-approved commands + hook wiring + statusline
│   └── agents/
│       └── code-reviewer.md            ← optional, read-only (opt-in)
├── tools/
│   └── context_budget.py               ← budget gate: CLAUDE.md ≤60, unscoped rules ≤40
├── scripts/
│   └── pre-commit.sh                   ← lint + typecheck + test + budget check
└── README.md                           ← AI Onboarding + runtime hygiene + Context Budget table
```

### Usage

Trigger in Claude Code with:

```
Set up a harness
Add AI rules to this repo
Thiết lập harness
```

The skill detects the stack profile (or asks), confirms before overwriting anything, and prints onboarding next steps. Re-running on an already-set-up repo is safe (idempotent).

### Enforcement (the load-bearing part)

- **`scripts/pre-commit.sh`** — runs lint + typecheck + tests; fails closed. The skill installs it as a git hook (and `git init`s the repo if needed).
- **`.claude/guards/bash-guard.py`** — a `PreToolUse` hook that blocks the agent from weakening its own gates (`--no-verify`, `git commit -n`, force-push to main). `--force-with-lease` on a feature branch is allowed.
- **Auto-format** (nuxt) — set up by the `nuxt-scaffold` skill. ESLint via `@nuxt/eslint` is the only formatter (Prettier disabled). A `PostToolUse` hook runs `.claude/guards/lint-fix-file.py` after every agent Write/Edit, scoped to just the touched file; humans get the same via `.vscode/settings.json` format-on-save.
- **`.claude/settings.json`** — pre-approves safe profile commands to reduce prompt friction.

---

## sprint-distill

Replaces a manual NotebookLM end-of-sprint pass with a git-native distillation step: merged PRs + log → sprint-distill → `knowledge/` + `bigin-skills` → knowledge validator gate.

Determines sprint scope from the last entry in `knowledge/log.md` (asks for a start date if there's no bundle yet or no dated entry). Gathers merged PRs since that date, touched concept files, and current `.claude/rules/`, plus any pasted out-of-repo material (meeting notes, transcripts, client docs). Classifies every candidate learning with a strict rule — WHAT/WHY → `knowledge/`, HOW-we-work → `bigin-skills`, neither → dropped and reported, never both — then proposes the full set of changes and **stops** for approval before writing anything. On approval: applies the changes, runs the knowledge validator if present, appends the log entry last.

Trigger with:

```
Sprint distill
Distill this sprint
Chưng cất sprint
```

Doesn't trigger on single-PR or single-change review — use `/code-review` for that.

---

## Installation / Cài đặt

### Via Marketplace

```
/plugin marketplace add tammai/bigin-skills
/plugin install bigin-skills@bigin
```

### Direct (single skill)

```bash
cp -r skills/bigin-harness-setup ~/.claude/skills/bigin-harness-setup
```

---

## Plugin Structure

```
bigin-skills/
├── .claude-plugin/
│   ├── plugin.json                ← plugin metadata (name, version, author)
│   └── marketplace.json           ← marketplace registry entry
├── skills/
│   ├── bigin-harness-setup/       ← harness scaffolder
│   │   ├── SKILL.md               ← 8-phase workflow (Phase 8: measurement step)
│   │   └── references/
│   │       ├── profile-nuxt.md    ← CLAUDE.md + conventions-frontend/server + settings
│   │       ├── profile-go.md
│   │       ├── profile-nodejs.md
│   │       ├── files-shared.md    ← security, architecture, task guide, review checklist, paths substitutions
│   │       ├── hook-guard.md      ← bash-guard.py + pre-commit scripts per profile
│   │       ├── budget-gate.md     ← context_budget.py (budget gate script)
│   │       ├── knowledge-bundle.md
│   │       └── ci.md
│   ├── task-workflow/             ← on-demand task workflow (Tier 3)
│   │   └── SKILL.md               ← scope → spec → implement → verify → review
│   ├── nuxt-scaffold/             ← Nuxt 4 BFF app scaffolder (npm create nuxt, no clone)
│   │   ├── SKILL.md               ← decides config values; the script does the rest
│   │   ├── scripts/
│   │   │   ├── scaffold.mjs       ← deterministic scaffold (Node stdlib, --config JSON)
│   │   │   └── templates/         ← source of truth for files written into the project
│   │   └── references/
│   │       ├── bootstrap.md       ← rationale for the script's command sequence
│   │       ├── modules.md         ← BFF preset, optional modules, Drizzle opt-in
│   │       └── artifacts.md       ← rationale + merge semantics for the templates
│   ├── sprint-distill/            ← end-of-sprint distillation (compresses, never appends)
│   │   └── SKILL.md
│   └── session-handoff/           ← session state persistence
│       └── SKILL.md
├── CHANGELOG.md
└── README.md
```

---

## License

MIT
