---
name: write-tests
description: "Writes scoped, style-matched tests for one file or function, or one E2E spec per PRD acceptance criterion (`FR-3/AC-2`). Triggers: 'write tests for X', 'generate unit tests', 'e2e test for FR-3/AC-2'."
argument-hint: [file | function | FR-n/AC-n]
effort: medium
---

# write-tests

Authoring new test code only — not running an existing suite ("run the tests"), and not general
testing-strategy questions.

**Two paths, routed on what the request names:**

| The request names | Path |
| --- | --- |
| a file, function, component, or module | the **unit path** below — the seven steps |
| a PRD requirement or criterion ID (`FR-3`, `FR-3/AC-2`), or a Given/When/Then criterion quoted inline | the **acceptance-criterion → E2E path** at the end of this file |

## Unit path

Write tests for the unit named in the request. Before writing any test code:

1. **Find the style reference.** Locate the nearest existing test file for this
   package/module (sibling `*_test.go` or `*.test.ts`). Match its structure,
   naming, and assertion style exactly. Do not invent a new pattern. If the
   repo has a scoped `.claude/rules/testing.md` in context, follow it too.

2. **Scope it.** Only test the unit specified. Do not expand to cover
   unrelated functions "while you're in there."

3. **List edge cases before coding.** Print a short bullet list of the cases
   you intend to cover (nil/empty input, boundary values, error paths,
   concurrency if relevant) and wait for confirmation if the list is longer
   than 5 items. If edge cases were given in the request, use those as the
   minimum required set — add more only if obviously missing.

4. **No unnecessary mocking.** If the unit under test has no I/O (no DB, no
   network, no filesystem), do not mock anything — call it directly. Only
   mock at actual I/O boundaries.

5. **TDD order for anything with business logic** (not pure CRUD/plumbing):
   a. Write the test(s) first.
   b. Run them and show they fail for the RIGHT reason (not a compile error
      or missing import).
   c. Only then write/modify the implementation.
   d. Run the tests again and iterate until green — don't hand back
      failing or unrun tests.

6. **One assertion concern per test case.** Prefer table-driven tests (Go)
   or `describe`/`it` with one behavior per `it` (TS) over one giant test
   with many unrelated assertions.

7. **Stop conditions — do NOT:**
   - Test framework/library internals (e.g. "Vue re-renders on state
     change") — only test the unit's own logic.
   - Add snapshot tests unless explicitly asked.
   - Generate tests for generated code (openapi types, mocks).
   - Leave `TODO` or skipped tests without flagging them explicitly.

Report back with: which cases were covered, which were deliberately
excluded and why, and the final test run output.

## Acceptance-criterion → E2E path

Read `references/acceptance-to-e2e.md` before writing anything on this path — it carries the
resolution table, every refusal case, the per-profile style discovery, and the run-reporting
rule. The essentials:

- **`docs/product/prd.md` is a fixed, read-only contract.** Resolve `FR-n/AC-m` by reading it;
  never write it, amend it, or renumber an ID. Quote the criterion into the spec **verbatim,
  never paraphrased**, and name its ID there — the same citation style as `epic-workflow`'s
  step 2. `FR-n` with no `/AC-m` means every active criterion under that requirement.
- **Stop rather than invent.** No PRD, an absent ID, or a `Status: withdrawn` requirement (statuses are requirement-level; criteria have none) or
  criterion → say which, and stop. Never reconstruct a criterion from a requirement title.
- **Find the repo's own E2E tree; never install one.** "The repo's existing E2E style" means the
  target repo's, discovered from its `.claude/rules/testing.md` and its existing specs. If the
  repo has **no** E2E tier, report that, name the nearest tier it does have, and stop — no
  Playwright, no Cypress, no invented `e2e/` directory.
- **Never claim green on a spec you did not run.** The unit path's TDD order (step 5) does not
  transfer intact: an E2E spec usually cannot be driven red-then-green locally. Attempt the run,
  then report its true state — passed, failed, or **not run** with what running it needs.
- Then report as the unit path does: criteria covered by ID, criteria deliberately excluded and
  why, and the run output or the explicit statement that it was not run.
