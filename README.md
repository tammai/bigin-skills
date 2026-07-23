# bigin-skills

**BigIn's collection of Claude Code skills**

Skills for standardized, AI-assisted development across BigIn's stacks.

---

## Quick Start

Two things happen on a project using this harness, and they're not peers — one is a one-time setup step, the other is what you actually run every day:

1. **Once, at the start** — [`bigin-harness-setup`](#bigin-harness-setup) lays down the governance layer (CLAUDE.md, path-scoped rules, guard hooks, budget gate). On an empty repo it also scaffolds the app itself, delegating to the matching stack skill (`nuxt-scaffold` / `next-scaffold` / `go-scaffold` / `nodejs-scaffold`).
2. **Every day after that** — [`task-workflow`](#developer-workflow) is the main driver of this whole system. Every non-trivial feature or bug fix goes through it: scope → spec gate → approved `PLAN.md` → implement/verify loop → review → cleanup. You'll invoke `bigin-harness-setup` once per repo and `task-workflow` dozens of times a day on it.

**A typical day, in order:**

| You say | What runs |
| --- | --- |
| "Implement X" / "fix bug in Y" / "add a feature" | `task-workflow` — scopes the change, drafts a spec and waits for your approval, then implements with an independent verifier checking every diff against the approved plan |
| _(automatically, inside task-workflow's Implement step)_ | `model-router` scores the task and picks the executing tier; `write-tests` and `debug-workflow` are pulled in for test-authoring and bug-fix discipline |
| "Write tests for X" | `write-tests` directly — when you just need tests for one function/component, not a full spec'd change |
| "Why is this flaky" / "debug this" | `debug-workflow` directly — for a bug not yet tied to a `task-workflow` plan |
| "Sprint distill" / end of sprint | `sprint-distill` — compresses merged PRs into `knowledge/` + harness updates |
| "Save session" / nearing a context limit | `session-handoff` |
| Implementing a Figma handoff in a Nuxt UI app | `nuxt-ui-figma-handoff` |

If the repo has never been set up, say **"set up a harness"** first — everything else assumes `CLAUDE.md`, `.claude/rules/`, and the guard hooks already exist.

---

## Skills

### Core Skills

The harness itself — setup, workflow, and maintenance for a repo under standardized AI-assisted development.

<!-- gen:skills-core -->
| Skill                   | Purpose                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **bigin-harness-setup** | Scaffolds an AI workflow harness — CLAUDE.md brief, path-scoped rules, and enforcement gates (commit hooks + budget check). Profiles: nuxt, go, nodejs, next. |
| **task-workflow**       | On-demand task workflow (/task-workflow): scope → spec → plan (approved) → implement/verify loop (capped, independent verifier) → review → cleanup.           |
| **nuxt-scaffold**       | Scaffolds a Nuxt 4 BFF app from scratch via a deterministic Node.js script — npm create nuxt@latest + BFF preset + config/sample code. No GitHub clone.       |
| **next-scaffold**       | Scaffolds a Next.js App Router BFF app from scratch via a deterministic Node.js script — create-next-app + BFF preset + shadcn/ui. No GitHub clone.           |
| **go-scaffold**         | Scaffolds a Go modular-monolith REST API — users/posts, oapi-codegen + sqlc, JWT+argon2id+RBAC, chi router, Postgres. Runs codegen + build/vet/test itself.   |
| **nodejs-scaffold**     | Scaffolds a Node.js modular-monolith REST API — users/posts, code-first OpenAPI (TypeBox) + Drizzle, JWT+argon2id, outbox/inbox + job queue.                  |
| **sprint-distill**      | End-of-sprint distillation: merged PRs + touched knowledge/ concepts → proposal-first knowledge/ and bigin-skills updates. Compresses, never just appends.    |
| **write-tests**         | On-demand test authoring (/write-tests): style-matches the nearest test file, lists edge cases first, TDD-orders logic, mocks only true I/O boundaries.       |
| **debug-workflow**      | On-demand systematic debugging (/debug-workflow): triage → fast path for obvious bugs, full guarded workflow for flaky/env/repeat-failure bugs.               |
| **model-router**        | Scores task complexity via a deterministic rubric and routes to quick-executor/standard-worker/deep-architect. Routes down as well as up.                     |
<!-- /gen:skills-core -->

### Handoff Skills

Add-ons for a specific cross-role handoff (e.g. designer → developer). Not required for the core harness — opt in per project as the relevant handoff comes up.

<!-- gen:skills-handoff -->
| Skill                     | Purpose                                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **session-handoff**       | Saves session state (tasks, decisions, uncommitted changes) to SESSION.md and restores it on resume.                                       |
| **nuxt-ui-figma-handoff** | Turns a Nuxt UI Figma design handoff into code — theme tokens into main.css, component overrides into app.config.ts. Requires a Figma URL. |
<!-- /gen:skills-handoff -->

---

## BigIn Harness Setup

Sets up a consistent "harness level" on any repo so team members of mixed skill levels produce consistent, maintainable output.

### Principles

- **Guidance defines intent; gates enforce it mechanically.** Anything left to judgment varies by skill level — so the value is in the gates, not more docs.
- **Single source of truth.** Reference shared rules, never duplicate them.
- **No overhead.** Lean, scannable markdown — a rule nobody reads is worse than no rule.
- **Additive-first cross-repo contract.** `openapi.yaml` is the contract between frontend and backend. Backend leads with backward-compatible changes; a breaking change requires a version bump. Frontend generates types from `openapi.yaml` — never hardcoded.
- **Three-tier loading.** CLAUDE.md is always loaded (≤60 lines). Rule files in `.claude/rules/` carry `paths:` frontmatter so they load only when matching files are in context. On-demand skills (like `/task-workflow`) load only when invoked. Always-loaded target: ~600 tokens for CLAUDE.md alone; worst-case with active paths ~1,750 tokens.

### Profiles

| Profile  | Stack                                                                                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nuxt`   | Nuxt 4 fullstack (Cloudflare Pages), Nuxt ESLint, Pinia + Pinia Colada, VueUse, Nuxt UI, nuxt-auth-utils, Zod, Vitest — BFF proxy layer (no D1/KV/R2; backend owns data). Empty repo → scaffolded by the `nuxt-scaffold` skill (`npm create nuxt@latest`, no clone) |
| `go`     | Go modular-monolith REST API (`users`/`posts` modules, compiler-enforced boundaries) — contract-first (`oapi-codegen` + `sqlc`), JWT+argon2id auth + RBAC, chi router, Postgres. Empty repo → scaffolded by the `go-scaffold` skill                                |
| `nodejs` | Node.js modular-monolith REST API (`users`/`posts` modules) — code-first OpenAPI (TypeBox route schemas + `@fastify/swagger`) + Drizzle/`drizzle-kit`, JWT+argon2id auth, outbox/inbox event bus + Postgres-backed job queue, Fastify, Postgres. Empty repo → scaffolded by the `nodejs-scaffold` skill |
| `next`   | Next.js App Router fullstack (Vercel), shadcn/ui, Zustand, TanStack Query, iron-session, Zod, Vitest — BFF proxy layer (no ORM/DB driver; backend owns data). Empty repo → scaffolded by the `next-scaffold` skill (`create-next-app`, no clone)                    |

### What gets generated

**nuxt on an empty repo:** the full app is first scaffolded **by the `nuxt-scaffold` skill's deterministic script** — all decisions gathered upfront into a config JSON, then `node scripts/scaffold.mjs --config <path>` runs `npm create nuxt@latest` + the BFF preset modules + config and sample code (`nuxt.config.ts`, `eslint.config.mjs`, `app/`, `server/`, `simple-git-hooks`) with zero prompts. The Nuxt app is a BFF proxy layer — no DB, the backend owns data persistence. The harness governance layer is then overlaid additively.

**go on an empty repo:** scaffolded **by the `go-scaffold` skill's deterministic script** — module path + project name gathered upfront as CLI flags, then `node scripts/scaffold.mjs --module <path>` writes a modular monolith: `users` and `posts` modules under `internal/<mod>/internal/{domain,application,infrastructure,api}` with compiler-enforced boundaries (Go's nested `internal/`), a shared JWT + argon2id + RBAC auth kernel (signup/login/refresh/logout), CRUD with optimistic concurrency, soft-delete erasure with a synchronous cross-module anonymize, and a batched cross-module read (no N+1). Runs `oapi-codegen` and `sqlc` per module (from `api/openapi.yaml` and each module's SQL) via `go run pkg@version` (no global install, no `go.mod` pollution), writes the hand-written glue (`cmd/server`, `internal/config`, `internal/server`), then `go mod tidy` + `gofmt` + `go vet` + `go build` + `go test` + `git commit` — all before reporting success. `go-scaffold` writes no `.claude/` anything; the harness governance layer is overlaid additively afterward, same as nuxt.

**nodejs on an empty repo:** scaffolded **by the `nodejs-scaffold` skill's deterministic script** — project name gathered upfront as a CLI flag, then `node scripts/scaffold.mjs --project <name>` writes a modular monolith: `users` and `posts` modules under `src/modules/<mod>/{domain,application,infrastructure,api}`, each behind its own `/v1/<module>` route prefix, boundaries enforced by `eslint-plugin-boundaries`. OpenAPI is **code-first**, not contract-first: TypeBox route schemas double as the spec, and `@fastify/swagger` dumps the generated `src/api/openapi.json` (`openapi-typescript` was removed). Per-module Drizzle schemas still generate migration SQL via `drizzle-kit generate` — the reverse direction of sqlc. JWT (`@fastify/jwt`) + argon2id auth, an in-process event bus with outbox/inbox + a dead-letter table + retry backoff, a Postgres-backed job queue (Graphile Worker), idempotency-key handling, and cursor pagination round out the reference implementation. Then `pnpm lint` + `pnpm type-check` + `pnpm build` + `pnpm test --run` + `git commit` — all before reporting success. `nodejs-scaffold` writes no `.claude/` anything; the harness governance layer is overlaid additively afterward, same as go.

**next on an empty repo:** the full app is first scaffolded **by the `next-scaffold` skill's deterministic script** — all decisions gathered upfront into a config JSON, then `node scripts/scaffold.mjs --config <path>` runs `create-next-app` + the BFF preset (Zustand, TanStack Query, Zod, iron-session, Vitest) + `shadcn/ui` (`npx shadcn@latest init` + `add`) + config and sample code (`next.config.ts`, `src/app/`, `src/hooks/`, `simple-git-hooks`) with zero prompts. The `dashboard` template layers the official shadcn `dashboard-01` block; `saas` adds a demo-auth-gated `/dashboard` (`iron-session`) with hand-authored login/signup pages instead of a full GitHub template clone — shadcn/ui has no equivalent gallery of standalone app templates to clone the way `nuxt-ui-templates` does. The Next app is a BFF proxy layer — no DB, the backend owns data persistence. The harness governance layer is then overlaid additively.

```
your-repo/
├── CLAUDE.md                           ← Tier 1: always loaded, ≤60 lines
├── AI_TASK_GUIDE.md                    ← human reference; agents use /task-workflow
├── AI_REVIEW_CHECKLIST.md              ← definition of done (profile commands filled in)
├── .claude/
│   ├── rules/
│   │   ├── conventions-frontend.md     ← Tier 2: paths: app/** (nuxt) or src/app/**,src/components/**,src/hooks/** (next) — nuxt/next only
│   │   ├── conventions-server.md       ← Tier 2: paths: server/** (nuxt) or src/app/api/**,src/lib/** (next) — nuxt/next only
│   │   ├── conventions.md              ← Tier 2: paths: src/** or **/*.go (go/nodejs)
│   │   ├── security.md                 ← Tier 2: paths: scoped per profile
│   │   └── architecture.md             ← Tier 2: paths: scoped per profile
│   ├── guards/
│   │   ├── bash-guard.mjs               ← blocks --no-verify and force-push to main
│   │   ├── spec-gate-guard.mjs          ← blocks non-trivial edits before PLAN.md is approved
│   │   ├── bugfix-test-guard.mjs        ← blocks fix-shaped commits with no staged regression test
│   │   ├── injection-scan-guard.mjs     ← flags likely prompt-injection markers in fetched content
│   │   ├── injection-gate-guard.mjs     ← asks for confirmation after a flag; denies outright on a canary-token match
│   │   ├── session-resume-check.mjs     ← SessionStart hook: prompts to resume an in-progress SESSION.md
│   │   ├── canary-seed.mjs              ← SessionStart hook: seeds a per-session exfiltration canary token
│   │   └── precompact-snapshot.mjs      ← PreCompact hook: autosaves SESSION.md before context compaction
│   └── settings.json                   ← pre-approved commands + hook wiring
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
- **`.claude/guards/bugfix-test-guard.mjs`** — a `PreToolUse` hook that blocks fix-shaped `git commit`s (conventional `fix:`, or `bugfix`/`hotfix`) unless a staged file matches a test pattern, all staged files are docs/config, or the message contains `[no-test]`. Enforces `debug-workflow`'s regression-test requirement deterministically instead of by prose.
- **`.claude/guards/injection-scan-guard.mjs` + `.claude/guards/injection-gate-guard.mjs`** — a three-stage prompt-injection defense (inspired by Lasso Security's PostToolUse Defender). The scan guard (`PostToolUse`, stage 1) heuristically checks `WebFetch`/`mcp__*` responses and `curl`/`wget` Bash output for injected instructions and flags a session-scoped marker; the gate guard (`PreToolUse`, stage 2) asks for confirmation on the next risky `Bash`/`Write`/`Edit`/`WebFetch`/`mcp__*` call if that flag is still fresh (5-minute window), then clears it.
- **`.claude/guards/canary-seed.mjs`** — a `SessionStart` hook that seeds a per-session random token and instructs the model never to reproduce it. `injection-gate-guard.mjs`'s stage 3 denies (not asks) any tool call whose input contains that token — a per-session UUID has zero legitimate reason to appear anywhere, so this is a hard block rather than a confirmation.
- **`.claude/guards/session-resume-check.mjs`** — a `SessionStart` hook that deterministically injects a resume-prompt reminder when `.claude/memory/SESSION.md` has `status: in-progress`, instead of relying on CLAUDE.md prose alone.
- **`.claude/guards/precompact-snapshot.mjs`** — a `PreCompact` hook that writes/updates `.claude/memory/SESSION.md` (in `session-handoff`'s own format, marked `<!-- precompact-autosave -->`) before a context compaction, so an automatic mid-task compaction doesn't silently lose in-flight state. Always exits 0 — a failed autosave never blocks compaction.
- **Auto-format** (nuxt/next) — set up by the `nuxt-scaffold`/`next-scaffold` skill. ESLint is the only formatter (Prettier disabled). A `PostToolUse` hook runs `.claude/guards/lint-fix-file.mjs` after every agent Write/Edit, scoped to just the touched file; humans get the same via `.vscode/settings.json` format-on-save.
- **`.claude/settings.json`** — pre-approves safe profile commands to reduce prompt friction.

---

## Developer Workflow

**The main driver of this whole system, day to day.** Where `bigin-harness-setup` runs once per repo, `task-workflow` is what you run for every non-trivial feature or bug fix from then on — it's the discipline that `spec-gate-guard.mjs` and `bugfix-test-guard.mjs` actually enforce, not just prose in a doc nobody reads.

Trigger with natural language ("implement X", "add a feature", "fix bug in Z", "start working on", "thêm chức năng", "sửa lỗi") or explicitly with `/task-workflow`.

### The six steps

1. **Scope** — one sentence: what's changing and why, before touching any code.
2. **Spec gate** — write and get approval for a spec before implementing. Skipped for bug fixes, copy changes, config tweaks, and changes ≤20 lines of logic. If the request doesn't carry enough information to fill the spec confidently, the workflow asks up to 3 targeted clarifying questions rather than filling gaps with silent assumptions. The default spec has six required fields — `What` / `Inputs-outputs` / `Edge cases` / `Security considerations` / `Testing strategy` / `Not in scope` — pasted in chat and requiring your explicit approval before any code is written.
3. **Plan file** — the approved spec plus a tasks-tracking table, written to `PLAN.md`. This is exactly what `spec-gate-guard.mjs` checks for: it blocks `Edit`/`Write`/`MultiEdit` calls until `PLAN.md` exists with `Status: approved`.
4. **Implement/verify loop** — `model-router` scores the task and picks the executing tier (asking for confirmation only when the tier comes back `deep-architect`); the spawned implementer self-checks lint+typecheck+tests, and delegates test-authoring to `write-tests` and bug-fix discipline to `debug-workflow`. A **fresh, read-only `verifier` subagent** is then spawned to audit the diff against `PLAN.md` directly — never against the implementer's own summary of what it did. On `FAIL`, the same implementer is resumed via `SendMessage` with the issues list verbatim, and a new, memoryless verifier re-checks the fix. Capped at **3 rounds** — past that, the workflow stops and asks you how to proceed rather than looping indefinitely.
5. **Review** — asks whether to run `/code-review` on the diff, plus `/security-review` if the change touches auth, sessions, secrets, PII, or untrusted input. Neither runs automatically.
6. **Cleanup** — once every task is `Done` and review is resolved (clean, or explicitly declined), `PLAN.md` is deleted. It's a working file for the task, not project documentation.

### Opt-in full-spec tier

Only on an explicit ask — "write a full spec" / "AI-friendly spec" / "spec-driven" — never triggered by perceived complexity. Adds User Stories & Scenarios, Functional/Non-Functional Requirements, an API Contract, a Data Model, and (frontend work only) a Component Tree, plus a `Covers` column and manual-verification rows in `PLAN.md`. See [`skills/task-workflow/references/full-spec-example.md`](skills/task-workflow/references/full-spec-example.md) for a filled example.

### Running more than one instance at once

[`skills/task-workflow/references/parallelization.md`](skills/task-workflow/references/parallelization.md) covers worktree-per-instance, a role split (main instance codes, forks research), a cascade pattern for 3-4 concurrent tasks, and the rule that spec-gate approval is per-worktree — approving `PLAN.md` in one instance never carries over to another's.

---

## Sprint Distill

Determines sprint scope from the last entry in `knowledge/log.md` (asks for a start date if there's no bundle yet or no dated entry). Gathers merged PRs since that date, touched concept files, and current `.claude/rules/`, plus any pasted out-of-repo material (meeting notes, transcripts, client docs). Classifies every candidate learning with a strict rule — WHAT/WHY → `knowledge/`, HOW-we-work → `bigin-skills`, neither → dropped and reported, never both — then proposes the full set of changes and **stops** for approval before writing anything. On approval: applies the changes, runs the knowledge validator if present, appends the log entry last.

Trigger with:

```
Sprint distill
Distill this sprint
Chưng cất sprint
```

Doesn't trigger on single-PR or single-change review — use `/code-review` for that.

---

## Installation

### Via Marketplace

```
/plugin marketplace add tammai/bigin-skills
/plugin install bigin-skills@bigin
```

### Via npx

```bash
npx skills add tammai/bigin-skills
```

### Direct (single skill)

```bash
cp -r skills/bigin-harness-setup ~/.claude/skills/bigin-harness-setup
```

> Note: `bigin-harness-setup` calls sibling skills by repo-relative path (e.g. `node skills/nuxt-scaffold/scripts/scaffold.mjs`), so its empty-repo scaffold branches only work inside the full plugin. Install it via the marketplace, not standalone. The other skills are self-contained and copy cleanly on their own.

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
│   │       ├── profile-next.md    ← same shape as profile-nuxt.md
│   │       ├── profile-go.md
│   │       ├── profile-nodejs.md
│   │       ├── files-shared.md    ← security, architecture, task guide, review checklist, paths substitutions
│   │       ├── patch-mode.md      ← Phase 1a: version diffing + CHANGELOG patch-block application
│   │       ├── hook-guard.md      ← bash-guard.mjs, spec-gate-guard.mjs, bugfix-test-guard.mjs, injection-scan/gate-guard.mjs, session-resume-check.mjs, canary-seed.mjs, precompact-snapshot.mjs + pre-commit scripts per profile
│   │       ├── budget-gate.md     ← context_budget.mjs (budget gate script)
│   │       ├── knowledge-bundle.md
│   │       ├── graph.md           ← Phase 5.7: optional Graphify rule file + usage doc
│   │       ├── ci.md
│   │       └── summary-checklist.md ← Phase 7 summary print template + Output Checklist
│   ├── task-workflow/             ← on-demand task workflow (Tier 3)
│   │   ├── SKILL.md               ← scope → spec → plan file (approved) → implement/verify loop (capped) → review → cleanup
│   │   ├── references/
│   │   │   ├── full-spec-example.md ← filled example of the opt-in full-spec tier
│   │   │   ├── verify-contract.md   ← single-source verifier output schema (PASS/FAIL + issues)
│   │   │   └── parallelization.md   ← when/how to fan out implement+verify across subagents
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
│   ├── next-scaffold/             ← Next.js App Router BFF app scaffolder (create-next-app, no clone)
│   │   ├── SKILL.md               ← decides config values; the script does the rest
│   │   ├── evals/evals.json
│   │   ├── scripts/
│   │   │   ├── scaffold.mjs       ← deterministic scaffold (Node stdlib, --config JSON)
│   │   │   └── templates/         ← source of truth for files written into the project
│   │   └── references/
│   │       ├── bootstrap.md       ← rationale for the script's command sequence
│   │       ├── modules.md         ← BFF preset + shadcn/ui block registry notes
│   │       └── artifacts.md       ← rationale + merge semantics for the templates
│   ├── go-scaffold/               ← Go modular-monolith REST API scaffolder (users/posts, oapi-codegen + sqlc, JWT+argon2id+RBAC)
│   │   ├── SKILL.md               ← CLI flags in, design notes for maintainers, no AskUserQuestion menu
│   │   ├── evals/evals.json
│   │   └── scripts/
│   │       ├── scaffold.mjs       ← deterministic scaffold (Node stdlib, --module/--dir/--project flags)
│   │       └── templates/files/   ← source of truth; STATIC_FILES before codegen, GLUE_FILES after
│   ├── nodejs-scaffold/           ← Node.js modular-monolith REST API scaffolder (users/posts, code-first TypeBox OpenAPI + Drizzle, outbox/inbox + job queue)
│   │   ├── SKILL.md               ← CLI flags in, design notes for maintainers, no AskUserQuestion menu
│   │   ├── evals/evals.json
│   │   └── scripts/
│   │       ├── scaffold.mjs       ← deterministic scaffold (Node stdlib, --project/--dir flags)
│   │       └── templates/files/   ← source of truth; STATIC_FILES before pnpm add/codegen, GLUE_FILES after
│   ├── sprint-distill/            ← end-of-sprint distillation (compresses, never appends)
│   │   ├── SKILL.md
│   │   └── evals/evals.json
│   ├── write-tests/               ← on-demand test authoring
│   │   ├── SKILL.md               ← style-match, scope, edge cases, TDD ordering, no over-mocking
│   │   └── evals/evals.json
│   ├── debug-workflow/            ← on-demand systematic debugging (Tier 3)
│   │   ├── SKILL.md               ← triage → fast path (obvious bugs) or full guarded workflow (flaky/env/repeat failures)
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
│   ├── standard-worker.md         ← sonnet/high — default tier, most feature/bug-fix work
│   ├── deep-architect.md          ← opus/high — architectural decisions, contract/schema changes, full-spec tier
│   └── verifier.md                ← haiku/low, read-only — independently audits a diff against PLAN.md, spawned alongside whichever of the three tiers above implements it
├── .claude/
│   └── rules/                     ← this repo's own path-scoped authoring rules
│       ├── context-hygiene.md     ← always-loaded output/session discipline
│       └── skill-authoring.md     ← paths: skills/**,agents/** — conventions for authoring skills + agents
├── tools/                         ← repo tooling (not shipped into target repos as-is)
│   ├── context_budget.mjs         ← always-loaded token budget gate
│   ├── docs_sync.mjs              ← regenerates the skills/agents tables in CLAUDE.md + README
│   └── docs-manifest.json         ← source of truth for the generated tables
├── scripts/
│   └── git-hooks/pre-commit       ← runs context_budget.mjs + docs_sync.mjs --check
├── CLAUDE.md
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

**Docs sync** — the skills/agents tables in `CLAUDE.md` and `README.md` (between `<!-- gen:* -->` markers) are generated from `skills/*/SKILL.md`, `agents/*.md` frontmatter, and `tools/docs-manifest.json`, not hand-maintained.

```
node tools/docs_sync.mjs          # regenerate the tables in place
node tools/docs_sync.mjs --check  # diff-only; exits 1 on stale regions (pre-commit gate)
```

A new skill or agent needs a matching entry in `tools/docs-manifest.json` (skill: `group` + `summary`; agent: `summary`) — the generator fails closed both ways, so a skill dir with no manifest entry (or vice versa) blocks the commit by name.

**Pre-commit gate** — contributors activate the local hook once per clone; it runs the budget gate + docs-sync check before each commit:

```
git config core.hooksPath scripts/git-hooks
```

---

## License

[PolyForm Strict License 1.0.0](LICENSE) — licensed by BigIn. Free to use as-is for noncommercial/personal/nonprofit purposes; no modifying, no redistributing, no sublicensing. Commercial use by other companies requires a separate license from BigIn.
