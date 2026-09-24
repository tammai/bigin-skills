# Framing

How to offer someone a choice about what they're building, before anyone writes it down.

Everything else in this skill converges. The seven techniques in `elicitation.md` *extract* —
they pull out what the user already implicitly knows about a thing they can already name. That is
the right instrument once the shape is settled and the wrong one when it isn't: an ask of "we
want a portal" runs straight through to a good PRD for a portal, and nobody ever asks whether a
portal is the right shape. This step is the one place the skill diverges before it narrows.

It runs at **step 2.5**, after the repo read and before elicitation. Before, not after, because
the framing choice answers most of what round 1 would have asked — problem, users, outcome — and
someone picking between concrete options is both cheaper and more accurate than the same person
answering three open questions.

## The budget

**The framing round is elicitation round 1.** Not an extra round. The cap in `elicitation.md` is
unchanged and remains the single source for the total: 3 rounds, at most 4 questions per round,
12 questions for the whole discovery.

A phase that quietly added a fourth round would make every discovery longer, which is the
opposite of why this exists. If framing resolves the shape — and it usually does — rounds 2 and 3
are the boundaries and numbers rounds, and round 1 never happens separately.

## When to skip it

Say you're skipping, in one line, and go to step 3. The `## Round shape` rule in
`elicitation.md` already sets that precedent — a silent skip reads as an oversight.

- **The user has already decided the shape**, and says so. Offering options to someone who came
  with an answer is theatre, and it costs them a round.
- **The repo's existing product fixes the framing.** A new surface on an established product is
  often rung 3 for its own reasons — who the user is, what "done" means — while the shape is
  given by everything already shipped. Frame only what is genuinely open.
- **The constraint decides it.** One integration, one regulator, one deadline that admits one
  approach. Say which constraint, so the user can disagree with the constraint rather than with
  a silence.

Rungs 1 and 2 never reach this step at all; the ladder exits before it.

## What a framing is

Four lines. Not a proposal, not a design — a *stance* on what problem is worth solving.

| Line | What it carries |
| --- | --- |
| **Problem** | the one it treats as primary. Not the whole list — the one that, if solved, makes the others smaller |
| **User** | who it serves first. Naming a second user is how a framing stops being a framing |
| **Refuses** | what it deliberately will not do. The load-bearing line — see below |
| **First slice** | the smallest thing shippable that would show whether the stance is right |

**The refusal line is what makes framings different from each other.** Three framings with the
same non-goals are one framing with three names, and the user cannot tell them apart until they
have already picked one. If you cannot write a distinct refusal for a framing, it is not a
separate option — drop it or merge it.

## Making them genuinely different

Four rules, in the order they catch problems:

1. **Vary the primary user, not the feature list.** The same features serving the ops team and
   serving the customer are two different products with two different first slices. Varying the
   features while holding the user fixed produces a menu, not a choice.
2. **Vary the mechanism class.** Roughly: *replace* the manual process, *make it visible* so
   people fix it themselves, or *remove the need for it* upstream. Three framings drawn from one
   class differ only in size.
3. **Always include the cheapest intervention that could plausibly work** — often "a report and
   a Slack message", sometimes "change the policy, build nothing". It is the baseline the others
   have to earn their cost against, and it is right more often than anyone expects. This is the
   constructive form of `elicitation.md`'s problem inversion.
4. **Collapse any two whose first slice is the same.** Identical first slices mean identical
   bets; shipping them as two options wastes half the user's only pick.

## Asking

**Use `AskUserQuestion`.** One question, the framings as options, each option's description
carrying the four lines compressed to a sentence or two.

**At most 4 options — this is the tool's hard cap, not a style preference.** Three is usually
right. v1.98.1 promised more than four and v1.98.2 is the fix; do not re-learn it here. "Other"
is added automatically and is where a merge, a rejection, or the user's own framing lands, so
there is no need to spend an option on "none of these".

A merge is a normal, common answer — two framings whose stances are compatible often produce a
better brief than either alone. Restate the merged stance in one line and confirm it before
moving on, because a merge the user meant loosely and you took literally is an unnoticed wrong
assumption at exactly the point step 4 warns about.

## What happens to the answer

The chosen framing seeds the brief: its Problem line becomes `## Problem`, its User line starts
`## Users`, its Refuses line starts `## Non-goals`, and its First slice informs `## Outcome`.
None of that is written yet — step 4 still presents the brief and waits.

**The losing framings get one line each** in the brief's `## Framings considered`: what it was,
why it lost. The epic design doc already makes this argument for `## Alternatives considered`,
and it holds harder here, where the decision is older and the next session has less context. The
whole cost is three lines, and it stops the same three options being regenerated next quarter.

Nothing is written to disk during this step. Framings live in the conversation until the brief
carries them.
