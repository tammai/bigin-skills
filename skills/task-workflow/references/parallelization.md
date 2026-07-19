# Running task-workflow across multiple instances

Guidance for teams running more than one Claude Code instance at once. Applies whenever ≥2 instances might touch overlapping code — not a fixed team size, and not a recommendation to run more instances by default.

## Default stance: minimum viable parallelization

Add an instance only from true necessity — a second genuinely independent task is waiting, not "we have the tokens/capacity for it." Parallelization has real coordination cost (merge conflicts, duplicated context, a human tracking more than one thread at once). A single well-scoped instance beats three loosely-scoped ones. Never target a fixed instance count ("always run 3") — scale to how many independent, well-defined tasks actually exist right now.

## Worktree-per-instance rule

Whenever ≥2 instances may touch overlapping code, give each its own `git worktree` and a named chat (`/rename`) so it's identifiable at a glance. Never point two instances at the same working tree — even read-only exploration in one can race against edits landing in another, and `spec-gate-guard.mjs`/`bugfix-test-guard.mjs` reason about the state of *a* working tree, not "whichever instance touched it last."

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

- **Main instance** — the one doing code changes for the task at hand. Only one instance should ever be writing to a given file at a time.
- **Forks** — codebase questions, external research, reading docs. A fork never writes; it answers a question and hands the answer back.
- Never run two instances writing to the same files "in parallel" — that's not parallelization, that's a race condition with extra steps. If two tasks genuinely need to touch the same file, they're not independent tasks; sequence them instead.

## Cascade pattern (3-4 concurrent tasks)

When juggling 3-4 genuinely independent tasks: open new tasks rightward (newest task, newest terminal/pane, rightmost), and sweep oldest-to-newest when checking in — don't let the newest, most-interesting task starve the oldest one that's actually closer to done. Hard cap at 3-4 concurrent instances; past that, a human can't meaningfully track state across all of them, which defeats the point of "task-workflow's discipline reduces the need to hold everything in your head."

## Interaction with the harness

- Each worktree gets its **own** `.claude/memory/SESSION.md` — session state is per-worktree, not shared, since two instances resuming from the same SESSION.md would stomp each other's "Next Steps."
- **Spec-gate applies per worktree.** Each instance's non-trivial edits need their own approved `PLAN.md` in that worktree — an approval given to instance A's plan does not carry over to instance B's, even for a superficially similar task. This is the single most common multi-instance confusion: "I already approved this" almost always means "I approved a *different* instance's plan." When in doubt, check which worktree/branch you're actually looking at before assuming a plan is pre-approved.
- If a task's scope turns out to overlap another instance's in-flight work, stop and ask (same "stop and ask" discipline as task-workflow's own Scope Discipline) — don't let one instance start editing a file another instance already has open changes in.

## See also

- `SKILL.md`'s Scope discipline — the same "stop and ask on scope creep" rule applies across instances, not just within one.
- `skills/session-handoff/SKILL.md` — the per-worktree SESSION.md format referenced above.
