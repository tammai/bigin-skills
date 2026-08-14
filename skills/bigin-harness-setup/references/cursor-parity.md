# Cursor Parity

Phase 5.8. Runs only when `AGENT_HOSTS` includes `cursor`. Everything Cursor-specific lives here — no other reference file branches on the host.

**Claude Code is canonical.** `CLAUDE.md` and `.claude/rules/*.md` are the source of truth; `AGENTS.md` and `.cursor/rules/*.mdc` are generated from them by `tools/cursor_mirror.mjs` and carry a generated-file banner. Nothing in the Cursor tree is hand-edited, and `--check` in the pre-commit gate is what keeps that true.

The guards are **not** mirrored — one script body serves both hosts. `.claude/guards/lib/hook-io.mjs` (see `hook-guard.md` → `## lib/hook-io.mjs`) normalizes the payload differences and emits host-correct output; `.cursor/hooks.json` registers the same `.mjs` files that `.claude/settings.json` does.

---

## What maps to what

| Claude Code | Cursor | How |
|---|---|---|
| `CLAUDE.md` (always loaded) | `AGENTS.md` (always loaded) | generated mirror, body verbatim |
| `.claude/rules/<n>.md` + `paths:` | `.cursor/rules/<n>.mdc` + `globs:` | generated mirror, frontmatter translated |
| `.claude/settings.json` → `hooks` | `.cursor/hooks.json` → `hooks` | written once, per the template below |
| `PreToolUse` | `preToolUse` | same `tool_name` / `tool_input` field names |
| `PostToolUse` | `postToolUse` | `tool_response` → `tool_output` |
| `SessionStart` | `sessionStart` | `session_id` → `conversation_id` |
| `PreCompact` | `preCompact` | `compaction_trigger` → `trigger` |
| `.claude/guards/*.mjs` | same files | `lib/hook-io.mjs` adapts the payload |
| `scripts/pre-commit.sh`, `scripts/commit-msg.sh` | same files | git hooks are host-agnostic already |
| `.claude/skills/`, `skills/` | **not mirrored — already loaded** | Cursor discovers skills from Claude's directories too |
| `.claude/model-routing.json`, `knowledge/`, `graphify-out/` | not mirrored | read by skills, not by the host |

**Skills need no mirror at all.** Cursor discovers skills from `.cursor/skills/`, `.agents/skills/`, *and* Claude's own skill directories, and its `SKILL.md` frontmatter contract (`name` matching the folder, plus `description`) is a subset of Claude Code's. So a repo-local `.claude/skills/` is live in Cursor as-is; Claude-specific extras like `effort` are simply ignored there. Don't add a skills mirror — you'd be duplicating files that already load, and `tools/context_budget.mjs` would then count them twice.

Skill descriptions therefore count toward **both** hosts' always-loaded budgets once parity is installed. That's why `budget-gate.md` attributes them to Cursor as well.

What doesn't cross over is the *subagent ladder*: `model-router` spawns via Claude Code's Agent tool with a `model`/`effort` pin per tier, and Cursor's agents don't take those. Cursor reads `agents/*.md` for `name`/`description` and ignores the rest, so the roles exist but the routing doesn't. In Cursor, `/task-workflow`'s implement/verify loop is something the user drives rather than something the router fans out.

---

## Installing bigin-skills itself in Cursor

Separate from anything this skill writes into a target repo: the **plugin** is installable in Cursor, so a teammate there gets the same skills (`/task-workflow`, `/debug-workflow`, …) rather than only the generated gates.

`bigin-skills` ships two manifests, one per host, both at the repo root:

| Host | Manifest | Marketplace |
|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` | `.claude-plugin/marketplace.json` |
| Cursor | `.cursor-plugin/plugin.json` | `.cursor-plugin/marketplace.json` |

The Cursor manifest **points at the existing directories** (`"skills": "skills"`, `"agents": "agents"`) rather than requiring a Cursor-shaped layout — Cursor resolves those from declared paths, so nothing had to move and there is one copy of every skill.

```
/add-plugin                      # in Cursor's agent chat, or Customize → Plugins
```

For local development, symlink the checkout instead of installing:

```sh
ln -s "$(pwd)" ~/.cursor/plugins/local/bigin-skills
```

Three deliberate omissions from the Cursor manifest:

- **No `rules`.** This repo's `.claude/rules/` are conventions for *authoring bigin-skills*, not for the projects that install it. Shipping them would push repo-maintenance rules into every consumer's context.
- **No `hooks`.** The guards are per-repo: they read `PLAN.md`, `.claude/memory/`, and the git index relative to the project. Registering them plugin-wide would apply the spec gate to every project the user opens in Cursor. They belong in the target repo's `.cursor/hooks.json`, which is what Phase 5.8 writes.
- **No `mcpServers`.** There are none.

`tools/docs_sync.mjs --check` gates the two hosts' manifests against each other: `.claude-plugin/plugin.json`'s `version` is the source of truth, and a mismatch in any other manifest fails the commit by name. It also enforces Cursor's stricter component rules — every skill's `name` must equal its folder name, and every skill and agent needs a `description` — because Claude Code accepts files Cursor would reject or silently half-load.

---

## Frontmatter translation

Cursor `.mdc` frontmatter is not Claude Code's. Four differences, all handled by the mirror script:

1. **`paths:` (YAML list) → `globs:` (comma-separated bare string).** `paths: ["server/**", "app/**"]` becomes `globs: server/**, app/**`. No quotes, no brackets — Cursor splits on commas.
2. **Brace sets must be expanded.** `globs` splits on commas, so `**/*.{ts,tsx}` would be read as two broken patterns (`**/*.{ts` and `tsx}`). Expand to `**/*.ts, **/*.tsx` before writing. This is not optional — `comments.md` and the `generic` profile's rules both carry brace sets.
3. **`alwaysApply` is required to get scoping right.** A rule with globs needs `alwaysApply: false` or Cursor loads it every turn regardless. A rule with no `paths:` in the source gets `alwaysApply: true`.
4. **`.md` in `.cursor/rules/` is ignored.** Only `.mdc` is read there (plus `AGENTS.md` anywhere). A mirror written as `.md` is silently inert.

There is deliberately **no per-profile `globs` table anywhere.** The mirror derives every glob from the `paths:` the profile already wrote (`files-shared.md` → `## paths substitutions`), so a profile whose paths change needs no Cursor-side edit and the two can't drift. Adding such a table would create the second source of truth this whole file exists to avoid.

---

## AGENTS.md

Generated from `CLAUDE.md`: this banner, a blank line, then the `CLAUDE.md` body verbatim.

```markdown
<!-- Generated from CLAUDE.md by tools/cursor_mirror.mjs. Do not edit — edit CLAUDE.md and re-run `node tools/cursor_mirror.mjs`. -->
```

Both files are always-loaded, each for its own host, so `tools/context_budget.mjs` measures the two hosts separately and fails if *either* is over budget (see `budget-gate.md`). If your Claude Code version also picks up `AGENTS.md`, the brief loads twice in that client — the budget gate prints a combined figure so you can see it rather than discovering it in `/context`.

Cursor also reads nested `AGENTS.md` files in subdirectories. The harness doesn't generate any: path-scoped rules already cover that ground, and a second nesting mechanism would give the same rule two homes.

---

## .cursor/hooks.json

Write to `.cursor/hooks.json`. Same nine guards as `.claude/settings.json`, same script paths.

**No matchers, deliberately.** Cursor's matcher semantics differ per event (for `beforeShellExecution` it matches the *command string*, not the tool name), and a matcher that silently fails to match turns a gate off without any signal. Every guard already self-filters — `bash-guard` needs a command, `bugfix-test-guard` needs `git commit`, `spec-gate-guard` needs write-shaped input, `injection-scan-guard` needs a fetch-shaped call — so matcher-less registration costs a few no-op script runs and removes a whole class of silent-failure. Don't "optimize" this by adding matchers.

`failClosed: true` on the five blocking gates: Cursor fails open by default, so a crashed or timed-out gate would pass the call through. The four non-blocking hooks stay fail-open — a failed autosave or resume prompt is a missed convenience, not a reason to freeze the session.

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command", "command": "node .claude/guards/bash-guard.mjs", "failClosed": true },
      { "type": "command", "command": "node .claude/guards/bugfix-test-guard.mjs", "failClosed": true },
      { "type": "command", "command": "node .claude/guards/commit-msg-guard.mjs", "failClosed": true },
      { "type": "command", "command": "node .claude/guards/spec-gate-guard.mjs", "failClosed": true },
      { "type": "command", "command": "node .claude/guards/injection-gate-guard.mjs", "failClosed": true }
    ],
    "postToolUse": [
      { "type": "command", "command": "node .claude/guards/injection-scan-guard.mjs" }
    ],
    "sessionStart": [
      { "type": "command", "command": "node .claude/guards/canary-seed.mjs" },
      { "type": "command", "command": "node .claude/guards/session-resume-check.mjs" }
    ],
    "preCompact": [
      { "type": "command", "command": "node .claude/guards/precompact-snapshot.mjs" }
    ]
  }
}
```

If `.cursor/hooks.json` already exists, **merge per event** — append missing entries, never drop the user's. Same rule `.claude/settings.json` follows.

`lint-fix-file.mjs` is not registered here. Cursor's `afterFileEdit` hook accepts no output and the format-on-save path is the editor's own ESLint integration, so a hook that rewrites the file underneath Cursor's editor buffer is a conflict, not a convenience. Nuxt/next repos keep format-on-save through `.vscode/settings.json`, which Cursor reads (it's a VS Code fork).

### One behavior degrades

Cursor's `preToolUse` response accepts `allow` and `deny` — there is no `ask`. `injection-gate-guard.mjs`'s stage-2 heuristic wants `ask` (the flag is a heuristic, not proof). Under Cursor `lib/hook-io.mjs` degrades it to `deny` and says so in the message, so the agent surfaces the flagged content to the user instead of proceeding. Stricter than Claude Code, never looser. Stage 3 (canary) is `deny` on both hosts and doesn't degrade.

---

## tools/cursor_mirror.mjs

Write to `tools/cursor_mirror.mjs`. Zero dependencies. Two modes: bare regenerates the mirror, `--check` exits 1 on drift without writing (what the pre-commit gate and CI run).

```javascript
#!/usr/bin/env node
// Regenerates the Cursor mirror from the canonical Claude Code harness files:
//   CLAUDE.md            -> AGENTS.md
//   .claude/rules/*.md   -> .cursor/rules/*.mdc   (paths: -> globs:, braces expanded)
//
// `--check` writes nothing and exits 1 if any mirror is missing, stale, or orphaned —
// that's the pre-commit/CI mode. Bare invocation writes the mirror.
//
// The mirror is generated, never hand-edited. Edit the source and re-run this.
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const CHECK = process.argv.includes('--check')
const BANNER_SRC = 'CLAUDE.md'
const RULES_SRC = '.claude/rules'
const RULES_OUT = '.cursor/rules'

function banner(source) {
  return `<!-- Generated from ${source} by tools/cursor_mirror.mjs. Do not edit — edit ${source} and re-run \`node tools/cursor_mirror.mjs\`. -->`
}

// Splits a file into [frontmatter, body]. Frontmatter is null when absent.
function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) return [null, text]
  const end = text.indexOf('\n---\n', 4)
  if (end === -1) return [null, text]
  return [text.slice(4, end), text.slice(end + 5)]
}

// Pulls the `paths:` YAML list out of frontmatter. Returns [] when there is none.
function readPaths(frontmatter) {
  if (frontmatter === null) return []
  const out = []
  let inPaths = false
  for (const line of frontmatter.split('\n')) {
    if (/^paths:/.test(line)) {
      inPaths = true
      continue
    }
    if (inPaths) {
      const item = line.match(/^\s*-\s*(.+?)\s*$/)
      if (!item) break
      out.push(item[1].replace(/^["']|["']$/g, ''))
    }
  }
  return out
}

// Cursor splits `globs` on commas, so a brace set like **/*.{ts,tsx} would arrive as
// two broken patterns. Expand it into one glob per alternative instead.
function expandBraces(glob) {
  const m = glob.match(/^(.*)\{([^{}]*)\}(.*)$/)
  if (!m) return [glob]
  return m[2].split(',').flatMap(alt => expandBraces(`${m[1]}${alt.trim()}${m[3]}`))
}

function toMdc(name, text) {
  const [frontmatter, body] = splitFrontmatter(text)
  const globs = readPaths(frontmatter).flatMap(expandBraces)
  const head = globs.length > 0
    ? `---\nglobs: ${globs.join(', ')}\nalwaysApply: false\n---`
    : '---\nalwaysApply: true\n---'
  return `${head}\n${banner(join(RULES_SRC, name))}\n${body.replace(/^\n+/, '\n')}`
}

// { path, content } for every file the mirror should contain, in a stable order.
function expected() {
  const out = []
  if (existsSync(BANNER_SRC)) {
    out.push({ path: 'AGENTS.md', content: `${banner(BANNER_SRC)}\n\n${readFileSync(BANNER_SRC, 'utf-8')}` })
  }
  if (existsSync(RULES_SRC)) {
    for (const name of readdirSync(RULES_SRC).filter(f => f.endsWith('.md')).sort()) {
      out.push({
        path: join(RULES_OUT, `${name.replace(/\.md$/, '')}.mdc`),
        content: toMdc(name, readFileSync(join(RULES_SRC, name), 'utf-8'))
      })
    }
  }
  return out
}

// .mdc files under .cursor/rules/ with no corresponding .claude/rules/ source. A rule
// deleted from the canonical tree has to disappear here too, or it keeps applying.
function orphans(want) {
  if (!existsSync(RULES_OUT)) return []
  const keep = new Set(want.map(f => f.path))
  return readdirSync(RULES_OUT)
    .filter(f => f.endsWith('.mdc'))
    .map(f => join(RULES_OUT, f))
    .filter(p => !keep.has(p))
    .sort()
}

const want = expected()
const stale = want.filter(f => !existsSync(f.path) || readFileSync(f.path, 'utf-8') !== f.content)
const extra = orphans(want)

if (CHECK) {
  if (stale.length === 0 && extra.length === 0) {
    console.log(`OK Cursor mirror up to date (${want.length} file(s))`)
    process.exit(0)
  }
  for (const f of stale) console.log(`ERROR ${f.path} is missing or out of date`)
  for (const p of extra) console.log(`ERROR ${p} has no .claude/rules/ source`)
  console.log('\nRun `node tools/cursor_mirror.mjs` and commit the result. Edit the canonical file, never the mirror.')
  process.exit(1)
}

if (want.some(f => f.path.startsWith(`${RULES_OUT}/`))) mkdirSync(RULES_OUT, { recursive: true })
for (const f of stale) writeFileSync(f.path, f.content)
for (const p of extra) unlinkSync(p)
console.log(`Cursor mirror written: ${stale.length} updated, ${extra.length} removed, ${want.length} total`)
```

### Wire `--check` into the gates

1. **Pre-commit.** If `scripts/pre-commit.sh` exists (Phase 5-1 created it), append a step running `node tools/cursor_mirror.mjs --check`, guarded the same way the budget check is: `if [ -f tools/cursor_mirror.mjs ]`. If the repo uses `simple-git-hooks`/`husky` instead, add the same command to that config.
2. **CI.** If Phase 5.6 generates CI in this same run, merge `ci.md` → `## cursor-mirror step: github` / `## cursor-mirror step: gitlab`. Foreign, hand-written CI is never edited — note in the Phase 7 summary that the step should be added there by hand.

---

## Procedure (Phase 5.8)

Skip everything if `AGENT_HOSTS` doesn't include `cursor`.

1. Write `tools/cursor_mirror.mjs` from the section above. Skip if `INSTALL_MODE=new` and it exists.
2. Run `node tools/cursor_mirror.mjs` — it generates `AGENTS.md` and every `.cursor/rules/*.mdc` from whatever the canonical tree ended up containing. Run it **here**, after Phases 3, 5.5, and 5.7, so `knowledge.md` and `graph.md` are mirrored too if they were installed. Never hand-write a mirror file; a mismatch between what the script would produce and what's on disk fails the gate on the next commit.
3. Write `.cursor/hooks.json` from the template above (merge per event if it exists).
4. Wire `--check` into the gates per the two steps above.
5. Add nothing to `.gitignore`. `AGENTS.md` and `.cursor/` are committed, like `.claude/` — a teammate opening the repo in Cursor has to get them from the clone, and `--check` compares committed state.

Idempotent: step 2 is a no-op when the mirror is already current, and `.cursor/hooks.json` merges.

---

## Testing the mirror by hand

```bash
node tools/cursor_mirror.mjs --check   # expect 0 on a clean tree
printf '\n- extra rule\n' >> .claude/rules/security.md
node tools/cursor_mirror.mjs --check   # expect 1, naming .cursor/rules/security.mdc
node tools/cursor_mirror.mjs           # regenerate
node tools/cursor_mirror.mjs --check   # expect 0 again
git checkout .claude/rules/security.md && node tools/cursor_mirror.mjs
```

The cases the script must still get right, if you change it: a rule with no `paths:` gets `alwaysApply: true` and no `globs`; a brace set expands to one glob per alternative with no stray `{`/`}` surviving; a quoted YAML path loses its quotes; a `.mdc` whose source was deleted is reported by `--check` and removed by a bare run; `--check` writes nothing, ever.
