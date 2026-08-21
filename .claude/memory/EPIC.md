# Epic: Absorb BMAD's upstream layer

Status: approved
Approved: 2026-08-21

## Goal

`bigin-skills` gains the layer upstream of code: turning a vague ask into an approved brief,
a PRD, and durable architecture decisions that `epic-workflow` can decompose and
`task-workflow` can execute. Ideas are absorbed from BMAD-METHOD v6.11.0 in this repo's own
idiom — BMAD itself is not installed. Done when a greenfield or established client repo can
go from "we want X" to a decomposed epic without a human hand-writing the intermediate
documents, and when the same triage sends a one-line change straight to `task-workflow`
instead of manufacturing paperwork for it.

## Constraints

- **`bigin-skills` depends on no other plugin.** It owns the generic PRD and architecture-decision formats; `product-rebuild-skills` adopts them later, never the reverse.
- **Two homes, no crossing.** Product artifacts are human-facing durable docs under `docs/product/`. Architecture decisions are agent-facing and live in `knowledge/` concepts, budget-managed. A PRD never lands in `knowledge/`; a system invariant never lands in `docs/product/`.
- **No new commit-time guard.** Discovery approval is conversational. A PRD gate would fire in every repo that installs the harness, and most of them will never have one.
- **Budget gate is the hard ceiling.** 7872/12000 chars at epic start. Unit 1 adds the only new always-loaded description.
- **Each unit ships itself** — its own `CHANGELOG.md` entry and a version bump across all four manifests. No unit defers docs to a later one.
- `references/*.md` under `bigin-harness-setup` are copied verbatim into target repos, so any change to one needs a CHANGELOG `patch` block or already-scaffolded repos never receive it.

## Units

| # | Unit | Acceptance | Blocked by | Status | Notes |
|---|------|-----------|------------|--------|-------|
| 1 | `discovery-workflow` skill — scale-adaptive triage, product brief, PRD, structured elicitation, and architecture decisions written into `knowledge/` | Runs standalone on a vague ask and produces brief + PRD at fixed paths plus at least one `knowledge/` concept; a one-line change is triaged straight to `task-workflow` with nothing written; budget gate passes | — | Done | Shipped as v1.69.0 (uncommitted pending approval). Artifact paths are now fixed contract for later units: `docs/product/brief.md`, `docs/product/prd.md`, `knowledge/architecture/<topic>.md`. PRD requirement IDs are `FR-n` with per-requirement Given/When/Then criteria — unit 2 decomposes from these, unit 5 targets them. Neither `epic-workflow` nor `write-tests` reads a PRD yet; the handoff is a human passing the path. Add the pre-existing `docs/KNOWLEDGE.md` §5 mermaid gap (no `epic-workflow` node) to unit 3's scope. |
| 2 | `epic-workflow` reads a PRD instead of asking | An epic decomposes from a PRD with zero clarifying questions; behaviour unchanged when no PRD exists | 1 | Not started | |
| 3 | Harness support for the product artifacts — path-scoped rule, all six profile templates, `patch-mode.md` entry | A fresh scaffold includes it on both hosts; an already-scaffolded repo picks it up via patch mode; budget gate passes for Claude Code and Cursor | 1 | Not started | |
| 4 | Verified + shrinking project context in `bigin-harness-setup` — run every command before writing it down, shrink stale claims instead of appending | A re-verify pass on a real repo removes at least one stale `CLAUDE.md` claim and fails loudly on a command that no longer runs | 3 | Not started | Blocked on 3 for file collision, not artifact dependency — both edit harness-setup's references |
| 5 | `write-tests` gains an acceptance-criteria → E2E path | Generates an E2E spec from a PRD acceptance criterion in the repo's existing E2E style; unit-test path unchanged | 1 | Not started | Parallel with 3 and 4 |
| 6 | One triage ladder across `discovery-workflow`, `epic-workflow` step 1, and `task-workflow` step 1 | The same request entered at any of the three entry points lands at the same depth; the ladder is stated once and referenced, not restated three times | 1, 2 | Not started | |

## Not in scope

Installing BMAD itself — the posture is absorb, not complement. Nor are these BMAD skills
ported, each because we already have it or deliberately don't want it:

- `bmad-retrospective` — `sprint-distill` covers it
- `bmad-correct-course` — `task-workflow` gained course correction in v1.65.0
- `bmad-code-review` — `task-workflow` step 5 plus `/code-review`
- BMad Loop / `bmad-build-auto` — `epic-workflow`'s hard stop after each unit is a deliberate context-hygiene choice; autopilot already exists in `product-rebuild-skills` where the artifacts justify it
- `stories.yaml` / `sprint-status.yaml` — our guards read markdown tables off disk; a YAML state file forks the guard contract
- `bmad-party-mode`, `bmad-checkpoint-preview` — approval gates already exist

## Amendments

- **2026-08-21 — two process findings spun out of this epic.** Unit 1's six audit rounds plus its
  behavioural test produced nine defects, every one the same species: a sentence asserting a
  checkable fact about something outside its own file. Three were introduced by fixes for earlier
  ones. None was in the workflow the skill defines. Two improvements follow, and neither belongs
  here — this epic's goal is absorbing BMAD's upstream layer, and these are about how we author
  skills at all:

  1. `.claude/rules/skill-authoring.md` gains a rule: a sentence asserting a verifiable fact about
     anything outside the file being edited must be checked against that thing as it is written,
     including facts about the file's own frontmatter. Negative and universal claims are the
     high-risk form ("neither mentions a PRD", "all four skip cleanly", "the only one that…"); two
     of the nine were superlatives with no denominator to check against at all.
  2. `task-workflow` step 4.3 gains a trivial-fix carve-out: the orchestrator applies a one-line
     correction directly and still dispatches a fresh verifier. Two of unit 1's six rounds spent a
     ~270k-token implementer resume to change two words. The independence that matters is in the
     audit, not in who types the fix.

  Tracked as their own epic, not as units 7 and 8 here. Recorded so they are not lost with this
  file. Note that finding 1 gets more valuable the sooner it lands, since units 2-6 are all
  authoring work.
