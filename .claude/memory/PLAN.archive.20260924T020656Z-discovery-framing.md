# Plan: discovery-workflow — the framing phase

Status: approved  (all tasks Done — pending review + cleanup)
Branch: main

`discovery-workflow` converges from its first question. Its seven elicitation techniques all
*extract* — they pull out what the user already implicitly knows about a thing they can already
name. Nothing in the chain generates options for the user to react to, so an ask of "we want a
portal" yields a good PRD for a portal and nobody ever asks whether a portal is the right shape.
The one place alternatives are weighed today is `epic-workflow`'s design doc (`## Alternatives
considered`), and that is architecture, after the *what* is settled.

This adds the missing divergent step, and only that. Everything downstream of the brief is
untouched.

## Spec

**What.** A new step between "read the repo" and "elicit": offer the user **at most 4 framings**
of their idea, let them pick, merge, or write their own, and run the existing funnel on the
result. Rung 3 only.

**Where it sits.** `SKILL.md` step 2.5, after step 2 (read the repo — framings are worse when
they ignore what the repo already is) and before step 3 (elicit). It comes *before* elicitation
rather than after because the framing choice answers most of what round 1 asks — problem, users,
outcome — and a user picking between concrete options is cheaper and more accurate than the same
user answering three open questions.

**Budget: the framing round IS elicitation round 1.** The cap in `references/elicitation.md`
stays exactly as written — 3 rounds, at most 4 questions each, 12 for the whole discovery. A
phase that quietly added a fourth round would make every discovery longer, which is the opposite
of the point. `framing.md` states the accounting and `elicitation.md` gains one line pointing at
it, so the two cannot disagree about the total.

**At most 4 framings, asked with `AskUserQuestion`.** Four is the tool's hard cap on options, and
v1.98.2 exists because v1.98.1 ignored it. Three is usually right; "Other" is automatic and is
where a merge or a rejection lands. The step names the tool at the ask site, per
`.claude/rules/skill-authoring.md`.

**What a framing is.** Four lines, no more: the problem it treats as primary, the user it serves,
**what it refuses to do**, and the first slice that would prove it. The refusal line is what makes
framings actually different — three framings with the same non-goals are one framing with three
names.

**How to generate ones that differ**, which is the whole substance of `references/framing.md`:
vary the primary user rather than the feature list; vary the mechanism class (replace the manual
process / make it visible / remove the need for it); always include the cheapest intervention that
could work, as the baseline the others have to earn their cost against; and reject any two
framings whose first slice is the same — that is one framing, and shipping it as two wastes the
user's only pick.

**Writes nothing.** Framings are presented in chat and live in the conversation, same discipline
as the brief and the PRD. The chosen one seeds the brief's Problem / Users / Outcome / Non-goals.

**The losers are recorded.** The brief template gains `## Framings considered` — one line each,
what it was and why it lost. Same argument the epic design doc already makes for
`## Alternatives considered`: the next session should not re-litigate a decision this one made.
Three lines is the whole cost.

**Skip conditions, stated and announced.** Rungs 1 and 2 never reach it. Within rung 3 it skips
when the user says they have already decided the shape, and when the repo's existing product
fixes the framing (a new surface on an established product is rung 3 for its own reasons, but its
framing is usually given). A skipped phase says it is skipping, in one line — the existing
`## Round shape` rule already sets that precedent.

**What this deliberately does not do.** It does not become a standalone `brainstorm` skill: it
shares the triage ladder, the question cap and the two approval gates, and a separate skill would
need its own copy of all three — which is the drift this repo keeps paying for. It does not add a
gate, it does not write a file, and it does not touch the PRD, `epic-workflow` or `task-workflow`.

## Tasks

| # | Task | Status | Notes |
| --- | --- | --- | --- |
| 1 | `skills/discovery-workflow/references/framing.md` — the new reference: what a framing is, the four distinctness rules, the ask shape, the skip conditions, the budget accounting | Done | The substance lives here; `SKILL.md` gets a pointer, not a copy |
| 2 | `SKILL.md` step 2.5 + renumber nothing — steps stay 1..7 with 2.5 inserted as its own numbered step, and the two later cross-references to "step 3" re-checked | Done | Step numbering moves under you; re-read the citing sentences rather than the plan |
| 3 | `references/elicitation.md` — one line: the framing round is round 1, cap unchanged | Done | Single source for the total; `framing.md` points here, not the reverse |
| 4 | `references/artifact-formats.md` — brief template gains `## Framings considered` | Done | One line per rejected framing |
| 5 | `evals/evals.json` — add a should-trigger case for a brainstorm-shaped ask | Done | e.g. "help me figure out what we should even build here" |
| 6 | Regress: extend `every ask site ... names AskUserQuestion` and `no ask site promises more options than the tool allows` to cover `discovery-workflow` | Done | Both cases exist and are scoped to `bigin-harness-setup` today |
| 7 | Regress: the cap arithmetic agrees between `framing.md` and `elicitation.md` | Done | Mutation-check by claiming a 4th round in one file |
| 8 | Docs sweep + version bump + CHANGELOG | Done | Minor (1.102.0) → the full manual-surface sweep: `docs/USER_GUIDE.md`'s discovery section, `README.md` prose, `site/src/pages/` prose |

**No patch block.** Nothing here is templated into a target repo — `discovery-workflow` is read
live from the plugin, so every repo gets this the moment the plugin updates.

## Open questions

| # | Question | Working assumption | Decided by |
| --- | --- | --- | --- |
| 1 | Does the skill `description:` gain a brainstorm trigger? | **Resolved: no.** Two eval cases cover the phrasing instead, at zero always-loaded cost. **No.** Headroom is 11 chars (11,989 of 12,000) and `"what should we even build"` already covers the ask semantically. Adding one means trimming another description to pay for it | Tam |

## Verification

- `node tools/regress.mjs` green, with tasks 6 and 7 mutation-checked.
- A dry run against a real vague ask — "we want a portal" — produces 3 framings whose first
  slices differ, inside one round.
- `node tools/context_budget.mjs` still passes (the phase adds no always-loaded text unless
  open question 1 is answered yes).
