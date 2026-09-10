---
name: epic-workflow
description: "Breaks an initiative too big for one PLAN.md into ordered, independently shippable units, drafts the epic's one-page design doc, gets both approved, then dispatches the units one at a time through task-workflow. Triggers: 'break this epic down', 'too big for one task', 'design doc for this epic', /epic-workflow."
argument-hint: [initiative]
effort: low
---

# epic-workflow

The layer above `task-workflow`. `task-workflow` takes one task to shipped code; this decides what the tasks *are* and in what order, then feeds them in one at a time.

It adds no gate of its own. Every unit still goes through `task-workflow`'s spec gate — approving an epic approves the *decomposition*, never a unit's spec, and `.claude/memory/EPIC.md` deliberately does not satisfy `spec-gate-guard.mjs`. Don't try to make it: the guard reads `PLAN.md` at the repo root, and an epic-level approval standing in for five unwritten specs is exactly the drift the gate exists to stop.

## When not to use

- **The request fits one `PLAN.md`** — one spec, one implement/verify loop, one mergeable diff. That's `task-workflow`. Decomposing it costs a session and buys nothing.
- **A bug, however tangled.** `debug-workflow` triages it; the fix is one task.
- **Nobody can write acceptance criteria for it yet.** Rung 3 — `discovery-workflow` runs first, and its PRD comes back here.
- **A roadmap.** More than ~8 units isn't an epic — see the ceiling in step 3.

## Steps

1. **Triage.** Run the ladder in `${CLAUDE_PLUGIN_ROOT}/skills/discovery-workflow/references/triage-ladder.md`. It is stated once and shared by all three entry points, so a request typed here lands on the same rung it would have reached through `task-workflow` or `discovery-workflow`.

   **Only rung 2 continues.** This skill *is* rung 2, and it refuses in both directions. Below the bar the work is rung 1 — say so in one sentence and hand straight to `task-workflow`, don't decompose to justify the invocation. Where the initiative is stated but its product shape isn't settled it is rung 3, and there is nothing here to decompose *from*: hand to `discovery-workflow`, whose PRD comes back to this skill at step 2.

2. **Clarify — conditional on an approved PRD.** Check `docs/product/prd.md` first. `epic-workflow` only ever reads this file — it never writes or amends it, at any step.

   **A PRD exists, is `Status: approved` (or has no `Status:` line), and the initiative is what it covers:** read it and ask **zero** clarifying questions — the PRD already answers everything this step is allowed to ask about, through a fixed mapping:

   | PRD field | Answers |
   | --- | --- |
   | The requirement index | The unit candidates — one unit per FR, or one unit per tight FR cluster sharing a `Surface:`; never one unit spanning two unrelated FRs |
   | `Depends on:` | `Blocked by` — the only legitimate source of a Blocked-by edge when decomposing from a PRD |
   | `Surface:` | The two-plus-surfaces half of step 1's triage bar |
   | `Priority:` (`must`/`should`/`could`) | What the first epic-sized slice contains when the PRD exceeds the ~8-unit ceiling — `must` first |
   | Each FR's acceptance criteria | That unit's `Acceptance` cell, **quoted from the PRD, never paraphrased**, so the unit's own spec gate is audited against the PRD's own words. A quoted criterion inherits the PRD's roles-never-people rule — a real name surfacing in one is fixed in the PRD, never edited out of `EPIC.md` |

   Cite the FR IDs a unit covers so the decomposition is traceable back to the contract, and name out loud any active requirement no unit covers, as deferred.

   Edge cases:
   - **`Status: draft`** — not a decomposition source. Report it and ask: approve it through `discovery-workflow` first, or proceed with the questions below. Don't silently decompose a draft; a draft PRD's IDs can still move.
   - **No `Status:` line** — treat as approved, same rule `discovery-workflow` already uses.
   - **`Status: withdrawn` requirement** — never becomes a unit, and never becomes a `Blocked by`.
   - **PRD exists but the initiative is unrelated to it** — say so in one sentence and fall through to the questions below. A PRD on disk is not a claim that every later epic derives from it.
   - **PRD yields more than ~8 units** — the existing ceiling in step 3 still wins; slice by `Priority:`, `must` first, and say what was deferred.
   - **Index and FR blocks disagree** — the block wins (already the PRD's own rule); say which line was stale rather than reconciling silently.
   - **An FR's acceptance criteria can't hold without a later unit** — it is not one unit; split or reorder it. Step 3's four decomposition rules still govern; a PRD does not exempt a unit from them.
   - **Resuming an in-flight `EPIC.md` (step 8)** — unchanged: never re-read a PRD to re-decompose an approved queue.

   **No PRD, a draft one, or an unrelated one:** Up to 3 questions, and only about what changes the *decomposition*: sequencing, what's explicitly out, which surface is authoritative when two disagree. Not implementation detail — each unit's own spec gate asks those later, with the relevant code in front of it. Never invent a decomposition over an unasked question.

3. **Decompose.** Every unit must satisfy all four:
   - **One plan's worth** — one spec, one implement/verify loop, one reviewable diff. If a unit needs two specs, it's two units.
   - **Independently verifiable** — it has acceptance criteria that hold without any later unit existing. A unit whose only test is "unit 4 works" isn't a unit.
   - **Leaves the repo green and shippable** — `main` must be able to ship with units 1..k done and k+1..n absent. Dead-but-tested code behind a flag is fine; a half-applied migration or a contract with no implementation is not.
   - **Ordered by artifact dependency, not by convenience** — contracts and migrations first, consumers after. Set `Blocked by` only where a real artifact dependency exists; units with none are parallelizable, and say so (see `${CLAUDE_PLUGIN_ROOT}/skills/task-workflow/references/parallelization.md` for the worktree rule).

   **Ceiling: ~8 units.** Past that the scope is a roadmap, not an epic. Say so, then propose the first epic-sized slice of it and note what you've deferred — don't queue twenty rows nobody will reach.

3b. **Design doc — when the epic earns one.** The decomposition says *what* the units are; nothing else in this harness says *how* the initiative is built or what was rejected, and that reasoning otherwise survives only in merged PR descriptions. Draft `docs/design/{slug}.md` to the template in `references/design-doc.md`, which carries the bar for when one is warranted.

    Three of its rules matter enough to state here. **Skipping is normal** — an obvious shape, or every unit following a pattern the repo already has, means no doc — **but a silent skip is not**: say in one sentence that you skipped it and why, in the same message as the decomposition. **The Design section opens with a `mermaid` diagram**, because this is a document humans read and a system's shape lands in a picture faster than in three paragraphs. And it is **drafted, not written** — step 4's gate covers it, step 5 writes it.

4. **Approval gate.** Present the unit table — and the design doc, where step 3b drafted one — in chat and wait. This is the epic's one gate, and it now covers both artifacts. Write nothing to disk before approval — an unapproved queue file on disk is indistinguishable from an approved one on the next session's resume.

5. **Write the queue** to `.claude/memory/EPIC.md`. Format and worked example: `references/epic-queue.md`. When the decomposition came from a PRD, the queue gains a `PRD:` header line and a `Covers` column, both PRD-derived-only. If a file is already there with open rows, that's step 8, not this step. Where step 3b drafted a design doc, write it to `docs/design/{slug}.md` in the same step, same slug — the two are read together.

6. **Dispatch one unit.** Take the first row that is neither `Done` nor `Blocked` and whose every `Blocked by` row is `Done`. If no row qualifies, don't dispatch: when every row is `Done`, go to step 10; when rows remain but each is `Blocked` or waiting on an unfinished dependency, stop and say which rows are held and on what — that is a decomposition problem for step 9, not something to work around. State the unit number, its acceptance criteria, and any epic-level constraint it inherits — then run `task-workflow` on that unit as the task statement. `task-workflow` owns it completely from there: its own spec gate, its own `PLAN.md`, its own verifier rounds.

7. **Close the unit, then decide whether to continue.** Once `task-workflow` reaches cleanup and archives `PLAN.md` out of the repo root, flip the row to `Done` and put a one-line outcome in `Notes` — what shipped, and anything it changed for a later unit (a renamed field, a decision the next unit inherits).

   Then go straight to step 6 for the next eligible unit — or to step 10 if that was the last row — **unless one of these holds** — in which case stop, say which one, and tell the user to `/clear` and re-invoke:

   - **Context is actually tight.** Most of a unit's weight is already isolated: step 4 spawns the implementer and the verifier as subagents, so what lands in this session is the scope sentence, the spec, the plan, the verdicts and the review. That is small per unit and not zero — a unit whose review pulled a lot of code into the main thread, or a session already several units deep, has spent it.
   - **The unit changed something a later unit inherits.** A renamed field, a contract that landed differently, a `Blocked by` that turned out unnecessary. The user should see that in `Notes` before the next spec is drafted against it, and an amendment (step 9) may be the real next move rather than the next unit.
   - **The next unit's spec gate now needs a decision the last unit just changed.** Drafting a spec in the same breath as the outcome that invalidated its premise is how a plan gets approved against a stale assumption.

   **The stop is a condition, not a schedule.** Continuing is the common case, and `/clear` between every pair of units was the old default for a reason that step 4's subagents already handle. What has not changed: one unit at a time, each through its own spec gate, `task-workflow` owning it end to end. Step 8's resume path is unchanged, so a `/clear` at any point — asked for or not — costs nothing.

   **A genuinely independent tail can run in parallel worktrees instead.** When two or more remaining rows have no `Blocked by` between them and touch disjoint surfaces, they can run as one instance per worktree rather than in sequence here — the rules are in `${CLAUDE_PLUGIN_ROOT}/skills/task-workflow/references/parallelization.md`, and they are not optional: one worktree and one branch per instance, never two instances in one working tree. Say the row numbers and stop; this skill dispatches sequentially and does not orchestrate that fan-out. Two things make it the exception rather than the default — each unit still needs its own human spec gate, and `spec-gate-guard.mjs` reads `PLAN.md` at the repo root, so two units sharing a working tree would compete for one path.

8. **Resume.** On invocation, check `.claude/memory/EPIC.md` first. If it exists with rows not `Done`: report the queue state in one table, then go to step 6 for the next eligible unit (step 6 handles the case where none is eligible). Never re-decompose over an in-flight epic, and never overwrite the file without asking — if the user wants a different decomposition, that's step 9.

9. **Amend, when the epic itself moves.** A unit's work sometimes invalidates a later unit — a contract lands differently, a dependency turns out unnecessary. Amend rather than restart: add, remove, or reorder rows, log it in the file's `## Amendments` section, and re-approve **only the changed rows** (don't re-paste the whole table). If the epic's *goal* moved rather than its units, stop and re-decompose from step 2 — a queue patched past recognition is worse than an honest second epic. **Cap: 2 amendments.** A third means the original decomposition was wrong; say that and re-decompose.

10. **Epic cleanup.** Once every row is `Done`, archive `.claude/memory/EPIC.md`. It stops being a working file, but it doesn't stop being the only written record of *why* the initiative was cut into these units — so it moves rather than being deleted.

    Two things happen before the archive, both proposed rather than run silently:

    - **Distill, and expect to find something.** This is the layer where durable decisions actually live — a single `PLAN.md` usually establishes nothing worth keeping, but an epic that settled a contract, a boundary, or an invariant did. Propose the specific `knowledge/` edit (which concept file, what line), preferring an amendment to an existing concept over a new file; every new file needs a summary line in `knowledge/index.md`. Read the `## Amendments` log before proposing — a decomposition that had to change usually changed because of something worth writing down. Skip if the repo has no `knowledge/` bundle.
    - **The design doc's decisions become records.** Where step 3b wrote `docs/design/{slug}.md`, each decision it actually settled becomes one file under `knowledge/architecture/`, in the MADR shape in `references/design-doc.md`. The doc itself **stays where it is and is never archived** — it is the entry point for whoever touches this system next. Update its `Status:` line, and the sections reality diverged from, before proposing the records.

    - **Rebuild the graph** if `graphify-out/graph.json` exists: propose `graphify update .`.

    **Then archive it**, to exactly one of two destinations — never both:

    - **The repo has `knowledge/implementation/`** — write `knowledge/implementation/{YYYY-MM-DD}-{slug}.md` from the `Record` template in `${CLAUDE_PLUGIN_ROOT}/skills/bigin-harness-setup/references/knowledge-bundle.md`: `type: Record`, `source: epic`, `shipped:` the list of versions its units landed in, and a body that is the `EPIC.md` **verbatim** — goal, constraints, the unit table with its `Notes`, `## Not in scope`, and the `## Amendments` log if there is one. Append one line to `knowledge/implementation/index.md`, newest first. Then delete `.claude/memory/EPIC.md`.
    - **It doesn't** — no `knowledge/` bundle at all, or a bundle predating `implementation/` — write `.claude/memory/EPIC.archive.{ISO}-{slug}.md` with the same verbatim body, then delete `.claude/memory/EPIC.md`. Don't create `knowledge/implementation/` just to have somewhere to put it: one record in a folder with no bundle around it is harder to find than the memory file, and it half-scaffolds a bundle nobody asked for.

    Verbatim is the whole point, and more of it survives here than for a task: the `Notes` column is where each unit recorded what it changed for the units after it, and the `## Amendments` log is the only place the decomposition's own history exists. Slug from the epic's title; if that slug already exists for that date, suffix `-2`.

    **The record and the concept must not restate each other.** The distill bullet moves the *invariant* into a concept — "rate limits are per-key, not per-IP". The record keeps the *narrative* that produced it — the unit that got reordered, the amendment that nearly hit the cap, the decomposition that lost. A record that repeats its own concept, or a concept that recounts the epic, means one of the two was written in the wrong place.

## Interaction with session-handoff

`session-handoff` writes `.claude/memory/SESSION.md` alongside the queue. Keep them in their lanes: `EPIC.md` holds the unit queue and its amendment log, `SESSION.md` holds whatever is in flight *right now*. When saving a session mid-unit, name the epic and the unit number in `SESSION.md` rather than copying rows across — two records of the same queue drift within a day.
