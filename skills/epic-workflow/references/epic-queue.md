# The epic queue file

`.claude/memory/EPIC.md` — written by step 5 once the decomposition is approved, updated one row at a time, deleted at step 10.

Why there and not the repo root: units land on different branches, and a root-level file rides along on every one of them and conflicts on every merge. `.claude/memory/` is already the cross-session state directory (`session-handoff` writes `SESSION.md` there, `precompact-snapshot.mjs` writes into it before a compaction), it's committed like the rest of `.claude/`, and it survives `/clear`. It carries **no `Branch:` line** — unlike `PLAN.md`, an epic legitimately spans branches, and `spec-gate-guard.mjs` never reads this file.

## Format

```markdown
# Epic: {epic name}

Status: approved
Approved: {YYYY-MM-DD}

## Goal

{one paragraph — what this initiative delivers, and what "done" means for the whole epic}

## Constraints

{epic-level decisions every unit inherits: an authoritative surface, a compatibility promise,
a library or pattern already chosen. One line each. Omit the section if there are none —
don't pad it with things a unit's own spec gate will decide better.}

## Units

| # | Unit | Acceptance | Blocked by | Status | Notes |
|---|------|-----------|------------|--------|-------|
| 1 | {one plan's worth of work} | {what proves it works, without later units} | — | Not started | |

## Not in scope

{explicit exclusions, including anything trimmed by the ~8-unit ceiling}

## Amendments

{empty until step 9 writes here}
```

Valid row statuses: `Not started`, `In progress`, `Done`, `Blocked`. They mean the same things as `PLAN.md`'s task statuses — `In progress` means a `PLAN.md` for that unit exists right now.

`Status:` at the top is the epic's own state: `approved`, or `amending` while step 9 is mid-amendment. Unlike `PLAN.md`'s, no guard reads it; it's there so a resumed session can tell an approved queue from one caught mid-change.

## Worked example

```markdown
# Epic: Multi-tenant billing

Status: approved
Approved: 2026-08-19

## Goal

Every workspace gets its own subscription, seat count, and invoice history, billed through
Stripe. Done when a workspace owner can subscribe, add seats, and see invoices, and when a
workspace with no subscription is read-only rather than broken.

## Constraints

- The backend owns billing state. The BFF never writes to Stripe directly — it proxies.
- `workspace_id` is the tenancy key everywhere. No per-user subscriptions, ever.
- Existing single-tenant workspaces must keep working unsubscribed, indefinitely.

## Units

| # | Unit | Acceptance | Blocked by | Status | Notes |
|---|------|-----------|------------|--------|-------|
| 1 | `subscriptions` + `seats` tables and the tenancy-scoped queries | Migration applies and rolls back; queries reject a missing `workspace_id` | — | Done | Kept `plan_code` as text, not an enum — Stripe adds plans faster than we ship migrations |
| 2 | Stripe webhook ingest with the outbox/inbox pattern | A replayed webhook is idempotent; a malformed one is rejected and logged | 1 | Done | Inbox dedupes on Stripe's `event.id` |
| 3 | Subscription + seat endpoints on the API contract | Contract tests pass for subscribe, change seats, cancel | 1 | In progress | |
| 4 | BFF proxy routes and the typed client | Client is generated from the contract, not hand-written; 401/403 paths covered | 3 | Not started | |
| 5 | Billing settings UI — plan, seats, invoice list | Owner can subscribe and change seats; non-owner sees read-only | 4 | Not started | |
| 6 | Read-only degradation for unsubscribed workspaces | Writes return a typed error the UI renders as an upgrade prompt; reads unaffected | 3 | Not started | Parallel with 4 and 5 |

## Not in scope

Usage-based billing, tax handling, dunning emails, self-serve plan changes for enterprise
contracts. Proration is deferred to a second epic — it's Stripe-side and doesn't block any
unit here.

## Amendments

- **2026-08-21 — unit 6 unblocked early.** Turned out the degradation check reads only the
  contract, not the BFF client, so `Blocked by` dropped from 4 to 3. Rows 4–6 can now run in
  parallel worktrees.
```

## Dispatch and resume protocol

**Dispatching (step 6)** — hand `task-workflow` three things and nothing more: the unit's `Unit` cell as the task statement, its `Acceptance` cell, and the `## Constraints` block. Not the whole queue. `task-workflow` writes its own spec from that, and a unit whose spec can't be written from those three things is a unit that was under-specified at decomposition time — go back to step 3 rather than papering over it with the rest of the file.

**Resuming (step 8)** — read the file, print the units table as-is, and name the next eligible unit. Two cases worth handling explicitly:

- **A row says `In progress` but no `PLAN.md` exists.** The unit was abandoned mid-flight, or its plan was deleted by a cleanup that never flipped the row. Ask which: resume the unit from scratch, or mark it `Done` because it actually shipped. Never guess from the git log — a merged branch proves code landed, not that the acceptance criteria were met.
- **A row says `In progress` and a `PLAN.md` exists.** Hand off to `task-workflow`'s own resume path (its step 3 asks whether to resume, discard, or replace). Don't touch `PLAN.md` from here.

**Closing (step 7)** — the `Notes` cell is the only thing that survives the unit. Use it for what a *later* unit needs to know: a name that changed, a decision that constrains it, a deferral. Not a summary of the diff — git has that.
