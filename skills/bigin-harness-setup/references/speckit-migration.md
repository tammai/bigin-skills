# Phase 0.7: Spec Kit Migration

Procedure for a repo already running [GitHub Spec Kit](https://github.com/github/spec-kit). Runs before Phase 1's harness detection, because the outcome changes what Phase 1 finds.

Spec Kit and this harness answer the same question — how does a non-trivial change get from idea to merged code — with opposite bets. Spec Kit is **spec-as-artifact**: `specs/<nnn>-<slug>/` is the durable record, code is its output. The harness is **spec-as-scaffolding**: `PLAN.md` is disposable process, and the durable record is the code plus the `knowledge/` bundle. Running both means two competing drivers and one dead gate; the point of this phase is to pick one deliberately rather than by accident.

---

## Detection

Check for any of these. The layout differs by Spec Kit version, and the difference matters — only the older one writes to `CLAUDE.md`.

| Marker | Layout | Note |
|---|---|---|
| `.claude/skills/speckit[-.]*/SKILL.md` | current | Spec Kit ships skills; ~10 of them, all always-loaded |
| `.claude/commands/speckit[-.]*.md`, or `specify.md` + `plan.md` + `tasks.md` together | older | ships slash commands instead |
| `CLAUDE.md` containing a `MANUAL ADDITIONS` marker or a Spec Kit-authored block | older only | written by `.specify/scripts/*/update-agent-context.sh` |
| `.specify/` | both | templates, scripts, `memory/constitution.md`, per-feature state in `feature.json` |
| `specs/<nnn>-<slug>/spec.md` | both | feature artifacts |

Set `SPECKIT = migrate | coexist | none`. If no marker is found, `none` — skip this entire phase.

`.specify/scripts/*/update-agent-context.sh` present (older layout) is the one hard incompatibility: it rewrites `CLAUDE.md` on every plan run and will clobber the harness brief. Say so explicitly when it's there.

---

## The decision

Fold into Phase 1.5's bundled `AskUserQuestion` as an additional question — never ask it standalone:

```
Spec Kit detected ({N} features under specs/, {M} skills/commands installed). How should it be handled?
1. migrate (default) — triage specs/, salvage what's durable, remove Spec Kit, install the harness as the only workflow
2. coexist — install the harness as governance only; Spec Kit stays the driver (see caveats below)
3. leave it — install nothing this run, stop after this phase
```

---

## `coexist` — governance only

Valid when a team isn't ready to move. Three changes to the normal install:

1. **Omit `spec-gate-guard.mjs` from `.claude/settings.json`** (Phase 5-2b still writes the script; just don't register the hook). It resolves the governing plan as root `PLAN.md` only, so with Spec Kit driving it blocks every `/speckit-implement` edit over 20 lines while Spec Kit's own `specs/<branch>/plan.md` goes unread. Note the omission in the Phase 7 summary so it's a decision on record, not a silent gap.
2. **Older layout → `INSTALL_MODE=new`** so Phase 2 preserves the Spec Kit block in `CLAUDE.md`; then tell the user which harness sections to merge in by hand.
3. **Warn on budget.** `tools/context_budget.mjs` counts `.claude/skills/*/SKILL.md` descriptions as always-loaded. Spec Kit's ten cost ~1 150 chars of the 12 000 limit — real, and spent on a workflow that's being kept in parallel with its replacement.

Everything else installs normally: the other guards, the budget gate, CI, and the knowledge bundle are all orthogonal to Spec Kit and collide with nothing.

---

## `migrate` — ordered procedure

Never delete anything in steps 1–5. Deletion happens once, in step 6, after the user has seen the triage table.

### 1. Safety tag

```sh
git tag pre-harness-migration
```

Everything below is recoverable from that tag. Say so — it's what makes the rest of the procedure a low-stakes decision.

### 2. Triage

Write `tools/speckit-triage.mjs` (template below), run it, and show the table verbatim. It is read-only. Delete the script in step 6.

### 3. Reconcile contracts — do this before anything else

Every `specs/*/contracts/` file is either already merged into the repo's real contract (`openapi.yaml` / `openapi.json`) or it is silent drift. This is the **only** category where deleting `specs/` loses something not reconstructible from code and git history. Diff each one against the live contract and report mismatches; don't resolve them silently.

### 4. Distill shipped features

One pass over all shipped specs, not one per spec. Concepts are per-invariant, not per-feature — twenty shipped features typically collapse into a handful of `knowledge/` concepts (`auth-model`, `tenancy-rule`, `contract-versioning`). Requires `KNOWLEDGE_BUNDLE = true`; if the user declined the bundle in Phase 1.5, say plainly that the "why" in `specs/` has nowhere to go and offer to reverse that choice.

Every new concept file needs a summary line in `knowledge/index.md` or `tools/knowledge_validate.mjs` warns it's unreachable. A bundle that mirrors `specs/` one-to-one makes the index useless, which defeats the index-first read protocol.

### 5. Convert in-flight features

`PLAN.md` is singular. For each in-flight feature, fold `spec.md` + `tasks.md` into the `PLAN.md` format from `task-workflow` — spec, then task table, `Status: approved`, and a `Branch:` line naming the branch it belongs to.

Convert **one** into the working tree. If the triage found more than one in-flight, the others need a `git worktree` each (`references/parallelization.md` in `task-workflow`, hard cap 3–4) or a queue. More in-flight features than worktrees you're willing to run is a WIP problem the migration surfaced, not a migration problem — name it as such rather than converting them all into files that can't be active.

### 6. Remove

Confirm the list first, then:

```sh
rm -rf .specify specs tools/speckit-triage.mjs
rm -rf .claude/skills/speckit[-.]*          # current layout
rm -f .claude/commands/speckit[-.]*.md       # older layout — check for un-prefixed names too
```

Older layout also: strip the Spec Kit block from `CLAUDE.md` (Phase 2 then writes it fresh), and tell the user to unset `SPECIFY_FEATURE` / `SPECIFY_FEATURE_DIRECTORY` if either is exported from a shell profile.

### 7. Continue

Set `SPECKIT = migrate` done, and fall through to Phase 1. There is now no existing-harness conflict unless the repo had one independently of Spec Kit.

---

## Workflow mapping

State this when asked what's lost. Nine of the ten map onto something; one doesn't.

| Spec Kit | Harness equivalent |
|---|---|
| `speckit-specify`, `speckit-plan`, `speckit-tasks` | `task-workflow` steps 1–3 (scope → spec gate → `PLAN.md`) |
| `speckit-implement` | `task-workflow` step 4, implement/verify loop |
| `speckit-converge` | the verifier's `FAIL` → resume-implementer loop, capped at 3 rounds |
| `speckit-clarify` | the spec gate itself — approval is where ambiguity gets resolved |
| `speckit-analyze` | `verifier` audits the diff against `PLAN.md` independently |
| `speckit-checklist` | `AI_REVIEW_CHECKLIST.md` + `/code-review` |
| `speckit-constitution` | `CLAUDE.md` + path-scoped `.claude/rules/` |
| `speckit-taskstoissues` | **none.** Nothing in the harness turns tasks into tracker issues. If a team relies on it, that's a skill someone has to write against `PLAN.md`'s task table — surface the gap before deleting, don't discover it after. |

---

## tools/speckit-triage.mjs

Read-only classifier. Deletes nothing, writes nothing.

```javascript
#!/usr/bin/env node
// Spec Kit → harness migration triage. Classifies every specs/<feature>/ directory.
// Read-only: prints a plan, changes nothing.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const SPECS = 'specs'
if (!existsSync(SPECS)) {
  console.log('No specs/ directory — nothing to triage.')
  process.exit(0)
}

const PLACEHOLDER = /\[FEATURE NAME\]|\[NEEDS CLARIFICATION/
const rows = []

for (const name of readdirSync(SPECS).sort()) {
  const dir = join(SPECS, name)
  if (!statSync(dir).isDirectory()) continue
  const read = f => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), 'utf-8') : null)
  const spec = read('spec.md')
  const tasks = read('tasks.md')
  const done = tasks ? (tasks.match(/^- \[[Xx]\]/gm) ?? []).length : 0
  const open = tasks ? (tasks.match(/^- \[ \]/gm) ?? []).length : 0

  let state
  if (!tasks) state = 'never-planned'
  else if (open === 0 && done > 0) state = 'shipped'
  else if (done > 0) state = 'in-flight'
  else state = 'planned-not-started'

  let lastTouch = '—'
  try {
    lastTouch = execSync(`git log -1 --format=%as -- ${dir}`, { encoding: 'utf-8' }).trim() || '(uncommitted)'
  } catch {}

  rows.push({
    name,
    state,
    spec: !spec ? 'missing' : PLACEHOLDER.test(spec) ? 'placeholder' : 'written',
    progress: tasks ? `${done}/${done + open}` : '—',
    contracts: existsSync(join(dir, 'contracts')) ? readdirSync(join(dir, 'contracts')).length : 0,
    rationale: ['research.md', 'data-model.md', 'quickstart.md'].filter(f => existsSync(join(dir, f))).length,
    lastTouch
  })
}

const ACTION = {
  shipped: 'salvage → delete',
  'in-flight': 'CONVERT to PLAN.md',
  'never-planned': 'backlog line → delete',
  'planned-not-started': 'backlog line → delete'
}

const cols = ['name', 'state', 'spec', 'progress', 'contracts', 'rationale', 'lastTouch']
const w = c => Math.max(...rows.map(r => String(r[c]).length), c.length)
console.log(cols.map(c => c.padEnd(w(c))).join('  ') + '  action')
console.log(cols.map(c => '-'.repeat(w(c))).join('  ') + '  ------')
for (const r of rows) console.log(cols.map(c => String(r[c]).padEnd(w(c))).join('  ') + '  ' + ACTION[r.state])

const by = s => rows.filter(r => r.state === s).length
const inflight = by('in-flight')
console.log(
  `\n${rows.length} features: ${by('shipped')} shipped, ${inflight} in-flight, ` +
    `${by('never-planned') + by('planned-not-started')} never built`
)
console.log(
  `salvage inputs: ${rows.reduce((n, r) => n + r.contracts, 0)} contract files, ` +
    `${rows.reduce((n, r) => n + r.rationale, 0)} rationale docs`
)
if (inflight > 1) {
  console.log(`\n!! ${inflight} in-flight features but PLAN.md is singular — sequence them, or one git worktree each.`)
}
```

A `spec: placeholder` row still carrying `[NEEDS CLARIFICATION` markers is usually a dead draft, but check a couple by hand before mass-deleting — some teams leave those markers in specs they did build.
