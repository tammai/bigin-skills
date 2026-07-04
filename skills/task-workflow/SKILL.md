---
name: task-workflow
description: "AI task workflow — scope → spec → implement → verify → review. Use when starting a new feature, bug fix, or non-trivial change, especially when a spec is required before coding. Trigger: /task-workflow, 'show task workflow', 'spec gate', 'task guide', 'what is the task workflow', 'quy trình task', 'spec trước khi code'."
---

# task-workflow

Follow this workflow for every non-trivial task.

## Steps

1. **Scope** — state what you're changing and why in one sentence before touching any code.

2. **Spec gate** (non-trivial features only) — write and get approval for a spec before implementing.
   Skip for: bug fixes, copy changes, config tweaks, changes ≤20 lines of logic.

3. **Implement** — follow `.claude/rules/` conventions. Stay in scope.

4. **Verify** — run lint + typecheck + tests. All must pass before marking done.

5. **Review** — check `AI_REVIEW_CHECKLIST.md`. Mark done only when the checklist is clean.

## Spec format (when required)

Paste this in the chat and wait for approval before writing any code:

```
## Spec: {feature name}
What: {one paragraph — what changes and why}
Inputs/outputs: {what data flows in and out}
Edge cases: {anything that could go wrong}
Testing strategy: {what will be tested and how — unit/integration/manual, which edge cases get coverage}
Not in scope: {explicit exclusions}
```

## Scope discipline

If implementation reveals the task requires changes outside the stated scope: **stop and ask**. Never expand scope silently. A second task is better than a sprawling first one.
