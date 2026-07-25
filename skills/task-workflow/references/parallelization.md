# Running task-workflow with more than one agent

Three different ways to have more than one agent working at once. They are not interchangeable, and the harness behaves differently under each — pick deliberately, and never mix models A and C in one tree.

| Model | Isolation | Coordination | Pick it when |
|---|---|---|---|
| **A. Worktree-per-instance** — separate `claude` processes you launch | Full: own worktree, own branch, own `PLAN.md`/`SESSION.md` | You, by hand | Genuinely independent tasks, or two repos (Nuxt + Go) |
| **B. Isolated subagents** — Agent tool with `isolation: "worktree"` | Full: temporary worktree under `.claude/worktrees/`, auto-cleaned if unchanged, enforced by the CLI | The spawning session | Parallel work inside one session where **isolation** is the point and results merge at the end |
| **C. Agent teams** — Agent tool with a `name` param | **None. All teammates share the lead's working tree** | Shared file-locked task list + `SendMessage` between members | The coordination surface *is* the point: a shared task DAG, reassignment, teammates challenging each other |

Choosing between B and C is the real decision: **isolation or coordination.** B has none of the shared-tree hazards below because each agent has its own tree; what you give up is the shared task list and inter-agent messaging, and what you take on is merge work. C gives you the coordination and hands you every hazard in this file. If you don't need teammates to talk to each other, B is the safer default. Full protocol for C: the `agent-teams` skill.

## Default stance: minimum viable parallelization

Add an agent only from true necessity — a second genuinely independent task is waiting, not "we have the tokens/capacity for it." Parallelization has real coordination cost (merge conflicts, duplicated context, a human tracking more than one thread). A single well-scoped instance beats three loosely-scoped ones. Never target a fixed count ("always run 3") — scale to how many independent, well-defined tasks actually exist right now. Teams additionally cost significantly more tokens, scaling with the number of live teammates.

## Model A: worktree-per-instance

Whenever ≥2 **instances** may touch overlapping code, give each its own `git worktree` and a named chat (`/rename`) so it's identifiable at a glance. Never point two instances at the same working tree — even read-only exploration in one can race against edits landing in another, and `spec-gate-guard.mjs`/`bugfix-test-guard.mjs` reason about the state of *a* working tree, not "whichever instance touched it last."

Two-repo layout (Nuxt frontend + Go backend), one instance per task:

```bash
# From the Nuxt repo root, spin up a worktree for a frontend task
git -C ~/projects/app-nuxt worktree add ../app-nuxt-feature-x -b feature/x

# From the Go repo root, spin up a worktree for a backend task
git -C ~/projects/app-go worktree add ../app-go-feature-y -b feature/y

# Launch Claude Code in each worktree separately, then /rename each chat
# so the human tracking multiple instances can tell them apart at a glance.
cd ../app-nuxt-feature-x && claude
cd ../app-go-feature-y && claude
```

Tear down once merged: `git worktree remove ../app-nuxt-feature-x` (from the main worktree, after the branch is merged/deleted).

## Role split default

- **Main instance** — the one doing code changes for the task at hand. Only one agent should ever be writing to a given file at a time. This is a rule about *files*, not about processes: under model C it's enforced by plan ownership (`Owns:` globs), not by having separate trees.
- **Forks** — codebase questions, external research, reading docs. A fork never writes; it answers a question and hands the answer back.
- Two agents writing the same file "in parallel" is not parallelization, it's a race with extra steps. If two tasks genuinely need the same file, they aren't independent — sequence them.

## Cascade pattern (3-4 concurrent tasks)

When juggling 3-4 genuinely independent tasks: open new tasks rightward (newest task, newest terminal/pane, rightmost), and sweep oldest-to-newest when checking in — don't let the newest, most-interesting task starve the oldest one that's actually closer to done. Hard cap at 3-4 concurrent instances; past that, a human can't meaningfully track state across all of them, which defeats the point of "task-workflow's discipline reduces the need to hold everything in your head." (For model C the practical ceiling is similar for a different reason — 3-5 teammates is where coordination overhead starts eating the parallelism.)

## Interaction with the harness

Per-worktree state (models A and B):

- Each worktree gets its **own** `.claude/memory/SESSION.md` — session state is per-worktree, not shared, since two instances resuming from the same SESSION.md would stomp each other's "Next Steps."
- **Spec-gate applies per worktree.** Each instance's non-trivial edits need their own approved `PLAN.md` in that worktree — an approval given to instance A's plan does not carry over to instance B's, even for a superficially similar task. This is the most common multi-instance confusion: "I already approved this" almost always means "I approved a *different* instance's plan." When in doubt, check which worktree/branch you're actually looking at.
- If a task's scope turns out to overlap another instance's in-flight work, stop and ask (same discipline as task-workflow's Scope Discipline) — don't let one instance start editing a file another instance already has open changes in.

Shared-tree state (model C) — the above does **not** hold, and assuming it does is the dangerous case:

- **One `PLAN.md` cannot gate several teammates.** A single global `Status: approved` authorizes every agent in the tree, so approval *leaks* rather than being scoped — the opposite of the model-A behavior above. Under teams, each concurrent task gets its own `.claude/task-plans/<slug>.md` with an `Owns:` glob list, and the spec gate resolves ownership by path.
- **One `SESSION.md`, several writers.** `SessionStart` fires per agent, so every teammate would otherwise prompt "resume or archive?" over the same file, and two agents compacting near-simultaneously lose one another's update.
- **One git index.** `git commit -a` / `git add -A` from any teammate sweeps up every sibling's in-flight work, which also lets a sibling's staged test satisfy the regression-test gate for an untested fix. Stage explicit paths; only one agent commits at a time.
- **Whole-tree commands lie.** `git status --porcelain`, `git diff`, and a full lint/typecheck/test run all report the union of everyone's work, so "nothing adjacent broke" isn't measurable from inside one teammate.

## See also

- `skills/agent-teams/SKILL.md` — the model-C protocol: fan-out decision, ownership, task-list bridging, the gates.
- `SKILL.md`'s Scope discipline — the same "stop and ask on scope creep" rule applies across agents, not just within one.
- `skills/session-handoff/SKILL.md` — the per-worktree SESSION.md format referenced above.
