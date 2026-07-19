# Agent invocation

## Spawn call shape

Use the Agent tool. `subagent_type` is the plugin-namespaced agent name — `bigin-skills:quick-executor`, `bigin-skills:standard-worker`, or `bigin-skills:deep-architect`, per the Step 3 tier decision.

The prompt is self-contained — the spawned agent has no memory of this conversation. Include:

- **Scope** — one sentence: what's changing and why.
- **Plan reference** — `PLAN.md` path, if one exists (the agent should read it, not have it pasted in full).
- **Touched files** — the `touchedFiles` list from `classify.mjs`, if any (empty for net-new work).
- **Routing rationale** — the tier and the deciding signal(s), e.g. "Routed to standard-worker: 3 files touched, follows existing CRUD pattern, no contract change." This lets the agent sanity-check the tier against its own read of the task and flag a mismatch early rather than silently over- or under-delivering.
- **Graph availability** (if `graphify-out/graph.json` exists in the repo) — say so, plus a pointer to `docs/graph-usage.md`, so the subagent queries the graph for structural navigation before falling back to grep. Omit this line entirely when no graph exists — don't tell the agent to check for one.
- **Objective** — one sentence: why this task exists, not just what it is. Distinct from Scope (the what); this is the reason, so the agent can judge trade-offs an under-specified scope doesn't cover.
- **Constraints** — what the result must respect (e.g. "no new dependencies," "must not change the public API," "keep it under 50 lines"). Omit if genuinely none — don't pad.
- **Definition of done** — what a sufficient return contains, as a short checklist. This is the exact contract Step 6 checks the return against, so make it concrete and checkable ("tests pass and are shown, not claimed"; "the new endpoint is wired into the router"), not vague ("code quality is good").

These three are a fixed template, not prose advice — write them the same way every time rather than improvising phrasing per task, so Step 6's evaluation has something stable to check against.

Example prompt body:

```
Scope: add a DELETE endpoint for /api/contacts/:id, following the existing
CRUD pattern in handlers/contacts.go.
Plan: PLAN.md (task #4)
Touched files (expected): handlers/contacts.go, handlers/contacts_test.go
Routing: standard-worker — 2 files, existing pattern, no contract file touched.
Graph: graphify-out/graph.json exists — see docs/graph-usage.md for query recipes.
Objective: contacts currently can't be removed via the API, which blocks the
GDPR-deletion flow this sprint depends on.
Constraints: no new dependencies; must not change existing endpoint signatures.
Definition of done:
- DELETE /api/contacts/:id returns 204 on success, 404 for an unknown id
- handlers/contacts_test.go covers both cases
- go test ./... output shown, not just claimed passing
```

## Return evaluation contract

The spawned agent's final reply should let the orchestrator check it against the payload's definition-of-done without re-deriving the work. State, per definition-of-done item: **met** (with the evidence — e.g. the test output, the file path), **partial** (what's missing), or **unmet**. An agent that just says "done" with no evidence per item should be treated as **unmet** for any item it didn't address — Step 6 does not infer completion from a confident tone.

## Handback contract

If a spawned agent determines mid-task that its tier is wrong — the task needs an architectural decision it wasn't scoped for, or turns out to be far simpler than routed — it replies with a line in this exact form instead of pushing through:

```
ROUTING_MISMATCH: <one-sentence reason>; suggested tier: <quick|standard|deep>
```

On receiving this, re-run Step 2/Step 3 of `SKILL.md` with the new information and respawn the suggested tier. Don't attempt to change the model or effort of the already-running subagent — those are fixed at spawn time via its frontmatter, not mutable in place.
