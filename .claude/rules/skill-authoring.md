---
paths: skills/**,agents/**
---

# Skill Authoring Conventions

**SKILL.md files:**

- Body ≤500 lines; move supporting detail into `references/`
- `description:` frontmatter is the trigger — and it is **always loaded**, for every skill, on every turn. Budget: **≤350 chars, aim ~250.** One clause on what the skill does, then 3–4 representative triggers. Matching is semantic, not literal string lookup — fourteen phrasings match no better than four.
- **English only, everywhere** — descriptions, trigger phrases, eval fixtures, headers, body prose. No bilingual pairs.
- "Do NOT use for…" prose belongs in a body `## When not to use` section, where it costs nothing until the skill is invoked — never in `description:`.
- All `references/` paths in a SKILL.md are relative to that skill's own `references/` directory
- Don't rely on a rule generalizing across items — if it applies to every profile/file/case, be explicit. But **explicit ≠ copy-pasted**: a per-item table (one row per profile, columns for what differs) is explicit *and* single-source. N near-identical prose blocks drift the moment one of them is edited — that's what `references/scaffold-delegation.md` replaced.

**Generated files (templated in `references/`, written into target repos):**

- Keep each generated file SHORT — terse, scannable. A rule nobody reads is worse than no rule.
- All `.claude/rules/*.md` templates must carry `paths:` frontmatter. Unscoped rule files count against the always-loaded budget and must be ≤40 lines.
- Never duplicate rule content across generated files; reference the single source. The generated `CLAUDE.md` is always-loaded, so it holds only what must be true *before* any file is in context — a rule that belongs to a path goes in that path's scoped rule file, with at most a one-line pointer in `CLAUDE.md`.
- `AI_TASK_GUIDE.md` is a pointer to `task-workflow`, deliberately. Never restate the workflow's steps or formats there — the two diverged that way once already.
- Don't write context-management prose (what to preserve on compaction, when to `/clear`, piping output) into a generated `CLAUDE.md`. The `PreCompact` hook handles state deterministically, and the model manages its own context.
- A CHANGELOG.md entry that changes content copied verbatim into target repos (`files-shared.md`, `knowledge-bundle.md`, `profile-*.md`) may include a fenced ` ```patch ` block so `bigin-harness-setup`'s patch mode (Phase 1a) can apply it to already-scaffolded repos automatically: `target` (path as generated in a repo), `anchor` (exact existing substring), `insert: after|before|replace`, then `---`, then the content. Omit the block entirely if the change doesn't reduce to one clean anchor match — patch mode skips-and-flags anything it can't match exactly, so no block just means "no auto-patch," not an error.
- For a wholly new file with no existing anchor to patch against (e.g. a new guard script) — use `mode: create-if-missing` instead of `anchor`/`insert`: `target`, then `---`, then the full file content. Patch mode writes it only if `target` doesn't already exist in the repo; it never overwrites a file that's already there, hand-edited or otherwise.
- `bash-guard.mjs` is the load-bearing gate — if you change its regexes, test: block `--no-verify`, `git commit -n`, `git push --force`; allow `--force-with-lease`, normal commits, messages merely containing `-n`.
- `bugfix-test-guard.mjs` is a load-bearing gate — if you change its fix-detection regex or test-path patterns, test: block `git commit -m "fix: x"` with no staged test file; allow the same commit once a `*.test.ts`/`*.spec.ts`/`_test.go`/`tests/**` file is staged; allow when the message contains `[no-test]`; allow non-fix messages (e.g. `feat: x`); allow when every staged file matches the docs/config allowlist; allow non-`git commit` commands and `git commit` with no `-m`.
- `spec-gate-guard.mjs` is the other load-bearing gate — if you change its allowlist/threshold, test: block a non-trivial edit with no/unapproved `PLAN.md`; allow the same edit once `PLAN.md` has `Status: approved`, and allow edits under the trivial-path allowlist or ≤20-line threshold regardless of plan status.
- `injection-gate-guard.mjs` (paired with `injection-scan-guard.mjs`) is a third load-bearing gate — if you change the freshness window or `injection-scan-guard.mjs`'s `INJECTION_PATTERNS`, test: a fresh flag on the next Bash/Write/Edit/WebFetch/mcp__ call returns `permissionDecision: "ask"` and the flag file is deleted after; a stale flag (older than the freshness window) passes through silently; a scan of benign fetched content (e.g. "we can safely ignore this warning") never writes a flag. Its stage-3 canary check is a fourth test set — if you change it, test: a canary token in a `Bash` command string, a `Write` `content`, or a `WebFetch` `url` all return `permissionDecision: "deny"`; a different random UUID passes through untouched; a missing canary file falls through unchanged to the stage-2 heuristic behavior above.
- Plugin-level `agents/*.md` frontmatter is the **default** ladder (`frontier` profile — quick `sonnet`/low, standard `opus`/high, deep `fable`/xhigh, verifier `sonnet`/high); `model-router` overrides `model` per spawn from `.claude/model-routing.json`, so keep frontmatter and `references/model-profiles.md` in sync. `effort` has no call-site override — changing a tier's effort means editing its agent file. Never pin `effort` on a `model: haiku` agent expecting it to apply: Haiku 4.5 doesn't accept an effort level.
- **`high` is the documented default effort on every model that supports effort** (only Opus 4.7 defaults to `xhigh`). Any pin away from `high` needs a stated reason in `references/model-profiles.md` — `low` for genuinely mechanical, latency-sensitive tiers, `xhigh` only where a wrong call can't be cheaply reverted. Don't assert what a model's default is from memory; it's in the model-config docs.
- **Model choice answers "could it do this at all"; effort answers "did it check its work."** Keep routing signals on the axis they actually predict — breadth, coverage, and blast radius set the verification bar, not the model tier.
- For agents generated *into target repos*: `architect`-style agents get `model: opus`; others `model: sonnet`. QA/reviewer agents restrict `tools:` to `Read, Grep, Glob, Bash` (no Write/Edit) rather than relying on prose to enforce read-only behavior. `agentType` is not a subagent frontmatter field — it only applies as a call-site option when *invoking* an agent (e.g. `Agent` tool `subagent_type`, `Workflow`'s `agent()` `opts.agentType`), never inside a `.claude/agents/*.md` definition's own frontmatter.

**Key skill facts:**

- `bigin-harness-setup` is idempotent — never clobbers without confirmation; `settings.json` merged, `README.md` append-only
- `nuxt-scaffold` owns the Nuxt project (config, sample code, hooks); governance stays with `bigin-harness-setup`
- `sprint-distill` compresses, never appends — every addition names what it replaces or cites budget headroom
