# Plan: task-workflow archives PLAN.md instead of deleting it

Status: approved
Branch: feat/triage-ladder

## Spec

## Spec: task-workflow archives PLAN.md instead of deleting it

What: Step 6 currently ends with "delete PLAN.md". It becomes "archive PLAN.md", with
two mutually exclusive destinations decided by whether the repo has a knowledge/ bundle:
  - Bundle present -> write knowledge/implementation/<YYYY-MM-DD>-<slug>.md using unit 1's
    Record template (type: Record, source: plan, body = PLAN.md verbatim), append one line
    to knowledge/implementation/index.md (newest first), then remove PLAN.md from the root.
  - No bundle -> write .claude/memory/PLAN.archive.<ISO>-<slug>.md, then remove PLAN.md.
The distill bullet above it is untouched, and the step says explicitly that the record is
the plan verbatim while the concept is the invariant — neither restates the other.
Three consequential lines elsewhere go stale the moment this lands and are corrected in
the same pass: SKILL.md:158, epic-workflow SKILL.md:66, discovery-workflow SKILL.md:99,
and files-shared.md:234 (the AI_TASK_GUIDE.md template line).

Inputs/outputs: In — a finished PLAN.md, presence/absence of knowledge/. Out — one archive
file in one of the two locations; no PLAN.md at the repo root.

Edge cases: bundle exists but knowledge/implementation/ doesn't (pre-v1.76.0 bundle) ->
fall back to .claude/memory/, don't half-create a bundle folder. Slug collision on the same
day -> the ISO timestamp in the no-bundle path disambiguates; in the bundle path, suffix -2.
A plan with an ## Amendments section -> carried verbatim, that's the point.

Security considerations: N/A — no auth/secrets/PII/untrusted-input surface; PLAN.md content
is already in-repo.

Testing strategy: no runnable code changes. Verification is (a) `node tools/context_budget.mjs`
still passes and the always-loaded number is unmoved, (b) `node tools/docs_sync.mjs --check`
passes after the version bump, (c) the files-shared.md edit ships with a CHANGELOG patch block
so already-scaffolded repos receive it.

Not in scope: epic-workflow step 10 (unit 3), sprint-distill (unit 4), docs/KNOWLEDGE.md +
USER_GUIDE.md + README.md reconciliation (unit 5). Backfilling archives for past tasks.

## Review

Declined by the user (2026-08-27) — prose-only change, no auth/secrets/PII/untrusted-input surface.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Rewrite `skills/task-workflow/SKILL.md` step 6: archive-not-delete, both destinations, the record-vs-concept boundary | Done | |
| 2 | Fix stale line `skills/task-workflow/SKILL.md:158` ("deleted at cleanup") | Done | |
| 3 | Fix stale line `skills/epic-workflow/SKILL.md:66` ("deletes `PLAN.md`") | Done | |
| 4 | Fix stale row `skills/discovery-workflow/SKILL.md:99` ("deleted at task cleanup") | Done | |
| 5 | Update `skills/bigin-harness-setup/references/files-shared.md:234` (AI_TASK_GUIDE.md template) | Done | verbatim-copied file — needs a CHANGELOG patch block (task 6) |
| 6 | CHANGELOG entry with a `patch` block for the files-shared.md anchor | Done | |
| 7 | Version bump to 1.77.0 across the four manifest version fields | Done | |
| 8 | Gates: `context_budget.mjs` (unmoved) + `docs_sync.mjs --check` | Done | budget 8267 chars, unmoved from epic start; docs_sync clean |
