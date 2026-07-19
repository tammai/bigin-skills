# Bench report template

Written to `.claude/tmp/bench/<skill>-<date>.md`. Proposal-gated — this phase only writes the report file itself; it never touches skill content, never commits, and never auto-acts on what it finds.

```
# skill-bench: {skill} — {date}

k = {k}, tasks = {task ids}

## Results

| Task | Arm | pass@k | pass^k |
|---|---|---|---|
| {task id} | with-skill | {0 or 1} | {0-100%} |
| {task id} | without-skill | {0 or 1} | {0-100%} |

**Skill-level pass^k delta: {with_avg - without_avg} pts**

## Representative diff (summaries + paths only — full trees available in the trial's worktree until cleanup)

### {task id}, with-skill, trial {n}
- Files touched: {paths}
- One-line summary of what changed: {summary}

### {task id}, without-skill, trial {n}
- Files touched: {paths}
- One-line summary of what changed: {summary}

## Failure detail (any trial that failed its rubric)

| Task | Arm | Trial | Failed criteria |
|---|---|---|---|
| {task id} | {arm} | {n} | {rubric description(s) that failed} |

## If I could only fix one thing

{one paragraph — the single highest-value observation from this run, e.g. "without-skill trials pass just as often on task X — the skill adds nothing there," or "the skill's edge-case coverage is the actual differentiator, not raw pass rate"}
```

Ask: "Act on any of these findings now, or just log the report?" — same propose-then-stop discipline as `harness-audit` and `sprint-distill`. Acting on a finding (e.g. rewriting a skill's prose) is its own `task-workflow`-scale change, not something this skill does inline.
