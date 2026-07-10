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
   If the request doesn't contain enough information to fill the spec's required sections (What / Inputs-outputs / Edge cases / Security considerations / Testing strategy) with confidence, ask up to 3 targeted clarifying questions before drafting the spec — never fill the gaps with silent assumptions and present an approved-looking spec built on them.
   Use the default format below unless the user explicitly asks for a "full spec" / "AI-friendly spec" / "spec-driven" spec — then use the full spec format instead. Never switch formats based on perceived complexity; the trigger is the explicit request only.
   If the feature touches auth, sessions, secrets, PII, or untrusted input (user-controlled data, URLs, redirects, file paths), the spec's Security considerations must name the concrete risks — see `.claude/rules/security.md`. Don't defer security to the post-implementation review; a threat found at spec time is a sentence, the same one found after code review is a rewrite.

3. **Plan file** — once the spec/plan is approved, write it to `PLAN.md`: the approved spec followed by a tasks tracking table (see format below).
   If `PLAN.md` already exists with tasks not marked `Done`, stop and ask the user how to proceed (resume, discard, or replace) before writing — never overwrite silently. If it doesn't exist, or every task in it is `Done`, write the new plan over it.

4. **Implement** — follow `.claude/rules/` conventions. Stay in scope. Update `PLAN.md`'s tracking table as each task starts, finishes, or blocks — don't batch updates to the end. For any new test files, follow the `write-tests` skill's discipline (style-matching, no unnecessary mocking, TDD ordering for business logic). For bug fixes specifically, use the `debug-workflow` skill's four-phase process instead of ad-hoc trial and error.

5. **Verify** — run lint + typecheck + tests. All must pass before marking done. Show the actual command output in your response before flipping any `PLAN.md` task row to `Done` — a claim that tests pass without the output showing it doesn't count.

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

### Full spec (opt-in)

Only when the user explicitly asks for a "full spec" / "AI-friendly spec" / "spec-driven" spec. Omit any section below that doesn't apply — don't pad. Typical omissions: no Component Tree for a backend-only change, no API Contract for a UI-only change, no Data Model if nothing new is persisted.

```
## Spec: {feature name} [full-spec]
User Stories & Scenarios: {Given/When/Then per story, only if there's more than one flow}
Requirements: {Functional (FR-1, FR-2, ...) as plain bullets — skip the table unless there are 5+; Non-Functional only if there's a real perf/scale/availability constraint}
API Contract: {typed request/response — only if this introduces or changes an API}
Data Model: {interfaces/types — only if this introduces or changes persisted/shared data}
Component Tree (frontend projects only): {file paths + nesting — only for multi-component frontend work}
Security considerations: {same as default format — always required}
Verification Checklist: {Automated: tests/lint/typecheck. Manual: happy path, error path, edge cases}
Not in scope: {explicit exclusions}
```

See `references/full-spec-example.md` for a filled-in example.

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

**Full-spec tier only:** add a `Covers` column (e.g. `FR-3`) linking each task to the requirement it implements, and add one tracked row per Verification Checklist manual item (e.g. `Verify: error path for FR-2`, status `Not started`). Cleanup (step 7) can't happen while any of those rows is still open. Don't add the `Covers` column or verification rows for default-tier specs — there are no FR-IDs to reference.

## Scope discipline

If implementation reveals the task requires changes outside the stated scope: **stop and ask**. Never expand scope silently. A second task is better than a sprawling first one.
