# Graph Templates

Templates for the optional Graphify structural-graph convention. Scaffolded by `SKILL.md` Phase 5.7 when the user opts in. Before writing, replace `{GRAPHIFY_VERSION}` in `docs/graph-usage.md` with the version reported by `graphify --version` once installed (Phase 5.7 step 3) — if the user declines to install right now, leave it as `not yet installed — run graphify --version after installing`.

---

## .claude/rules/graph.md

```markdown
# Graph Rules

Structural facts — call flow, dependency, schema shape — live only in `graphify-out/graph.json`, never in `knowledge/` or another rule file; that's what stops the two from drifting apart.

`knowledge/` keeps only what no parser can extract: decisions, invariants, playbooks, "why".

Never load `graph.json` or `GRAPH_REPORT.md` into context wholesale. Query it — `graphify query`/`path`/`explain` — don't read it.

`EXTRACTED` edges are ground truth. `INFERRED`/`AMBIGUOUS` edges are a pointer to a source read, not confirmation — a source read wins any disagreement with the graph.

If `graphify-out/graph.json` doesn't exist, skills fall back to grep/read silently.

Query recipes, rebuild command, install/version pinning: `docs/graph-usage.md`.
```

---

## docs/graph-usage.md

```markdown
# Graph usage (graphify)

`graphify` (github.com/Graphify-Labs/graphify) builds a queryable knowledge graph over this repo using local tree-sitter parsing — no API keys, nothing leaves the machine. It's a navigation aid for finding where things live and tracing call chains, nothing more.

## What it is NOT

Never ground truth for behavior — that's the actual source, tests, and the contract (if this repo has one). If a graph query and a source read disagree, the source read wins.

## Install / index

Do not hardcode the install command from memory — this tool releases frequently. At setup time (or whenever reinstalling):

1. Open the repo's own README (github.com/Graphify-Labs/graphify) and follow its current install instructions verbatim. Package name is `graphifyy` (double-y) — don't typo it as `graphify`. Pinned at setup: **{GRAPHIFY_VERSION}**.
2. Index this repo: `graphify update .` (headless — code only, local AST, no LLM/API key) or `/graphify .` (in-assistant skill, full flow including doc extraction). The same command rebuilds the graph later — there's no separate "rebuild" command.
3. Graph lands at `graphify-out/` (`graph.json`, `graph.html`, `GRAPH_REPORT.md`).

## Gitignore contract

Commit `graphify-out/` itself — the graph is checked in like any other generated-but-useful artifact. Add to `.gitignore`: `graphify-out/cost.json` (API-cost bookkeeping, useless without the run that produced it) and optionally `graphify-out/cache/` if present. Never gitignore `graphify-out/` wholesale — that would silently break every skill that expects the graph to exist.

## Query recipes

Commands default to `graphify-out/graph.json` in the cwd, so from the repo root pass `--graph graphify-out/graph.json` explicitly:

- **"Where is X implemented?"** — `graphify explain "X"` (exact-ish node name) or `graphify query "where is X handled?"` (natural language, BFS from matched start nodes).
- **Call-chain spot-checks** — `graphify path "A" "B"` to confirm a relationship actually exists between two symbols.
- **Broader structure** — `graphify query "what connects auth to the database?"`-style questions to enumerate handlers, entry points, or dependents before reading.

MCP alternative: graphify ships a `serve` module exposing `query_graph`, `get_node`, `get_neighbors`, `shortest_path` — same data, tool calls instead of CLI. Use it only if already set up; the CLI is simpler otherwise.

## Confidence tags

Relationships are tagged `EXTRACTED` (explicit in source) or `INFERRED` (resolved by cross-file analysis), with `AMBIGUOUS` marking uncertain inferences. Treat `INFERRED`/`AMBIGUOUS` edges as pointers to a source read, never as confirmation on their own. A confident-looking empty result is not evidence the thing doesn't exist — confirm with grep/read before concluding "not found."

## Degradation path

If `graphify-out/graph.json` doesn't exist (never indexed, or deleted), every adopting skill falls back to grep/read silently — no error, no nagging to install. Rebuilding is always `graphify update .`, proposed at natural workflow completion points (task-workflow Cleanup, debug-workflow fix validation, sprint-distill start) — never auto-run.

## Large graphs / dynamic code

Past ~5000 nodes the HTML visualization is skipped — query `graph.json` via the CLI/MCP instead. Metaprogrammed routes, DSL-built methods, and macro-generated functions (Ruby/Rails, Elixir) won't resolve cleanly under static tree-sitter analysis — lean on direct source reads for those.
```
