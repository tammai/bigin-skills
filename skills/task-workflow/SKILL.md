---
name: task-workflow
description: "AI task workflow — scope → spec → approved PLAN.md → implement/verify loop (capped, independent verifier) → review → cleanup. Triggers: 'implement X', 'add a feature', 'fix bug in Z', /task-workflow, or any non-trivial feature/bug-fix work."
effort: low
---

# task-workflow

Follow this workflow for every non-trivial task.

## Steps

1. **Scope** — state what you're changing and why in one sentence before touching any code.

2. **Spec gate** (non-trivial features only) — write and get approval for a spec before implementing.
   Skip for: bug fixes, copy changes, config tweaks, changes ≤20 lines of logic.
   If the request doesn't contain enough information to fill the spec's required sections (What / Inputs-outputs / Edge cases / Security considerations / Testing strategy) with confidence, ask up to 3 targeted clarifying questions before drafting the spec — never fill the gaps with silent assumptions and present an approved-looking spec built on them.
   Use the default format below unless the user explicitly asks for a "full spec" / "AI-friendly spec" / "spec-driven" spec — then use the full spec format instead. There is exactly one other way the full format gets used: run `model-router`'s capability scoring (its Steps 1–2 only) against the *described* scope before drafting — the files the request implies, passed via `--paths`, since no `PLAN.md` exists yet — and if it scores the `deep` tier, offer the full format once with the rubric's rationale and use whichever the user picks. A `standard` or `quick` score is not a reason to raise formats at all. That score is the rubric's judgment, not yours: never upgrade the format because a task *feels* big. Step 4 reuses this score rather than re-running it, unless the approved spec changed the scope you fed it.
   If the feature touches auth, sessions, secrets, PII, or untrusted input (user-controlled data, URLs, redirects, file paths), the spec's Security considerations must name the concrete risks — see `.claude/rules/security.md`. Don't defer security to the post-implementation review; a threat found at spec time is a sentence, the same one found after code review is a rewrite.

3. **Plan file** — once the spec/plan is approved, write it to `PLAN.md`: the approved spec followed by a tasks tracking table (see format below).
   If `PLAN.md` already exists with tasks not marked `Done`, stop and ask the user how to proceed (resume, discard, or replace) before writing — never overwrite silently. If it doesn't exist, or every task in it is `Done`, write the new plan over it.

   **Coverage check** — before step 4, read the finished `PLAN.md` back once and confirm three things hold:
   - every requirement in the spec maps to at least one task
   - every task maps to a requirement, or says in `Notes` that it's setup/scaffolding
   - every edge case the spec names is covered by a task or by the Testing strategy

   Fix any gap in `PLAN.md` now. This is the same economics as the security rule in step 2: a missing task costs one line here and a whole verify round once code exists. At full-spec tier it's mechanical — check the `Covers` column against the FR list. Don't spawn a subagent for this; it's a read of a file you just wrote.

   **Mirror the tasks for live tracking** — once the coverage check passes, create one Claude Code task per `## Tasks` row (`TaskCreate`), then keep them current as you work: `in_progress` when you start a row, `completed` when you flip it to `Done`. Skip the mirror for plans with fewer than 3 rows; the overhead outweighs the visibility.

   The mirror is **one-way and disposable**. `PLAN.md` is the source of truth: never edit the table from the task list, never let a task carry state the table doesn't, and never treat a completed task as evidence a row is done — step 4.5's rule stands, it's the command output that counts. Everything that must survive compaction, `/clear`, a handoff, or a fresh subagent lives in the file, which is why the table is *inside* `PLAN.md` and not a separate progress doc. The verifier and `spec-gate-guard.mjs` read `PLAN.md` off disk and cannot see session task state at all — that asymmetry is the point, so don't "fix" it by moving anything out of the file.

4. **Implement/verify loop** — an independent verifier subagent, not just tests, checks every diff against `PLAN.md` before it reaches review. Skip the whole loop (implement inline, then just run lint+typecheck+tests yourself) only when the spec gate itself was skipped **and** `model-router`'s verification bar came back "normal gates" — a trivial-looking change that touches a contract, migration, or CI path still goes through the loop. The loop guards against spec drift on non-trivial work; it isn't there to gate copy fixes.

   1. **Implement.** Run `model-router`'s scoring and resolution only (its Steps 1 through 4: gather signals with the *planned* file list via `--paths`, score capability, set the verification bar, resolve the tier's model **and agent**, state all of it) — skip straight to spawning if the tier is obvious or the user already named a model/tier. If step 2 already scored capability, reuse that result and run only the verification bar and resolution here; re-score just the capability axis when the approved spec moved the scope out from under it. Don't let `model-router` auto-spawn (its own Step 5); which tier actually implements is the user's call, not a silent one:
      - **Scored tier is `deep`** — state the rationale and ask the user to confirm before spawning it. It's the most expensive tier (opus/high under the default ladder, fable/high under `frontier`) and the biggest behavior swing, so it's the one case worth a pause. If the user declines, ask which tier/model they want instead and spawn that.
      - **Scored tier is `standard`** — spawn it directly, no confirmation needed.
      - **Scored tier is `quick`** — spawn it directly *if* the verification bar is "normal gates". If any bar trigger fired (high-risk path, coverage under 0.3, a planned new file, 5+ files, flaky symptom), spawn the `standard` tier instead: the capability score can be genuinely low while the change still needs more checking than the quick tier's `low` effort gives it. The new-file trigger is why the quick tier rarely takes work that adds a module — writing a fresh test suite is the part that doesn't belong at `low` effort, and `quick-executor`'s own brief already scopes it to changes with coverage in place.
      - **User already named a tier or model explicitly** — use exactly that; skip both scoring and the confirmation step.

      **Spawn what `routing.agents[tier]` names, not the tier's usual agent.** A profile that pins a tier at a non-default effort routes to a variant — the `standard` tier is `standard-worker-high` under `frontier` and `lean`, `standard-worker` only under `opus-centric`. Hardcoding the base name silently runs the task at the wrong effort. The spawned agent is the implementer for this task. Pass `model-router`'s verification bar through in the payload. Wait for it to finish; capture the returned agent ID and the diff it reports.
   2. **Dispatch a fresh verifier.** Call the Agent tool with `subagent_type: "bigin-skills:" + routing.agents.verifier` and `model:` set to `routing.models.verifier`, both from `model-router`'s signals (or `bigin-skills:verifier` on its own default if scoring was skipped) — the verifier tier has a variant too, `verifier-medium` under `lean`, so read the agent off `routing` rather than assuming. Pass `PLAN.md`'s path and **the diff itself** — never the implementer's own summary of what it did, that's exactly what independence is for. Parse the response against `references/verify-contract.md`'s schema.
   3. **On `FAIL`** — resume the *same* spawned implementer agent with `SendMessage` (`to:` its agent ID) relaying the issues list verbatim, so it fixes only what was flagged instead of re-deriving the task. Then dispatch a **new** verifier (fresh Agent call, new agent ID, no memory of this round) against the new diff. Note the round in `PLAN.md`'s task-row `Notes` (e.g. "Fix-loop round 2/3"). Cap at 3 rounds. Don't re-run model-router's scoring on a resume — the task's underlying complexity doesn't change round to round, only the issue list does; if the implementer itself decides the tier was wrong, it uses the normal `ROUTING_MISMATCH:` handback instead.
   4. **Round cap hit** — stop looping. Show the user the latest issues list and ask whether to adjust `PLAN.md`, raise the cap, or take over manually. Do not proceed to Review.
   5. **On `PASS`** — continue to Review below. The implementer is responsible for lint + typecheck + tests passing before it ever reports a diff as ready — the verifier's job is auditing against `PLAN.md`, not re-running the test suite. Show the actual command output in your response before flipping any `PLAN.md` task row to `Done` — a claim that tests pass without the output showing it doesn't count.

   For any new test files, follow the `write-tests` skill's discipline (style-matching, no unnecessary mocking, TDD ordering for business logic). For bug fixes specifically, use the `debug-workflow` skill's triage + guardrails (fast path for obvious bugs, full workflow for flaky/env/repeat failures) instead of ad-hoc trial and error.

5. **Review** — ask whether to run `/code-review` (and `/security-review` too, if the change touches auth, sessions, secrets, PII, or untrusted input) on the diff — don't run either automatically. If the user says yes, check `AI_REVIEW_CHECKLIST.md` and don't mark this step done until it's clean. If they decline or want to defer, note that in `PLAN.md` and move on.

6. **Cleanup** — once every task in `PLAN.md` is `Done` and review is resolved (clean, or explicitly declined by the user), delete `PLAN.md`. It's a working file for the task, not project documentation — nothing to preserve once the task ships. Close out any mirrored tasks in the same pass, so a finished task doesn't leave a stale list behind.

   Two things happen before the delete, both proposed rather than run silently:

   - **Distill, if there's anything durable.** `PLAN.md` is the only written record of *why* this task took the shape it did, and deleting it is the last chance to keep any of that. If the task established or changed a decision, invariant, contract, or constraint — not merely "added a feature" — say so and propose the specific `knowledge/` edit (which concept file, what line). Concepts are per-invariant, not per-task: prefer amending an existing file to adding one, and every new file needs a summary line in `knowledge/index.md` or the validator flags it unreachable. Nothing durable is the common case for routine work — say that and move on rather than inventing a concept to justify the step. Skip entirely if the repo has no `knowledge/` bundle.
   - **Rebuild the graph, if the task changed code** and `graphify-out/graph.json` exists: propose `graphify update .` (AST-only, zero API cost).

## Spec format (when required)

Paste this in the chat and wait for approval before writing any code:

```
## Spec: {feature name}
What: {one paragraph — what changes and why}
Inputs/outputs: {what data flows in and out}
Edge cases: {anything that could go wrong}
Security considerations: {who/what is trusted, what input is attacker-controlled, what could go wrong if it's abused — or "N/A, no auth/secrets/PII/untrusted-input surface" if genuinely none}
Testing strategy: {what will be tested and how — unit/integration/manual, which edge cases get coverage}
Not in scope: {explicit exclusions}
```

### Full spec (opt-in)

Only when the user explicitly asks for a "full spec" / "AI-friendly spec" / "spec-driven" spec. Omit any section below that doesn't apply — don't pad. Typical omissions: no Component Tree for a backend-only change, no API Contract for a UI-only change, no Data Model if nothing new is persisted.

```
## Spec: {feature name} [full-spec]
User Stories & Scenarios: {Given/When/Then per story, only if there's more than one flow}
Requirements: {Functional (FR-1, FR-2, ...) as plain bullets — skip the table unless there are 5+; Non-Functional only if there's a real perf/scale/availability constraint}
API Contract: {typed request/response — only if this introduces or changes an API}
Data Model: {interfaces/types — only if this introduces or changes persisted/shared data}
Component Tree (frontend projects only): {file paths + nesting — only for multi-component frontend work}
Security considerations: {same as default format — always required}
Verification Checklist: {Automated: tests/lint/typecheck. Manual: happy path, error path, edge cases}
Not in scope: {explicit exclusions}
```

See `references/full-spec-example.md` for a filled-in example.

## PLAN.md format

Single file — the approved spec followed by a tracking table, kept in one place and updated in place (no separate progress file):

```
# Plan: {feature name}

Status: approved
Branch: {git branch --show-current}

## Spec

{approved spec, as written for the spec gate}

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | {task} | Not started | |
```

Valid statuses: `Not started`, `In progress`, `Done`, `Blocked`.

`Branch:` records the branch the plan was written on, so a plan left behind by an earlier task can't silently govern a later one — `spec-gate-guard.mjs` blocks non-trivial edits when it disagrees with `HEAD`. Omit the line when there's no branch to name (detached HEAD, or not a git repo); the guard skips the check rather than blocking on what it can't verify. On a deliberate rename or rebase onto a new branch, update the line rather than deleting it.

**Full-spec tier only:** add a `Covers` column (e.g. `FR-3`) linking each task to the requirement it implements, and add one tracked row per Verification Checklist manual item (e.g. `Verify: error path for FR-2`, status `Not started`). Cleanup (step 6) can't happen while any of those rows is still open. Don't add the `Covers` column or verification rows for default-tier specs — there are no FR-IDs to reference.

## Scope discipline

If implementation reveals the task requires changes outside the stated scope: **stop and ask**. Never expand scope silently. A second task is better than a sprawling first one.

## Running multiple instances

Running more than one Claude Code instance at once (e.g. a separate frontend + backend task) — see `references/parallelization.md` for the worktree-per-instance rule and per-worktree spec-gate/SESSION.md interaction.
