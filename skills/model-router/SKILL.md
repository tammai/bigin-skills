---
name: model-router
description: "Evaluates task complexity against a deterministic rubric (files touched, contract/schema risk, test coverage, reversibility, architectural-decision judgment) and routes execution to one of three pre-defined subagents — quick-executor (low effort), standard-worker (high effort), deep-architect (xhigh effort) — spawned via the Agent tool. The model each tier runs on is configurable per project (.claude/model-routing.json: frontier = sonnet/opus/fable, opus-centric, or lean = haiku/sonnet/opus) and overridable on demand. Routes down as well as up: high effort on a trivial task overthinks (slow, hedged, verbose), so a one-line fix gets the fast/cheap tier, not the default. MUST use when user says: 'route this task', 'which model should handle this', 'pick the right model tier for this', 'assess task complexity and route it', 'spawn the right agent for this change', 'should this be quick or deep', 'delegate this to the appropriate tier', 'set the model profile for this project', 'change the model ladder', 'use the lean profile', 'which models do the tiers use', 'định tuyến task này', 'chọn model phù hợp cho việc này', 'giao việc này cho agent nào', 'đánh giá độ phức tạp và định tuyến', 'đổi profile model cho project này'. Do NOT use when the user has already named both the tier and the model for a task they want done right now (e.g. 'use opus for this') — honor that directly instead of re-scoring it; setting the project's standing ladder in .claude/model-routing.json IS this skill's job. Do NOT use for the spec-format decision itself — task-workflow's full-spec tier triggers only on an explicit request, never on perceived complexity; model-router only picks the executing tier once work is about to start (it does treat an already-produced full-spec PLAN.md as an automatic high-tier signal)."
effort: medium
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/classify.mjs *), Bash(git status *), Bash(git diff *)
---

# model-router

Scores a task, then hands it off to the matching subagent. Three tiers, one each — effort is fixed per tier, the model is whatever the project's profile resolves to.

| Tier     | Subagent                       | Effort (fixed) | Model — `frontier` (default) | `opus-centric` | `lean` |
| -------- | ------------------------------ | -------------- | ---------------------------- | -------------- | ------ |
| Quick    | `bigin-skills:quick-executor`  | low            | sonnet                       | sonnet         | haiku  |
| Standard | `bigin-skills:standard-worker` | high           | opus                         | opus           | sonnet |
| Deep     | `bigin-skills:deep-architect`  | xhigh          | fable                        | opus           | opus   |

Mechanical signals come from `scripts/classify.mjs`; two signals are not mechanically detectable and must be reasoned about directly — never invent a score for them from the diff alone.

## Step 1: Gather mechanical signals

Run `node ${CLAUDE_SKILL_DIR}/scripts/classify.mjs`. Relay the JSON. Fields: `filesChanged`, `touchedFiles`, `highRiskMatches`, `testCoverageRatio`, `fullSpecDetected`, `routing`.

If the script errors (non-git-repo, no `git` on `PATH`, etc.) it still returns valid JSON with an `error` field — fall back to Step 2 for every signal, estimating `filesChanged` from the user's own description of scope. `routing` is still populated (with the default profile) even on that path.

## Step 2: Assess qualitative signals (reason directly, no tool)

- **Architectural decision required?** Yes if: introduces a new pattern/abstraction, changes a dependency direction, or there's more than one reasonable way to structure the change and picking one is a judgment call. No if: follows an existing, already-established pattern in the codebase.
- **Reversibility?** Hard if: data migration, published/external contract change, deployed infra change, anything with no clean single-commit revert. Easy otherwise.

## Step 3: Score → bucket → tier

**Auto-overrides — skip scoring, go straight to Deep:**

- `highRiskMatches` is non-empty (touches `openapi.yaml`, migrations, schema, secrets, or CI config)
- `fullSpecDetected` is true (a `task-workflow` full-spec-tier `PLAN.md` already exists)

**Otherwise, score with the point table:**

| Signal                          | 0 pts | +1      | +2   | +3  |
| ------------------------------- | ----- | ------- | ---- | --- |
| Files touched                   | 1     | 2-4     | 5+   |     |
| Test coverage ratio             | ≥0.7  | 0.3-0.7 | <0.3 |     |
| Architectural decision required | No    |         |      | Yes |
| Reversibility                   | Easy  |         | Hard |     |

Total 0-1 → Quick · 2-4 → Standard · 5+ → Deep.

Full point table plus worked examples: `references/scoring-rubric.md`.

## Step 3b: Resolve the model for that tier

The tier decides the agent and its effort; this step decides only which model it runs on. Precedence:

1. **On-demand instruction in this request** ("run it on fable", "use the lean ladder here") — this spawn only. Don't edit the project config for a one-off.
2. **`routing.models[tier]`** from Step 1 (resolved from `.claude/model-routing.json`).
3. The `frontier` default, which is what `routing` already reports when no config exists.

Relay any non-empty `routing.warnings` to the user — a malformed config degrades silently to the default otherwise, and a config the user thinks is active but isn't is worse than no config.

Profiles, config schema, and the effort rationale per model: `references/model-profiles.md`.

## Step 4: State tier + model + rationale

State the chosen tier, the model it will run on (and where that model came from if it wasn't the default), and the deciding signal(s) — one line. Only ask the user (single yes/no) if the score sits exactly on a bucket boundary **and** the qualitative signals were ambiguous — don't ask by default, that reintroduces the triage overhead this skill exists to remove.

## Step 5: Spawn

Call the Agent tool with `subagent_type: bigin-skills:<tier-agent-name>` (see the table above) and `model: <resolved model from Step 3b>` — pass `model` explicitly on every spawn, even when it matches the agent's frontmatter default, so the handoff and the actual run can't disagree. Pass: one-line task scope, `PLAN.md` path if one exists, the touched-file list, the chosen tier + rationale, and — if `graphify-out/graph.json` exists in the repo — a note of its presence plus a `docs/graph-usage.md` pointer, so the subagent knows why it was picked, can flag a mismatch, and navigates structurally before grepping. Also pass **objective**, **constraints**, and **definition-of-done** — a fixed payload template, not prose advice, so Step 6 has something concrete to check the return against.

Exact call shape and payload fields: `references/agent-invocation.md`.

## Step 6: Return evaluation

After the subagent returns, check it against the payload's `definition-of-done` (contract: `references/agent-invocation.md`'s "Return evaluation contract").

- **Met** — proceed to Step 7 (or use the result directly if nothing else applies).
- **Partial/unmet** — resume the *same* subagent (`SendMessage` to its agent ID, not a fresh Agent call) naming the specific gap against the definition-of-done. Track the cycle count in your own working context — max **2 follow-up cycles** (3 dispatches total, including the original spawn).
- **Cycle cap hit:**
  - Quick-tier exhaustion → exactly one `standard-worker` attempt, with the full loop history (every prior return + the gaps named) folded into its payload.
  - Standard-tier or Deep-tier exhaustion → surface to the user; don't retry further and don't escalate tiers on this path.
- Never spawn `bigin-skills:verifier` from this step — that's a separate, `task-workflow`-only mechanism scoped to auditing a diff against `PLAN.md`. This evaluation is deliberately lighter than a verifier round.
- Never auto-escalate into `deep-architect` from exhaustion — Deep stays reachable only via Step 3's auto-overrides (`highRiskMatches`, `fullSpecDetected`).

A `ROUTING_MISMATCH:` reply at any point during this loop short-circuits straight to Step 7 — re-scoring wins over continuing the retry loop, since a wrong tier makes definition-of-done checks meaningless.

## Step 7: Handback protocol

If the spawned subagent reports a routing mismatch (a reply starting `ROUTING_MISMATCH:` — see `references/agent-invocation.md`), re-score with the new information and respawn the correct tier (re-running Step 3b for the new tier's model). Don't try to change the running subagent's model or effort mid-session — both are fixed once it's spawned, not mutable in place.

## References

- `scripts/classify.mjs` — mechanical signal gathering + model-ladder resolution; never outputs a suggested tier.
- `references/model-profiles.md` — profiles, `.claude/model-routing.json` schema, override precedence, effort rationale per model.
- `references/scoring-rubric.md` — full point table + 3 worked examples.
- `references/agent-invocation.md` — Agent tool call shape, payload fields (objective/constraints/definition-of-done), return evaluation contract, handback contract.
