# Reference graph index

`codebase-memory-mcp` (github.com/DeusData/codebase-memory-mcp) builds a code
graph over a repo and answers structural queries against it. Used here, it
indexes `reference/` only — a navigation aid for finding where things live and
tracing call chains, nothing more.

## What it is NOT

The graph is never ground truth for behavior. Behavior truth stays with the
API contract (`PORT/contract/`) and the black-box parity suite
(`references/parity-testing.md`). Use the graph only for:
- "Where is X implemented in the reference?"
- Call-chain spot-checks ("does A actually call B before C?")

If a graph query and an actual source read ever disagree, the source read
wins — the graph is a shortcut to the read, not a replacement for it. Phase 2
and Phase 6 still require re-reading the actual source file before writing
FEATURES.md rows or porting a module.

## When to index

- **Reference repo**: index when it's too large to explore in-context —
  roughly >300 files or >100k LOC. Below that, grep + read is faster than the
  indexing round-trip; skip it.
- **Target/clone repo**: don't index at all early on — a fresh port fits in
  context. Revisit once the new implementation itself grows past a few
  hundred files.

## Install / index flow

Do not hardcode the install command or MCP config from memory — this tool
releases frequently and past instructions go stale. At index time:

1. Open the repo's own README (github.com/DeusData/codebase-memory-mcp) and
   follow its current install/setup instructions verbatim.
2. Record the version actually installed in `PORT/PARITY.md` (or the port log
   if that file doesn't exist yet) — a parity claim that depends on graph
   queries is only reproducible if the tool version is pinned.
3. Index `reference/` (not the target repo, per above).

## Project-ID note

The tool derives project IDs from the repo path (slashes become hyphens).
Use whatever ID it reports back verbatim in all subsequent calls for that
repo — don't reconstruct it by hand.

## Language-accuracy caveat

Full call-graph accuracy is only available for the Hybrid LSP language set:
Python, TS/JS, PHP, C#, Go, C/C++, Java, Kotlin, Rust, Perl. Outside that set,
the tool falls back to tree-sitter-level analysis only.

If the reference is written in a dynamic, heavy-metaprogramming language —
Ruby/Rails, Elixir — expect call-graph gaps (metaprogrammed routes, DSL-built
methods, macro-generated functions won't resolve cleanly). Flag this
explicitly to the user when the reference is one of these, and lean more on
direct source reads for those modules.

## Mandatory: verify labels before trusting queries

Node labels vary by language — e.g. Go methods are labeled `Method`, not
`Function`, so a query pattern like `(f:Function)` silently returns zero rows
instead of erroring. Before relying on any query result:

1. Run one unlabeled probe query first (e.g. match any node, or match by name
   only) to discover what labels the indexer actually used for this
   reference's language.
2. From then on, use an inclusive label pattern such as
   `(f:Function|Method)` rather than assuming one label name.

A confident-looking empty result set is a label mismatch, not evidence the
thing doesn't exist — always confirm labels before concluding "not found."

## Query patterns

- **Accuracy-sensitive checks** (does this call chain actually exist, in what
  order): prefer `trace_path` with `"direction": "both"` — it traces both
  callers and callees from a node, catching cases where the relationship runs
  the opposite direction from what you assumed.
- **Broader structural queries** (find all handlers touching entity X, list
  everything implementing interface Y): use `query_graph` with Cypher, after
  the label-verification probe above.
