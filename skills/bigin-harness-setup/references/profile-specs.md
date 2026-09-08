# Specs Profile Templates

The BA's repo in a polyrepo project (`<project>-specs`). Holds BMAD docs — PRD, architecture, epics, stories, QA gates — plus the `REPO_MAP.md` source and `ux/figma-links.md`. **No code and no test automation.** Selected by Phase 0a from the repo name, never by a file marker; the stack ladder does not run.

Its users are business analysts, not developers. Every message this profile installs is written for someone who will not read a stack trace, and the gates whose premise is "there is code here" are deliberately absent — see `references/overlay-matrix.md` → `## Polyrepo profiles: which gates apply`.

What this profile **installs**: `CLAUDE.md`, `.claude/rules/` (security + product only), the AI files, six of the nine gates, `settings.json`, the context-budget gate, a pre-commit script that runs the story lint, and the knowledge bundle if opted into.

What it **skips**: Phase 0.5 scaffold (nothing to scaffold — a specs repo is seeded by its BA), the conventions and testing rules (no stack), `.vscode/settings.json`, `commit-msg-guard`, `bugfix-test-guard` and `spec-gate-guard` (reasons in the matrix), and Phase 5.6 CI beyond the story lint.

---

## Commands

There is no lint/typecheck/test triad here. Record all three as the literal `TODO` placeholder and say so in the Phase 7 summary — the placeholder is how the harness reports "this profile has none" rather than inventing one.

The one real command is the story lint, which is also the pre-commit gate:

```sh
node scripts/story_lint.mjs
```

Copy it from `${CLAUDE_PLUGIN_ROOT}/skills/bigin-harness-setup/scripts/story_lint.mjs` to `scripts/story_lint.mjs`.

---

## BMAD story template addition

Append this to the story template in the repo's own `.bmad-core`. **This plugin ships no BMAD template**, so it cannot patch one — hand it to the BA with the sentence below, and say in the Phase 7 summary that it was handed over rather than installed.

```markdown
## Contract impact

- contracts: none | <service>.v<major> — endpoints touched
- breaking: yes | no
- ui: yes | no
```

`ui: yes` is what the ready-for-dev gate keys on: a story that declares UI needs a Figma node-id in its consumer-side sidecar before it can enter a sprint. Design impact is deliberately **not** in this section — it belongs in the sidecar, filled by dev, not in the story, filled by the BA.

`story_lint.mjs` enforces the section's presence and its values at commit time. Its assumptions about BMAD's story format are listed in the script's own header and confined to one function, because they were written against the documented shape rather than a live corpus — expect to revisit them against the first real specs repo.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: BMAD specs repository — PRD, architecture, epics, stories, QA gates. No application code.

## What lives here
| Folder | Holds |
|---|---|
| `docs/prd/` | product requirements |
| `docs/architecture/` | architecture decisions |
| `docs/epics/` | epics |
| `docs/stories/` | user stories — **the source of truth**, synced from here to the dev repos |
| `docs/qa/` | QA gates |
| `REPO_MAP.md` | the project's map of every repo; synced everywhere from here |

## Commands
| Purpose | Command |
|---|---|
| check stories | `node scripts/story_lint.mjs` |

## Hard Rules (non-negotiable)
- A story is finished only when its **Contract impact** section is filled in. The check runs when you commit and will tell you exactly which line is missing.
- Stories are written here and **nowhere else**. The dev repos receive read-only copies; a change made there is thrown away on the next sync.
- Never disable a check to get a commit through. If a check looks wrong, say so — it gets fixed here, not bypassed.
- Nothing in this repo is secret, but never paste credentials, tokens or customer data into a story.

## Task workflow
Writing or reshaping a requirement: /discovery-workflow. Breaking an initiative into stories: /epic-workflow.
```

---

## rules

Two files only, both from `files-shared.md`: `.claude/rules/security.md` and `.claude/rules/product.md`. No `architecture.md` (this repo *is* where architecture is written, so a rule file about respecting it has no target), no `conventions*.md`, no `testing.md`.

---

## architecture addendum

None, and no `architecture.md` at all. See `## rules`.

---

## CI

Two workflows. `node scripts/story_lint.mjs` over the repo (plus the orphan-sidecar check once Phase 6 lands) — no build, no tests, no deploy. And `.github/workflows/story-dispatch.yml` from `references/ci.md` → `## story-sync workflow: github (specs repo)`, which tells every consumer repo when a story changes. The consumer half of that flow is written into the consumer repos, not here.

---

## settings.json Template

`permissions.allow` is git plus the story lint. Six gates: `bash-guard` (a BA still runs `git`), the three-stage injection defence, the session-resume notice, and the compaction snapshot — plus the `Setup` clone bootstrap. `commit-msg-guard`, `bugfix-test-guard` and `spec-gate-guard` are absent by design.

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
      "Bash(node scripts/story_lint.mjs:*)"
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
