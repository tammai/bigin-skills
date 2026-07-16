# Templates

## PORT/FEATURES.md template

```markdown
# Port inventory: <source-project> → <target-stack>

- Source: <repo-url> @ <commit-hash>
- Source license: <license> — <attribution/derivative-work notes>
- Scope: <one-sentence scope agreed in Phase 0>
- Status legend: [ ] not started · [x] ported · [~] adapted · [s] skipped

## Entry points
| # | Feature | Source location | Rating | Status | Test |
|---|---------|----------------|--------|--------|------|
| 1 | POST /auth/login | src/routes/auth.js:14 | CORE | [ ] | — |
| 2 | Password reset email flow | src/services/mail.js | ADAPT (SES → SMTP) | [ ] | — |
| 3 | Legacy XML export | src/export/xml.js | SKIP (user descoped) | [s] | — |

## Data model
| Entity | Fields/constraints of note | Relations | Rating | Status |
|--------|---------------------------|-----------|--------|--------|

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
