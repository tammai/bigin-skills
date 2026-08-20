# Phase 1.5: the decision bundle

The six questions Phase 1.5 asks, with their auto-detected defaults and the exact option wording. Ask them in **one bundled `AskUserQuestion` call** where they fit (max four per call — split into two back-to-back calls in this order when more apply), and write no file until every one is answered.

1. **Knowledge Bundle & Graphify** (four-way):
   ```
   Add structured knowledge tracking? (knowledge+graphify / knowledge only / graphify only / none)
   1. knowledge + graphify (default) — knowledge/ concept bundle (decisions, invariants, "why") plus a graphify structural graph of this repo (graphify-out/, query-only navigation aid — see docs/graph-usage.md)
   2. knowledge only — knowledge/ concept bundle, no graph
   3. graphify only — structural graph, no knowledge/ bundle
   4. none — skip both
   See references/knowledge-bundle.md and references/graph.md for what each writes.
   ```
   Store `KNOWLEDGE_BUNDLE` (true for options 1/2) and `GRAPH` (true for options 1/3) — `KNOWLEDGE_BUNDLE` semantics are unchanged from the old yes/no ask.
2. **CI config** (github/gitlab/both/no) — **omit this question entirely if `PROFILE = generic`**; set `CI_PROVIDER = no` and say in the Phase 7 summary that CI wasn't generated (`references/profile-generic.md` → `## CI` has the reason and what to put in a job by hand). Otherwise auto-detect a default first: run `git remote get-url origin 2>/dev/null`; if it matches `github.com` preselect `github`, if `gitlab.com` preselect `gitlab`; if undetermined (no remote, unrecognized host, or ambiguous) preselect `both`. Present the preselected option first/labeled as detected, but let the user override:
   ```
   Add CI config? (github/gitlab/both/no)
   Generates a workflow that runs {LINT} && {TYPECHECK} && {TEST} on push to main and on merge/pull requests.
   ```
   For `flutter`, `{LINT}` is four commands (`dart format --output=none --set-exit-if-changed .`, then `flutter analyze --fatal-infos` in the `{TYPECHECK}` slot, then **both** `dart run custom_lint` and `dart run import_lint`) and the generated workflow adds a regenerate-and-diff step for committed generated code — say "lint, analyze, test, and a generated-code diff" rather than listing all of it in the question.
3. **Model routing profile** (opus-centric/frontier/lean) — which model ladder `model-router` and `task-workflow` spawn subagents on. Written to `.claude/model-routing.json` at Phase 5-3d:
   ```
   Which model ladder should subagents use? (opus-centric/frontier/lean)
   1. opus-centric (default) — quick=sonnet/low, standard=opus/medium, deep=opus/high, verifier=sonnet/high. Matches an Opus-default session; the deep tier escalates on effort, not on model.
   2. frontier — quick=sonnet/low, standard=opus/high, deep=fable/high, verifier=sonnet/high. Everything above quick at full effort, deep on the top model.
   3. lean — quick=sonnet/low, standard=sonnet/high, deep=opus/high, verifier=sonnet/medium. Cost-first, trading model capability for effort on the standard tier; deep still escalates to opus.
   Per-tier overrides and the full schema: `${CLAUDE_PLUGIN_ROOT}/skills/model-router/references/model-profiles.md` (this plugin's own tree).
   ```
   Store `MODEL_ROUTING` (the profile name).
4. **Agent hosts** — which AI coding hosts this harness has to hold. Auto-detect a default first: `.cursor/` present in the repo → preselect `both`; otherwise preselect `claude`. Present the preselected option first/labeled as detected, but let the user override:
   ```
   Which agent hosts should the harness cover? (claude/both/cursor)
   1. claude — Claude Code only: CLAUDE.md, .claude/rules/, .claude/settings.json hooks.
   2. both — also generate the Cursor mirror: AGENTS.md, .cursor/rules/*.mdc, .cursor/hooks.json. Same guards, same gates, one canonical source (Claude Code's) kept in sync by tools/cursor_mirror.mjs.
   3. cursor — Cursor mirror as well as the canonical tree. Same files as `both`: the Claude Code tree is the source the mirror is generated from, so it's always written.
   See references/cursor-parity.md for what the mirror contains and the one behavior that degrades.
   ```
   Store `AGENT_HOSTS`. Options 2 and 3 are the same install — say so rather than pretending a Cursor-only layout exists, since `.cursor/rules/` is generated *from* `.claude/rules/` and deleting the source would break the gate on the next commit.
5. **Install mode** — only if Phase 1 detected an existing-harness conflict in this run: the overwrite/new/cancel question from Phase 1 above.
6. **Spec Kit handling** — only if Phase 0.7 found Spec Kit: the `migrate | coexist | leave` question, worded in `references/speckit-migration.md` → "The decision". On `migrate`, `KNOWLEDGE_BUNDLE` stops being a free choice — it's where the `specs/` rationale lands, so if the user declines both, say the "why" has nowhere to go before accepting it.
