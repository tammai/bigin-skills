---
paths: skills/**
---

# Skill Authoring Conventions

**SKILL.md files:**

- Body ≤500 lines; move supporting detail into `references/`
- `description:` frontmatter is the trigger — specific and "pushy" (list exact activating phrases)
- Section headers English only; Vietnamese trigger phrases in `description:` frontmatter only
- All `references/` paths in a SKILL.md are relative to that skill's own `references/` directory
- Sonnet 5 doesn't generalize instructions across items — if a rule should apply
  to every profile/file/case, say so explicitly rather than stating it once.

**Generated files (templated in `references/`, written into target repos):**

- Keep each generated file SHORT — terse, scannable. A rule nobody reads is worse than no rule.
- All `.claude/rules/*.md` templates must carry `paths:` frontmatter. Unscoped rule files count against the always-loaded budget and must be ≤40 lines.
- Never duplicate rule content across generated files; reference the single source.
- A CHANGELOG.md entry that changes content copied verbatim into target repos (`files-shared.md`, `knowledge-bundle.md`, `profile-*.md`) may include a fenced ` ```patch ` block so `bigin-harness-setup`'s patch mode (Phase 1a) can apply it to already-scaffolded repos automatically: `target` (path as generated in a repo), `anchor` (exact existing substring), `insert: after|before|replace`, then `---`, then the content. Omit the block entirely if the change doesn't reduce to one clean anchor match — patch mode skips-and-flags anything it can't match exactly, so no block just means "no auto-patch," not an error.
- `bash-guard.mjs` is the load-bearing gate — if you change its regexes, test: block `--no-verify`, `git commit -n`, `git push --force`; allow `--force-with-lease`, normal commits, messages merely containing `-n`.
- `spec-gate-guard.mjs` is the other load-bearing gate — if you change its allowlist/threshold, test: block a non-trivial edit with no/unapproved `PLAN.md`; allow the same edit once `PLAN.md` has `Status: approved`, and allow edits under the trivial-path allowlist or ≤20-line threshold regardless of plan status.
- `architect`-style agents get `model: opus`; others `model: sonnet`. QA/reviewer agents restrict `tools:` to `Read, Grep, Glob, Bash` (no Write/Edit) rather than relying on prose to enforce read-only behavior. `agentType` is not a subagent frontmatter field — it only applies as a call-site option when *invoking* an agent (e.g. `Agent` tool `subagent_type`, `Workflow`'s `agent()` `opts.agentType`), never inside a `.claude/agents/*.md` definition's own frontmatter.

**Key skill facts:**

- `bigin-harness-setup` is idempotent — never clobbers without confirmation; `settings.json` merged, `README.md` append-only
- `nuxt-scaffold` owns the Nuxt project (config, sample code, hooks); governance stays with `bigin-harness-setup`
- `sprint-distill` compresses, never appends — every addition names what it replaces or cites budget headroom
