---
name: skill-bench
description: "Benchmarks a target skill's outcome quality and consistency by running the same task with the skill available vs masked, k trials per arm, scored against an objective rubric (pass@k, pass^k). Project-local — audits this plugin's own skills, never ships downstream. Use when user says: 'benchmark this skill', 'run skill-bench', 'measure write-tests', 'does this skill actually help', 'bench debug-workflow'. Do NOT use for auditing hooks/frontmatter/docs staleness — that's `harness-audit`."
disable-model-invocation: true
effort: high
allowed-tools: Bash(git worktree *), Bash(git diff --stat *), Bash(node .claude/skills/skill-bench/scripts/*), Bash(git status *)
---

# skill-bench

Runs the same bench task k times with a skill available and k times with it masked, in isolated git worktrees, and scores each trial against an objective rubric. Never auto-fixes or auto-commits — proposes a report, same discipline `harness-audit` and `sprint-distill` already enforce.

**Trial cap:** default 2 skills × 3 tasks × k=3 × 2 arms = 36 trials per invocation. If the requested scope (skills × available tasks × k × 2) would exceed this, state the computed total and ask for explicit confirmation before running any trials.

## Phase 0: Select scope and self-heal

1. Target skill(s) — default coverage set is `write-tests`, `task-workflow`, `debug-workflow` (the initial 3-skill set; see `benchmarks/<skill>/tasks.json` for what's actually defined — don't invent tasks for a skill that has no `tasks.json`, report it missing instead).
2. `k` — default 3.
3. **Safety check, always run first:** `node .claude/skills/skill-bench/scripts/mask.mjs status <skill>` for every skill in scope. If any comes back `masked`, a prior run crashed mid-trial — run `unmask` on it before doing anything else. This is the actual mechanism behind "the mask is restored even if a trial errors": idempotent self-healing at the top of every run, not a language-level trap around a subagent call (which can't exist across an LLM dispatch).

## Phase 1: Load bench tasks

Read `benchmarks/<skill>/tasks.json` for each target skill. Each entry: `{id, prompt, fixture, rubric}`. `fixture` is a path (relative to that skill's `benchmarks/<skill>/` dir) to the starting file state for the trial. `rubric` is a list of criteria — every criterion must be one of `file-exists`, `file-contains`, `command` (see `scripts/score.mjs`'s header for the exact shape). If a rubric line can't be expressed as one of these, rewrite it or cut it — never score by judgment.

## Phase 2: Run trials

For each task, for each arm (`with-skill`, `without-skill`), for `trial` in `1..k`:

1. Dispatch one Agent tool call with `isolation: "worktree"` so the trial's file changes land in a fresh, isolated git worktree rather than the main tree. Prompt: the task's fixture contents as starting context (tell the agent which files exist at which paths) plus the task's `prompt` field verbatim. Record the worktree path the Agent tool result returns (only returned when the agent made changes — a no-op trial has nothing to score and counts as a fail).
2. **Before dispatching a `without-skill` trial:** run `node .claude/skills/skill-bench/scripts/mask.mjs mask <skill>`.
3. **Immediately after that trial returns — regardless of whether it succeeded, errored, or looks wrong — run** `node .claude/skills/skill-bench/scripts/mask.mjs unmask <skill>` **before starting the next trial.** Do not skip this because the trial failed; masked state must never carry into the next dispatch.
4. Score the trial: write `{worktree: <path>, rubric: <task's rubric, with fixture-relative paths resolved to the worktree>}` to a scratch JSON file, then run `node .claude/skills/skill-bench/scripts/score.mjs <that-file>`. Record `trialPasses`.
5. Remove the worktree: `git worktree remove <path> --force`.

Known limitation, stated plainly rather than assumed away: masking works by renaming `skills/<skill>/SKILL.md` in the **main tree** (see `scripts/mask.mjs`'s header), because that's the one lever that reliably controls skill discoverability regardless of how a spawned agent's worktree isolation interacts with this plugin's own loading. This means `with-skill` and `without-skill` trials for the same task cannot literally run concurrently against each other (the mask is a shared, main-tree toggle) — run all trials for one arm before switching to the other.

## Phase 3: Score

Compute pass@k and pass^k per (task, arm) per `references/scoring.md`'s formulas. Aggregate to a skill-level pass^k delta (with-skill avg − without-skill avg, in points).

## Phase 4: Report — STOP HERE

Write `references/report-template.md`'s shape to `.claude/tmp/bench/<skill>-<date>.md`. Diffs are summaries + file paths only — never inline full trees (full output stays available in each trial's worktree until Phase 5's cleanup runs, so it's one `git diff` away if actually needed). Ask: "Act on any of these now, or just log the report?" Do not write or fix anything in this phase.

## Phase 5: Cleanup sweep

Even though each trial removes its own worktree in Phase 2 step 5, run a backstop sweep: `git worktree list --porcelain | grep -A1 'bench'` (or equivalent) and remove anything left over from a trial that errored before reaching step 5. Confirm `git worktree list` shows no bench residue before finishing.

## References

- `scripts/mask.mjs` — masks/unmasks a skill directory in the main tree; idempotent, self-healing, never auto-fixes.
- `scripts/score.mjs` — mechanical rubric scoring; every criterion is a command or file assertion, never judgment.
- `references/scoring.md` — pass@k / pass^k formulas + worked example.
- `references/report-template.md` — exact report shape and the propose-then-stop gate.
- `benchmarks/<skill>/tasks.json` — task/fixture/rubric definitions per skill.
