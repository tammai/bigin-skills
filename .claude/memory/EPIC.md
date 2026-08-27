# Epic: Two process findings from the BMAD epic

Status: complete
Approved: 2026-08-27
Completed: 2026-08-27 (units 1-2, v1.74.1 and v1.75.0)

## Goal

Fix the two authoring/workflow weaknesses that surfaced while shipping the "Absorb BMAD's
upstream layer" epic (units 1-6, v1.69.0-v1.74.0), neither of which was in the workflows those
units defined. Done when a skill author is told to verify external factual claims as they write
them, and when a two-word correction no longer costs a full implementer resume.

Provenance: spun out of the completed BMAD epic's `## Amendments` section, archived at
`.claude/memory/EPIC.archive.20260827T000000Z-bmad-upstream-layer.md`. That epic produced nine
defects across unit 1's six audit rounds, every one the same species — a sentence asserting a
checkable fact about something outside its own file — and three of the nine were introduced by
fixes for earlier ones. Two of unit 1's six rounds spent a ~270k-token implementer resume to
change two words. These two units are the response.

## Constraints

- **Each unit ships itself** — its own `CHANGELOG.md` entry and a version bump across the four
  manifest version fields (`.claude-plugin/plugin.json` is the source of truth;
  `.cursor-plugin/plugin.json` and two fields in `.cursor-plugin/marketplace.json` follow).
  `.claude-plugin/marketplace.json` carries no version field.
- **Neither unit competes for the always-loaded budget.** Unit 1 edits
  `.claude/rules/skill-authoring.md`, which is path-scoped to `skills/` and `agents/`; unit 2
  edits `skills/task-workflow/SKILL.md`'s body. Neither touches a `description:`. The gate still
  has to pass, it just should not move: 8267/12000 chars at epic start.
- **Neither unit touches `bigin-harness-setup/references/*.md`**, so no CHANGELOG `patch` block
  is needed. If one turns out to, that changes.
- **Both units are parallelizable** — no `Blocked by` edge between them. Separate worktrees
  follow `skills/task-workflow/references/parallelization.md`; otherwise unit 1 goes first.

## Units

| # | Unit | Acceptance | Blocked by | Status | Notes |
|---|------|-----------|------------|--------|-------|
| 1 | `.claude/rules/skill-authoring.md` gains a verify-as-you-write rule for claims about anything outside the file being edited | The rule exists and names the three high-risk forms the epic identified — negative ("neither mentions a PRD"), universal ("all four skip cleanly"), and superlative with no denominator ("the only one that…") — plus the file's-own-frontmatter case; it says the check happens *as the sentence is written*, not in a later audit pass; a re-read of one shipped unit's diff shows the rule would have caught at least one of that unit's nine defects | — | Done | Shipped as **v1.74.1** (patch, not minor: the rule is this repo's own authoring discipline and changes nothing for installers — unit 2 is consumer-visible and should take the minor). Lives as a third top-level bolded paragraph in `.claude/rules/skill-authoring.md`, above `**SKILL.md files:**`, because it governs every file kind below it and not just SKILL.md bullets. Framed as a **timing** rule (same edit that writes the sentence) rather than a quality one — that is the part that distinguishes it from "be accurate", which the epic already had implicitly and which did not work. Four named forms: negative, universal, superlative-with-no-denominator, own-frontmatter; plus a closing line making a cross-file citation (step number, section heading) a claim in its own right. Acceptance sample: v1.69.0's `artifact-formats.md` reader table shipped `**No** — its `SKILL.md` mentions no PRD` for `epic-workflow`, a negative claim about another file, reversed by unit 2; the `write-tests` row the same, reversed by unit 5. **Drafting it caught one of its own defects** — the first draft said all three rows reversed when only the two `**No**` rows did, a universal claim fixed by enumerating. Budget unchanged at 8267; no `description:` and no `bigin-harness-setup/references/*.md` touched, so no CHANGELOG `patch` block. Implement/verify loop **not** run — this session is configured not to call the Agent tool unless asked, so implementation was inline and the gates were run directly, same as unit 6 of the BMAD epic. For unit 2: nothing in this rule constrains `task-workflow`'s step 4.3, and the two files do not overlap.
| 2 | `task-workflow` step 4.3 gains a trivial-fix carve-out | The orchestrator may apply a bounded trivial correction directly instead of resuming the implementer, and **still dispatches a fresh verifier**; "trivial" is bounded explicitly so it cannot swallow a real fix; the resume path is unchanged for everything else; the 3-round cap and its `Notes` bookkeeping still apply | — | Done | Shipped as **v1.75.0** (minor — installer-visible behaviour change, unlike unit 1). Added as a nested **Trivial-fix carve-out** block under step 4.3; the original resume sentence is **byte-identical** (`SKILL.md` diff is +9/-0), so the resume path is unchanged by construction rather than by review. Four bars bound "trivial", and the fourth is the one doing the real work: **all-or-nothing** — one issue failing any bar sends the *whole* list back, because splitting a list leaves the implementer re-deriving against a diff it did not write. The other three: the issue already names the correct value (no decision to make), text not behaviour (a test's *name* is text, its assertion is not), one bounded hunk in a file the diff already touches. Verifier dispatch is **unconditional** and stated as such — a self-applied fix is where an unaudited diff is easiest to rationalise. An orchestrator-applied round that returns `FAIL` goes to the implementer next; no self-fixing twice running. `references/verify-contract.md` gained the matching requirement (an `issues` entry names the correct value where known) since that string is now the sole input to bar 1 — `agents/verifier*.md` reference that file rather than restating it, so their byte-identical bodies were not touched. Pre-minor stale-docs sweep: `docs/USER_GUIDE.md`'s loop diagram and properties list updated (the diagram said FAIL always resumes the same implementer); `README.md`, `docs/KNOWLEDGE.md` and every "capped at 3 rounds" restatement still true since the cap did not move. Two deliberate non-edits — `bigin-harness-setup/references/speckit-migration.md:110` maps `speckit-converge` to "the verifier's `FAIL` → resume-implementer loop", still an accurate equivalence for a migrating user and not worth a CHANGELOG `patch` block rippling into every scaffolded repo; and `site/` is outside `CLAUDE.md`'s sweep list, the precedent unit 6 of the BMAD epic set. Implement/verify loop not run, same reason as unit 1.

## Not in scope

- Re-auditing units 1-6 against the new rule. Unit 1's acceptance samples one diff; it does not
  sweep the epic.
- Changing the verifier's independence contract. The independence that matters is in the audit,
  not in who types the fix — that is the premise of unit 2, not something it revisits.
- Touching the 3-round fix-loop cap itself.
