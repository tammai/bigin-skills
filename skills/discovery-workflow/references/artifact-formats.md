# Artifact formats: brief and PRD

The two files this skill writes under `docs/product/`. Both are presented in chat and written
only after the user approves them (`SKILL.md` steps 4 and 5).

Both open with a `Status:` line — `draft` or `approved`. **No guard reads it.** It exists for
one purpose: resume. `approved` means never overwrite, `draft` means the next invocation may
continue over it. A file with no `Status:` line was hand-written by a human and counts as
approved.

---

## docs/product/brief.md

```markdown
# Product Brief: {product or initiative}

Status: approved
Date: {YYYY-MM-DD}

## Problem

{Two or three sentences. What is true today that shouldn't be, and for whom. Written so that
someone who disagrees can say so — "onboarding is slow" is unfalsifiable, "a new client takes
three weeks to reach first invoice, and two of those weeks are manual data entry" is not.}

## Users

| Role | What they are trying to do | What they must not be able to do |
| --- | --- | --- |
| {role, never a person} | {the job, in their words} | {the boundary — this column is where the authorization model comes from} |

## Outcome

{What is different when this works, stated so it can be checked. One or two lines. If no line
here can be checked, the discovery isn't finished — go back to elicitation.}

## Constraints

{Fixed inputs, not preferences: an existing contract that can't change, a stack that's already
chosen, a compliance rule, a deadline, a team size. Each with where it comes from.}

## Non-goals

{What this deliberately does not do, and — where it's a live temptation — one clause on why.
The cheapest section to write and the most expensive one to omit.}

## Open questions

| # | Question | Deciding role | Working assumption |
| --- | --- | --- | --- |
| 1 | {what's still unresolved} | {the role who decides, never a person} | {what the PRD assumes meanwhile} |

## Derived from

{Established-repo mode only. One line per claim above that came from the repo rather than the
user: what was read or run, and what it established. Commands recorded here were actually run
in the session that wrote this file — see `established-repo.md`.}
```

### Rules

- **Roles, never people.** Both here and in the PRD. A brief is committed and outlives the
  people in it; a named customer, a real email address, or a live account number in a
  git-tracked file is a privacy problem with no upside, and the approval gate is where it gets
  caught.
- **No solution in the brief.** No screens, no endpoints, no schema. If a constraint is
  genuinely technical ("must keep the existing OpenAPI contract"), it belongs under
  Constraints as a constraint, with its source.
- **Open questions are recorded, not resolved by invention.** A question with a stated
  deciding role and a working assumption lets the PRD proceed honestly. A question quietly
  answered by the agent produces a PRD everyone approves and nobody agreed to.

---

## docs/product/prd.md

This is the **contract**. It is the one artifact here that other skills parse, so its shape is
fixed rather than stylistic.

```markdown
# PRD: {product or initiative}

Status: approved
Date: {YYYY-MM-DD}
Brief: docs/product/brief.md

## Requirement index

| ID | Requirement | Priority | Surface | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| FR-1 | {one-line title} | must | api | — | active |
| FR-2 | {one-line title} | should | web, api | FR-1 | active |

## Requirements

### FR-1 — {title}

Requirement: {one sentence, testable, in the user's terms}
Priority: must
Surface: api
Depends on: —
Status: active
Acceptance criteria:
1. Given {state}, when {action}, then {observable result}.
2. Given {state}, when {action}, then {observable result}.

### FR-2 — {title}

Requirement: {…}
Priority: should
Surface: web, api
Depends on: FR-1
Status: active
Acceptance criteria:
1. Given {…}, when {…}, then {…}.

## Non-functional requirements

### NFR-1 — {title}

Requirement: {the constraint, with a number in it}
Priority: must
Surface: api
Depends on: —
Status: active
Acceptance criteria:
1. Given {load or condition}, when {measured how}, then {the threshold}.
```

### The contract, stated

Three readers address requirements by ID. **Two of them do not read this file yet** — the format
is fixed ahead of that wiring, deliberately, and this table says which is which so nobody
mistakes the intent for the current behaviour:

| Reader | What it needs from this file | Reads it today? |
| --- | --- | --- |
| `epic-workflow` | the index for the unit candidates, `Depends on:` for ordering by artifact dependency, `Surface:` for its two-plus-surfaces triage bar, `Priority:` for which slice ships first | **No** — its `SKILL.md` mentions no PRD. It is handed the path as the initiative statement, and the relevant lines are pointed out to it (`SKILL.md` step 7) |
| `write-tests` | one acceptance criterion at a time, addressed as `FR-3/AC-2`, as the source for a test | **No** — a criterion is quoted to it by hand as the test's target |
| `task-workflow` | the ID in a `PLAN.md` `Covers` cell, and the acceptance criteria as the verifier's target | **Yes**, at full-spec tier — that column already takes requirement IDs |

Fixing the format before the other two read it is the point rather than an accident: a contract
that changes shape after something starts parsing it breaks every citation already written
against it. Getting it right once, early, is cheaper than migrating it later.

Which is why:

1. **IDs are assigned once, never renumbered, never reused.** New requirements take the next
   unused number even if that leaves a gap. Every citation downstream is by ID, and a
   renumbering silently re-points all of them at requirements nobody wrote. This is the single
   rule most worth being pedantic about.
2. **The `### FR-n — {title}` blocks are authoritative; the index is navigation.** The index
   must list every requirement exactly once, and when the two disagree, the block wins. Keep it
   in sync by hand at every amendment — a stale index is a reading error, not a contract break.
3. **The field lines are fixed, one per line, in the order above.** `Requirement:`,
   `Priority:`, `Surface:`, `Depends on:`, `Status:`, `Acceptance criteria:`. A field with
   nothing in it is written `—`, never omitted, so a reader never has to guess whether an
   absent line means empty or forgotten.
4. **Every requirement has at least one acceptance criterion**, each a numbered
   Given/When/Then line, each independently checkable, and each **observable from outside the
   system**. "The repository returns a row" is not an acceptance criterion; "the invoice appears
   on the client's list within one refresh" is. A criterion that can only be checked by reading
   the implementation cannot become a test that survives a refactor.
5. **No solution design.** No table names, no endpoint paths, no component names, no library
   choices. Those are either architecture decisions (`architecture-concepts.md`) or the task's
   own spec. The PRD outlives both.

### Field values

| Field | Values | Notes |
| --- | --- | --- |
| `Priority:` | `must`, `should`, `could` | There is no `won't` — that's a brief non-goal, not a requirement |
| `Surface:` | comma-separated surface names (`web`, `api`, `mobile`, `db`, `ci`, …) | Use the names the repo already uses. This is the field that shows a requirement crosses surfaces, which is `epic-workflow`'s triage bar once it is pointed at it |
| `Depends on:` | requirement IDs, or `—` | IDs only, never prose. A dependency on something outside the PRD is a brief constraint |
| `Status:` | `active`, `withdrawn` | A withdrawn requirement keeps its ID and its block, with the reason on the `Status:` line |

### Worked example

```markdown
### FR-4 — Invite a teammate to a workspace

Requirement: A workspace owner can invite someone by email address, and the invitee joins that
workspace with the role the owner picked.
Priority: must
Surface: web, api
Depends on: FR-1
Status: active
Acceptance criteria:
1. Given a workspace owner on the members page, when they invite an address that has no
   account, then the address appears as "invited" and receives one invitation.
2. Given a pending invitation, when the invitee accepts it, then they can see that workspace
   and nothing outside it.
3. Given a member who is not an owner, when they open the members page, then no invite control
   is available to them.
```

Criterion 3 is the shape worth copying: the boundary column of the brief's Users table becomes
a negative acceptance criterion, which is the one kind nobody writes unless the format asks for
it — and the one that turns into the authorization test.
