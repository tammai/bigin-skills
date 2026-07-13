# Scoring rubric

## Auto-overrides (skip scoring entirely)

| Trigger | Why |
|---|---|
| `highRiskMatches` non-empty | Touches `openapi.yaml`/`.json`, `migrations/`, `schema.sql`/`.prisma`, `.env*`, `docker-compose`, `Dockerfile`, `.github/workflows/`, or `.claude/(guards\|rules)/` — contract, data, or governance surface. Wrong here is expensive to unwind. |
| `fullSpecDetected` | A `task-workflow` full-spec-tier `PLAN.md` already exists. The user already signaled this needs deep, structured treatment (FR-IDs, API contract, data model) — honor that signal instead of re-deriving it from a diff. |

Either one → `deep-architect`, no further scoring.

## Point table

| Signal | 0 pts | +1 | +2 | +3 |
|---|---|---|---|---|
| Files touched | 1 | 2-4 | 5+ | |
| Test coverage ratio | ≥0.7 | 0.3-0.7 | <0.3 | |
| Architectural decision required | No | | | Yes |
| Reversibility | Easy | | Hard | |

**Buckets:** 0-1 → `quick-executor` · 2-4 → `standard-worker` · 5+ → `deep-architect`.

These thresholds are a starting point, not tuned against real usage yet — expect to adjust after the first several real routings.

## Worked examples

### 1. Typo fix in README

`classify.mjs` reports: `filesChanged: 1`, `highRiskMatches: []`, `testCoverageRatio: null` (no code touched, so no test to check), `fullSpecDetected: false`.

Qualitative: no architectural decision, trivially reversible.

Score: files touched (1 → 0 pts) + coverage (n/a → 0 pts) + architecture (No → 0 pts) + reversibility (Easy → 0 pts) = **0 → quick-executor**.

### 2. New CRUD endpoint following an existing pattern, tests present

`classify.mjs` reports: `filesChanged: 3` (handler, route registration, test file), `highRiskMatches: []`, `testCoverageRatio: 1.0`, `fullSpecDetected: false`.

Qualitative: follows the codebase's existing CRUD-endpoint pattern exactly — no architectural decision. Reversible in one commit.

Score: files touched (3 → +1) + coverage (1.0 → 0 pts) + architecture (No → 0 pts) + reversibility (Easy → 0 pts) = **1 → quick-executor** if truly mechanical, but if the endpoint requires picking validation rules or an auth scope that isn't already established elsewhere, architecture flips to Yes: **1 + 3 = 4 → standard-worker**. This is the common case — most "new endpoint" work lands here once you account for the small judgment calls a template doesn't cover.

### 3. New payments integration touching `openapi.yaml`

`classify.mjs` reports: `highRiskMatches: ["openapi.yaml"]`.

Auto-override fires immediately — **deep-architect**, no scoring needed. (Would also have scored high on its own: many files, no prior pattern, hard to reverse once a contract ships.)
