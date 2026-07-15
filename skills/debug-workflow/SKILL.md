---
name: debug-workflow
description: "Systematic four-phase debugging: root cause investigation → pattern analysis → hypothesis testing → fix + validation. MUST use when user says: 'why is this failing', 'debug this', 'this test is flaky', 'why is this test flaky', 'this works in staging but not in prod', 'production incident', 'performance regression', 'investigate this stack trace', 'gỡ lỗi giúp tôi', 'tại sao lỗi này xảy ra', 'debug giúp tôi cái này' — whenever the failure isn't yet tied to a tracked task. Do NOT use for new feature implementation or a tracked bug fix already going through PLAN.md (see task-workflow) or for authoring new tests (see write-tests)."
effort: medium
---

# debug-workflow

Four phases, gated — do not start phase N+1 without phase N's output recorded. No fix proposals before phase 4 — phase 3's own change is a disposable diagnostic probe to confirm or refute the hypothesis, not the fix itself; only phase 4 turns a confirmed hypothesis into the actual fix.

## When this applies vs task-workflow

`task-workflow` owns any bug fix tracked through `PLAN.md` (scope → skip-spec → implement/verify loop → review → cleanup). Its step 4 (Implement/verify loop) points here for the actual debugging work. Use `debug-workflow` directly, standalone, when the failure isn't yet tied to a ticket/PLAN.md: a flaky test, a stack trace, "works in staging not prod," a live incident.

## Phases

1. **Root Cause Investigation.** Trace the failure backward through the call stack / request path. Add diagnostic logging at each component boundary crossed, explicit per layer:
   - Nuxt composable → log inputs/outputs at the call site
   - Pinia / Pinia Colada store → log state before and after the action
   - API client → log the request payload and response
   - Go handler → log what it received and what it returned
   - DB → log the query and the row(s) it touched
   No fix proposals in this phase — only evidence.

2. **Pattern Analysis.** Compare the failing path against a known-working analogous path (another composable, another handler) to isolate what's actually different — config, environment, timing, data shape.

3. **Hypothesis Testing.** State exactly one hypothesis, supported by evidence from phases 1–2. Test it with the smallest possible change — a disposable probe to confirm or refute, not a shippable fix. If wrong, discard the probe and return to phase 1 — do not stack a second hypothesis on an unconfirmed one.

4. **Fix + Validation.** Implement only once root cause is confirmed. Validate with the actual failing test/repro now passing, plus a check that nothing adjacent broke. Show this validation output — don't claim it passed without showing it (same discipline as `write-tests` and `task-workflow`'s Verify step).

## Escalation safeguard

After 3 failed fix attempts on the same issue: **stop and ask** — flag it as an architecture-level problem for human review instead of continuing to patch. (Same "stop and ask" phrasing as `task-workflow`'s Scope discipline — don't stack further attempts silently.)

## References

- `references/race-conditions.md` — condition-based waiting instead of arbitrary timeouts, for timing-related bugs
- `references/defense-in-depth.md` — after the fix, add validation at the layer that should have caught it originally
