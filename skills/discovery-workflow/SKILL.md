---
name: discovery-workflow
description: "Turns a vague product ask into an approved brief and PRD under docs/product/, records the architecture decisions in knowledge/, then hands the PRD to epic-workflow. Triggers: 'we want to build X', 'write a PRD', 'what should we even build', /discovery-workflow."
argument-hint: [product idea]
disallowed-tools: Edit Write NotebookEdit
effort: medium
---

# discovery-workflow

The layer above `epic-workflow`. `epic-workflow` decides what the tasks *are*; this decides what the **product** is, and it starts before anyone can name the thing being built. Everything downstream assumes that question is already answered: `epic-workflow` takes an initiative as given, `task-workflow` takes a task as given, and both are right to. This one produces what they assume.

It writes exactly three kinds of artifact, into two homes that never cross:

| Home | What lands there | Read by |
| --- | --- | --- |
| `docs/product/brief.md` | the problem, the users, the outcome, the constraints, the non-goals | humans, on the way to approving the PRD |
| `docs/product/prd.md` | numbered requirements with acceptance criteria — the contract | every task spec derived from it, and the readers named in step 5 |
| `knowledge/architecture/<topic>.md` | the decisions the product forced — invariants, boundaries, shapes | agents, on every non-trivial change afterwards |

**A PRD never lands in `knowledge/`, and a system invariant never lands in `docs/product/`.** The two homes have different readers, different lifetimes, and different budgets: product docs are durable prose a human approves once and revisits at the next planning round, while `knowledge/` concepts are always-reachable context an agent pays for on every task. Mixing them makes the PRD unreadable and the bundle unaffordable.

**The paths are fixed, not configurable.** Downstream skills read a path; they don't search for one. If the repo already keeps product documents somewhere else, link to them from these files rather than moving either the old docs or these paths.

**It stops twice, and adds no commit-time gate.** Both stops block: the brief and the PRD are each presented in chat and written only once you approve them (steps 4 and 5). What it adds no machinery for is enforcement — nothing at commit time reads a brief or a PRD, and nothing should: a PRD gate would fire in every repo that installs the harness, and most of them will never have a PRD. In a harnessed repo the existing gates already pass this work — `spec-gate-guard.mjs` treats every `.md` path as trivial, so a PRD written before any `PLAN.md` exists is not blocked, and a docs-only commit clears `bugfix-test-guard.mjs` on the same allowlist.

## When not to use

- **The product question is already answered.** See rung 2 of the ladder (`references/triage-ladder.md`) — that's `epic-workflow`, and manufacturing a brief for it wastes a session and dates the moment the epic starts.
- **A bug, a copy change, a config tweak.** Rung 1. `task-workflow`, or `debug-workflow` if it needs diagnosis first.
- **A library's API surface.** That's `knowledge-distill`, and it is not a product decision.
- **A retrospective.** `sprint-distill` looks backwards over merged PRs. This looks forwards over nothing.

## Steps

1. **Triage.** Run the ladder in `references/triage-ladder.md`. It is stated once and shared by all three entry points, so a request typed here lands on the same rung it would have reached through `epic-workflow` or `task-workflow`.

   **Only rung 3 continues to step 2.** Rung 1 exits to `task-workflow`, rung 2 to `epic-workflow`, each in one sentence and each writing nothing to disk — the ladder's own rules cover that, and it applies here exactly as written. Rung 3 is the only rung that produces artifacts at all: the brief, the PRD, and the architecture concepts in the table above.

   The rung-2/rung-3 boundary is the one this skill turns on, and the ladder's second discriminator is what decides it. Read that question there and answer it before continuing — it is not repeated here, because a second copy is a copy that can go stale.

2. **Read before asking.** If the repo has anything in it, the repo answers some of the questions, and asking them anyway is how a discovery session loses the user's trust in the first five minutes. Follow `references/established-repo.md`: what to read and in what order, the run-it-before-you-write-it-down rule for every command a claim rests on, and the provenance-not-value rule for anything that touches a secret. On a genuinely empty repo, say there is nothing to derive from and go to step 3.

3. **Elicit what the repo cannot answer** — and nothing else. `references/elicitation.md` carries the named techniques, the hard cap on how much you may ask, and what to do when the cap is reached instead of asking more. Read it before the first question; the bare "up to 3 clarifying questions" default is not enough structure for a product question and too much license for a small one.

4. **Brief, then the first gate.** Draft `docs/product/brief.md` to the template in `references/artifact-formats.md` — problem, users, outcome, constraints, non-goals — and **present it in chat. Write nothing until the user approves it.** An unapproved brief on disk is indistinguishable from an approved one on the next session's resume, and the brief is what the PRD is derived from, so an unnoticed wrong assumption here is repaid with interest in step 5.

   **Nothing mechanically prevents a premature write, which is exactly why the rule is stated this plainly.** The frontmatter's `disallowed-tools` withholds `Edit`, `Write` and `NotebookEdit` for the invoking turn, and that is a courtesy rather than a guarantee: a shell redirect writes a file just as well, and Bash has to stay available because step 2 runs commands. There is no guard either, deliberately — a commit-time check on a PRD would fire in every repo that installs the harness. So the discipline *is* the mechanism here. Present, wait, then write. And if you find yourself weighing whether this particular case really needs the approval, that is the case that needs it.

5. **PRD, then the second gate.** Derive `docs/product/prd.md` from the approved brief, again to the template, and again present it and wait.

   This file is the **contract**, and it is the reason the format is not negotiable. Three readers address requirements by `FR-n`, and all three read this file: a task's `PLAN.md` cites requirement IDs in its `Covers` column at full-spec tier, `epic-workflow` reads an approved PRD directly at its own step 2, decomposing from the requirement index and `Depends on:` lines with zero clarifying questions, and `write-tests` resolves an `FR-3/AC-2` citation here on its acceptance-criterion → E2E path, quoting the criterion verbatim into the spec. Either way the citation is by ID, so an ID that silently moves invalidates every citation pointing at it. **IDs are assigned once, never renumbered, never reused** — a withdrawn requirement keeps its number and says it was withdrawn. `references/artifact-formats.md` has the full shape.

   The gate is also the privacy checkpoint. Elicitation captures whatever the user says about their product, and this file is about to be committed: **the PRD names roles, never people**, and this is the read where a customer name, an email address, or a real account that slipped in during step 3 gets caught and replaced with the role.

6. **Record the architecture decisions the product forced.** A PRD that says "any teammate can be invited to a workspace" has already decided something about tenancy and authorization that no requirement states and every future task must respect. Those decisions go to `knowledge/architecture/` as OKF v0.2 concepts, one per invariant, per `references/architecture-concepts.md` — which also carries the `type:` selection rule, the required `knowledge/index.md` line, and how to check the frontmatter against whatever spec the bundle itself declares.

   **If the repo has no `knowledge/` bundle, skip this step and say so** — name the decisions you would have written and where they would have gone, and don't create a bundle as a side effect of discovery. Half a bundle is worse than none: unvalidated, ungated, and unreachable from any index.

7. **Hand off.** Discovery ends at the PRD; it does not decompose and it does not implement. Close by stating, explicitly:

   - the PRD path — `docs/product/prd.md`;
   - that the next step is `epic-workflow`, with that path as the initiative statement. `epic-workflow` now reads an approved PRD itself at its own step 2 — the requirement index for the unit candidates, `Depends on:` for ordering by artifact dependency, `Surface:` for which units touch two-plus surfaces, `Priority:` for what the first epic-sized slice contains, and each requirement's acceptance criteria as its unit's acceptance criteria, quoted rather than paraphrased — so naming the path is the handoff now, not a substitute for it;
   - anything the brief left as an open question, because an unresolved product question becomes an unaskable decomposition question one layer down.

   Then **stop**. Do not start the decomposition in the same session — the brief, the PRD, and everything read to produce them are context the decomposition doesn't need, and the PRD on disk is the complete handoff package.

8. **Resume, on every invocation.** Before triage, check both paths. Report what you find and continue from there rather than re-deriving:

   | On disk | What to do |
   | --- | --- |
   | Neither file | step 1 |
   | `brief.md` approved, no PRD | report it, then step 5 |
   | `brief.md` a draft | report it, offer to continue from it or to re-elicit; either way the draft may be overwritten |
   | `prd.md` approved | **report state and go to step 7.** Never rewrite it — see below |
   | `prd.md` a draft | report it, continue at step 5 from what's there |
   | A file with no `Status:` line | treat it as approved. It was almost certainly hand-written, and the safe direction is to never overwrite what you can't prove is a draft |

   `Status: approved` is write protection and `Status: draft` is not — that is the whole purpose of the line, and no guard reads it.

## Amending an approved artifact

An approved brief or PRD is never overwritten, whatever the request. When the product moves, amend in place:

- **Additive** — append the new requirement with the **next unused number**. Never fill a gap left by a withdrawal, and never renumber to keep the list tidy; every citation downstream is by ID.
- **Withdrawn** — the requirement's block stays, `Status: withdrawn` with a one-line reason. Anything already built against it is now a separate decision, not a silent one.
- **Changed** — edit the requirement's own block and its acceptance criteria in place, and say which criteria changed. Any `PLAN.md` citing it is now audited against something new, so name it in the handoff.
- **The premise moved** — the problem itself was wrong, not the requirements under it. Don't patch: start a new brief at step 4 and say plainly that the old PRD is superseded. A PRD patched past recognition reads as approved while describing something nobody agreed to.

Every amendment goes through step 5's gate again, presented as a diff — the changed blocks, not the whole PRD re-pasted.

## Interaction with the skills downstream

`task-workflow` is unchanged by this skill and doesn't require it. `epic-workflow` reads an approved PRD at its own step 2 when handed one — zero clarifying questions in that case, its own decomposition rules and ceiling still apply — and is otherwise unchanged: a repo with no PRD, or one it doesn't reach, keeps working exactly as before. The three states worth keeping straight:

| File | Owner | Lifetime |
| --- | --- | --- |
| `docs/product/prd.md` | this skill | durable — outlives every epic derived from it |
| `.claude/memory/EPIC.md` | `epic-workflow` | one epic, archived out of `.claude/memory/` at epic cleanup |
| `PLAN.md` | `task-workflow` | one task, archived out of the repo root at task cleanup |

Only the first stays a live document; the other two survive as implementation records, read when someone needs to know why a past change took its shape. That is why the PRD is the only one of the three whose format is worth getting exactly right.
