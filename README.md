# bigin-skills

**BigIn's collection of Claude Code skills**
_Bộ skill Claude Code của BigIn_

Skills for standardized, AI-assisted development across BigIn's stacks.

---

## Skills

### Core Skills

The harness itself — setup, workflow, and maintenance for a repo under standardized AI-assisted development.

| Skill                  | Purpose                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **bigin-harness-setup** | Scaffolds an AI workflow harness into a repo — `CLAUDE.md`, path-scoped rules, and enforcement gates. Profiles: `nuxt`, `go`, `nodejs`. |
| **task-workflow**       | On-demand task workflow skill (`/task-workflow`): scope → spec → plan file → implement → verify → review → cleanup. Loaded only when invoked, not on every session start. |
| **nuxt-scaffold**       | Scaffolds a Nuxt 4 BFF app from scratch via a deterministic Node.js script (`scripts/scaffold.mjs`, config-driven, zero prompts, macOS/Windows) — `npm create nuxt@latest` + BFF preset + config/sample code. No GitHub clone. / Scaffold app Nuxt 4 BFF bằng script Node.js tất định — không prompt khi chạy. |
| **go-scaffold**         | Scaffolds a production-ready Go REST API via a deterministic Node.js script (`scripts/scaffold.mjs`, CLI-flag driven, zero prompts) — contract-first: `openapi.yaml` → server interface + models (`oapi-codegen`), SQL → typed queries (`sqlc`); chi router, Postgres, structured logging, rate limiting, CORS, Prometheus metrics. The script runs codegen + `go build`/`vet`/`test` itself before committing. |
| **sprint-distill**      | End-of-sprint distillation: merged PRs + touched `knowledge/` concepts → proposal-first `knowledge/` and `bigin-skills` updates. Compresses, never just appends. |
| **write-tests**         | On-demand test authoring (`/write-tests`): style-matches the nearest existing test file, lists edge cases before coding, TDD-orders business logic, mocks only true I/O boundaries. |
| **debug-workflow**      | On-demand systematic debugging (`/debug-workflow`): four gated phases — root cause investigation → pattern analysis → hypothesis testing → fix + validation. For untracked debugging (flaky tests, stack traces, incidents), not tracked bug fixes (see task-workflow) or test authoring (see write-tests). |
| **model-router**        | Scores a task against a deterministic rubric (files touched, contract/schema risk, test coverage, reversibility, architectural-decision judgment) and routes it to one of three subagents — `quick-executor` (haiku/low), `standard-worker` (sonnet/medium), `deep-architect` (opus/high) — spawned via the Agent tool. Routes down as well as up, so a trivial fix doesn't get an overthinking high-effort pass. |

### Handoff Skills

Add-ons for a specific cross-role handoff (e.g. designer → developer). Not required for the core harness — opt in per project as the relevant handoff comes up.

| Skill                       | Purpose                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| **session-handoff**     | Saves session state (tasks, decisions, uncommitted changes) to `SESSION.md` and restores it on resume.   |
| **nuxt-ui-figma-handoff**   | Turns a Nuxt UI Figma design handoff into code — global tokens into `main.css` (`@theme`, `--ui-radius`), semantic color roles and per-component Tailwind Variants overrides into `app.config.ts`. Requires a Figma file/frame URL from the user. |

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
| `go`     | Go REST API — contract-first (`oapi-codegen` + `sqlc`), chi router, Postgres. Empty repo → scaffolded by the `go-scaffold` skill |
| `nodejs` | Node.js TypeScript REST API                                                    |

### What gets generated

**nuxt on an empty repo:** the full app is first scaffolded **by the `nuxt-scaffold` skill's deterministic script** — all decisions gathered upfront into a config JSON, then `node scripts/scaffold.mjs --config <path>` runs `npm create nuxt@latest` + the BFF preset modules + config and sample code (`nuxt.config.ts`, `eslint.config.mjs`, `app/`, `server/`, `simple-git-hooks`) with zero prompts. The Nuxt app is a BFF proxy layer — no DB, the backend owns data persistence. The harness governance layer is then overlaid additively.

**go on an empty repo:** scaffolded **by the `go-scaffold` skill's deterministic script** — module path + project name gathered upfront as CLI flags, then `node scripts/scaffold.mjs --module <path>` writes the project, runs `oapi-codegen` (from `openapi.yaml`) and `sqlc` (from `internal/store/queries/*.sql`) via `go run pkg@version` (no global install, no `go.mod` pollution), writes the hand-written glue (`cmd/server`, `internal/config`, `internal/server`), then `go mod tidy` + `gofmt` + `go vet` + `go build` + `go test` + `git commit` — all before reporting success. `go-scaffold` writes no `.claude/` anything; the harness governance layer is overlaid additively afterward, same as nuxt.

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
│   │   ├── bash-guard.mjs               ← blocks --no-verify and force-push to main
│   │   ├── spec-gate-guard.mjs          ← blocks non-trivial edits before PLAN.md is approved
│   │   ├── injection-scan-guard.mjs     ← flags likely prompt-injection markers in fetched content
│   │   ├── injection-gate-guard.mjs     ← asks for confirmation before the next risky tool call after a flag
│   │   ├── session-resume-check.mjs     ← SessionStart hook: prompts to resume an in-progress SESSION.md
│   │   └── verify-gate.mjs              ← Stop hook: blocks turn-end until lint+typecheck+test pass
│   ├── settings.json                   ← pre-approved commands + hook wiring
│   └── agents/
│       └── code-reviewer.md            ← optional, read-only (opt-in)
├── tools/
│   └── context_budget.mjs               ← budget gate: CLAUDE.md ≤60, unscoped rules ≤40
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
- **`.claude/guards/bash-guard.mjs`** — a `PreToolUse` hook that blocks the agent from weakening its own gates (`--no-verify`, `git commit -n`, force-push to main). `--force-with-lease` on a feature branch is allowed.
- **`.claude/guards/spec-gate-guard.mjs`** — a `PreToolUse` hook that blocks non-trivial `Edit`/`Write`/`MultiEdit` calls until `PLAN.md` exists with `Status: approved`. Trivial paths (`tests/**`, `*.md`, `.env.example`, common config files) and edits ≤20 lines are exempt.
- **`.claude/guards/injection-scan-guard.mjs` + `.claude/guards/injection-gate-guard.mjs`** — a two-stage prompt-injection defense (inspired by Lasso Security's PostToolUse Defender). The scan guard (`PostToolUse`) heuristically checks `WebFetch`/`mcp__*` responses and `curl`/`wget` Bash output for injected instructions and flags a session-scoped marker; the gate guard (`PreToolUse`) asks for confirmation on the next risky `Bash`/`Write`/`Edit`/`mcp__*` call if that flag is still fresh (5-minute window), then clears it.
- **`.claude/guards/session-resume-check.mjs`** — a `SessionStart` hook that deterministically injects a resume-prompt reminder when `.claude/memory/SESSION.md` has `status: in-progress`, instead of relying on CLAUDE.md prose alone.
- **`.claude/guards/verify-gate.mjs`** — a `Stop` hook that blocks turn-end until lint + typecheck + test pass, skipping entirely on a clean working tree. The deterministic backstop for `task-workflow` Step 5's "show the actual output" convention.
- **Auto-format** (nuxt) — set up by the `nuxt-scaffold` skill. ESLint via `@nuxt/eslint` is the only formatter (Prettier disabled). A `PostToolUse` hook runs `.claude/guards/lint-fix-file.mjs` after every agent Write/Edit, scoped to just the touched file; humans get the same via `.vscode/settings.json` format-on-save.
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
├── skills/                        ← Core Skills
│   ├── bigin-harness-setup/       ← harness scaffolder
│   │   ├── SKILL.md               ← 8-phase workflow (Phase 8: measurement step)
│   │   ├── evals/evals.json       ← should-trigger/should-not-trigger cases
│   │   └── references/
│   │       ├── profile-nuxt.md    ← CLAUDE.md + conventions-frontend/server + settings
│   │       ├── profile-go.md
│   │       ├── profile-nodejs.md
│   │       ├── files-shared.md    ← security, architecture, task guide, review checklist, paths substitutions
│   │       ├── patch-mode.md      ← Phase 1a: version diffing + CHANGELOG patch-block application
│   │       ├── hook-guard.md      ← bash-guard.mjs, spec-gate-guard.mjs, injection-scan/gate-guard.mjs + pre-commit scripts per profile
│   │       ├── budget-gate.md     ← context_budget.mjs (budget gate script)
│   │       ├── knowledge-bundle.md
│   │       └── ci.md
│   ├── task-workflow/             ← on-demand task workflow (Tier 3)
│   │   ├── SKILL.md               ← scope → spec → plan file → implement → verify → review → cleanup
│   │   ├── references/
│   │   │   └── full-spec-example.md ← filled example of the opt-in full-spec tier
│   │   └── evals/evals.json
│   ├── nuxt-scaffold/             ← Nuxt 4 BFF app scaffolder (npm create nuxt, no clone)
│   │   ├── SKILL.md               ← decides config values; the script does the rest
│   │   ├── evals/evals.json
│   │   ├── scripts/
│   │   │   ├── scaffold.mjs       ← deterministic scaffold (Node stdlib, --config JSON)
│   │   │   └── templates/         ← source of truth for files written into the project
│   │   └── references/
│   │       ├── bootstrap.md       ← rationale for the script's command sequence
│   │       ├── modules.md         ← BFF preset (always installed, no opt-in menu)
│   │       └── artifacts.md       ← rationale + merge semantics for the templates
│   ├── go-scaffold/               ← Go REST API scaffolder (contract-first: oapi-codegen + sqlc)
│   │   ├── SKILL.md               ← CLI flags in, design notes for maintainers, no AskUserQuestion menu
│   │   ├── evals/evals.json
│   │   └── scripts/
│   │       ├── scaffold.mjs       ← deterministic scaffold (Node stdlib, --module/--dir/--project flags)
│   │       └── templates/files/   ← source of truth; STATIC_FILES before codegen, GLUE_FILES after
│   ├── sprint-distill/            ← end-of-sprint distillation (compresses, never appends)
│   │   ├── SKILL.md
│   │   └── evals/evals.json
│   ├── write-tests/               ← on-demand test authoring
│   │   ├── SKILL.md               ← style-match, scope, edge cases, TDD ordering, no over-mocking
│   │   └── evals/evals.json
│   ├── debug-workflow/            ← on-demand systematic debugging (Tier 3)
│   │   ├── SKILL.md               ← four gated phases: root cause → pattern → hypothesis → fix+validation
│   │   ├── references/
│   │   │   ├── race-conditions.md   ← condition-based waiting vs arbitrary timeouts
│   │   │   └── defense-in-depth.md  ← add validation at the layer that should've caught it
│   │   └── evals/evals.json
│   ├── model-router/               ← task-complexity scoring → subagent routing
│   │   ├── SKILL.md                ← gather signals → score → pick tier → spawn via Agent tool
│   │   ├── evals/evals.json
│   │   ├── scripts/
│   │   │   └── classify.mjs        ← mechanical signals only (files, high-risk paths, test coverage, full-spec PLAN.md)
│   │   └── references/
│   │       ├── scoring-rubric.md   ← point table + 3 worked examples
│   │       └── agent-invocation.md ← Agent tool call shape, handback protocol
│   ├── session-handoff/           ← Handoff Skills (add-ons, opt in per project)
│   │   ├── SKILL.md               ← session state persistence
│   │   └── evals/evals.json
│   └── nuxt-ui-figma-handoff/
│       ├── SKILL.md               ← requires a Figma file/frame URL from the user
│       ├── references/
│       │   └── nuxt-ui-v4-theming.md ← @theme tokens, ui.colors, Tailwind Variants overrides
│       ├── scripts/
│       │   └── generate_color_scale.mjs ← fills in a 50-950 ramp from one brand swatch
│       └── evals/evals.json
├── agents/                        ← plugin-level subagents, spawned via Agent tool (not invoked as skills)
│   ├── quick-executor.md          ← haiku/low — mechanical, single-file, low-risk tasks
│   ├── standard-worker.md         ← sonnet/medium — default tier, most feature/bug-fix work
│   └── deep-architect.md          ← opus/high — architectural decisions, contract/schema changes, full-spec tier
├── CHANGELOG.md
└── README.md
```

---

## Maintaining this repo

**`harness-audit`** — a project-local skill (`.claude/skills/harness-audit/SKILL.md`, not shipped as part of the plugin) that audits this repo's own harness against current official Claude Code docs (skills, hooks, sub-agents, plugins, memory). Findings report only — it never auto-fixes, and it won't trigger from natural language (`disable-model-invocation: true`), so it has to be run explicitly.

Run it with:

```
/harness-audit
```

It fetches the live docs, checks skill frontmatter / hooks / sub-agents / context budget / plugin structure / eval coverage / permissions against them, then **stops** with a findings table and asks whether to act on anything or just log the report. Closed findings are tracked in `.claude/audit-log.md` (created on first run) so re-runs don't re-litigate what's already been fixed.

---

## License

MIT
