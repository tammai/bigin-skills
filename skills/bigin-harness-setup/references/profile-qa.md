# QA Profile Templates

The QA repo in a polyrepo project (`<project>-qa`). Holds manual test cases, end-to-end automation, and traceability from both back to story IDs. **Unit and integration tests do not live here** — they live with the code they test, in the api/web/mobile repos. Selected by Phase 0a from the repo name; the stack ladder does not run.

This repo has two kinds of user, and the profile is written for both: manual testers, who work in markdown and should never meet a stack trace, and automation engineers, who write real code. That is why it keeps more gates than `specs` and fewer than a code repo.

What this profile **installs**: `CLAUDE.md`, `.claude/rules/security.md` + `testing.md`, the AI files, eight of the nine gates, `settings.json`, the context-budget gate, and a pre-commit script running the E2E lint when an automation toolchain is present.

What it **skips**: Phase 0.5 scaffold, `conventions*.md` and `architecture.md`, `.vscode/settings.json`, and `spec-gate-guard` — writing a test case *is* the work here, and a gate demanding an approved `PLAN.md` before a tester may write one inverts the workflow it is meant to protect.

**`bugfix-test-guard` is kept**, unlike in `specs` and `contracts`, and for a reason specific to this repo: a fix to an E2E spec *is* a test file, so it satisfies the guard's own `TEST_PATTERNS` and passes without ceremony. Manual cases are markdown, which the guard's trivial allowlist already covers. The premise holds here; it does not there.

---

## Commands

Detected, not assumed — an automation stack may or may not exist yet. Follow `references/profile-generic.md` → `## Commands` for the detection ladder, then record:

| Purpose | Typical |
|---|---|
| lint | the automation toolchain's linter, if one is configured |
| typecheck | `TODO: typecheck command` unless the automation is typed |
| test | the E2E runner (`npx playwright test`, `npx cypress run`, …) |

A repo holding only manual cases so far records all three as `TODO` and says so in the Phase 7 summary. That is a normal state, not a gap to paper over.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: QA repository — manual test cases, end-to-end automation, traceability to story IDs. Unit and integration tests live with the code, not here.

## What lives here
| Folder | Holds |
|---|---|
| `cases/` | manual test cases, one file per case, each naming the story it covers |
| `e2e/` | end-to-end automation |
| `traceability/` | story ID → cases and specs that cover it |

## Commands
| Purpose | Command |
|---|---|
| test | `{TEST}` |

## Hard Rules (non-negotiable)
- Every test case and every E2E spec names the **story ID** it covers. A case that covers nothing traceable is a case nobody can act on.
- Stories are read-only here. They are written in the specs repo and copied in; edit one there.
- A bug found here is reported against the story, not fixed in the app repo from this session.
- Never put credentials or real customer data in a test case or a fixture. Test accounts only.
- No `--no-verify`.

## Task workflow
Automating a case: /task-workflow. Investigating a failure: /debug-workflow.
```

---

## rules

`.claude/rules/security.md` and `.claude/rules/testing.md` from `files-shared.md`. No `architecture.md` (this repo has no application architecture to respect) and no `conventions*.md` (the automation stack is detected, not prescribed).

---

## CI

The E2E suite on a schedule or against a deployed environment — never on every push, since it needs a running stack this repo does not own. Plus the story gates from `references/ci.md` → `## story gates:`, which apply here as they do in any repo receiving synced stories: a merge request names a story, and orphaned sidecars are surfaced. If no automation exists yet, write the story gates and no E2E workflow, and say so in the summary.

---

## settings.json Template

Git plus the detected test runner. Eight gates — everything except `spec-gate-guard`.

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
