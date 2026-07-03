---
paths: skills/**
---

# Skill Authoring Conventions

**SKILL.md files:**

- Body ≤500 lines; move supporting detail into `references/`
- `description:` frontmatter is the trigger — specific and "pushy" (list exact activating phrases)
- Section headers English only; Vietnamese trigger phrases in `description:` frontmatter only
- All `references/` paths in a SKILL.md are relative to that skill's own `references/` directory

**Generated files (templated in `references/`, written into target repos):**

- Keep each generated file SHORT — terse, scannable. A rule nobody reads is worse than no rule.
- All `.claude/rules/*.md` templates must carry `paths:` frontmatter. Unscoped rule files count against the always-loaded budget and must be ≤40 lines.
- Never duplicate rule content across generated files; reference the single source.
- `bash-guard.mjs` is the load-bearing gate — if you change its regexes, test: block `--no-verify`, `git commit -n`, `git push --force`; allow `--force-with-lease`, normal commits, messages merely containing `-n`.
- `architect`-style agents get `model: opus`; others `model: sonnet`. QA/reviewer agents use `agentType: general-purpose` (not `Explore`).

**Key skill facts:**

- `bigin-harness-setup` is idempotent — never clobbers without confirmation; `settings.json` merged, `README.md` append-only
- `nuxt-scaffold` owns the Nuxt project (config, sample code, hooks); governance stays with `bigin-harness-setup`
- `sprint-distill` compresses, never appends — every addition names what it replaces or cites budget headroom
