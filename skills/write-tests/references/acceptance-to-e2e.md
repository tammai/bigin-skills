# Acceptance criterion → E2E spec

The second path of `write-tests`: a PRD acceptance criterion in, one E2E spec (or one added
case per criterion in an existing spec file) out, written in the style the target repo already
uses. The seven-step unit path in `SKILL.md` is untouched by any rule here — a request naming a
file or function still goes there.

Invoked as `write-tests FR-3/AC-2`, `write-tests FR-3`, or with a Given/When/Then criterion
quoted inline in the request.

## The PRD is a fixed, read-only contract

`docs/product/prd.md` is the only file this path reads for a criterion. Its shape is defined in
`${CLAUDE_PLUGIN_ROOT}/skills/discovery-workflow/references/artifact-formats.md` →
`## docs/product/prd.md`, and `write-tests` **only ever reads it** — never writes it, never
amends it, never renumbers or adds an ID, not even to fix something obviously wrong. A defect
found while resolving a citation is reported so it can be fixed in the PRD through
`discovery-workflow`; a PRD edited by the skill that tests against it stops being a contract.

Citation style is `epic-workflow`'s step 2, deliberately, so the two read alike: address the
requirement **by ID**, and put the criterion into the spec **quoted verbatim, never
paraphrased**. Paraphrasing is how a test drifts from the requirement it claims to cover while
both still look green. Name the ID in the spec itself — the test's title or a one-line comment
above it — so the trace from spec back to contract survives a file move.

## Resolving the citation

| Input | Resolves to |
| --- | --- |
| `FR-3/AC-2` | The second numbered criterion under the `### FR-3` block |
| `FR-3` (no `/AC-m`) | Every **active** criterion under `### FR-3`, one spec case each |
| `NFR-2/AC-1` | Same addressing. A threshold criterion is usually a performance-tier check rather than an E2E one — say so and name the tier it belongs in rather than asserting a millisecond budget from a browser driver |
| A criterion quoted inline in the request | Itself. No PRD read is required, and none is invented — but a criterion given without an ID gets no ID in the spec either |

Two resolution rules, both the PRD's own:

- **The `### FR-n` block is authoritative; the requirement index is navigation.** If the two
  disagree, the block wins — and say which line was stale instead of reconciling it silently.
- **IDs are permanent.** A gap in the numbering is expected. Never treat a missing `FR-7` as an
  off-by-one and read `FR-8` instead.

## When to refuse, and what to say

| Case | What this path does |
| --- | --- |
| No `docs/product/prd.md` | Say the file is absent and stop. Ask for the criterion quoted inline if the user wants to proceed |
| The cited `FR-n` or `AC-m` is absent from the file | Name what was cited and what the file actually holds, and stop. **Never** reconstruct a criterion from the requirement's title, the index row, or a neighbouring criterion |
| `Status: withdrawn` on the requirement, or a criterion marked withdrawn | Refuse to generate, and say the citation is stale. A withdrawn requirement keeps its ID precisely so a stale citation is caught rather than silently honoured |
| The PRD is `Status: draft` | Generate — but say the IDs can still move, so the spec's citation may need re-pointing. Unlike a decomposition, one test is cheap to re-point, which is why a draft is not disqualifying here as it is for `epic-workflow` |
| Index and `### FR-n` block disagree | The block wins; report the stale line |
| The criterion is not observable from outside the system | Flag it as a **PRD defect** to fix in the PRD, and stop. Every criterion is meant to be externally observable; one that can only be checked by reading the implementation cannot become an E2E spec, and a unit test wearing an E2E spec's filename is worse than no spec — it reports coverage nobody has |
| The repo has no E2E harness | See below — this is the case most likely to be papered over |
| The spec cannot be run here | See below — never claim green on an unrun spec |
| The repo gates E2E to deploy time rather than pre-commit | That tiering is the target repo's `.claude/rules/testing.md` call, not this skill's. Report where the spec will run and stop there; do not rewire a gate or move the spec into a tier that runs earlier |

Every refusal above ends the run. Reporting the block *is* the deliverable in those cases —
there is no partial spec, no `TODO`-bodied placeholder, and no "best guess pending
confirmation".

### The repo has no E2E harness — report and stop

**If the repo has no E2E tier, this path produces no file.** Say so plainly, name the nearest
tier that does exist (a `vitest` unit tree, a Flutter `integration_test/` flow tier, an API
integration suite), and stop. Do **not** install Playwright, Cypress, or anything else; do not
add a dependency, a config file, or an `e2e/` directory; and do not write a spec into a tree
that does not exist yet in the hope someone wires a runner later.

Adopting an E2E harness is the repo's decision, with CI cost and a maintenance owner attached.
A skill invoked to write one test is the worst possible place for it to be made.

### Never claim green on a spec you did not run

The unit path's TDD order (step 5) **does not transfer intact**: an E2E spec usually cannot be
driven red-then-green locally, because it needs a running app, seeded data, or a device.

So the rule for this path is weaker in what it requires and stricter in what it reports:

- **Attempt the run.** Use the command the repo's own config or `testing.md` names for that
  tier; do not invent one.
- **Report the true state, in one of exactly three forms:** it ran and passed (with the
  output), it ran and failed (with the output, and what the failure means — a spec failing
  because the behaviour is not built yet is the correct red), or **it was not run**, naming
  precisely what running it needs (a dev server, credentials, a simulator).
- A spec that was not run is never described as passing, working, verified, or done, and its
  absence of output is never left for the reader to notice.

## Discovering the repo's E2E style

"The repo's existing E2E style" always means **the target repo's own**, discovered by reading
it. This plugin prescribes no E2E harness anywhere and installs none, so there is nothing to
default to.

In order:

1. The repo's `.claude/rules/testing.md`, if it has one — that is where per-repo test-tree
   conventions live, and it outranks anything inferred from file layout.
2. The existing E2E specs themselves. Match the nearest one's structure, naming, selector
   strategy, fixture and setup helpers, and assertion style exactly — the same rule the unit
   path's step 1 applies to unit tests. Do not introduce a second pattern beside a working one.
3. The runner's config (what globs it picks up, where the base URL comes from) for where the
   new file has to live to run at all.

Where a repo was scaffolded by `bigin-harness-setup`, its `testing.md` encodes that profile's
tree, which tells you where an E2E tier would sit if the repo has added one:

| Profile | What its `testing.md` encodes | Bearing on this path |
| --- | --- | --- |
| `nuxt` | A centralized `tests/` tree mirroring `app/`/`server/`, cross-tree imports via the `~~/` root alias, Nitro auto-imports stubbed from `tests/support/` | Vitest tiers only — no E2E tier is declared, so one either exists in the repo already or the no-harness rule applies |
| `next` | Tests **co-located** with source under `src/**/*.test.ts(x)` | Same: Vitest only, no declared E2E tier |
| `flutter` | A mirrored `test/**` tree plus `integration_test/**`, where flow tests live — and one flow test per acceptance criterion, on a real device or simulator | The closest thing to an E2E tier the profiles declare, and its 1:1 criterion mapping is exactly this path's shape |
| `go`, `nodejs` | No testing rule — conventions live in a single `conventions.md` | Discover from the repo's own suites |
| `generic` | No testing rule at all | Discover from the repo, or report no tier |

## Content rules inherited from the PRD

A quoted criterion carries the PRD's own content rules with it, and the strongest is
**roles, never people**. Criteria name a role ("a workspace owner", "an invitee"), never a real
person, email address, or account. If a real name, address, or account number does appear in a
criterion you are about to quote, that is **fixed in the PRD** — never laundered into a test
fixture, and never quietly swapped for a role on the way into the spec while the PRD keeps it.
Stop, name the line, and let it be corrected upstream.

Fixture data comes from the criterion's own terms plus the repo's existing fixture helpers, and
nothing else. Do not reach for production data, and do not invent a plausible-looking customer.

## Reporting back

The same report the unit path gives, with the run rule above applied: which criteria were
covered (by ID), which were deliberately excluded and why, and the run output — or the explicit
statement that the spec was not run, and what running it needs.
