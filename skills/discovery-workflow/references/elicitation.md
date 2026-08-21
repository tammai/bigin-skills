# Elicitation

What to ask when the repo can't answer it, and — more importantly — how much you are allowed to
ask. This replaces the bare "up to 3 clarifying questions" that the rest of the harness uses:
three questions is the right budget for a task whose shape is already known, and the wrong one
for a product question, in both directions. Too small to establish who a product is for; too
open-ended to stop an agent asking twelve variations of the same thing.

## The cap

**3 rounds. At most 4 questions per round. 12 questions for the whole discovery, including any
asked while reading the repo.** Amendments to an approved artifact get one round of at most 2
questions, not a fresh budget.

A round is one message: ask, wait, use the answers. Never ask a follow-up inside the same turn
you received an answer in — that is how a round becomes an interrogation.

**When the cap is reached, stop asking and write the brief anyway.** Every unresolved item
becomes a row in the brief's `## Open questions` table with a deciding role and a working
assumption, and the brief says in one line that elicitation hit the cap. That is a better
artifact than a longer interview: it makes the remaining uncertainty visible at the approval
gate, where the person who can actually resolve it is looking. An agent that keeps asking is
optimising for its own confidence at the user's expense.

## Before asking anything

Read the repo first (`established-repo.md`). Then drop every question that fails any of these:

- **The repo already answers it.** Stack, commands, conventions, existing surfaces, current data
  model — these are read, never asked. Asking anyway tells the user you didn't look.
- **The answer changes no line** of the brief or the PRD. If you can't name the section it
  lands in, it isn't a discovery question.
- **It's implementation detail.** Which library, which table, which component. Those are decided
  at the task's spec gate with the relevant code in front of it, not here.
- **It bundles two decisions.** Split it or drop the weaker half. A compound question gets a
  compound answer that resolves neither.

Each question that survives carries a **default** — "assume X unless you say otherwise" — so
that "you decide" is a usable answer rather than a dead end.

## Techniques

Pick by what's missing. This is a routing table, not a script: running all seven would blow the
cap by itself, and most discoveries need two or three.

| Technique | Use it when | The ask | What it produces |
| --- | --- | --- | --- |
| **Concrete instance** | the ask is abstract ("we want a portal") | "Walk me through the last time someone actually did this, start to finish." | the real flow, the real roles, and the edge cases nobody volunteers |
| **Problem inversion** | there's no stated pain, only a feature | "If we ship nothing here, what's different in six months?" | whether there is a problem at all, and the Outcome line |
| **Role census** | more than one kind of user is implied | "Who touches this, and what must each of them *not* be able to see or do?" | the Users table, including the boundary column the authorization model comes from |
| **Non-goals first** | the scope is unbounded | "What would you be annoyed to find in the first version?" | Non-goals. The cheapest question in the set and the one most often skipped |
| **Failure interview** | money, privacy, or data loss is in scope | "What must never happen, even once?" | non-functional requirements, and most of the architecture invariants in step 6 |
| **Volume and horizon** | any storage, listing, or reporting surface | "How many of these exist today, and how many in a year?" | the only reliable source of scale requirements; frequently decides the architecture outright |
| **Disagreement probe** | more than one stakeholder is named or implied | "Who would answer that differently, and who decides when they do?" | the deciding role for each open question — this is what stops a brief being approved by someone who can't approve it |

## Round shape

The default sequence, when you need all three rounds:

1. **Shape** — problem, users, outcome. Concrete instance and problem inversion do most of the
   work here. Nothing else is answerable until this round is.
2. **Boundaries** — non-goals, constraints, what must never happen. Non-goals first and the
   failure interview.
3. **Numbers** — volumes, horizon, priority order. Volume and horizon, plus a forced choice on
   priority: "if only one of these shipped this quarter, which one?" That answer is what the
   PRD's `Priority:` fields are built from.

Skip any round the repo or the previous round already answered, and say you're skipping it.
Finishing in one round is a good outcome, not a shortcut.

## What answers may become

Answers arrive as prose about a real business, and prose about a real business contains real
people. **Names, email addresses, account numbers, and customer identities stay in the
conversation and never reach an artifact** — translate each one to its role on the way in
("Priya in finance" becomes "the finance approver") and keep translating consistently, so the
brief and the PRD use one vocabulary. The approval gate in `SKILL.md` step 5 is the backstop,
not the first line of defence.
