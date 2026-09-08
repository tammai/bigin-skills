# Shared File Templates

Templates for files that are identical (or nearly identical) across all stack profiles.

---

## paths substitutions

When writing `.claude/rules/security.md` and `.claude/rules/architecture.md`, prepend the profile-specific `paths:` frontmatter before the template content. `.claude/rules/comments.md` and `.claude/rules/product.md` are the two exceptions — each carries its own stack-agnostic frontmatter and is written verbatim, no substitution: `comments.md` scopes by source-file extension (every profile), because comment rules apply to any source file including scripts and tooling outside the app directories; `product.md` scopes to `docs/product/**`, which is the same path on every profile regardless of stack.

Every profile that has an API contract lists its contract file: `architecture.md` owns the versioning rule (additive changes, `/v2/` on a break), so it has to load when the contract itself is the file being edited — not only when source files are. The filename differs by profile (`openapi.yaml`, `api/openapi.yaml`, `openapi.json`); use the one the repo actually has, since a `paths:` entry that names a file the repo doesn't contain fails silently — the rule simply never loads. `nodejs` and `nuxt-marketing` are the two with no contract line: `nodejs` generates its OpenAPI document code-first rather than committing a snapshot, and `nuxt-marketing` has no API at all — its `content.config.ts` collection schemas are the contract that file loads for instead.

**nuxt:**
```yaml
---
paths:
  - "server/**"
  - "app/**"
  - "openapi.yaml"
---
```

**nuxt-marketing:** the app tree plus both editable trees, and `content.config.ts` in place of an OpenAPI file. The content trees are load-bearing here rather than a nicety: `architecture.md` carries the content → pages → blocks boundary and the hidden-not-substituted locale rule, so it has to load while somebody is editing a content entry or a locale bundle — which is where those two rules are broken.
```yaml
---
paths:
  - "app/**"
  - "content/**"
  - "i18n/**"
  - "content.config.ts"
---
```

**go:** the contract is at the **repo root**, not under `api/`. `go-scaffold` writes `openapi.yaml` there (`scripts/scaffold.mjs`'s `OAPI_SPEC`) and `profile-go.md`'s layout shows it there; scoping this to `api/openapi.yaml` names a file the repo does not contain, and by the rule above that fails silently — the architecture rule simply never loads while the contract is being edited. `api/openapi.yaml` is flutter's path, not go's.
```yaml
---
paths:
  - "**/*.go"
  - "openapi.yaml"
---
```

**nodejs:**
```yaml
---
paths:
  - "src/**"
---
```

**flutter:**
```yaml
---
paths:
  - "lib/**"
  - "api/openapi.yaml"
---
```

**tauri:** both halves, because the security and architecture rules here are precisely about the boundary *between* them — an `architecture.md` that loads only for `app/**` never loads while somebody is writing the `#[tauri::command]` on the other side of it.
```yaml
---
paths:
  - "app/**"
  - "src-tauri/**"
  - "openapi.yaml"
---
```

**next:** the contract file is `openapi.json`, not `openapi.yaml` — `next-scaffold` ships a committed JSON snapshot (`pnpm openapi:generate`). Scoping this to `openapi.yaml` silently means the rule never loads when the real contract is edited.
```yaml
---
paths:
  - "src/app/**"
  - "src/features/**"
  - "src/shared/**"
  - "src/components/**"
  - "src/lib/**"
  - "src/proxy.ts"
  - "openapi.json"
---
```

**specs / contracts / qa:** these repos hold prose, contracts and test artifacts rather than source trees, so `security.md` scopes to what each actually contains. None of the three gets an `architecture.md` except `contracts` (see `rule-files.md`).
```yaml
---
paths:                      # specs
  - "docs/**"
  - "REPO_MAP.md"
---
---
paths:                      # contracts
  - "openapi/**"
---
---
paths:                      # qa
  - "cases/**"
  - "e2e/**"
  - "traceability/**"
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

Written to `.claude/model-routing.json` (Phase 5-3d). `{MODEL_ROUTING}` is the profile chosen in Phase 1.5 — `opus-centric` (default) | `frontier` | `lean`.

```json
{
  "profile": "{MODEL_ROUTING}"
}
```

A profile sets each tier's model **and** effort. Only the model is overridable here — add a `models` object with `quick` | `standard` | `deep` | `verifier` → `fable` | `opus` | `sonnet` | `haiku`. There is no `effort` key (effort comes from the spawned agent's frontmatter, which the Agent tool can't override):

```json
{
  "profile": "opus-centric",
  "models": { "deep": "fable" }
}
```

Effort comes from the plugin's own agent definitions and is **not** settable here — the profile picks it by picking which agent each tier spawns. Under `opus-centric` that's quick `low`, standard `medium`, deep `high`, verifier `high`; `frontier` raises standard to `high` and `lean` also drops the verifier to `medium`. Ladders, precedence, and the effort rationale: `bigin-skills` → `skills/model-router/references/model-profiles.md`.

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
- The OpenAPI contract file is the cross-repo agreement between frontend and backend. (Substitute the repo's actual contract path when writing this file — `openapi.yaml` on nuxt, go and tauri, `api/openapi.yaml` on flutter, `openapi.json` on next.)
- Backend leads with backward-compatible (additive) changes.
- Breaking change = API version bump (`/v2/`). Frontend adopts after backend ships.
- Frontend generates types from the contract. Never hardcode API response shapes.
```

*Profile-specific architecture rules are appended below this by the skill during setup.*

---

## vendored-contract.md

**Written only when Phase 0a set `REPO_TYPE` to `api`, `web` or `mobile`** — a polyrepo consumer repo. Skipped entirely otherwise, including for a standalone repo on the same stack profile.

This is the single source for the vendored-contract rule; the three consumer profiles point at it rather than restating it, so the rule cannot drift between them. Substitute `{SPEC_PATH}`, `{CODEGEN_OUT}` and `{CONTRACTS_REPO}` from this table — the first two differ per stack and both were verified against the shipped scaffolders and profiles:

| `REPO_TYPE` | `{SPEC_PATH}` | `{CODEGEN_OUT}` |
|---|---|---|
| `api` (go) | `openapi.yaml` | `internal/openapi/openapi.gen.go` |
| `web` (nuxt) | `openapi.yaml` | `shared/api-client/schema.d.ts` — `layers/shared/api-client/schema.d.ts` on the `starter` template |
| `mobile` (flutter) | `api/openapi.yaml` | `api/generated/**` |

`{CONTRACTS_REPO}` is the `repo` field of the entry in `api-contract.lock`.

```markdown
---
paths:
  - "{SPEC_PATH}"
  - "api-contract.lock"
---

# Vendored Contract

`{SPEC_PATH}` and `api-contract.lock` are **not editable in this repo**. Both are written only by `contract_sync.mjs`, which vendors the contract from `{CONTRACTS_REPO}` at a commit pinned in the lock and verifies its checksum before writing anything.

- **Need an API change?** It belongs in the contracts repo, in its own session. Say so and stop — never add a shape here to make the client compile.
- **Take a published change:** `node scripts/contract_sync.mjs bump <tag>`. Lock, spec and generated client move in one commit; a PR carrying only two of the three is wrong.
- **Re-apply what the lock already pins:** `node scripts/contract_sync.mjs sync`.
- **A refusal is information, not an obstacle.** A moved tag or a checksum mismatch means a published version now points at different bytes. Report it to the contracts repo; never re-pin past it to make the error go away.
- `{CODEGEN_OUT}` is generated. Regenerate it; never hand-edit it.

Session start reports whether this repo is behind. Sitting on an older contract version than another repo is a supported state, not drift.
```

---

## comments.md

Written verbatim — frontmatter included, no paths substitution.

```markdown
---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,go,py,rb,rs,java,kt,cs,php,swift,scala,ex,exs}"
---
# Comment Rules

- **Comment the why, never the what.** The code already says what it does. A comment earns its place by carrying what the code can't: a non-obvious constraint, a rejected alternative, a workaround plus the upstream issue it waits on.
- **Match the file you're in.** Comment density is house style. A file with no comments doesn't want yours; a heavily documented one expects them. Never add comments to lines you didn't otherwise change.
- **No narration.** No `// loop over users`, no section banners, no prose restating the signature directly above it.
- **No history in code.** No "added X", "changed from Y", "previously Z", no dates, no commented-out code kept "just in case". Git holds all of it.
- **No process residue.** Never write comments addressed to the reviewer or the requester ("as requested", "generated", "TODO for review") — the reader is a future maintainer with no memory of this task.
- **A suppression always states its reason.** `@ts-ignore`, `as any`, `eslint-disable`, `//nolint` — each needs a comment saying why, on the same line or directly above. This is the one comment that is never optional.
- **TODOs need an owner and an exit condition.** `// TODO(name): drop once <specific thing>`. A bare `TODO` is noise — delete it or file it.
- **Doc comments only where the language expects them.** Exported Go identifiers get a doc comment starting with the identifier name. Public TS/JS API gets JSDoc when the signature alone is ambiguous. Internal code gets neither by default.

The two that get skipped most:

    // ✗ @ts-ignore
    // ✓ @ts-ignore — `raw` is typed `unknown` until sdk@3.2 ships generics
    //   (vendor/sdk#412); parseConfig() below validates the shape at runtime.

    // ✗ //nolint:gosec
    // ✓ //nolint:gosec — bin is resolved from an allowlist in resolveBinary(),
    //   never from request input.

    // ✗ // TODO: clean this up
    // ✓ // TODO(dana): drop this fallback once every client is on /v2 (#318).
```

---

## product.md

Written verbatim — frontmatter included, no paths substitution. Every profile gets it,
`generic` included, same as `comments.md`.

```markdown
---
paths:
  - "docs/product/**"
---
# Product Artifact Rules

Applies to `docs/product/brief.md` and `docs/product/prd.md`. Full templates and field
definitions live in `discovery-workflow` (`references/artifact-formats.md`) — this rule states
only what must still hold when one of those files is edited by hand.

- **Requirement IDs are permanent.** Assigned once, in order, never renumbered or reused. A
  withdrawn requirement keeps its ID and its block — change its `Status:` line, don't delete it.
- **The `### FR-n` / `### NFR-n` blocks are authoritative; the Requirement index is navigation.**
  If the two disagree, the block wins — but keep the index in sync by hand at every edit.
- **Field lines are fixed, one per line, `—` for empty.** Never omit a field because it has
  nothing in it; an absent line reads as "forgotten," not "empty."
- **Every requirement needs at least one Given/When/Then acceptance criterion, observable from
  outside the system.** Not a claim that can only be checked by reading the implementation.
- **No solution design in either file.** No table names, endpoint paths, component names, or
  library choices — those belong to an architecture decision or the task's own spec.
- **Roles, never people.** Both files name roles ("workspace owner"), never a real person, email
  address, or account.
- **An approved artifact is amended, not overwritten.** Edit a `Status: approved` file in place;
  don't replace it wholesale.
- **Two homes, never crossed.** A requirement never lands in `knowledge/`; an invariant never
  lands in the PRD.
```

---

## AI_TASK_GUIDE.md

Orientation for humans, not a second copy of the workflow. The `task-workflow` skill is the single source — this file must never restate its steps in enough detail to drift from them.

```markdown
# AI Task Guide

The workflow for every non-trivial task is the `task-workflow` skill: run `/task-workflow`, or
just describe the task ("implement X", "fix the bug in Y") and it triggers on its own. It owns the
authoritative version of every step, spec format, and `PLAN.md` layout — if this file and the skill
ever disagree, the skill wins.

Work too big for one plan — several PRs, or several surfaces — goes through `epic-workflow` first: it
splits the initiative into ordered units and hands them back to `task-workflow` one unit at a time.

## What it does, so you know what you're approving

1. **Scope** — one sentence on what's changing, before any code.
2. **Spec gate** — a spec you approve in chat first. Skipped for bug fixes, copy/config tweaks, and
   changes ≤20 lines of logic.
3. **Plan file** — the approved spec plus a task table, written to `PLAN.md`.
4. **Implement/verify loop** — a routed implementer subagent does the work; a separate read-only
   verifier audits the diff against `PLAN.md`. Capped at 3 rounds, then it stops and asks you.
5. **Review** — offers `/code-review`, plus `/security-review` for auth/secrets/PII/untrusted input.
   Neither runs without your say-so.
6. **Cleanup** — `PLAN.md` is archived out of the repo root once everything is `Done` — into
   `knowledge/implementation/` if this repo has one, else `.claude/memory/`. It's a working file,
   not docs, but it's the only record of *why* the task took its shape, so it's kept.

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
- [ ] No narration, history, or process-residue comments — `.claude/rules/comments.md`
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
- [ ] OpenAPI contract updated if any route signature changed
- [ ] Types regenerated from the contract if API surface changed

## Scope
- [ ] Spec was approved before implementation (non-trivial features only)
- [ ] Changes are in scope — nothing extra was modified
- [ ] README / docs updated if commands or onboarding changed
```
