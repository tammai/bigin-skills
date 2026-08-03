# Scoring rubric

Two independent axes, because they answer different questions and have different fixes:

- **Capability** — can the model do this *at all*? Picks the tier (and therefore the model). Raise it when the model has all the context, clearly tried, and still got it wrong.
- **Verification** — how thoroughly does the work need checking? Sets the gate discipline in the spawn payload, not the model. Raise it when the failure was skipping a file, not running tests, or bailing partway.

Scoring one axis and spending the result on the other is the mistake this split exists to prevent: file count and reversibility are verification signals, and buying a more capable model with them over-provisions routine work while under-provisioning small-but-hard work.

---

## Axis 1: Capability → tier

**Auto-override — skip scoring, go straight to Deep:**

| Trigger | Why |
|---|---|
| `fullSpecDetected` | A `task-workflow` full-spec-tier `PLAN.md` already exists. The user explicitly signalled this needs deep, structured treatment (FR-IDs, API contract, data model) — honor the signal instead of re-deriving it. |
| A **breaking** contract change, or a **data migration that transforms existing rows** | Genuinely a design problem, not just a risky file. There's no clean revert once it ships, and the shape has to be right the first time. |

Note the second one is about the *change*, not the path. `highRiskMatches` being non-empty is a prompt to ask the question — "is this breaking, or is it additive?" — not the answer. An added optional OpenAPI field or a bumped action version touches a high-risk path and is still a Quick-tier edit; it raises the verification bar (Axis 2), not the tier.

**Otherwise, score:**

| Signal                | 0 pts                                | +1                              | +2                                              | +3                                |
| --------------------- | ------------------------------------ | ------------------------------- | ----------------------------------------------- | --------------------------------- |
| Pattern to follow     | An equivalent exists in this codebase | Similar, needs real adaptation  |                                                 | None — needs a new pattern/abstraction |
| Structural judgment   | One obvious structure                |                                 | More than one reasonable structure, and the choice matters |                                   |
| Problem understood    | Requirements and cause are clear     | Some ambiguity left to resolve  | Unfamiliar domain, or root cause still unknown  |                                   |
| Simultaneous context  | ≤2 files                             | 3–9 files                       | 10+ files                                       |                                   |

**Buckets:** 0-1 → **Quick** · 2-4 → **Standard** · 5+ → **Deep**. The bucket names the *tier*; which agent file that tier spawns depends on the project profile (see `model-profiles.md`), so resolve it from `routing.agents[tier]` rather than assuming the base name.

Only the last row is mechanical (`filesChanged` from `classify.mjs`), and it's deliberately the cheapest signal — breadth costs context, not capability. The other three are reasoned about directly; never invent them from a diff. When `scope` is `none`, `filesChanged` is unknown rather than 0 — estimate it from the stated scope.

---

## Axis 2: Verification bar → spawn payload

Independent of tier. A Quick-tier task on a contract file still gets the full bar; a Deep-tier greenfield task with nothing risky in it doesn't need one.

| Trigger (mechanical unless noted)              | Verification bar to state in the payload                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `highRiskMatches` non-empty                     | A verifier round is **mandatory** even where `task-workflow` would skip it; show full gate output; state the revert path in `PLAN.md` notes |
| `testCoverageRatio` < 0.3, or null with code changes | Tests come first, per `write-tests`' TDD ordering — an untested change doesn't get validated by eye                   |
| `plannedNewFiles` non-empty                          | Tests come first, same ordering. Distinct from the row above: a file that doesn't exist yet is uncovered by construction, so it's excluded from `testCoverageRatio` rather than dragging it to 0 |
| `filesChanged` ≥ 5                              | Run gates across the whole tree, not just the touched files                                                               |
| Flaky/timing symptom (reasoned)                 | ≥5 consecutive passes, per `debug-workflow`'s own `race-conditions.md`                                                    |
| None of the above                               | Normal gates: lint + typecheck + tests, with actual output shown                                                          |

Triggers stack. Two matches means both bars apply.

---

## Worked examples

### 1. Typo fix in README

Planned scope: `README.md`. `highRiskMatches: []`, `testCoverageRatio: null` (no code touched).

Capability: pattern n/a → 0 · one obvious structure → 0 · clear → 0 · 1 file → 0 = **0 → Quick**.
Verification: nothing triggers → normal gates.

### 2. Subtle bug in one well-tested file, unfamiliar subsystem

Planned scope: 1 file. `testCoverageRatio: 1.0`, `highRiskMatches: []`.

Capability: fixing within existing code → 0 · one obvious fix once the cause is known → 0 · **root cause unknown, unfamiliar domain → +2** · 1 file → 0 = **2 → Standard**.
Verification: coverage is good, scope is small → normal gates.

This is the case the old single-axis rubric got wrong: 1 file + good coverage + easy revert scored 0 and routed to the cheapest tier at the lowest effort, which is exactly the "clearly tried and still got it wrong" case that wants a more capable model. Capability is now carried by the signal that actually predicts it.

### 3. Mechanical rename across 30 fully-tested files

`filesChanged: 30`, `testCoverageRatio: 0.9`, `highRiskMatches: []`.

Capability: existing pattern, it's a rename → 0 · one obvious structure → 0 · fully understood → 0 · **10+ files → +2** = **2 → Standard**.
Verification: **filesChanged ≥ 5 → gates across the whole tree.**

Breadth buys the context to hold 30 files, and a whole-tree gate run. It does not buy the top model — on routine work at the same effort, a larger model mostly adds verification steps at a higher per-token price.

### 4. Add one optional field to `openapi.yaml` + regenerate

`highRiskMatches: ["openapi.yaml"]`, `filesChanged: 3` (contract, generated types, one handler).

Auto-override check: additive, not breaking, no migration → **does not fire**.
Capability: established additive-field pattern → 0 · one obvious structure → 0 · clear → 0 · 3 files → +1 = **1 → Quick**.
Verification: **`highRiskMatches` non-empty → mandatory verifier round, full gate output, revert path noted.**

Under the old rubric the path match alone sent this to the Deep tier at the top model and the top effort. The risk was real; the response was aimed at the wrong axis.

### 5. New payments integration, breaking a published endpoint

`highRiskMatches: ["openapi.yaml", "db/migrations/0007_payments.sql"]`.

Auto-override fires — a breaking contract change plus a migration → **Deep**, no scoring. (It would have scored there anyway: no prior pattern +3, structural judgment +2, 10+ files +2 = 7.)
Verification: `highRiskMatches` non-empty and coverage starts at 0 → mandatory verifier round, tests first, full gate output, revert path.

---

## Calibration

These thresholds are a starting point. The capability rows are ordered by how strongly each predicts "a bigger model would get this right and a smaller one wouldn't" — pattern-novelty first, breadth last. Adjust after real routings; if a tier keeps handing back `ROUTING_MISMATCH:`, the row that drove the score is the one to re-weight.

**The tier to watch is Quick.** Most 0-1 work is trivial enough that `task-workflow` skips the implement/verify loop and does it inline, so quick's realistic home is a standalone `/model-router` call plus the narrow band that reaches the loop — a feature past the spec gate's ≤20-line threshold that still follows an exact existing pattern in ≤3 files. That band is real but thin. If quick genuinely never gets selected across a stretch of real routings, that's the evidence for folding it into Standard and re-bucketing to two tiers; don't remove it on the theory that it's unused without checking.
