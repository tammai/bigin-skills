---
name: debug-workflow
description: "Systematic debugging with triage — fast path for obvious bugs, full guarded workflow (repro → evidence → hypothesis → fix → prevention) for hard ones. MUST use when user says: 'why is this failing', 'debug this', 'this test is flaky', 'why is this test flaky', 'this works in staging but not in prod', 'production incident', 'performance regression', 'investigate this stack trace', 'gỡ lỗi giúp tôi', 'tại sao lỗi này xảy ra', 'debug giúp tôi cái này' — whenever the failure isn't yet tied to a tracked task. Do NOT use for new feature implementation or a tracked bug fix already going through PLAN.md (see task-workflow) or for authoring new tests (see write-tests)."
effort: medium
---

# debug-workflow

Triage first, then the smallest process that fits the bug. Every path ends with a regression test — a bug fix that leaves no test behind is not done (repos scaffolded by `bigin-harness-setup` enforce this at commit time via `bugfix-test-guard.mjs`).

## When this applies vs task-workflow

`task-workflow` owns any bug fix tracked through `PLAN.md`; its Implement step points here for the actual debugging work. Use `debug-workflow` directly, standalone, when the failure isn't yet tied to a ticket/PLAN.md: a flaky test, a stack trace, "works in staging not prod," a live incident.

## Triage

Take the **full workflow** if at least one of these holds:

- flaky / timing / race symptom — intermittent, order-dependent, "passes locally, fails in CI"
- works in one environment but not another (staging vs prod, CI vs local)
- live production incident
- a fix attempt for this bug has already failed
- root cause still unclear after reading the files the stack trace / symptom implicates

Otherwise take the **fast path**. Don't run the full workflow "to be safe" — uniform ceremony on obvious bugs adds nothing; the full workflow's value is concentrated in the cases above.

## Fast path

1. Reproduce the failure (failing test, request, script).
2. Fix it.
3. Show the previously-failing repro now passing, plus a check that nothing adjacent broke — actual command output, not a claim.
4. Add a regression test if no existing test covers the bug.

If the fix doesn't hold, stop iterating blind — that's triage trigger #4; re-enter the full workflow at step 1.

## Full workflow

Gated — do not start step N+1 without step N's output recorded.

1. **Reproduce.** Get a deterministic repro before hypothesizing — without one, every later "it's fixed" is a guess (a flaky test that passes once proves nothing). Escape hatch: for a live incident or a genuinely irreproducible failure, record why it can't be reproduced plus the best available evidence (logs, traces), and treat every downstream conclusion as provisional.

2. **Evidence.** If the symptom names a function/handler/table and `graphify-out/graph.json` exists, query the graph for callers/callees/dependents first and read only the files it implicates — `INFERRED`/`AMBIGUOUS` edges are a pointer to a source read, not confirmation. Read the implicated code and trace the failure backward through the call stack / request path. Instrument the component boundaries the failure crosses (composable, store, API client, handler, DB) only where reading the code doesn't yield the evidence. No fix proposals in this step — only evidence.

3. **Hypothesis.** State exactly one hypothesis, supported by step-2 evidence, and **pre-register the probe's outcomes before running it**: "if the hypothesis is right, the probe shows X; if wrong, Y." The probe is the smallest possible disposable diagnostic — never the fix itself. "Symptom gone" is not "cause confirmed"; only the pre-registered X counts. If refuted, discard the probe and return to step 2 — never stack a second hypothesis on an unconfirmed one.

4. **Fix + validation.** Implement only once the root cause is confirmed. Validate with the failing repro now passing plus a check that nothing adjacent broke — show the actual output, don't claim it passed without showing it (same discipline as `write-tests` and `task-workflow`'s Verify step). For timing-related bugs, one pass proves nothing: require repeated runs (≥5 consecutive passes) — see `references/race-conditions.md`.

5. **Prevention — required output, not an afterthought.** Every full-workflow fix ships with (a) a regression test covering the bug, and (b) validation added at the layer that *should* have caught it — see `references/defense-in-depth.md`. If code changed and `graphify-out/graph.json` exists, propose a graph rebuild (`graphify update .`).

## Escalation safeguard

After 3 failed fix attempts on the same issue: **stop and ask** — flag it as an architecture-level problem for human review instead of continuing to patch. (Same "stop and ask" phrasing as `task-workflow`'s Scope discipline — don't stack further attempts silently.)

## References

- `references/race-conditions.md` — condition-based waiting instead of arbitrary timeouts, for timing-related bugs
- `references/defense-in-depth.md` — validation at the layer that should have caught the bug originally
- consumer repo's own `docs/graph-usage.md` (if this repo adopted Graphify via `bigin-harness-setup`) — query recipes for step 2's graph-first lookup
