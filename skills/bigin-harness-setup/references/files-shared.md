# Shared File Templates

Templates for files that are identical (or nearly identical) across all stack profiles.

---

## paths substitutions

When writing `.claude/rules/security.md` and `.claude/rules/architecture.md`, prepend the profile-specific `paths:` frontmatter before the template content:

**nuxt:**
```yaml
---
paths:
  - "server/**"
  - "app/**"
---
```

**go:**
```yaml
---
paths:
  - "**/*.go"
---
```

**nodejs:**
```yaml
---
paths:
  - "src/**"
---
```

---

## security.md

```markdown
# Security Rules

- **Plan for it, don't just check for it.** Specs for features touching auth, sessions, secrets, PII, or untrusted input must include a Security considerations section (see `AI_TASK_GUIDE.md`) naming concrete risks before implementation starts — not just at review time.
- **No unauthenticated endpoints.** Every route verifies a token unless explicitly marked public and reviewed.
- **Validate at boundaries.** Never trust request input — parse and validate with schema before any processing.
- **No path traversal.** Never construct file paths from user input without sanitization.
- **LAN is not a security boundary.** Authenticate internal service-to-service calls.
- **Secrets in env only.** No hardcoded credentials, API keys, or tokens in source code.
- **No logging of PII.** Mask tokens, passwords, emails, and personal data in logs.
- **Dependency rule.** Never add a new dependency without checking its maintenance status and license.
```

---

## architecture.md

```markdown
# Architecture Rules

## Domain Boundaries
- Each domain owns its data — no cross-domain direct DB queries or direct imports.
- Cross-domain communication via service interfaces only.

## Dependency Direction
handlers/controllers → services → repos/stores  
Never reverse. A repo must never import a handler.

## API Contract
- `openapi.yaml` is the cross-repo contract between frontend and backend.
- Backend leads with backward-compatible (additive) changes.
- Breaking change = API version bump (`/v2/`). Frontend adopts after backend ships.
- Frontend generates types from `openapi.yaml`. Never hardcode API response shapes.
```

*Profile-specific architecture rules are appended below this by the skill during setup.*

---

## AI_TASK_GUIDE.md

```markdown
# AI Task Guide

Follow this workflow for every task.

## Steps

1. **Scope** — state what you're changing and why in one sentence before touching any code.

2. **Spec gate** (non-trivial features only) — write and get approval for a spec before implementing.
   Skip this for: bug fixes, copy changes, config tweaks, changes ≤20 lines of logic.
   If the feature touches auth, sessions, secrets, PII, or untrusted input (user-controlled data, URLs, redirects, file paths), the spec's Security considerations must name the concrete risks — see `.claude/rules/security.md`. Don't defer security to the post-implementation review; a threat found at spec time is a sentence, the same one found after code review is a rewrite.

3. **Plan file** — once the spec/plan is approved, write it to `PLAN.md`: the approved spec followed by a tasks tracking table (see format below).
   If `PLAN.md` already exists with tasks not marked `Done`, stop and ask the user how to proceed (resume, discard, or replace) before writing — never overwrite silently. If it doesn't exist, or every task in it is `Done`, write the new plan over it.

4. **Implement** — follow `.claude/rules/conventions.md`. Stay in scope. Update `PLAN.md`'s tracking table as each task starts, finishes, or blocks — don't batch updates to the end.

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
```

---

## AI_REVIEW_CHECKLIST.md

```markdown
# Review Checklist

Before marking any task complete, every item must be checked.

## Gates (run these commands)
{COMMANDS}

## Code quality
- [ ] No new `@ts-ignore`, `as any`, or `eslint-disable` without a justifying comment
- [ ] No `//nolint` without a justifying comment (Go)
- [ ] No hardcoded secrets, credentials, or API keys

## Security
- [ ] Every risk named in the spec's Security considerations section was actually addressed
- [ ] No unauthenticated endpoints added
- [ ] All new inputs validated at the handler boundary
- [ ] No PII logged

## Contract
- [ ] `openapi.yaml` updated if any route signature changed
- [ ] Types regenerated from `openapi.yaml` if API surface changed

## Scope
- [ ] Spec was approved before implementation (non-trivial features only)
- [ ] Changes are in scope — nothing extra was modified
- [ ] README / docs updated if commands or onboarding changed
```

---

## code-reviewer agent

```markdown
---
name: code-reviewer
description: Reviews code changes for correctness, security, and convention compliance. Use when asked to review a PR, audit changes, check a diff, or verify code before merging.
model: sonnet
tools: Read, Grep, Glob, Bash
---

# Code Reviewer

Read-only audit agent. Never writes or edits files.

## Process
1. Read the changed files (use `git diff` to identify them).
2. Check each change against:
   - `.claude/rules/conventions.md` — naming, patterns, API client usage
   - `.claude/rules/security.md` — auth, input validation, secrets, PII
   - `.claude/rules/architecture.md` — layer boundaries, dependency direction
   - `AI_REVIEW_CHECKLIST.md` — the full definition of done
3. Report violations with `file:line` references.
4. Final verdict: **pass** / **fail** with specific issues listed.

## What counts as a violation
- Lint or type errors (if visible from static reading)
- Auth bypass or missing input validation
- Suppressed rules without justifying comments
- `openapi.yaml` not updated when routes changed
- Cross-layer dependency violations
- Hardcoded credentials

## What to ignore
- Style preferences not in the rules files
- Suggestions for refactoring beyond the task scope
- Hypothetical future issues

## Coverage note
For anything borderline, report it anyway with a confidence level and severity —
don't silently drop it for being minor or uncertain. Only skip items already
listed under "What to ignore" above.
```
