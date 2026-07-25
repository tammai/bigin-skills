# Ownership protocol

In an agent team every teammate writes into the lead's working tree. Claude Code file-locks *task claiming* but not file writes, and its only stated mitigation is advisory ("break the work so each teammate owns a different set of files"). This is how we make that enforceable.

## Why ownership lives in the plan file

A `PreToolUse` hook can see `session_id` and sometimes `agent_id`/`agent_type` — but **nothing binds any of those to the teammate name the lead assigned**: no payload field, no env var, no session id in the roster's member records, and no usable argv (in-process teammates share the lead's OS process). So a `name → globs` map would rest on a name the teammate self-declares and the guard can't verify: a suggestion, not a gate.

Inverting it fixes that. The gate asks only **"is this path claimed by exactly one approved plan?"** — answerable from `tool_input.file_path` alone, with zero identity. It also collapses ownership and spec-approval into one artifact, so there's one file, one staleness story, and one cleanup step.

## The record

One plan per concurrent task at **`.claude/task-plans/<slug>.md`** — keyed by task slug, not teammate name, so it survives reassignment (`TaskUpdate owner:`). Not `.claude/plans/`: a Claude Code setting already claims that name for a project-relative plan directory.

Ordinary single-agent work keeps using the repo-root `PLAN.md` exactly as before.

```markdown
# Plan: api-pagination

Status: approved
Owns: server/api/**, server/repo/pagination.ts
Verified: PASS 2026-07-25T09:12:00Z

## Spec
...

## Tasks
| # | Task | Status | Notes |
```

| Line | Written by | Read by | Meaning |
| ---- | ---------- | ------- | ------- |
| `Status:` | lead, after human approval | `spec-gate-guard.mjs`, `task-plan-gate.mjs` | Same semantics as today's `PLAN.md` |
| `Owns:` | lead, at plan time | `spec-gate-guard.mjs`, `task-plan-gate.mjs` | Comma-separated repo-root-relative globs. **Its presence is what opts the repo into scoped mode** |
| `Verified:` | lead, after a verifier `PASS` | `task-verify-gate.mjs` | Gates task completion |

## Glob semantics

- Repo-root-relative, POSIX separators. `**` crosses directories; `*` and `?` don't.
- Precedence is **specificity** — the number of literal characters before the first wildcard. Higher wins. `**` scores 0, so a catch-all always loses to a specific glob.
- Two plans matching a path at *equal* specificity is a **collision**, and blocking it is how overlapping ownership gets caught. Fix by narrowing one plan's globs or sequencing the tasks — never by adding both.

```
server/repo/pagination.ts   → specificity 25   (wins)
server/api/**               → specificity 11
**                          → specificity 0    (always loses)
```

## What the gates do

| Situation | Result |
| --------- | ------ |
| No plan file anywhere has an `Owns:` line | **Legacy mode** — `spec-gate-guard.mjs` behaves byte-identically to before teams existed. This is the compatibility contract for every already-scaffolded repo |
| Path matches exactly one plan, `Status: approved` | Allow |
| Path matches exactly one plan, not approved | Block — get spec approval first |
| Path matches two plans at equal specificity | Block — overlapping ownership, named in the message |
| Path matches no plan, scoped mode active | **Block at any size.** The ≤20-line escape hatch does not apply to an unclaimed file — a 5-line edit to a file nobody owns is exactly the silent overwrite this exists to stop |
| A plan file is unreadable or its `Owns:` unparseable | Block, with the parse error. A corrupt ownership map under concurrency is when you most need the gate |
| `TaskCreate` whose description has no `Plan:` (and no `[coordination]`) | Block — the plan must exist before the task |
| `TaskCompleted` for a plan with no `Verified: PASS` | Block — the implement/verify loop hasn't closed |
| `TaskCompleted` whose plan file is already gone | **Allow.** Cleanup-then-complete is legitimate, and a task that can never be completed deadlocks the team |

Both task-hook gates no-op entirely when `.claude/task-plans/` doesn't exist, because `TaskCreate`/`TaskCompleted` also fire in ordinary non-team sessions.

## Where the lead's own edits go

In order of preference:

1. **The lead coordinates and doesn't implement.** Its writes land on `.md`/config paths that the gate treats as trivial anyway.
2. The lead keeps the root `PLAN.md` with its own narrow `Owns:` and implements inside it like any other member.
3. `Owns: **` in `PLAN.md` as a deliberate catch-all — safe only because `**` loses every specificity contest, so it never blocks a teammate holding a specific glob.

## Worked example

Cross-layer feature: cursor pagination across a Go API and a Nuxt table.

```
.claude/task-plans/api-pagination.md    Owns: server/api/**, server/repo/pagination.ts
.claude/task-plans/table-pagination.md  Owns: app/components/DataTable/**
```

```
Task 1  "api-pagination — cursor params + repo query"     Plan: .claude/task-plans/api-pagination.md      owner: alpha
Task 2  "table-pagination — wire cursor into DataTable"   Plan: .claude/task-plans/table-pagination.md    owner: beta
        blockedBy: [1]                                     (needs the contract Task 1 settles)
Task 3  "[coordination] synthesize + review both slices"  owner: team-lead
```

`app/types/api.ts` is generated from the contract and both slices read it — so it belongs to **neither** plan. Give it to Task 1 (`Owns: server/api/**, server/repo/pagination.ts, app/types/api.ts`) and let Task 2 depend on Task 1, rather than letting both claim it. Two claims on a generated file is the exact collision the gate blocks.

## Staleness

The plan file *is* what the shared task points at, so it can't drift from an out-of-band map. The one real staleness is a plan left behind after cleanup — and that fails **loudly**: the next agent to touch those paths gets an overlap or unapproved block naming a plan whose work is done. Delete plan files as part of cleanup (`SKILL.md` Step 6).
