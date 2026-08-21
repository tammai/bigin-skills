# Architecture decisions as knowledge/ concepts

Discovery forces decisions no requirement states. "Any teammate can be invited to a workspace"
settles something about tenancy and authorization; "invoices are immutable once sent" settles
something no PRD sentence will ever repeat but every future task must respect. Those decisions
are **agent-facing** — read on every non-trivial change, forever — so they go to `knowledge/`,
not into the PRD.

## What belongs here, and what doesn't

| Goes to `knowledge/architecture/` | Stays in `docs/product/prd.md` |
| --- | --- |
| "A row is reachable from exactly one workspace, and every query filters by it" | "A user can only see their own workspace's invoices" |
| "Money is stored in integer minor units; no float ever touches a currency value" | "Totals must match the client's own accounting to the cent" |
| "The frontend never talks to a third party directly; every outbound call goes through the API" | "Payment failures are shown to the user within one page load" |

The distinction is the reader, not the subject. The right-hand column is a promise to a user
that someone approves and later checks. The left-hand column is a constraint on every future
change, which nobody approves and everybody must obey. **A requirement never lands in
`knowledge/`, and an invariant never lands in the PRD** — and neither file restates the other.

Expect **one to three concepts** from a discovery. More than five means you are transcribing the
PRD, and every line of `knowledge/` is context every later task pays for.

## Skip cleanly when there's no bundle

If there is no `knowledge/` directory, or no `knowledge/index.md`:

**Skip the step and say so.** Name the decisions you would have written, the file each would have
gone to, and that the repo can opt into a bundle through `bigin-harness-setup`. Then move on.

Do not create the directory. A lone concept file with no index, no spec, and no validator is
worse than no bundle at all: nothing checks its frontmatter, no pre-commit gate governs it, the
index-first read protocol never reaches it, and the next reader finds a file that looks
authoritative and was never verified by anything.

If `knowledge/` exists but the repo has no `tools/knowledge_validate.mjs`, write the concepts and
say that validation didn't run and which command would run it.

## Prefer amending an existing concept

Read `knowledge/index.md` before writing anything. If a concept already covers the subject —
under `contracts/`, `domains/`, or anywhere else — **amend that file** instead of adding a second
one under `architecture/`. Two concept files on one invariant is the failure mode the whole
bundle is arranged to avoid, and the one that produces contradictory guidance six months later.

`architecture/` groups by origin rather than by kind, which is a deliberate deviation from the
bundle spec's `contracts/` + `domains/` layout: decisions from one discovery arrive as a set and
are read as a set. The `type:` key still carries the kind, the validator does not care about
folder names, and an existing concept keeps its existing home.

## The file

`knowledge/architecture/<topic>.md` — kebab-case, one invariant per file, **≤60 lines**. Link to
sources of truth; never copy the PRD's text into it.

```markdown
---
type: Contract
title: Workspace Tenancy Boundary
description: Every persisted row belongs to exactly one workspace, and every read filters by it.
tags: [architecture, tenancy, authorization]
status: draft
generated: { by: discovery-workflow/opus-5, at: 2026-08-21T00:00:00Z }
sources:
  - id: prd
    resource: docs/product/prd.md
    title: PRD FR-4, FR-7 — workspace membership and invoice visibility
    last_modified: 2026-08-21
---

# Workspace Tenancy Boundary

Every persisted row belongs to exactly one workspace. Every read path filters by the caller's
workspace, and no query is permitted to span two.

## Why

Requirements FR-4 and FR-7 in `docs/product/prd.md` put invitees and invoices in the same
tables as everyone else's. Isolation is therefore a property of every query rather than of a
deployment boundary, which makes it the kind of thing a single missing `where` clause breaks
silently.

## Consequences

- Every table with tenant data carries a workspace reference; there is no shared-lookup exception.
- A cross-workspace read is a bug, never a feature request, and any aggregate across workspaces
  is a separate deliberate decision.
- Related: [Invoice Immutability](/architecture/invoice-immutability.md).
```

### `type:` — two values, one test

| Value | Use it for | The test |
| --- | --- | --- |
| `Contract` | an **invariant** — something that must always hold, and whose violation is a bug | Could a future change break this without anyone noticing? Then it's a Contract |
| `Domain` | a **shape** decision — how the domain is modelled, named, and bounded | Is this "how we describe the world here", rather than a promise? Then it's Domain |

Those are the only two this skill writes, and both are in every version of the allowed list. The
others a bundle may allow — `System`, `Table`, `Metric`, `Playbook`, `Constraint` in our v0.2
profile, and more in older v0.1-inspired ones — belong to producers with something already
running to describe; a discovery has neither a running system nor a measurement to point at.
**Read the bundle's own `meta/knowledge-bundle-spec.md` for its list before writing**, and follow
it where it differs from this file.

### Frontmatter

Our OKF v0.2 profile asks for the keys below, and where the repo ships
`tools/knowledge_validate.mjs` the right-hand column is what that script does with them — it runs
in pre-commit and CI, so there it is not a style guide.

**Check the bundle before assuming any of this applies.** Bundles predating the v0.2 move declare
themselves v0.1-inspired in their own `meta/knowledge-bundle-spec.md`, carry a longer `type` list,
and say nothing about `status`, `generated`, `sources` or `verified` — in one of those, the trust
keys are harmless extras rather than requirements, and the local spec wins over this table. Where
there is no validator at all, nothing checks any of it: match the shape of the concept files
already in the bundle rather than importing this one.

| Key | Required? | With the v0.2 validator installed |
| --- | --- | --- |
| `type` | **yes** | missing, or outside the allowed list → **error** |
| `title`, `description`, `tags` | recommended | missing `description` or `tags` → warning. Write them; the index-first read protocol depends on `description` being usable |
| `status` | optional | anything outside `draft` / `stable` / `deprecated` → **error** |
| `generated: { by, at }` | write it | malformed mapping, or a missing `by` → **error**; `at` that isn't ISO 8601 → **error**; a `by` outside `human:<id>` / `process:<id>` / `<producer>/<version>` → warning. Use `discovery-workflow/<model>` |
| `sources` | write it | an entry with no `resource` → **error**; a `last_modified` that isn't `YYYY-MM-DD` → **error** |
| `verified` | **omit** | see below |

**Leave `verified` empty and set `status: draft`.** These concepts describe a system that does not
exist yet — nothing has confirmed them against running code, and absence of `verified` is how the
bundle says exactly that. The first task that implements the decision is what earns
`status: stable` and a `verified` entry. Writing one now would claim a confirmation nobody
performed.

### The link trap

Bundle-relative links are **root-anchored against `knowledge/`** and must resolve to a file
inside it. A validator, in every version that has one, treats every markdown link starting with
`/` that way, so:

- `[Invoice Immutability](/architecture/invoice-immutability.md)` — correct, and checked.
- `[PRD](/docs/product/prd.md)` — **breaks the build.** It resolves to
  `knowledge/docs/product/prd.md`, which doesn't exist, and that is a hard error. Point at the
  PRD through `sources:` and refer to it in prose as inline code, never as a `/`-prefixed link.
- `./sibling.md` and a bare `sibling.md` are **both skipped entirely** — the check collects only
  targets beginning with `/`, so neither form is ever resolved and a broken one is never
  reported. That makes the relative forms worse than an error: they rot in silence. Always use
  the root-anchored form for in-bundle links, because it is the only form anything checks.
- A `Related:` link must point at a file that exists **in the same commit**. Writing one concept
  that links a sibling you decided not to write breaks the build with the same error as the line
  above — if the sibling isn't being written now, drop the link rather than leaving it pointing
  at an intention.

## The index line is not optional

Every new concept file needs one line in `knowledge/index.md`, under an `## Architecture`
heading (create the heading if it's the first one).

**Copy the style off a line already in the file** — bullet marker, dash, and capitalisation.
Bundles differ (`-` or `*`, an em dash or a hyphen), a new line in a different style is
immediately visible as machine-written, and none of it is checked, so nothing will correct you.
The example below shows the parts, not the house style:

```markdown
## Architecture
- [Workspace Tenancy Boundary](/architecture/workspace-tenancy-boundary.md) — every row belongs to one workspace; every read filters by it
```

A root-anchored link, then a summary short enough to answer a routine question on its own.

Two things depend on it, and only one of them is a tool. Where a validator runs, its reachability
walk starts from every `index.md`, so a file no index links is reported unreachable. The reason
that matters even with no validator installed is the second one: the index-first read protocol
means an unlisted concept is a concept no agent will ever open. A concept nobody reads is a
concept that doesn't exist.

**Add the heading and the line, and change nothing else in the file.** Leave its existing
frontmatter exactly as it is, whatever it contains — index files differ across bundle versions,
and you are there to add one line, not to migrate someone's index.

A v0.2 validator may *warn* about that frontmatter (it prefers a bare index) while a v0.1-inspired
bundle spec **requires** `type` on every file under `knowledge/`. That warning is not yours: it is
a warning, not a failure, the bundle still validates with it, and stripping keys to silence it is
how a discovery breaks the repo's own rules on its way past. Leave `knowledge/log.md` alone for
the same reason — it takes one entry per sprint and `sprint-distill` owns it.

## Before handing off

If `tools/knowledge_validate.mjs` exists, run `node tools/knowledge_validate.mjs`. It must exit 0
with no `ERROR` lines, and any warning naming a file you just wrote is yours to fix — a warning
about a file you didn't touch is not this session's problem, and silently fixing it hides
whatever produced it.

**If there is no validator, say so in the handoff** — name the file you wrote and that nothing
checked it — then re-read it against the bundle's own `meta/knowledge-bundle-spec.md` and against
a neighbouring concept file, which together are the only spec that repo actually has. An
unvalidated concept that copies its neighbours' shape is fine; one that copies this reference's
shape into a bundle whose spec disagrees is a file the repo's own rules reject.
