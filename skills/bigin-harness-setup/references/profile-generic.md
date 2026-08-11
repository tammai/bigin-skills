# Generic Profile Templates

Fallback profile — used when Phase 0's stack detection matches none of `nuxt` / `go` / `nodejs` / `next`. Nothing is asked; the harness installs its stack-neutral half.

What generic **does** install: `CLAUDE.md`, `.claude/rules/security.md` + `architecture.md`, the AI files, every guard wired in the `settings.json` block below (all nine), `settings.json` itself, the context-budget gate, the pre-commit script, and every opt-in phase (knowledge bundle, graphify, model routing).

What generic **skips**: Phase 0.5 scaffold (no scaffold skill exists for an unknown stack), the profile conventions rules (`conventions*.md`, `testing.md` — there's no stack to write conventions for), `.vscode/settings.json`, and Phase 5.6 CI generation (see `## CI` below).

---

## Commands

There is no fixed command set — detect it, and leave what can't be detected as an explicit `TODO`. Run these checks in order and stop at the first that answers:

1. `package.json` → read `scripts`. Map `lint`/`typecheck`|`type-check`/`test` (or `test:unit`) to the runner in `packageManager`, else the present lockfile (`pnpm-lock.yaml` → `pnpm`, `yarn.lock` → `yarn`, `bun.lockb` → `bun`, `package-lock.json` → `npm run`).
2. `Makefile` → grep `^lint:`, `^test:`, `^check:`, `^typecheck:` targets → `make <target>`.
3. `justfile` / `Taskfile.yml` → same idea (`just <recipe>` / `task <task>`).
4. Language-conventional defaults, only if the manifest is present: `pyproject.toml` → `ruff check .` / `mypy .` / `pytest`; `Cargo.toml` → `cargo clippy` / `cargo check` / `cargo test`; `composer.json` → `composer lint` / `composer test`; `Gemfile` → `bundle exec rubocop` / `bundle exec rspec`; `pom.xml` / `build.gradle` → `mvn verify` / `./gradlew check`.

Record the result as `{LINT}` / `{TYPECHECK}` / `{TEST}`. Any command that isn't found stays the literal string `TODO: <lint|typecheck|test> command` — every template below, the pre-commit script, `AI_REVIEW_CHECKLIST.md`, and the Phase 7 summary carry that placeholder through verbatim so the gap is visible instead of guessed at. Say which commands were detected and which are `TODO` in the Phase 7 summary.

---

## CLAUDE.md Template

Substitute `{LINT}` / `{TYPECHECK}` / `{TEST}` from `## Commands`, and `{STACK}` with a one-line description of what the repo actually is (languages present, entry point, package manager — read from the manifests, don't invent a framework). Drop any Commands row whose command is `TODO` — a table of placeholders is noise; the summary already reports the gap.

```markdown
# CLAUDE.md

Stack: {STACK}

## Commands
| Purpose   | Command       |
|-----------|---------------|
| lint      | `{LINT}`      |
| typecheck | `{TYPECHECK}` |
| test      | `{TEST}`      |

## Rules
See `.claude/rules/` — path-scoped security and architecture rules.

## Hard Rules (non-negotiable)
- No `--no-verify`, no disabling a lint rule or type check to make a gate pass. Fix the code or say why the rule is wrong.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- Match the surrounding code — its naming, layering, error handling, and test style are the convention here. There is no generated conventions rule file for this stack; the existing code is the spec.
- Every bug fix ships a regression test that fails before the fix (enforced at commit time by `bugfix-test-guard.mjs`).
- Never add a dependency without checking maintenance status and license.
- Secrets in env only. Validate all input at the boundary.

## Task workflow
Non-trivial features: /task-workflow. Bugs: /debug-workflow. Review: /code-review, /security-review.
```

---

## architecture addendum

None. `.claude/rules/architecture.md` for this profile is the shared base from `files-shared.md` → `## architecture.md` with the generic `paths:` frontmatter and nothing appended — the base rules (domain boundaries, dependency direction, API contract versioning) hold regardless of stack.

---

## CI

No CI template. Phase 5.6 is skipped entirely for this profile even when `CI_PROVIDER` is `github`/`gitlab`/`both`: a generated workflow is only as good as the commands in it, and for an unknown stack the runtime, cache strategy, and service containers can't be inferred. Instead, name it in the Phase 7 summary — the detected `{LINT}` / `{TYPECHECK}` / `{TEST}` commands, plus `node tools/context_budget.mjs` (and `node tools/knowledge_validate.mjs` if the knowledge bundle was opted into), are what a CI job needs to run.

---

## settings.json Template

`permissions.allow` is git-only — the stack's own toolchain is unknown, so nothing else is pre-approved. The hooks block is identical to every other profile except that there is no `PostToolUse` `lint-fix-file.mjs` entry (no known formatter).

```json
{
  "permissions": {
    "allow": [
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git pull:*)",
      "Bash(git stash:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bash-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bugfix-test-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/commit-msg-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/spec-gate-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash|Write|Edit|WebFetch|mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-gate-guard.mjs"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "WebFetch|mcp__.*|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-scan-guard.mjs"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/canary-seed.mjs"
          },
          {
            "type": "command",
            "command": "node .claude/guards/session-resume-check.mjs"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/precompact-snapshot.mjs"
          }
        ]
      }
    ]
  }
}
```
