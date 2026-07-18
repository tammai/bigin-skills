# Agent invocation

## Spawn call shape

Use the Agent tool. `subagent_type` is the plugin-namespaced agent name — `bigin-skills:quick-executor`, `bigin-skills:standard-worker`, or `bigin-skills:deep-architect`, per the Step 3 tier decision.

The prompt is self-contained — the spawned agent has no memory of this conversation. Include:

- **Scope** — one sentence: what's changing and why.
- **Plan reference** — `PLAN.md` path, if one exists (the agent should read it, not have it pasted in full).
- **Touched files** — the `touchedFiles` list from `classify.mjs`, if any (empty for net-new work).
- **Routing rationale** — the tier and the deciding signal(s), e.g. "Routed to standard-worker: 3 files touched, follows existing CRUD pattern, no contract change." This lets the agent sanity-check the tier against its own read of the task and flag a mismatch early rather than silently over- or under-delivering.
- **Graph availability** (if `graphify-out/graph.json` exists in the repo) — say so, plus a pointer to `docs/graph-usage.md`, so the subagent queries the graph for structural navigation before falling back to grep. Omit this line entirely when no graph exists — don't tell the agent to check for one.

Example prompt body:

```
Scope: add a DELETE endpoint for /api/contacts/:id, following the existing
CRUD pattern in handlers/contacts.go.
Plan: PLAN.md (task #4)
Touched files (expected): handlers/contacts.go, handlers/contacts_test.go
Routing: standard-worker — 2 files, existing pattern, no contract file touched.
Graph: graphify-out/graph.json exists — see docs/graph-usage.md for query recipes.
```

## Handback contract

If a spawned agent determines mid-task that its tier is wrong — the task needs an architectural decision it wasn't scoped for, or turns out to be far simpler than routed — it replies with a line in this exact form instead of pushing through:

```
ROUTING_MISMATCH: <one-sentence reason>; suggested tier: <quick|standard|deep>
```

On receiving this, re-run Step 2/Step 3 of `SKILL.md` with the new information and respawn the suggested tier. Don't attempt to change the model or effort of the already-running subagent — those are fixed at spawn time via its frontmatter, not mutable in place.
