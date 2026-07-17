---
name: harness-audit
description: "Audits this bigin-skills plugin against current official Claude Code docs (skills, hooks, sub-agents, plugins, memory) — a findings report only, never auto-fixes. Use when user says: 'audit the harness', 'audit bigin-skills', 'recheck against best practices', 'is this still current', 'harness audit', 'kiểm tra lại harness', 'soát lại theo best practice'. Do NOT use for auditing a target repo scaffolded by bigin-harness-setup — this skill audits the bigin-skills plugin itself, not its output."
disable-model-invocation: true
effort: high
---

# harness-audit

Full re-audit of this plugin against current official Claude Code docs. Findings report only — never fixes anything in the same run. Propose-then-stop, same discipline `task-workflow` and `sprint-distill` already enforce.

Anti-re-litigation rule: if `.claude/audit-log.md` exists, read it first. Any finding already listed there as `Closed` in a prior run — don't re-report it unless this audit independently finds something new about it (a regression, a doc change that reopens it). If the file doesn't exist, this is the first run; proceed normally and create it in Phase 4.

## Phase 0: Pull current docs

Fetch and read directly — don't rely on training data:

- https://code.claude.com/docs/en/skills.md
- https://code.claude.com/docs/en/best-practices.md
- https://code.claude.com/docs/en/hooks.md
- https://code.claude.com/docs/en/plugins-reference.md
- https://code.claude.com/docs/en/sub-agents.md
- https://code.claude.com/docs/en/memory.md

If any fetch fails, note it in the report and proceed with what's available — don't block the whole audit on one page.

## Phase 1: Audit dimensions

For each dimension: state what the docs say, what this repo currently does, cite the specific file/line, and classify as match / drift / opportunity. Skip anything that's already correct — the report only needs what doesn't pass.

Skip the generated table regions in `CLAUDE.md`/`README.md` (between `<!-- gen:* -->` markers) — they're mechanically derived from `skills/*/SKILL.md` + `agents/*.md` + `tools/docs-manifest.json` via `node tools/docs_sync.mjs` and are correct by construction. Any doc-staleness check focuses on the remaining manual surfaces instead: prose, the README tree diagram, and `marketplace.json`.

### Skill frontmatter (all skills under `skills/*/SKILL.md`)

- `description:` follows the "specific and pushy" rule (`.claude/rules/skill-authoring.md`) with real trigger phrases, EN + VI where the skill has Vietnamese triggers.
- Any skill whose side effects or timing sensitivity argue for `disable-model-invocation: true`.
- Any skill that should scope activation with frontmatter `paths:` (skill-level — distinct from the `paths:` already used in generated `.claude/rules/*.md` templates).
- `allowed-tools` used anywhere it should be, to pre-approve safe repeated tool calls.
- `effort:` set consistently — flag any skill that inherits from session by default where a pinned level would give more predictable behavior.
- Any skill whose main phase is non-interactive and context-heavy (large git log/diff scans, sprint-scale reads) that should move to `context: fork`.

### Hooks

- `bash-guard.mjs`, `spec-gate-guard.mjs`, `injection-scan-guard.mjs`, `injection-gate-guard.mjs` (including its stage-3 canary check), and `canary-seed.mjs` regexes/exit-code/decision-output contract still match the current hooks.md schema (event names, stdin format, exit codes, `hookSpecificOutput` fields like `additionalContext` and `permissionDecision`).
- Any hook event from the current docs (`SessionStart`, `PreCompact`, `Stop`, etc.) that's missing here but would close a real gap — not "adopt everything," only what fixes something concrete.
- `bigin-harness-setup`'s settings.json merge logic (Phase 5-3) still matches how Claude Code actually merges hooks across scopes per current docs.

### Sub-agents

- Anything in this harness's workflow (review, security scan, QA) that current `sub-agents.md` guidance suggests fits a `.claude/agents/*.md` subagent better than a skill phase. Check whether a read-only security-reviewer subagent (discussed early in this harness's design, never built) still makes sense against current docs, or whether a skill step remains the better fit.

### Context budget & skill size

- Any `SKILL.md` over ~400 lines (of the 500-line cap) — name what should move to `references/`.
- Any `references/*.md` file not reachable via a link from its own `SKILL.md` — orphaned content.

### Plugin/marketplace structure

- `plugin.json` / `marketplace.json` still match current `plugins-reference.md` schema.
- Any new plugin-level field (`agents`, `mcpServers`, plugin-level `hooks`) worth adopting over the current per-profile generation approach — only if it removes duplication, not novelty for its own sake.

### Eval coverage

- `task-workflow/evals/evals.json` exists but the harness itself was unreliable last run (see audit-log if present). Should `bigin-harness-setup`, `nuxt-scaffold`, or `sprint-distill` get the same should-trigger/should-not-trigger treatment, given they also carry "MUST use when" descriptions that could regress silently on edits.

### Permissions

- `templates/merge/claude-settings.json` and the four profile `settings.json` templates (nuxt, next, go, nodejs): any `permissions.allow` entry broader than needed, or any common safe command missing that would cut permission-prompt friction.

### Everything else

- Anything in the fetched docs genuinely new since the last audit (new frontmatter field, new hook event, changed discovery/routing behavior) that this repo doesn't use and plausibly should.

## Phase 2: Report — STOP HERE

Output, then wait. Do not write or edit anything in this phase.

```
## Findings

| Dimension | Finding | Severity (blocking / drift / opportunity) | File:line |
|---|---|---|---|
...

## If I could only do one thing
<one paragraph>

## Closed since last audit
<items from audit-log.md marked Closed that this run reconfirmed, or "first run — no prior log">
```

Ask: "Act on any of these now, or just log the report?"

## Phase 3: Act (only on request, only what's approved)

If the user asks to act on specific findings, treat each one as its own `task-workflow`-scale change — spec gate for anything non-trivial, no batch-applying every finding silently.

## Phase 4: Update audit log

Append to `.claude/audit-log.md` (create if missing):

```
## {DATE}
Docs checked: <list, note any fetch failures>
New findings: <count by severity>
Closed this run: <list, or none>
Deferred (logged, not acted on): <list, or none>
```

This is what Phase 0 of the next run reads to avoid re-litigating closed items.

## References

- `.claude/rules/skill-authoring.md` — the conventions this audit checks compliance against
- `.claude/audit-log.md` (this repo, created on first run) — prior findings, closed/deferred status
- `skills/bigin-harness-setup/references/hook-guard.md` — current guard scripts, for the Hooks dimension
- `skills/sprint-distill/SKILL.md` — sibling propose-then-stop gate pattern this skill mirrors
