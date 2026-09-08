# Contracts Profile Templates

The API contract repo in a polyrepo project (`<project>-contracts`). Holds `openapi/<service>.v<major>.yaml` — the **only** place API specs are edited — plus a changelog. Owned by dev, with backend and frontend both reviewing every change. Selected by Phase 0a from the repo name; the stack ladder does not run.

Version files coexist rather than replacing each other: a breaking change opens `core.v2.yaml` beside `core.v1.yaml`, and each consumer pins the file it is ready for. That is why this repo publishes no package and holds no generated client.

What this profile **installs**: `CLAUDE.md`, `.claude/rules/security.md` + `architecture.md`, the AI files, eight of the nine gates, `settings.json`, the context-budget gate, and a pre-commit script that lints the specs.

What it **skips**: Phase 0.5 scaffold, `conventions*.md` and `testing.md`, `.vscode/settings.json`, `bugfix-test-guard` (see below), and **its own release CI** — lint, `oasdiff` breaking-change gating, tagging and the consumer dispatch are a contracts-repo workstream outside this release, stated as a gap in the Phase 7 summary rather than half-written here.

**`bugfix-test-guard` is omitted, and the reason is concrete.** Its allowlist of "no runtime surface to test" paths covers `.md`, `.env.example`, `graphify-out/` and a fixed list of JS config files — **not `.yaml`**. So `fix: correct the Order schema` staging `openapi/core.v1.yaml` would be blocked on a regression test that cannot exist, and every contract fix would carry `[no-test]`. A gate answered by rote is worse than no gate. The thing that actually catches a bad contract change is `oasdiff` in this repo's own CI, which is the workstream above.

---

## Commands

| Purpose | Command |
|---|---|
| lint | `npx --no-install @redocly/cli lint openapi/*.yaml` |
| typecheck | `TODO: typecheck command` |
| test | `TODO: test command` |

Run the lint before recording it, per `SKILL.md` → Phase 2. If Redocly is not present, leave lint as the `TODO` placeholder and say so in the summary — do not substitute a different linter silently, because which linter runs decides which rules the specs are held to.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: OpenAPI 3.0.x contract repository. One file per service per major version; no code, no generated clients.

## Commands
| Purpose | Command |
|---|---|
| lint | `{LINT}` |

## Hard Rules (non-negotiable)
- **This is the only repo where an API spec is edited.** Consumers vendor a copy at a pinned commit; a change made in a consumer repo is thrown away on the next sync.
- A **breaking** change opens a new version file (`core.v2.yaml`) beside the old one. It never edits the file consumers are pinned to — mobile and web absorb versions on different schedules by design.
- Every change is reviewed by backend **and** frontend. The contract is the interface between them; a one-sided merge is how the interface drifts.
- Tag on merge. Consumers pin commits, and a tag that later moves to a different commit is a hard failure on their side — never re-point a published tag.
- No `--no-verify`, no disabling a lint rule to make a gate pass.

## Task workflow
Non-trivial contract changes: /task-workflow. Review: /code-review.
```

---

## architecture addendum

Appended to the shared `.claude/rules/architecture.md`:

```markdown
## [Contracts] Versioning

- One file per service per major version, all coexisting. `core.v1.yaml` lives until every consumer has moved off it and the deprecation window in `REPO_MAP.md` has passed.
- Additive changes (a new optional field, a new endpoint) go into the current file. Anything that could break a generated client — a removed or renamed field, a narrowed type, a new required request field — opens the next version file.
- The changelog entry names the consumers expected to move, not just the change.
```

---

## CI

Not written by this profile. See the skip list above: lint, `oasdiff`, tagging and dispatch belong to the contracts-repo workstream, and a half-written release pipeline that tags without checking compatibility is worse than none. Name the gap in the Phase 7 summary.

---

## settings.json Template

Git plus the spec linter. Eight gates — everything except `bugfix-test-guard`.

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
      "Bash(git stash:*)",
      "Bash(npx --no-install @redocly/cli lint:*)"
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
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/precompact-snapshot.mjs"
          }
        ]
      }
    ],
    "Setup": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/install-hooks.mjs"
          }
        ]
      }
    ]
  }
}
```
