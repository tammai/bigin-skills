# Shared File Templates

Templates for files that are identical (or nearly identical) across all stack profiles.

---

## paths substitutions

When writing `.claude/rules/security.md` and `.claude/rules/architecture.md`, prepend the profile-specific `paths:` frontmatter before the template content.

Every profile's list includes its OpenAPI contract file: `architecture.md` owns the versioning rule (additive changes, `/v2/` on a break), so it has to load when the contract itself is the file being edited — not only when source files are.

**nuxt:**
```yaml
---
paths:
  - "server/**"
  - "app/**"
  - "openapi.yaml"
---
```

**go:**
```yaml
---
paths:
  - "**/*.go"
  - "api/openapi.yaml"
---
```

**nodejs:**
```yaml
---
paths:
  - "src/**"
---
```

**next:**
```yaml
---
paths:
  - "src/app/**"
  - "src/components/**"
  - "src/hooks/**"
  - "src/lib/**"
  - "src/proxy.ts"
  - "openapi.yaml"
---
```

**generic:** the stack is unknown, so scope by source-file extension rather than by directory — plus whatever contract file the repo actually has (`openapi.yaml` / `openapi.json` / `schema.graphql`; include only the ones present, drop the line entirely if none):
```yaml
---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,go,py,rb,rs,java,kt,cs,php,swift,scala,ex,exs}"
  - "openapi.yaml"
---
```

---

## model-routing.json

Written to `.claude/model-routing.json` (Phase 5-3d). `{MODEL_ROUTING}` is the profile chosen in Phase 1.5 — `frontier` | `opus-centric` | `lean`.

```json
{
  "profile": "{MODEL_ROUTING}"
}
```

To pin an individual tier against the profile, add a `models` object — `quick` | `standard` | `deep` | `verifier` → `fable` | `opus` | `sonnet` | `haiku`:

```json
{
  "profile": "frontier",
  "models": { "deep": "opus" }
}
```

Effort per tier is fixed in the plugin's own agent definitions (quick `low`, standard `high`, deep `xhigh`, verifier `high`) and is **not** settable here. Ladders, precedence, and the effort rationale: `bigin-skills` → `skills/model-router/references/model-profiles.md`.

---

## security.md

```markdown
# Security Rules

- **Plan for it, don't just check for it.** Specs for features touching auth, sessions, secrets, PII, or untrusted input must include a Security considerations section (`/task-workflow` has the format) naming concrete risks before implementation starts — not just at review time.
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

Orientation for humans, not a second copy of the workflow. The `task-workflow` skill is the single source — this file must never restate its steps in enough detail to drift from them.

```markdown
# AI Task Guide

The workflow for every non-trivial task is the `task-workflow` skill: run `/task-workflow`, or
just describe the task ("implement X", "fix the bug in Y") and it triggers on its own. It owns the
authoritative version of every step, spec format, and `PLAN.md` layout — if this file and the skill
ever disagree, the skill wins.

## What it does, so you know what you're approving

1. **Scope** — one sentence on what's changing, before any code.
2. **Spec gate** — a spec you approve in chat first. Skipped for bug fixes, copy/config tweaks, and
   changes ≤20 lines of logic.
3. **Plan file** — the approved spec plus a task table, written to `PLAN.md`.
4. **Implement/verify loop** — a routed implementer subagent does the work; a separate read-only
   verifier audits the diff against `PLAN.md`. Capped at 3 rounds, then it stops and asks you.
5. **Review** — offers `/code-review`, plus `/security-review` for auth/secrets/PII/untrusted input.
   Neither runs without your say-so.
6. **Cleanup** — `PLAN.md` is deleted once everything is `Done`. It's a working file, not docs.

## Why `PLAN.md` matters to you

`.claude/guards/spec-gate-guard.mjs` blocks `Edit`/`Write` on non-trivial changes until `PLAN.md`
exists and contains `Status: approved`. That's the gate — approving the spec is what unblocks
implementation. It also checks `PLAN.md`'s `Branch:` line against the branch you're on, so a plan
left over from an earlier task can't quietly approve edits for a new one.
Layout, task statuses, and the opt-in full-spec tier: `/task-workflow`.

## Scope discipline

If implementation turns out to need changes outside the approved scope, the workflow stops and asks
rather than expanding silently. A second task beats a sprawling first one.
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

## Testing
- [ ] Business-logic changes have tests covering the edge cases named in the spec
- [ ] No mocking of non-I/O units (pure functions, in-process logic)
- [ ] No skipped/TODO tests left without being flagged

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
