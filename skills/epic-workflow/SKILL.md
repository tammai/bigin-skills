---
name: epic-workflow
description: "Breaks an initiative too big for one PLAN.md into ordered, independently shippable units, gets the decomposition approved, then dispatches one unit per session through task-workflow. Triggers: 'break this epic down', 'too big for one task', /epic-workflow."
effort: low
---

# epic-workflow

The layer above `task-workflow`. `task-workflow` takes one task to shipped code; this decides what the tasks *are* and in what order, then feeds them in one at a time.

It adds no gate of its own. Every unit still goes through `task-workflow`'s spec gate — approving an epic approves the *decomposition*, never a unit's spec, and `.claude/memory/EPIC.md` deliberately does not satisfy `spec-gate-guard.mjs`. Don't try to make it: the guard reads `PLAN.md` at the repo root, and an epic-level approval standing in for five unwritten specs is exactly the drift the gate exists to stop.

## When not to use

- **The request fits one `PLAN.md`** — one spec, one implement/verify loop, one mergeable diff. That's `task-workflow`. Decomposing it costs a session and buys nothing.
- **A bug, however tangled.** `debug-workflow` triages it; the fix is one task.
- **A roadmap.** More than ~8 units isn't an epic — see the ceiling in step 3.

## Steps

1. **Triage.** An epic must clear this bar: **3+ units**, *or* it spans more than one mergeable PR, *or* it touches two-plus distinct surfaces (a contract *and* its consumers, a migration *and* the code reading it). If it fails the bar, say so in one sentence and hand straight to `task-workflow` — don't decompose to justify the invocation.

2. **Clarify.** Up to 3 questions, and only about what changes the *decomposition*: sequencing, what's explicitly out, which surface is authoritative when two disagree. Not implementation detail — each unit's own spec gate asks those later, with the relevant code in front of it. Never invent a decomposition over an unasked question.

3. **Decompose.** Every unit must satisfy all four:
   - **One plan's worth** — one spec, one implement/verify loop, one reviewable diff. If a unit needs two specs, it's two units.
   - **Independently verifiable** — it has acceptance criteria that hold without any later unit existing. A unit whose only test is "unit 4 works" isn't a unit.
   - **Leaves the repo green and shippable** — `main` must be able to ship with units 1..k done and k+1..n absent. Dead-but-tested code behind a flag is fine; a half-applied migration or a contract with no implementation is not.
   - **Ordered by artifact dependency, not by convenience** — contracts and migrations first, consumers after. Set `Blocked by` only where a real artifact dependency exists; units with none are parallelizable, and say so (see `bigin-skills skills/task-workflow/references/parallelization.md` for the worktree rule).

   **Ceiling: ~8 units.** Past that the scope is a roadmap, not an epic. Say so, then propose the first epic-sized slice of it and note what you've deferred — don't queue twenty rows nobody will reach.

4. **Approval gate.** Present the unit table in chat and wait. This is the epic's one gate. Write nothing to disk before approval — an unapproved queue file on disk is indistinguishable from an approved one on the next session's resume.

5. **Write the queue** to `.claude/memory/EPIC.md`. Format and worked example: `references/epic-queue.md`. If a file is already there with open rows, that's step 8, not this step.

6. **Dispatch one unit.** Take the first row that isn't `Done` and whose every `Blocked by` row is `Done`. State the unit number, its acceptance criteria, and any epic-level constraint it inherits — then run `task-workflow` on that unit as the task statement. `task-workflow` owns it completely from there: its own spec gate, its own `PLAN.md`, its own verifier rounds.

7. **Close the unit, then stop.** Once `task-workflow` reaches cleanup and deletes `PLAN.md`, flip the row to `Done` and put a one-line outcome in `Notes` — what shipped, and anything it changed for a later unit (a renamed field, a decision the next unit inherits). Then **stop and hand off**: tell the user to `/clear` and re-invoke this skill for the next unit.

   Do not start the next unit in the same session. The queue file is the complete handoff package, and everything the finished unit accumulated — its spec, its diff, its verify rounds — is context the next unit doesn't need and shouldn't pay for.

8. **Resume.** On invocation, check `.claude/memory/EPIC.md` first. If it exists with rows not `Done`: report the queue state in one table, then go to step 6 for the next eligible unit. Never re-decompose over an in-flight epic, and never overwrite the file without asking — if the user wants a different decomposition, that's step 9.

9. **Amend, when the epic itself moves.** A unit's work sometimes invalidates a later unit — a contract lands differently, a dependency turns out unnecessary. Amend rather than restart: add, remove, or reorder rows, log it in the file's `## Amendments` section, and re-approve **only the changed rows** (don't re-paste the whole table). If the epic's *goal* moved rather than its units, stop and re-decompose from step 2 — a queue patched past recognition is worse than an honest second epic. **Cap: 2 amendments.** A third means the original decomposition was wrong; say that and re-decompose.

10. **Epic cleanup.** Once every row is `Done`:
    - **Distill, and expect to find something.** This is the layer where durable decisions actually live — a single `PLAN.md` usually establishes nothing worth keeping, but an epic that settled a contract, a boundary, or an invariant did. Propose the specific `knowledge/` edit (which concept file, what line), preferring an amendment to an existing concept over a new file; every new file needs a summary line in `knowledge/index.md`. Read the `## Amendments` log before proposing — a decomposition that had to change usually changed because of something worth writing down. Skip if the repo has no `knowledge/` bundle.
    - **Rebuild the graph** if `graphify-out/graph.json` exists: propose `graphify update .`.
    - **Delete `.claude/memory/EPIC.md`.** It's a working file for the epic, like `PLAN.md` is for a task. Nothing to preserve once the last unit ships and the distillation is in `knowledge/`.

## Interaction with session-handoff

`session-handoff` writes `.claude/memory/SESSION.md` alongside the queue. Keep them in their lanes: `EPIC.md` holds the unit queue and its amendment log, `SESSION.md` holds whatever is in flight *right now*. When saving a session mid-unit, name the epic and the unit number in `SESSION.md` rather than copying rows across — two records of the same queue drift within a day.
