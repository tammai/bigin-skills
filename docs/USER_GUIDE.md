# BigIn Skills — User Guide

A practical, task-oriented guide to using the `bigin-skills` plugin day to day.

This guide is written for the person *using* the harness in a project. If you're looking for the full reference — every profile, every generated file, every flag — that's [`README.md`](../README.md). If you're changing the plugin itself, read [`CLAUDE.md`](../CLAUDE.md) and `.claude/rules/skill-authoring.md`.

**Contents**

1. [What this plugin actually does](#1-what-this-plugin-actually-does)
2. [Install it](#2-install-it)
3. [Day 1 — set up a repo](#3-day-1--set-up-a-repo)
4. [Day 2 onward — the daily loop](#4-day-2-onward--the-daily-loop)
5. [Which skill for which job](#5-which-skill-for-which-job)
6. [Living with the gates](#6-living-with-the-gates)
7. [Tuning cost and depth](#7-tuning-cost-and-depth)
8. [Knowledge: distilling what the team learns](#8-knowledge-distilling-what-the-team-learns)
9. [Long sessions and handoff](#9-long-sessions-and-handoff)
10. [Troubleshooting](#10-troubleshooting)
11. [Glossary](#11-glossary)

---

## 1. What this plugin actually does

Three things, in order of how much they matter:

1. **It makes the agent write a spec before it writes code**, and it enforces that with a hook — not with a paragraph in a doc that nobody reads. That's `task-workflow` + `spec-gate-guard.mjs`.
2. **It has a second agent check the first agent's work**, against the approved plan, without ever seeing the first agent's own account of what it did. That's the `verifier`.
3. **It standardizes the setup** — CLAUDE.md, path-scoped rules, commit gates, CI — so a repo run by a junior and a repo run by a staff engineer produce output at the same floor. That's `bigin-harness-setup`.

Everything else in the plugin (scaffolders, distillers, routers) exists to support those three.

**The core insight to internalize:** guidance defines intent, gates enforce it. Anything left to the agent's judgment varies run to run. So the value is concentrated in a handful of small hook scripts, not in the volume of markdown.

---

## 2. Install it

### Marketplace (recommended)

```
/plugin marketplace add tammai/bigin-skills
/plugin install bigin-skills@bigin
```

### npx

```bash
npx skills add tammai/bigin-skills
```

### Verify it's live

Start a Claude Code session and type `/` — you should see `bigin-skills:task-workflow`, `bigin-skills:bigin-harness-setup`, and the rest in the skill list.

> **Don't install `bigin-harness-setup` standalone.** It calls sibling skills by repo-relative path (`node skills/nuxt-scaffold/scripts/scaffold.mjs`), so copying just that one directory breaks its empty-repo scaffold branches. The other skills copy cleanly on their own.

---

## 3. Day 1 — set up a repo

You do this **once per repo**. Say any of:

```
Set up a harness
Add AI rules to this repo
Scaffold the harness for this repo
```

### What happens

The skill detects your stack, asks a small batch of questions **before writing anything**, then generates the governance layer.

**Stack detection** (first match wins):

| Found | Profile |
| --- | --- |
| `nuxt.config.ts` | `nuxt` |
| `go.mod` | `go` |
| `package.json` with express/fastify/hono/koa | `nodejs` |
| `next.config.*` | `next` |
| none of the above, but the repo has code | `generic` — no question asked, setup keeps going |
| empty repo | asks which stack, then scaffolds the app first |

**The questions you'll be asked** (one bundled prompt, all optional to change):

| Question | Default | What it means |
| --- | --- | --- |
| Knowledge bundle & graph | knowledge + graphify | `knowledge/` holds decisions and invariants (the "why"); `graphify-out/` is a structural code graph for navigation |
| CI config | auto-detected from your git remote | Generates a workflow running lint + typecheck + test on push and PRs |
| Model ladder | `opus-centric` | Which models the three execution tiers spawn on — see [§7](#7-tuning-cost-and-depth) |

If the repo is empty, the app itself gets scaffolded first (by `nuxt-scaffold` / `next-scaffold` / `go-scaffold` / `nodejs-scaffold`), and the governance layer is overlaid on top additively.

If the repo is on GitHub Spec Kit, you'll be offered `migrate` / `coexist` / `leave`. Migration always shows you a read-only triage table of everything under `specs/` before deleting a single file.

### What you get

```
your-repo/
├── CLAUDE.md                   ← always loaded, ≤60 lines
├── AI_TASK_GUIDE.md            ← human pointer to /task-workflow
├── AI_REVIEW_CHECKLIST.md      ← definition of done
├── .claude/
│   ├── rules/                  ← path-scoped: load only when matching files are in context
│   ├── guards/                 ← the hooks that actually enforce things
│   ├── settings.json           ← pre-approved commands + hook wiring
│   └── model-routing.json      ← which model each tier runs on
├── tools/context_budget.mjs    ← always-loaded token budget gate
└── scripts/pre-commit.sh       ← lint + typecheck + test, fails closed
```

### After setup

Two things to do by hand:

```bash
# 1. Activate the pre-commit hook (once per clone, per contributor)
git config core.hooksPath scripts/git-hooks   # or whatever the summary printed

# 2. Read CLAUDE.md — it's short by design, and it's what every session sees
```

Re-running setup later is safe. It's idempotent: `settings.json` is merged, `README.md` is append-only, and nothing is clobbered without asking you first.

---

## 4. Day 2 onward — the daily loop

**`task-workflow` is the thing you actually use.** Harness setup happens once; this runs dozens of times a day.

Trigger it with plain language — "implement X", "add a feature", "fix the bug in Y", "create a new endpoint" — or explicitly with `/task-workflow`.

### The six steps, and what you do at each

| Step | What the agent does | What **you** do |
| --- | --- | --- |
| **1. Scope** | States in one sentence what's changing and why | Skim it. If it misread you, correct it now — it's one sentence, not a diff. |
| **2. Spec gate** | Drafts a spec and **stops** | **Approve, edit, or reject.** This is your highest-leverage moment. |
| **3. Plan file** | Writes the approved spec + task table to `PLAN.md`, reads it back for coverage | Nothing. |
| **4. Implement/verify** | Routes to a tier, implements, then spawns an independent verifier. Loops up to 3× on FAIL. | Nothing, unless the tier comes back `deep-architect` (it asks) or the round cap is hit. |
| **5. Review** | Asks whether to run `/code-review` (+ `/security-review` if the change touches auth/secrets/PII/untrusted input) | Say yes or no. Neither runs automatically. |
| **6. Cleanup** | Deletes `PLAN.md`, proposes distilling anything durable into `knowledge/`, proposes a graph rebuild | Approve or decline the proposals. |

### The spec gate is the whole point

For non-trivial features, the agent pastes this in chat and waits:

```
## Spec: {feature name}
What: {one paragraph — what changes and why}
Inputs/outputs: {what data flows in and out}
Edge cases: {anything that could go wrong}
Security considerations: {who/what is trusted, what's attacker-controlled}
Testing strategy: {what gets tested and how}
Not in scope: {explicit exclusions}
```

**Read the "Not in scope" and "Edge cases" lines first.** Those are where a misunderstanding is cheapest to catch. A wrong assumption fixed here costs one sentence; found after implementation it costs a rewrite.

The spec gate is **skipped** for bug fixes, copy changes, config tweaks, and changes under ~20 lines of logic. That's deliberate — it isn't there to gate typo fixes.

If the request is too vague to fill the spec confidently, the agent asks up to 3 targeted questions rather than inventing assumptions and presenting them as approved.

### Want more rigor on a big change?

Say **"write a full spec"** / **"AI-friendly spec"** / **"spec-driven"**. That adds User Stories, numbered Functional Requirements, an API Contract, a Data Model, a Component Tree (frontend only), and a `Covers` column linking every task to the requirement it implements.

It's **opt-in only** — the workflow will never escalate to it because a task "feels big." The single exception: if capability scoring comes back `deep-architect`, it offers the full format once, with its reasoning, and you pick.

### The implement/verify loop, concretely

```
model-router scores the task
        ↓
  spawns quick-executor | standard-worker | deep-architect
        ↓
  implementer writes code, runs lint + typecheck + tests itself
        ↓
  a FRESH verifier subagent audits the DIFF against PLAN.md
   (read-only, no memory, never sees the implementer's summary)
        ↓
   PASS → Review          FAIL → same implementer resumed with the
                                 issue list verbatim, then a NEW
                                 memoryless verifier re-checks
                                 (capped at 3 rounds)
```

Two properties worth knowing:

- **The verifier reads the diff, not the report.** An implementer that says "done, all tests pass" gets audited on the actual code either way.
- **The cap is real.** At 3 failed rounds it stops and asks you whether to adjust the plan, raise the cap, or take over. It does not loop forever.

### Scope discipline

If implementation reveals the task needs changes outside the stated scope, the workflow **stops and asks**. It never expands silently. A second task beats a sprawling first one.

### Running several tasks at once

One `PLAN.md` per worktree. Spec-gate approval is **per-worktree** — approving a plan in one instance never carries over to another. See [`skills/task-workflow/references/parallelization.md`](../skills/task-workflow/references/parallelization.md) for the worktree-per-instance pattern and the 3–4 task cascade.

---

## 5. Which skill for which job

| You want to… | Say | Skill |
| --- | --- | --- |
| Set up a new repo | "set up a harness" | `bigin-harness-setup` |
| Build a feature / fix a tracked bug | "implement X", "fix Y" | `task-workflow` |
| Write tests for one function | "write tests for `parseToken`" | `write-tests` |
| Debug something not yet in a plan | "why is this flaky", "debug this" | `debug-workflow` |
| Start a Nuxt / Next / Go / Node app from nothing | "scaffold nuxt", "create go rest api" | `*-scaffold` |
| Capture a sprint's learnings | "sprint distill" | `sprint-distill` |
| Pin a fast-moving library's API | "distill knowledge for nuxt@4.0.3" | `knowledge-distill` |
| Save state before hitting a limit | "save session" | `session-handoff` |
| Implement a Nuxt UI Figma handoff | paste the Figma URL | `nuxt-ui-figma-handoff` |
| Decide which model runs a task | "route this task" | `model-router` |

### The two that overlap most

**`write-tests` vs `task-workflow`** — `write-tests` is for "I need tests for this one function, now." A full feature going through `task-workflow` calls `write-tests` internally for its test authoring; you don't need to invoke both.

**`debug-workflow` vs `task-workflow`** — if the bug already has a `PLAN.md`, `task-workflow` owns it and points at `debug-workflow` for the actual debugging. Use `debug-workflow` standalone when the failure isn't tied to a ticket yet: a flaky test, a stack trace, "works in staging not prod," a live incident.

`debug-workflow` triages first: obvious bugs take a fast path, while flaky / environment-dependent / repeat failures take the full repro → evidence → hypothesis → fix → prevention workflow. **Every path ends with a regression test** — and in a harnessed repo that's enforced at commit time, not requested politely.

---

## 6. Living with the gates

The gates will block you sometimes. That's the point — but knowing *why* turns a blocker into a two-second fix.

### `spec-gate-guard.mjs` — "no approved PLAN.md"

**Blocks:** non-trivial `Edit`/`Write`/`MultiEdit` when `PLAN.md` is missing, not `Status: approved`, or its `Branch:` line disagrees with the branch you're on.

**Exempt:** `tests/**`, `*.md`, `.env.example`, common config files, and any edit ≤20 lines.

**Fix:** run `/task-workflow` and approve the spec. If it's a leftover plan from a finished task, delete `PLAN.md` — that's exactly what the `Branch:` check exists to catch.

### `bugfix-test-guard.mjs` — "fix commit with no test"

**Blocks:** `git commit -m "fix: …"` (or `bugfix`/`hotfix`) with no staged test file.

**Allows:** once a `*.test.ts` / `*.spec.ts` / `*_test.go` / `tests/**` file is staged; when every staged file is docs/config; or when the message contains `[no-test]`.

**Fix:** stage the regression test. If there genuinely can't be one (a docs typo mislabeled `fix:`), add `[no-test]` — but that's an escape hatch, not a habit.

### `bash-guard.mjs` — "you can't disable your own gates"

**Blocks:** `--no-verify`, `git commit -n`, force-push to main. **Allows:** `--force-with-lease` on a feature branch, normal commits, and messages that merely contain `-n`.

This one blocks the *agent*, not you. If you need to bypass a hook yourself, do it in your own terminal.

### The prompt-injection gates

Three stages, aimed at content the agent fetches rather than at you:

1. `injection-scan-guard.mjs` (PostToolUse) heuristically scans `WebFetch` / MCP responses and `curl`/`wget` output for injected instructions, and sets a session-scoped flag.
2. `injection-gate-guard.mjs` (PreToolUse) asks for confirmation on the next risky call if that flag is fresh (5-minute window), then clears it.
3. `canary-seed.mjs` seeds a per-session random token the model is told never to reproduce. Any tool call containing it is **denied outright**, not asked — a per-session UUID has no legitimate reason to appear anywhere.

If you get a confirmation prompt right after the agent fetched a web page, that's stage 2. Look at what it fetched before saying yes.

### `context_budget.mjs` — the always-loaded budget

Caps `CLAUDE.md` at 60 lines and unscoped rule files at 40. Runs in pre-commit.

**Fix:** don't grow `CLAUDE.md`. Move the content into a path-scoped rule file under `.claude/rules/` with `paths:` frontmatter, so it loads only when matching files are in context. That's the three-tier loading model working as designed:

| Tier | What | Cost |
| --- | --- | --- |
| 1 | `CLAUDE.md` | every turn, always (~600 tokens) |
| 2 | `.claude/rules/*.md` with `paths:` | only when a matching file is in context |
| 3 | Skills like `/task-workflow` | only when invoked |

---

## 7. Tuning cost and depth

Three execution tiers, each a subagent, plus the verifier. Your chosen ladder sets both the model and the effort of each.

| Tier | Subagent (default ladder) | Effort | Used for |
| --- | --- | --- | --- |
| Quick | `quick-executor` | low | Mechanical, single-file, low-risk |
| Standard | `standard-worker` | medium | Default — most feature and bug-fix work |
| Deep | `deep-architect` | high | Architecture, breaking contracts, row-transforming migrations |
| — | `verifier` | high | Read-only audit, spawned alongside whichever tier implemented |

`high` is the documented default effort, and **nothing pins above it on any ladder.** Quick and standard route *down* — mechanical and pattern-following work doesn't need full effort, especially with an approved `PLAN.md` already naming the files and edge cases. The checking a higher pin would buy is supplied structurally instead, by the verifier round.

### Pick a ladder

Set it in your repo's `.claude/model-routing.json`:

| Profile | quick | standard | deep | verifier | Pick it when |
| --- | --- | --- | --- | --- | --- |
| `opus-centric` (default) | sonnet/low | opus/medium | opus/high | sonnet/high | The cost-aware default. Standard runs at `medium` and leans on the verifier round; the deep tier escalates on **effort**, not on model. |
| `frontier` | sonnet/low | opus/high | fable/high | sonnet/high | Everything above quick at full effort, deep on the top model. Pay up front rather than per verifier round. |
| `lean` | sonnet/low | sonnet/high | opus/high | sonnet/medium | Cost-first, trading the other way: a cheaper standard tier run at *fuller* effort. Deep still escalates to opus. |

`opus-centric` is the only ladder that runs the standard tier below `high` — the other two differ from each other on model, not effort. If standard-tier work keeps coming back with verifier `FAIL`s, switching to `frontier` is the intended fix.

Under the default ladder, quick / standard / deep differ by **effort** more than by model — the deep tier's step up to `high` targets the "didn't check its work" failure mode rather than raw capability. Reach for `frontier` only if you're actually seeing the other failure mode: the model had full context, clearly tried, and still got the structure wrong.

Per-tier **model** overrides layer on top. There is no `effort` key — setting one is ignored with a warning:

```json
{ "profile": "opus-centric", "models": { "deep": "fable" } }
```

**Precedence:** something you say in the request ("run this one on fable") > `.claude/model-routing.json` > the `opus-centric` default. A malformed config never blocks routing — it degrades to the default and tells you. Deleting the file is safe.

### Why effort isn't a config key

Claude Code's Agent tool takes a `model` argument but no `effort` one — effort is read from the agent file being spawned. So when a ladder wants a tier at a different effort, the router spawns a *different agent file*: `standard-worker-high` under `frontier` and `lean`, `verifier-medium` under `lean`, each identical to its base except for the pin. The variant fixes only the effort — `standard-worker-high` still runs on `opus` under `frontier` and `sonnet` under `lean`.

You'll only notice this in the routing line ("Routed to standard-worker-high on sonnet"). What it does mean practically: **switching ladders changes effort, but a one-off request can't.** "Run this on fable" works; "run this at max effort" has nothing to set, and the router will tell you so rather than quietly ignoring it.

### Two axes, not one

`model-router` scores **capability** (can the model do this at all → picks the tier) and **verification** (how carefully must this be checked → sets the gate discipline) *separately*. A change can be mechanically simple and still need heavy verification — touching a contract, a migration, or CI. In that case the quick tier gets skipped in favor of `standard-worker`, even though the capability score was low.

Verification bar triggers: high-risk path, test coverage under 0.3, a planned new file, 5+ files, flaky symptoms.

### The one confirmation you'll see

If scoring lands on `deep-architect`, the workflow **pauses and asks** before spawning it — it's the most expensive tier (`opus/high` by default) and the biggest behavior swing. `standard-worker` and `quick-executor` spawn without asking.

Rationale per tier lives in [`skills/model-router/references/model-profiles.md`](../skills/model-router/references/model-profiles.md).

---

## 8. Knowledge: distilling what the team learns

Two skills write into `knowledge/`. They cover different things and should not be confused.

### `knowledge-distill` — external library APIs

**Problem it solves:** a library moved past the model's training data, so the agent confidently writes an API that no longer exists.

```
Distill knowledge for nuxt@4.0.3
Create a knowledge bundle for phaser
Update the nuxt bundle to 4.1.0
```

It clones the library at a **pinned commit**, distills its docs and source into concept files under `knowledge/libraries/<lib>/`, then hands the result to a fresh `knowledge-auditor` subagent that checks the bundle **against the library's own cloned source** — never against the distiller's account of what it wrote. Same independence principle as the `verifier`.

It **refuses "latest."** A bundle without a pinned version can't be audited or drift-checked. It also wires up a drift guard that compares the bundle's version against your declared dependency, so an upgrade doesn't silently leave stale docs behind.

### `sprint-distill` — what your team learned

```
Sprint distill
End-of-sprint review
```

Determines sprint scope from the last dated entry in `knowledge/log.md`, gathers merged PRs and touched concept files since then, and accepts pasted out-of-repo material (meeting notes, transcripts, client docs).

Every candidate learning is classified with a strict rule — **WHAT/WHY → `knowledge/`**, **HOW-we-work → `bigin-skills`**, **neither → dropped and reported**. Never both.

Then it **stops** and shows you the full set of proposed changes. Nothing is written until you approve.

**It compresses, never appends.** Net line delta for `CLAUDE.md` and `.claude/rules/` should be ≤0 across a sprint unless there's explicit budget headroom — every addition has to name what it replaces. That's the mechanism that stops the harness from bloating over a year.

Don't use it on a single PR. That's `/code-review`.

---

## 9. Long sessions and handoff

When you're nearing a usage limit:

```
Save session
```

`session-handoff` writes tasks, decisions, and uncommitted changes to `.claude/memory/SESSION.md`. On the next session start, `session-resume-check.mjs` (a `SessionStart` hook) sees `status: in-progress` and prompts you to resume or start fresh — deterministically, not by hoping the model reads a line of CLAUDE.md prose.

You also get this for free on automatic compaction: `precompact-snapshot.mjs` (a `PreCompact` hook) autosaves `SESSION.md` in the same format before context is compacted, so a mid-task compaction doesn't quietly lose in-flight state. It always exits 0 — a failed autosave never blocks compaction.

---

## 10. Troubleshooting

**"My edit was blocked and I don't have a PLAN.md."**
The spec gate is doing its job. Run `/task-workflow` and approve a spec — or, if the change is genuinely trivial, note that edits ≤20 lines and files under the trivial allowlist (`tests/**`, `*.md`, config) pass through untouched.

**"I have a PLAN.md and it's still blocked."**
Check two lines: `Status:` must read `approved`, and `Branch:` must match `git branch --show-current`. A plan left over from a finished task on another branch is the usual cause. Delete it.

**"The verifier keeps failing the same thing."**
At 3 rounds the loop stops and shows you the issue list. Usually the plan is wrong, not the code — the implementer is doing what `PLAN.md` says and the verifier is comparing against something else. Fix `PLAN.md`, then continue.

**"The agent picked an expensive tier."**
Say which one you want: "run this on the quick tier" or "use sonnet." An explicit instruction skips scoring entirely and takes precedence over everything.

**"Pre-commit fails on the context budget."**
`CLAUDE.md` went over 60 lines or an unscoped rule went over 40. Move the content into a path-scoped rule file with `paths:` frontmatter. See [§6](#6-living-with-the-gates).

**"Setup didn't recognize my stack."**
It sets `generic` and keeps going rather than stopping to ask. Lint/typecheck/test commands are detected from `package.json` scripts, a `Makefile`/`justfile`/`Taskfile`, or the language's conventional defaults; anything undetected stays a visible `TODO` in `CLAUDE.md` and `scripts/pre-commit.sh` rather than a guess. Fill those in. No CI is generated for `generic` — the summary tells you which commands a CI job needs instead.

**"Can I re-run harness setup?"**
Yes. It's idempotent, merges `settings.json`, appends to `README.md`, and confirms before overwriting anything.

**"An agent is asking me to confirm a shell command out of nowhere."**
Probably the injection gate (stage 2) after a recent web fetch. Check what was fetched before approving.

---

## 11. Glossary

| Term | Meaning |
| --- | --- |
| **Harness** | The governance layer: `CLAUDE.md`, `.claude/rules/`, guard hooks, budget gate, CI. |
| **Profile** | Which stack a repo is — `nuxt`, `next`, `go`, `nodejs`, or `generic`. Decides which templates get written. |
| **Guard** | A hook script under `.claude/guards/` that blocks or confirms a tool call. The load-bearing part of the system. |
| **Gate** | A checkpoint that fails closed — the spec gate, the pre-commit script, the budget gate. |
| **Tier** | One of the three execution subagents: quick / standard / deep. |
| **Ladder** | The model *and effort* assigned to each tier: `opus-centric` (default), `frontier`, or `lean`. |
| **Effort variant** | A second copy of a tier's agent that differs only in its effort pin (`standard-worker-high`, `verifier-medium`). Exists because effort can't be passed at spawn time. |
| **Verifier** | A fresh, read-only, memoryless subagent that audits a diff against `PLAN.md`. |
| **Bundle** | The `knowledge/` directory — concept files holding decisions, invariants, and pinned library APIs. |
| **Three-tier loading** | Always-loaded `CLAUDE.md` → path-scoped rules → on-demand skills. How the context budget stays small. |

---

## Where to go next

- Full reference for every profile and generated file — [`README.md`](../README.md)
- Running several tasks in parallel — [`skills/task-workflow/references/parallelization.md`](../skills/task-workflow/references/parallelization.md)
- A filled-in full spec — [`skills/task-workflow/references/full-spec-example.md`](../skills/task-workflow/references/full-spec-example.md)
- Model tier rationale — [`skills/model-router/references/model-profiles.md`](../skills/model-router/references/model-profiles.md)
- Migrating off Spec Kit — [`skills/bigin-harness-setup/references/speckit-migration.md`](../skills/bigin-harness-setup/references/speckit-migration.md)
- Contributing to the plugin — [`CLAUDE.md`](../CLAUDE.md)
