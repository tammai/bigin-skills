---
name: model-router
description: "Evaluates task complexity against a deterministic rubric (files touched, contract/schema risk, test coverage, reversibility, architectural-decision judgment) and routes execution to one of three pre-defined subagents — quick-executor (haiku/low effort), standard-worker (sonnet/medium effort), deep-architect (opus/high effort) — spawned via the Agent tool. Routes down as well as up: high effort on a trivial task overthinks (slow, hedged, verbose), so a one-line fix gets the fast/cheap tier, not the default. MUST use when user says: 'route this task', 'which model should handle this', 'pick the right model tier for this', 'assess task complexity and route it', 'spawn the right agent for this change', 'should this be quick or deep', 'delegate this to the appropriate tier', 'định tuyến task này', 'chọn model phù hợp cho việc này', 'giao việc này cho agent nào', 'đánh giá độ phức tạp và định tuyến'. Do NOT use when the user has already named a specific model/tier explicitly (e.g. 'use opus for this') — honor that directly instead of re-scoring it. Do NOT use for the spec-format decision itself — task-workflow's full-spec tier triggers only on an explicit request, never on perceived complexity; model-router only picks the executing tier once work is about to start (it does treat an already-produced full-spec PLAN.md as an automatic high-tier signal)."
effort: medium
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/classify.mjs *), Bash(git status *), Bash(git diff *)
---

# model-router

Scores a task, then hands it off to the matching subagent. Three tiers, one each:

| Tier | Subagent | Model | Effort |
|---|---|---|---|
| Quick | `bigin-skills:quick-executor` | haiku | low |
| Standard | `bigin-skills:standard-worker` | sonnet | medium |
| Deep | `bigin-skills:deep-architect` | opus | high |

Mechanical signals come from `scripts/classify.mjs`; two signals are not mechanically detectable and must be reasoned about directly — never invent a score for them from the diff alone.

## Step 1: Gather mechanical signals

Run `node ${CLAUDE_SKILL_DIR}/scripts/classify.mjs`. Relay the JSON. Fields: `filesChanged`, `touchedFiles`, `highRiskMatches`, `testCoverageRatio`, `fullSpecDetected`.

If the script errors (non-git-repo, no `git` on `PATH`, etc.) it still returns valid JSON with an `error` field — fall back to Step 2 for every signal, estimating `filesChanged` from the user's own description of scope.

## Step 2: Assess qualitative signals (reason directly, no tool)

- **Architectural decision required?** Yes if: introduces a new pattern/abstraction, changes a dependency direction, or there's more than one reasonable way to structure the change and picking one is a judgment call. No if: follows an existing, already-established pattern in the codebase.
- **Reversibility?** Hard if: data migration, published/external contract change, deployed infra change, anything with no clean single-commit revert. Easy otherwise.

## Step 3: Score → bucket → tier

**Auto-overrides — skip scoring, go straight to Deep:**
- `highRiskMatches` is non-empty (touches `openapi.yaml`, migrations, schema, secrets, or CI config)
- `fullSpecDetected` is true (a `task-workflow` full-spec-tier `PLAN.md` already exists)

**Otherwise, score with the point table:**

| Signal | 0 pts | +1 | +2 | +3 |
|---|---|---|---|---|
| Files touched | 1 | 2-4 | 5+ | |
| Test coverage ratio | ≥0.7 | 0.3-0.7 | <0.3 | |
| Architectural decision required | No | | | Yes |
| Reversibility | Easy | | Hard | |

Total 0-1 → Quick · 2-4 → Standard · 5+ → Deep.

Full point table plus worked examples: `references/scoring-rubric.md`.

## Step 4: State tier + rationale

State the chosen tier and the deciding signal(s) in one line. Only ask the user (single yes/no) if the score sits exactly on a bucket boundary **and** the qualitative signals were ambiguous — don't ask by default, that reintroduces the triage overhead this skill exists to remove.

## Step 5: Spawn

Call the Agent tool with `subagent_type: bigin-skills:<tier-agent-name>` (see the table above). Pass: one-line task scope, `PLAN.md` path if one exists, the touched-file list, and the chosen tier + rationale — so the subagent knows why it was picked and can flag a mismatch.

Exact call shape and payload fields: `references/agent-invocation.md`.

## Step 6: Handback protocol

If the spawned subagent reports a routing mismatch (a reply starting `ROUTING_MISMATCH:` — see `references/agent-invocation.md`), re-score with the new information and respawn the correct tier. Don't try to change the running subagent's model mid-session — effort and model are fixed at spawn time, not mutable in place.

## References

- `scripts/classify.mjs` — mechanical signal gathering only; never outputs a suggested tier.
- `references/scoring-rubric.md` — full point table + 3 worked examples.
- `references/agent-invocation.md` — Agent tool call shape, handback contract.
