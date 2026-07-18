# Reference graph (graphify)

`graphify` (github.com/Graphify-Labs/graphify) builds a queryable knowledge
graph over a folder using local tree-sitter parsing — no API keys, nothing
leaves the machine. Used here, it maps `reference/` only — a navigation aid
for finding where things live and tracing call chains, nothing more.

## What it is NOT

The graph is never ground truth for behavior. Behavior truth stays with the
API contract (`PORT/contract/`) and the black-box parity suite
(`references/parity-testing.md`). Use the graph only for:
- "Where is X implemented in the reference?"
- Call-chain spot-checks ("does A actually call B before C?")

If a graph query and an actual source read ever disagree, the source read
wins — the graph is a shortcut to the read, not a replacement for it. Phase 2
and Phase 7 still require re-reading the actual source file before writing
FEATURES.md rows or porting a module.

## When to build the graph

At the end of Phase 1, **ask the user** whether to build a graphify graph of
`reference/` — no size heuristic, their call. If yes, run the install/index
flow below on `./reference`. If no, the workflow proceeds unchanged with
grep/read.

Never index the target/clone repo itself — a fresh port fits in context.

## Install / index flow

Do not hardcode the install command or flags from memory — this tool releases
frequently and past instructions go stale. At index time:

1. Open the repo's own README (github.com/Graphify-Labs/graphify) and follow
   its current install instructions verbatim. Verified at v0.9.17:
   `uv tool install graphifyy` (package name has the double-y), then
   `graphify install` to register the `/graphify` skill.
2. Index the reference: `/graphify ./reference` (in-assistant skill, full
   flow including doc extraction), or headless
   `graphify update ./reference` — works for the initial build too, code
   only, local AST, no LLM/API key needed. The graph lands **inside the
   indexed path**: `reference/graphify-out/` (`graph.json`, `graph.html`,
   `GRAPH_REPORT.md`), plus a small `graphify-out/manifest.json` stub in the
   cwd.
3. Gitignore: `reference/` in the target's `.gitignore` (Phase 1) already
   covers the graph; add a root `graphify-out/` line too for the manifest
   stub. Writing `reference/graphify-out/` doesn't violate the read-only
   rule — it's derived tool output, not a source edit. (This is scoped to
   `reference/` only — the target/project repo has its own, opposite
   Graphify policy, committing its own root `graphify-out/`; see
   `bigin-harness-setup`'s `docs/graph-usage.md` template if that repo has
   adopted it. The two policies don't conflict — different directories.)
4. Record the graphify version actually installed (`graphify --version`) in
   `PORT/PARITY.md` (or the port log if that file doesn't exist yet) — a
   parity claim that depends on graph queries is only reproducible if the
   tool version is pinned.

## Using the graph (Phases 2–6)

If `reference/graphify-out/` exists, use it — don't fall back to blind grep
for questions the graph answers directly. Commands default to
`graphify-out/graph.json` in the cwd, so from the target repo root always
pass `--graph reference/graphify-out/graph.json`:

- **"Where is X implemented?"** — `graphify explain "X"` (exact-ish node
  name) or `graphify query "where is X handled?"` (natural language, BFS
  from matched start nodes — not Cypher).
- **Call-chain spot-checks** — `graphify path "A" "B"` to confirm a
  relationship actually exists between two symbols.
- **Broader structure** — `graphify query "what connects auth to the
  database?"`-style questions to enumerate handlers, entry points, or
  dependents before reading.

Phase 7 subagent briefs should mention the graph exists so a fresh subagent
can use these commands to locate related reference code instead of
re-discovering it by grep.

MCP alternative: graphify ships a `serve` module exposing `query_graph`,
`get_node`, `get_neighbors`, `shortest_path` — same data, tool calls instead
of CLI (see the README for setup; the module lives inside graphify's own
environment, not system Python). The CLI is simpler for a port; use MCP only
if it's already set up.

## Accuracy caveats

- **Edge confidence tags**: relationships are tagged `EXTRACTED` (explicit in
  source) or `INFERRED` (resolved by cross-file analysis), with `AMBIGUOUS`
  marking uncertain inferences. Treat `INFERRED`/`AMBIGUOUS` edges as
  pointers to a source read, never as confirmation on their own.
- **Dynamic / metaprogrammed code**: tree-sitter is static analysis —
  metaprogrammed routes, DSL-built methods, and macro-generated functions
  (Ruby/Rails, Elixir) won't resolve cleanly. Flag this explicitly to the
  user when the reference is one of these, and lean on direct source reads
  for those modules.
- **Large graphs**: past ~5000 nodes the HTML visualization is skipped —
  query `graph.json` via the CLI/MCP instead; that's the normal path here
  anyway.
- A confident-looking empty result is not evidence the thing doesn't exist —
  confirm with a grep/read before concluding "not found."
