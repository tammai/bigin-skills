---
name: model-router
description: "Scores task capability and verification needs on separate axes, then routes execution to the quick-executor, standard-worker, or deep-architect subagent; also sets the project's model ladder. Triggers: 'route this task', 'which model should handle this', 'quick or deep'."
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

Two axes, scored separately, because they answer different questions:

- **Capability** picks the tier, and therefore the model. Raise it when the model had the context, clearly tried, and still got it wrong.
- **Verification** sets the gate discipline in the spawn payload, and never touches the model. Raise it when the failure was a skipped file, unrun tests, or a refactor abandoned partway.

Breadth, coverage, and blast radius are *verification* signals. Spending them on a bigger model over-provisions routine work (a 30-file rename is not hard, just wide) and under-provisions small-but-hard work (a one-file bug in an unfamiliar subsystem is the case that actually wants a stronger model). Routes down as well as up: a one-line fix gets the fast/cheap tier, not the default.

Mechanical signals come from `scripts/classify.mjs`. The capability signals are mostly *not* mechanically detectable and must be reasoned about directly — never invent them from a diff.

## When not to use

- The user already named **both** the tier and the model for work they want done right now ("use opus for this") — honor that directly instead of re-scoring. Setting the project's standing ladder in `.claude/model-routing.json` *is* this skill's job, so that request does belong here.
- The spec-format decision — `task-workflow`'s full-spec tier fires only on an explicit request, never on perceived complexity. This skill only picks the executing tier once work is about to start (an already-produced full-spec `PLAN.md` is an automatic high-tier signal).

## Step 1: Gather mechanical signals

Routing happens *before* work starts, so pass the **planned** scope — the files you're about to change, from `PLAN.md` or the user's description:

```sh
node ${CLAUDE_SKILL_DIR}/scripts/classify.mjs --paths "path/one.ts,path/two.ts"
```

Relay the JSON. Fields: `scope`, `filesChanged`, `touchedFiles`, `highRiskMatches`, `testCoverageRatio`, `fullSpecDetected`, `routing`.

With no `--paths` the script falls back to uncommitted changes, then the branch diff — correct mid-task, wrong at the start. `scope` tells you which it used:

- `planned` / `uncommitted` / `branch` — signals are real, use them.
- `none` — a clean tree with no planned scope. `filesChanged`, `highRiskMatches`, and `testCoverageRatio` come back `null`, meaning **unknown, not zero**. Never score a `null` as 0 pts — that's what made every fresh task look trivial. Either re-run with `--paths`, or estimate from the stated scope in Step 2.
- On an `error` field (non-git repo, no `git` on `PATH`) — same handling as `none`. `routing` is still populated with the default profile either way.

## Step 2: Assess capability signals (reason directly, no tool)

- **Is there a pattern to follow?** An equivalent already in this codebase, something similar needing real adaptation, or nothing — a new pattern/abstraction.
- **Is there a structural judgment call?** More than one reasonable way to structure this, where the choice matters, versus one obvious shape.
- **Is the problem understood?** Requirements and cause clear, some ambiguity left, or an unfamiliar domain / unknown root cause.

These predict capability. Note what's *not* here: reversibility and blast radius moved to Step 3b, where they belong.

## Step 3: Score capability → tier

**Auto-overrides — skip scoring, go straight to Deep:**

- `fullSpecDetected` is true (a `task-workflow` full-spec-tier `PLAN.md` already exists — an explicit user signal)
- The change is a **breaking** contract change, or a **data migration that transforms existing rows**

A non-empty `highRiskMatches` is *not* an override. It's a prompt to ask whether the second bullet applies — additive contract changes and version bumps touch the same paths and are ordinary edits. What high-risk paths do change is the verification bar (Step 3b).

**Otherwise, score:**

| Signal               | 0 pts                                 | +1                             | +2                                                         | +3                                     |
| -------------------- | ------------------------------------- | ------------------------------ | ---------------------------------------------------------- | -------------------------------------- |
| Pattern to follow    | An equivalent exists in this codebase | Similar, needs real adaptation |                                                            | None — needs a new pattern/abstraction |
| Structural judgment  | One obvious structure                 |                                | More than one reasonable structure, and the choice matters |                                        |
| Problem understood   | Requirements and cause are clear      | Some ambiguity to resolve      | Unfamiliar domain, or root cause unknown                   |                                        |
| Simultaneous context | ≤2 files                              | 3–9 files                      | 10+ files                                                  |                                        |

Total 0-1 → Quick · 2-4 → Standard · 5+ → Deep.

Full tables plus five worked examples: `references/scoring-rubric.md`.

## Step 3b: Set the verification bar (independent of tier)

From the mechanical signals — this changes what the payload demands, never which model runs:

| Trigger                                              | Bar                                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `highRiskMatches` non-empty                          | Verifier round **mandatory** even where `task-workflow` would skip it; full gate output; revert path in `PLAN.md` |
| `testCoverageRatio` < 0.3, or null with code changes | Tests first, per `write-tests`' TDD ordering                                                                      |
| `filesChanged` ≥ 5                                   | Gates across the whole tree, not just touched files                                                               |
| Flaky/timing symptom                                 | ≥5 consecutive passes (see `debug-workflow`'s `race-conditions.md`)                                               |
| None of the above                                    | Normal gates: lint + typecheck + tests, output shown                                                              |

Triggers stack.

## Step 3c: Resolve the model for that tier

The tier decides the agent and its effort; this step decides only which model it runs on. Precedence:

1. **On-demand instruction in this request** ("run it on fable", "use the lean ladder here") — this spawn only. Don't edit the project config for a one-off.
2. **`routing.models[tier]`** from Step 1 (resolved from `.claude/model-routing.json`).
3. The `frontier` default, which is what `routing` already reports when no config exists.

Relay any non-empty `routing.warnings` to the user — a malformed config degrades silently to the default otherwise, and a config the user thinks is active but isn't is worse than no config.

Profiles, config schema, and the effort rationale per model: `references/model-profiles.md`.

## Step 4: State tier + model + verification bar + rationale

One line: the chosen tier, the model it will run on (and where that model came from if it wasn't the default), the verification bar from Step 3b, and the deciding signal(s). Only ask the user (single yes/no) if the capability score sits exactly on a bucket boundary **and** the Step 2 signals were ambiguous — don't ask by default, that reintroduces the triage overhead this skill exists to remove.

## Step 5: Spawn

Call the Agent tool with `subagent_type: bigin-skills:<tier-agent-name>` (see the table above) and `model: <resolved model from Step 3c>` — pass `model` explicitly on every spawn, even when it matches the agent's frontmatter default, so the handoff and the actual run can't disagree. Pass: one-line task scope, `PLAN.md` path if one exists, the touched-file list, the chosen tier + rationale, **the Step 3b verification bar**, and — if `graphify-out/graph.json` exists in the repo — a note of its presence plus a `docs/graph-usage.md` pointer, so the subagent knows why it was picked, can flag a mismatch, and navigates structurally before grepping. Also pass **objective**, **constraints**, and **definition-of-done** — a fixed payload template, not prose advice, so Step 6 has something concrete to check the return against. The verification bar belongs in `definition-of-done`, so an unmet bar is a Step 6 gap rather than a footnote.

Exact call shape and payload fields: `references/agent-invocation.md`.

## Step 6: Return evaluation

After the subagent returns, check it against the payload's `definition-of-done` (contract: `references/agent-invocation.md`'s "Return evaluation contract").

- **Met** — proceed to Step 7 (or use the result directly if nothing else applies).
- **Partial/unmet** — resume the *same* subagent (`SendMessage` to its agent ID, not a fresh Agent call) naming the specific gap against the definition-of-done. Track the cycle count in your own working context — max **2 follow-up cycles** (3 dispatches total, including the original spawn).
- **Cycle cap hit:**
  - Quick-tier exhaustion → exactly one `standard-worker` attempt, with the full loop history (every prior return + the gaps named) folded into its payload.
  - Standard-tier or Deep-tier exhaustion → surface to the user; don't retry further and don't escalate tiers on this path.
- Never spawn `bigin-skills:verifier` from this step — that's a separate, `task-workflow`-only mechanism scoped to auditing a diff against `PLAN.md`. This evaluation is deliberately lighter than a verifier round.
- Never auto-escalate into `deep-architect` from exhaustion — Deep is reachable via Step 3's capability score or its auto-overrides (`fullSpecDetected`, a breaking contract change or row-transforming migration), not by exhausting a lower tier.

A `ROUTING_MISMATCH:` reply at any point during this loop short-circuits straight to Step 7 — re-scoring wins over continuing the retry loop, since a wrong tier makes definition-of-done checks meaningless.

## Step 7: Handback protocol

If the spawned subagent reports a routing mismatch (a reply starting `ROUTING_MISMATCH:` — see `references/agent-invocation.md`), re-score with the new information and respawn the correct tier (re-running Step 3c for the new tier's model). Don't try to change the running subagent's model or effort mid-session — both are fixed once it's spawned, not mutable in place.

## References

- `scripts/classify.mjs` — mechanical signal gathering (`--paths` for planned scope) + model-ladder resolution; never outputs a suggested tier.
- `references/model-profiles.md` — profiles, `.claude/model-routing.json` schema, override precedence, effort rationale per model.
- `references/scoring-rubric.md` — both axes in full (capability point table, verification-bar triggers) + 5 worked examples.
- `references/agent-invocation.md` — Agent tool call shape, payload fields (objective/constraints/definition-of-done), return evaluation contract, handback contract.
