# Templates

## PORT/FEATURES.md template

```markdown
# Port inventory: <source-project> → <target-stack>

- Source: <repo-url> @ <commit-hash>
- Source license: <license> — <attribution/derivative-work notes>
- Scope: <one-sentence scope agreed in Phase 0>
- Status legend: [ ] not started · [x] ported · [~] adapted · [s] skipped

## Entry points
| # | Feature | Source location | Rating | Module | Status | Test |
|---|---------|----------------|--------|--------|--------|------|
| 1 | POST /auth/login | src/routes/auth.js:14 | CORE | auth | [ ] | — |
| 2 | Password reset email flow | src/services/mail.js | ADAPT (SES → SMTP) | auth | [ ] | — |
| 3 | Legacy XML export | src/export/xml.js | SKIP (user descoped) | — | [s] | — |

The Module column (here and on the Data model table below) is filled in at
Phase 3a when rows are grouped into named modules; each named module gets a
`PORT/spec/<module>.md`. SKIP'd rows get `—`.

## Data model
| Entity | Fields/constraints of note | Relations | Rating | Module | Status |
|--------|---------------------------|-----------|--------|--------|--------|

## Business rules
One row per rule that is NOT obvious from the entry-point table — validation
thresholds, permission matrices, state transitions, calculations. Quote the
exact numbers/conditions from source; these are what drift first.

## Side effects
Queues, cron jobs, webhooks, emails, file writes. Include schedules and
payload shapes.

## Config
| Env var | Purpose | Target equivalent |
|---------|---------|-------------------|

## Deliberate exclusions
Feature + one-line reason each. This section is what makes "skipped" a
decision instead of an accident.
```

## PORT/spec/<module>.md template

One file per module named at Phase 3a (small ports may combine closely related
modules into one file). Written stack-neutrally except Target adaptations.
Depth scales with module complexity — quote every rule for a permissions
engine, a few lines per section for plain CRUD.

```markdown
# Spec: <module-name>

- FEATURES.md rows: <row #s this module covers>
- Source: reference/<path(s)> @ <pinned commit>
- Status: draft | approved

## What
One paragraph — what this module does and why it exists.

## Inputs/outputs
Data in/out. Reference wire formats by contract file (PORT/contract/...),
don't duplicate them here.

## Business rules
Exact thresholds, permission conditions, state transitions, calculations —
quoted from source with reference/ file:line. These are what drift first.
This supersedes FEATURES.md's terser Business rules entry for the same
row(s) if the two ever disagree — this section comes from a dedicated
re-read of the source, FEATURES.md's was a first-pass summary.

## Edge cases & error behavior
Bad input, conflicts, empty states — the behaviors parity tests must pin.

## Side effects
Emails, queues, jobs, file writes — payloads and timing. Same authority
rule as Business rules above: this supersedes FEATURES.md's entry if the
two disagree.

## Target adaptations
ADAPT-rated rows only: what changes vs. source and why. The only
stack-specific section.

## Security notes
Only if the module touches auth/sessions/PII/untrusted input.

## Not in scope
SKIP'd rows, deferred behavior.
```

## PORT/PLAN.md template

```markdown
# Port plan: <source-project> → <target-stack>

- Status: draft | approved
- Row-level truth: PORT/FEATURES.md (this file tracks modules/sprints)

## Sprints
| # | Sprint | Modules | Depends on | Gate | Status |
|---|--------|---------|------------|------|--------|
| 1 | Auth core | auth, sessions | scaffold, vertical slice | module gates + user approves sprint | Not started |

## Modules
| # | Module | Spec | Sprint | Depends on | Status | Notes |
|---|--------|------|--------|------------|--------|-------|
| 1 | auth | PORT/spec/auth.md | 1 | — | Not started | |

Statuses: Not started · In progress · Done · Blocked (same vocabulary as
`task-workflow`'s PLAN.md, chosen deliberately for consistency across
sprint/task trackers — distinct from FEATURES.md's own checkbox legend
above, which tracks rows, not modules/sprints).
A module is Done only when all its FEATURES.md rows are checked and its
Phase 7 gate passed. Deferred-spec sprints carry a "write + approve specs"
row before their first module row.
```

## PORT/PARITY.md template

```markdown
# Parity report: <source-project> → <target-stack>

- Ported from: <repo-url> @ <commit-hash>
- Date: <date>
- Black-box suite: <path or "none">, results: <X/Y both-green>

## Summary
- CORE features: n/n ported
- ADAPT features: n/n ported with documented changes
- SKIP features: n (see FEATURES.md exclusions)

## Known behavioral differences
| # | Area | Source behavior | Port behavior | Deliberate? | Why |
|---|------|-----------------|---------------|-------------|-----|
| 1 | Error bodies | `{error: string}` | RFC 7807 problem+json | yes | target convention |

## Follow-ups
Anything discovered but out of scope, so it lands in a tracker instead of
evaporating.
```
