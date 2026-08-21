---
session-id: B27D1C13-F348-4069-AB45-35131B29AA0B
created: 2026-08-21T13:08:10Z
last-updated: 2026-08-21T13:08:10Z
status: in-progress
---

# Session Handoff

**Session saved:** 2026-08-21T13:08:10Z
**Branch:** feat/discovery-workflow
**Recent commits:** 0e8d276 fix: v1.68.1 — nuxt-scaffold's shape gate rejected 5 of its 8 templates (nothing from this session is committed)

## What We Were Working On

Epic **"Absorb BMAD's upstream layer"** (`.claude/memory/EPIC.md`, 6 units) — porting the
genuinely-missing ideas from BMAD-METHOD v6.11.0 into bigin-skills in this repo's own idiom.
BMAD itself is deliberately **not** installed; the posture is absorb.

Currently on **unit 1 of 6: the `discovery-workflow` skill.** Implementation is complete and
independently verified; only the manual verification rows remain. See `PLAN.md` for the
approved full-spec and the task table — that file, not this one, is the source of truth for
unit 1's progress. `EPIC.md` owns the unit queue.

## Current State

### Tasks

`PLAN.md` rows 1–7 `Done` (verifier 4/4 `PASS` after 3 fix-loop rounds). Rows 8–12 are the
manual verification rows and remain `Not started`:

- [ ] 8 — vague greenfield ask produces brief + PRD + ≥1 knowledge concept
- [ ] 9 — trivial ask triages to `task-workflow` with nothing written to disk
- [ ] 10 — established-repo run derives a brief without asking what `CLAUDE.md` answers
- [ ] 11 — repo with no `knowledge/` bundle skips FR-6 and says so
- [ ] 12 — re-invocation over an approved PRD reports state instead of overwriting

No Claude Code task-list mirror exists — `TaskCreate`/`TaskList` were not in this session's
toolset, so `PLAN.md` is the only tracker. Nothing to reconcile on resume.

### Decisions Made

- **Posture: absorb, not complement.** Don't install BMAD. Port what's missing in our idiom.
  Six BMAD skills explicitly rejected with reasons — see `EPIC.md`'s `## Not in scope`.
- **Unit 3 (architecture spine) folded into unit 1** rather than shipped as its own skill,
  saving a second always-loaded description. Epic is 6 units, not 7.
- **Two homes, no crossing.** `docs/product/` for human-facing product artifacts,
  `knowledge/architecture/` for agent-facing OKF concepts. Paths fixed, not configurable.
- **No new commit-time guard.** A PRD gate would fire in every repo installing the harness.
- **Review declined** after 4 clean-ish audits; recorded in `PLAN.md`'s `## Review`.
- **Commit held** until rows 8–12 pass — user's call, so the tree stays dirty across restart.
- **v1.69.0 bump is already written** into all four manifests and `CHANGELOG.md`. It is
  uncommitted. Do not bump again on resume.

### Uncommitted Changes

```
 site/index.html                 |   6 +-
 tools/docs-manifest.json        |   4 ++
 11 files changed, 239 insertions(+), 14 deletions(-)
```

Plus untracked: `PLAN.md`, `.claude/memory/EPIC.md`, and 6 files under
`skills/discovery-workflow/` (`SKILL.md`, `evals/evals.json`, and 4 `references/`).

## Next Steps

1. **Restart Claude Code first.** This session's plugin snapshot predates
   `discovery-workflow`, so the skill is not invokable here — rows 8–12 cannot be honestly
   run until the plugin reloads. This is the whole reason work paused.
2. Run rows 9, 10, 11, 12 in this repo. Row 11's negative case works here precisely because
   this repo has **no** `knowledge/` bundle.
3. Run row 8 in a repo that **does** have a `knowledge/` bundle — it needs FR-6's positive
   path, which this repo cannot exercise.
4. Flip rows 8–12, then `PLAN.md` step 6 cleanup: distill, then delete `PLAN.md`.
5. Commit as v1.69.0, flip `EPIC.md` unit 1 to `Done` with a `Notes` line, then **stop** —
   `epic-workflow` hands off one unit per session. Unit 2 gets a fresh session.

## Context Notes

**The distill candidate for unit 1's cleanup, do not lose it:** all six defects across three
fix-loop rounds were false or overstated prose claims about *other* files — downstream skills
described as already consuming the PRD, `disallowed-tools` claimed to enforce beyond one turn,
the knowledge validator claimed to check a link form it silently ignores, `sprint-distill`
claimed to reach its stop in one turn, and two stale counts. **Zero** defects in the skill's
own mechanics. Two of the six were introduced *by the fix for another one*. The lesson for
`.claude/rules/skill-authoring.md`: a sentence about another skill's behaviour needs that
skill's file open, and an enforcement claim needs the guard's actual scope checked.

**Second distill candidate — about `task-workflow` itself:** step 4.3 prescribes resuming the
full implementer for any `FAIL`, which cost a ~240k-token resume to fix one stale sentence in
round 3. There's a case for a trivial-fix carve-out where the orchestrator applies a one-line
correction directly and still dispatches a fresh verifier; the independence that matters is in
the audit, not in who types the fix. Not acted on — it would have meant improvising an
exception mid-task.

**Pre-existing bug found but deliberately not fixed:** `docs/KNOWLEDGE.md`'s §5 mermaid
diagram has never listed `epic-workflow` among the knowledge entry points. Predates this diff,
so it was left alone rather than smuggled into unit 1. Unit 3 touches the harness's knowledge
surfaces and is the natural home for it — worth adding to `EPIC.md` unit 3's scope.

**Verification asymmetry to remember:** the verifier reads `PLAN.md` and the diff off disk and
cannot see session state. That is the point. Every `PASS` here was against the diff, never
against the implementer's own summary — and round 1 proved why: the implementer's report
claimed the downstream wiring was phrased carefully, and it was not.
