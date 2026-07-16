# Parity testing

The strongest parity claim is a single black-box test suite that passes against
BOTH the source and the port. Build it when the source is runnable and the
interface is testable from outside the process. When it isn't (source won't
build, no test env), fall back to contract-level tests on the port alone and
say so in PARITY.md.

## HTTP APIs

1. Suite lives in `PORT/parity-suite/`, written in whatever the team already
   uses for API tests. It must take the base URL from an env var:
   `PARITY_TARGET_URL`. No imports from either implementation — HTTP only.
2. Drive the suite from the OpenAPI contract: one happy-path and one failure
   case per operation minimum. Prefer generating request skeletons from the
   spec over hand-writing them.
3. Seed data via the API itself where possible; via a shared SQL/fixture file
   only when unavoidable (and then the fixture becomes part of the contract).
4. Run matrix in CI or locally:
   ```
   PARITY_TARGET_URL=http://localhost:3000 <run suite>   # source
   PARITY_TARGET_URL=http://localhost:8080 <run suite>   # port
   ```
5. Normalize before comparing: strip timestamps, generated IDs, and
   Server/Date headers. Compare shapes and business values, not bytes.

## CLIs

Golden-file testing: a table of `(argv, stdin) → (exit code, stdout, stderr)`
cases, run against both binaries. Normalize paths, versions, durations.
Exit codes are contract; wording of error text usually isn't — decide per case
and record the decision.

## Libraries

Property/table tests written against the documented public API in
`PORT/contract/api.md`. If both stacks can run from one test harness (e.g.
source is JS, port is TS — or via subprocess shims), share the table as JSON
fixtures so both sides consume identical cases.

## UI apps

Full parity automation is usually not worth it. Instead:
- Contract-test the data layer (the API calls each view makes).
- One E2E smoke per key user flow from `PORT/contract/views.md` on the port.
- Manual side-by-side pass with the user for anything visual; record findings
  in PARITY.md rather than chasing pixel equality.

## What counts as a parity failure

- Different business outcome for same input: always a failure.
- Different error *classification* (4xx vs 5xx, exit 1 vs 2): failure.
- Different error *wording*: record in PARITY.md "known differences," not a failure,
  unless clients parse the text.
- Ordering differences: failure if the contract promises order; otherwise sort
  before comparing and note it.
