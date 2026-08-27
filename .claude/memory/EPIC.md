# Epic: Absorb BMAD's upstream layer

Status: complete
Approved: 2026-08-21
Completed: 2026-08-27 (units 1-6, v1.69.0 through v1.74.0)

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
| 1 | `discovery-workflow` skill — scale-adaptive triage, product brief, PRD, structured elicitation, and architecture decisions written into `knowledge/` | Runs standalone on a vague ask and produces brief + PRD at fixed paths plus at least one `knowledge/` concept; a one-line change is triaged straight to `task-workflow` with nothing written; budget gate passes | — | Done | Shipped as v1.69.0 (uncommitted pending approval). Artifact paths are now fixed contract for later units: `docs/product/brief.md`, `docs/product/prd.md`, `knowledge/architecture/<topic>.md`. PRD requirement IDs are `FR-n` with per-requirement Given/When/Then criteria — unit 2 decomposes from these, unit 5 targets them. `write-tests` does not read a PRD (unit 5); `epic-workflow` does, as of unit 2. Add the pre-existing `docs/KNOWLEDGE.md` §5 mermaid gap (no `epic-workflow` node) to unit 3's scope. |
| 2 | `epic-workflow` reads a PRD instead of asking | An epic decomposes from a PRD with zero clarifying questions; behaviour unchanged when no PRD exists | 1 | Done | Shipped as v1.70.0 on `feat/epic-workflow-prd`, stacked on unit 1's branch, uncommitted. `epic-workflow` step 2 is conditional: approved PRD (or no `Status:` line) -> zero questions and a fixed mapping; the no-PRD sentence is unchanged byte for byte. New contract for later units: `EPIC.md` gains an optional `PRD:` header line and an optional `Covers` column, PRD-derived-only -- unit 6's ladder work touches this same step 2, and unit 5 should mirror the mapping's `FR-n/AC-n` citation style. Code review skipped at the user's call. Nothing distilled: the reader contract was unit 1's decision, this unit only wired it. |
| 3 | Harness support for the product artifacts — path-scoped rule, all six profile templates, `patch-mode.md` entry | A fresh scaffold includes it on both hosts; an already-scaffolded repo picks it up via patch mode; budget gate passes for Claude Code and Cursor | 1 | Done | Shipped as v1.71.0, commit on `feat/harness-product-rule` stacked on unit 2. Delivered as **one shared rule**, `.claude/rules/product.md` (`paths: docs/product/**`), registered against the six-profile matrix the way `comments.md` is -- not six copies in six profile files, which would drift within a release. `rule-files.md`'s shared set is now four, not three. Reaches already-scaffolded repos via a `create-if-missing` CHANGELOG patch block whose content is byte-identical to the scaffold template -- **unit 4 edits these same references, so re-verify that identity if it touches `files-shared.md`**. Cursor parity needed no wiring: the mirror readdirs `.claude/rules/*.md`. Also closed unit 1's carried-in `docs/KNOWLEDGE.md` §5 mermaid gap. Code review skipped at the user's call. |
| 4 | Verified + shrinking project context in `bigin-harness-setup` — run every command before writing it down, shrink stale claims instead of appending | A re-verify pass on a real repo removes at least one stale `CLAUDE.md` claim and fails loudly on a command that no longer runs | 3 | Done | Shipped as v1.72.0 on `feat/harness-verify-mode`, stacked on units 2-3. Two behaviours: Phase 2 now runs every Commands row before writing it (all six profiles, not just generic's detection), and a fourth `INSTALL_MODE=verify` (Phase 1b, `references/verify-mode.md`) re-checks an existing `CLAUDE.md` and corrects or removes stale claims in place. **Three distinctions later units must not collapse:** cannot-run (stale claim, rewritten) vs runs-and-fails (reported, row kept) -- `npm run test` exits 1 for both, so read the failure, not the status code; contradicted-by-disk (correctable) vs merely-unsupported (left alone); and only lint/typecheck/test rows are ever executed. The `TODO: <lint|typecheck|test> command` literal now has one definition home (`verify-mode.md` -> `## The TODO: placeholder`) plus its two pre-existing carriers -- **unit 6 must point at it, never re-spell it**. Fixture and its reproducible inputs live in the session scratchpad, not the repo. Three fix-loop rounds, all three from claims about files outside the one being edited. Code review skipped, consistent with units 2-3. |
| 5 | `write-tests` gains an acceptance-criteria → E2E path | Generates an E2E spec from a PRD acceptance criterion in the repo's existing E2E style; unit-test path unchanged | 1 | Done | Shipped as v1.73.0 on `feat/write-tests-e2e`, stacked on units 2-4. `write-tests` now **reads `docs/product/prd.md` itself** on an `FR-n/AC-m` citation rather than being hand-fed a criterion -- so all three readers in `artifact-formats.md`'s contract table now read the file, and that table's last **No** row is closed. Two paths routed on what the request names: a file/function/module -> the seven-step unit path, byte-identical (1976 bytes, hash verified both sides); an ID or an inline Given/When/Then -> the new path, essentials in `SKILL.md` + rules in `references/acceptance-to-e2e.md`. **Three things later units must not undo:** the PRD stays read-only from here (a defect in a criterion is reported for `discovery-workflow` to fix, never edited in place); **no E2E tier in the repo means no file is written** -- report the nearest tier and stop, never install a harness; and an unrun spec is never called green (the unit path's TDD step 5 does not transfer, so the run is attempted and its true state reported in one of three permitted forms). **For unit 6:** `write-tests` now routes on what the request *names*, which is a fourth routing surface next to the three entry points that unit's ladder unifies -- keep it consistent or state deliberately why it differs. A fourth false claim beyond the three planned was found in `artifact-formats.md` and fixed; a re-grep found no fifth. The historical unit-1 note at line 29 of this file still says `write-tests` does not read a PRD -- left as the record of what was true then, deliberately. Code review skipped at the user's call, consistent with units 2-4. Nothing distilled: this repo has no `knowledge/` bundle. |
| 6 | One triage ladder across `discovery-workflow`, `epic-workflow` step 1, and `task-workflow` step 1 | The same request entered at any of the three entry points lands at the same depth; the ladder is stated once and referenced, not restated three times | 1, 2 | Done | Shipped as v1.74.0 on `feat/triage-ladder`, stacked on units 2-5. The ladder lives in `skills/discovery-workflow/references/triage-ladder.md` -- three rungs (1 task / 2 epic / 3 discovery, the numbering `discovery-workflow` already used), two discriminators, three rules that hold at every rung, and a `## What this ladder is not` section. The other two reach it through `${CLAUDE_PLUGIN_ROOT}`, the precedent unit 5 set. **The real defect was not duplication but divergence:** `epic-workflow`'s bar counted two-plus distinct surfaces and `task-workflow`'s escalation clause did not, so a contract-and-its-consumers change forked on which skill the user happened to name; and neither lower entry point could escalate *up* to discovery at all. Both closed -- `task-workflow` gaining the surfaces trigger is a **behaviour change**, some requests that were one `PLAN.md` now decompose. Three things a later change must not undo: the ladder is entered at any rung and hands work **down** as readily as up (the invocation is not evidence); a rung you exit from writes nothing to disk (was stated only in `discovery-workflow` before); and `write-tests` is deliberately **not** a fourth rung -- it routes on what a request *names* to pick a path within one skill, the ladder picks which workflow runs, different axis, and its routing table was not touched. `debug-workflow` stays a qualifier on rung 1 for the same reason. `docs/USER_GUIDE.md` restates the ladder in prose on purpose (it is the human surface) but every restatement is now bound to a rung name so it is greppable; `site/handbook.html:1824` carries a fourth copy of rung 2's bar in an SVG label -- still true, left alone, outside `CLAUDE.md`'s sweep list. Budget unchanged at 8267 chars: no `description:` moved. Implement/verify loop **not** run -- this session was configured not to call the Agent tool unless asked, so implementation was inline and the gates were run directly; the first unit in this epic to skip it. Code review skipped at the user's call, consistent with units 2-5. Nothing distilled: this repo has no `knowledge/` bundle. |

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
