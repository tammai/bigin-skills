# The triage ladder

Three rungs, one statement. `ask-bigin` reads it too, to route a request it was handed — but it is a
reader, not an entry point, and it never decides a rung the ladder wouldn't.
`task-workflow`, `epic-workflow` and `discovery-workflow` each enter their
work through this ladder, and the point of writing it once is that the *same request lands on the same
rung whichever of the three it was typed at*. Three paragraphs in three files drift, and a request that
gets a spec at one door and a decomposition at another is the drift that matters — it changes how much
process the work pays for.

## The rungs

| Rung | The request | Runs |
| --- | --- | --- |
| **1 · task** | One plan's worth — one spec, one implement/verify loop, one mergeable diff — and it does not touch two-plus distinct surfaces | `task-workflow`; `debug-workflow` first if the bug needs diagnosis before it can be scoped |
| **2 · epic** | **3+ units**, *or* it spans more than one mergeable PR, *or* it touches two-plus distinct surfaces (a contract *and* its consumers, a migration *and* the code reading it) — and the product shape is already settled | `epic-workflow` |
| **3 · discovery** | The product shape is *not* settled — a vague ask, a new product surface, or a named initiative nobody can yet write acceptance criteria for | `discovery-workflow` |

Rung 2's bar is a disjunction: any one of the three triggers is enough. Two-plus surfaces is the one most
often missed, because such a change can be small in lines and still needs the units ordered — the contract
lands before the code that reads it, or `main` is unshippable in between.

## The two discriminators

Each boundary has one question, and neither is a judgment call about how big the work *feels*.

**Rung 1 or rung 2 —** *does one `PLAN.md` hold it?* One spec, one implement/verify loop, one reviewable
diff, one surface. If any of those has to become two, it is rung 2.

**Rung 2 or rung 3 —** *can you write one testable acceptance criterion for the request exactly as stated,
inventing nothing?* If yes, the product question is answered and the work is an epic or a task. If writing
that one criterion requires you to decide who the user is or what "done" means, it is rung 3.

## Rules that hold at every rung

**The ladder is entered at any rung, and you move to the rung the request actually is — downward as well
as up.** Being invoked at a rung is not evidence the request belongs there. `task-workflow` hands a vague
ask up to rung 3 rather than spec'ing over the gap; `discovery-workflow` hands a copy fix down to rung 1
rather than manufacturing a brief for it. The commonest failure is the invocation justifying itself.

**A rung you exit from writes nothing to disk.** Exit in one sentence naming the skill to run — no stub
brief, no empty `docs/product/`, no placeholder concept, no `EPIC.md` with one row, no `PLAN.md` for a
task that was really an epic. An artifact that exists because a skill was invoked rather than because
someone needed it is exactly the paperwork this ladder exists to avoid.

**Landing on a rung starts that skill from its own beginning, never mid-workflow.** Each rung owns
everything after triage — its own gates, its own artifacts, its own approvals — and a skill that resumes
from disk still does that first, as it always would. The ladder decides which workflow runs and nothing
else.

## What this ladder is not

- **Not a model or effort decision.** That is `model-router`, and it runs *inside* rung 1 — `task-workflow`
  is the only skill that calls it. A rung-1 task can still be the most expensive thing in the repo.
- **Not `write-tests`' routing.** `write-tests` picks between its unit path and its acceptance-criterion →
  E2E path on what the request *names* — a file or function on one side, a PRD requirement or criterion ID
  on the other. That selects a path **within one skill**; this ladder selects **which workflow runs**.
  Different axis, deliberately, and neither one feeds the other. `write-tests` is not a fourth rung.
- **Not a place for `debug-workflow`.** Diagnosis is a qualifier on rung 1, not a rung: a bug's fix is one
  task however tangled the diagnosis was, and how hard it is to *find* says nothing about how much process
  the *fix* needs.
