# Scoring: pass@k and pass^k

Both are computed per (task, arm) — arm is `with-skill` or `without-skill` — from exactly `k` trials (not the larger-sample statistical estimator some papers use; here `k` trials are actually run, no sub-sampling).

## pass@k — existence

`1` if at least one of the `k` trials passed its full rubric (`scripts/score.mjs`'s `trialPasses`), else `0`. Answers: "can the skill/task combination succeed at all?"

## pass^k — consistency

`(number of trials that passed / k) × 100`, as a percentage. Answers: "how reliably does it succeed?" A skill that's occasionally brilliant and often wrong scores low here even if pass@k is 1.

## Skill-level delta (what the report's headline number is)

For a skill under test with multiple bench tasks:

```
with_avg    = mean(pass^k for each task, with-skill arm)
without_avg = mean(pass^k for each task, without-skill arm)
delta       = with_avg - without_avg   # in percentage points
```

This is the number the spec's success metric tracks: "pass^3 delta, with-skill vs without ... ≥ +20 pts on ≥2 of 3 skills, or a documented finding that a skill adds nothing (also a win)."

## Worked example

Task `slugify`, k=3, write-tests skill:

| Arm | Trial 1 | Trial 2 | Trial 3 | pass@3 | pass^3 |
|---|---|---|---|---|---|
| with-skill | pass | pass | pass | 1 | 100% |
| without-skill | pass | fail | fail | 1 | 33% |

Both arms "can" succeed (pass@3 = 1 for both — without the skill, a capable model can still get lucky once), but the skill measurably improves consistency: delta = 100 - 33 = **+67 pts** on this task. If `task-workflow` and `debug-workflow` show similar or smaller deltas, average them for the skill-level number reported in the summary table.
