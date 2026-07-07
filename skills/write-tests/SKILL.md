---
name: write-tests
description: "Writes scoped, style-matched tests for a specific file or function. MUST use when user says: 'write tests for X', 'add tests for Y', 'test this function', 'generate unit tests', 'write a test case for', 'viết test cho', 'thêm test cho', 'viết unit test'. Do NOT use for running an existing test suite ('run the tests') or for general testing-strategy questions — only for authoring new test code."
effort: medium
---

# write-tests

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
