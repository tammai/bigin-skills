---
name: task-workflow
description: "AI task workflow — scope → spec → plan file → implement → verify → review → cleanup. MUST use when user says: 'implement X', 'add a feature', 'build Y', 'fix bug in Z', 'start working on', 'create a new endpoint', 'thêm chức năng', 'sửa lỗi', 'làm feature mới', or is about to start any non-trivial feature/bug-fix work requiring a spec before coding. Also fires on meta-questions about the workflow itself: /task-workflow, 'show task workflow', 'spec gate', 'task guide', 'what is the task workflow', 'quy trình task', 'spec trước khi code'."
effort: low
---

# task-workflow

Follow this workflow for every non-trivial task.

## Steps

1. **Scope** — state what you're changing and why in one sentence before touching any code.

2. **Spec gate** (non-trivial features only) — write and get approval for a spec before implementing.
   Skip for: bug fixes, copy changes, config tweaks, changes ≤20 lines of logic.
   If the feature touches auth, sessions, secrets, PII, or untrusted input (user-controlled data, URLs, redirects, file paths), the spec's Security considerations must name the concrete risks — see `.claude/rules/security.md`. Don't defer security to the post-implementation review; a threat found at spec time is a sentence, the same one found after code review is a rewrite.

3. **Plan file** — once the spec/plan is approved, write it to `PLAN.md`: the approved spec followed by a tasks tracking table (see format below).
   If `PLAN.md` already exists with tasks not marked `Done`, stop and ask the user how to proceed (resume, discard, or replace) before writing — never overwrite silently. If it doesn't exist, or every task in it is `Done`, write the new plan over it.

4. **Implement** — follow `.claude/rules/` conventions. Stay in scope. Update `PLAN.md`'s tracking table as each task starts, finishes, or blocks — don't batch updates to the end.

5. **Verify** — run lint + typecheck + tests. All must pass before marking done.

6. **Review** — check `AI_REVIEW_CHECKLIST.md`. Mark done only when the checklist is clean.

7. **Cleanup** — once every task in `PLAN.md` is `Done` and the review checklist is clean, delete `PLAN.md`. It's a working file for the task, not project documentation — nothing to preserve once the task ships.

## Spec format (when required)

Paste this in the chat and wait for approval before writing any code:

```
## Spec: {feature name}
What: {one paragraph — what changes and why}
Inputs/outputs: {what data flows in and out}
Edge cases: {anything that could go wrong}
Security considerations: {who/what is trusted, what input is attacker-controlled, what could go wrong if it's abused — or "N/A, no auth/secrets/PII/untrusted-input surface" if genuinely none}
Testing strategy: {what will be tested and how — unit/integration/manual, which edge cases get coverage}
Not in scope: {explicit exclusions}
```

## PLAN.md format

Single file — the approved spec followed by a tracking table, kept in one place and updated in place (no separate progress file):

```
# Plan: {feature name}

Status: approved

## Spec

{approved spec, as written for the spec gate}

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | {task} | Not started | |
```

Valid statuses: `Not started`, `In progress`, `Done`, `Blocked`.

## Scope discipline

If implementation reveals the task requires changes outside the stated scope: **stop and ask**. Never expand scope silently. A second task is better than a sprawling first one.
