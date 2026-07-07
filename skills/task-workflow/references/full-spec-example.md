# Full spec example (opt-in tier)

A filled-in example of the full-spec format from `SKILL.md`, for a backend-only feature — no Component Tree, since nothing here touches a frontend. Sections that don't apply to a given feature should be omitted entirely, not left in empty.

## The spec

```
## Spec: Paginate the /api/tasks list endpoint [full-spec]

User Stories & Scenarios:
- US-1 (P1): Given a workspace with 500+ tasks, when a client calls GET /api/tasks,
  then it returns a bounded page instead of the full set, with a cursor for the next page.
- US-2 (P2): Given a client on the last page, when it requests the next cursor,
  then the response indicates there is no further page.

Requirements:
- FR-1: GET /api/tasks accepts `limit` (default 50, max 200) and `cursor` (opaque, optional).
- FR-2: Response includes `nextCursor: string | null`.
- FR-3: Invalid `limit` (non-numeric, <1, >200) returns 400 with a field-specific error.
- NFR-1: p95 latency for a paginated request must not regress past the current unpaginated p95.

API Contract:
  GET /api/tasks?limit=50&cursor=<opaque>
  200 OK
  {
    "tasks": [{ "id": "string", "title": "string", "status": "string" }],
    "nextCursor": "string | null"
  }
  400 Bad Request
  { "error": "invalid_limit", "message": "limit must be between 1 and 200" }

Data Model:
  interface TaskPage {
    tasks: Task[]
    nextCursor: string | null
  }

Security considerations: `cursor` is opaque and server-signed — reject any cursor that fails
signature verification with 400 rather than attempting to parse it, to avoid exposing internal
row-offset logic to the client.

Verification Checklist:
- Automated: unit test for cursor encode/decode round-trip; integration test for a 3-page walk
  over 120 seeded tasks; lint; typecheck.
- Manual: happy path (first page, middle page, last page returns nextCursor: null); error path
  (limit=0, limit=201, malformed cursor all return 400); edge case (workspace with 0 tasks
  returns an empty page, not an error).

Not in scope: sorting/filtering params, cursor-based pagination for other list endpoints.
```

## The resulting PLAN.md excerpt

Because this is the full-spec tier, the Tasks table gets a `Covers` column and one tracked row per manual verification item:

```
## Tasks

| # | Task                                          | Status      | Covers | Notes |
|---|------------------------------------------------|-------------|--------|-------|
| 1 | Add limit/cursor params + validation            | Not started | FR-1, FR-3 | |
| 2 | Add nextCursor to response                      | Not started | FR-2 | |
| 3 | Verify: happy path (first/middle/last page)      | Not started | US-1 | |
| 4 | Verify: error path (limit=0, limit=201, bad cursor) | Not started | FR-3 | |
| 5 | Verify: edge case (0-task workspace)             | Not started | US-1 | |
```

Cleanup (step 7) waits until every row — including the three `Verify:` rows — is `Done`.

A default-tier spec (the common case) has no `Covers` column and no `Verify:` rows — just the plain `# | Task | Status | Notes` table from `SKILL.md`.
