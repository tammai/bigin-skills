---
name: sprint-distill
description: "Distills merged PRs and touched knowledge/ concepts since the last sprint-log entry into knowledge/ updates and bigin-skills convention updates, proposal-first — replaces a manual NotebookLM end-of-sprint pass. MUST use when user says: 'sprint distill', 'distill this sprint', 'distill the sprint', 'run sprint distill', 'end of sprint', 'end-of-sprint review', 'chưng cất sprint', 'tổng kết sprint', 'compile sprint knowledge'. Do NOT use for a single PR, single change, or one-off code review — use /code-review or /review instead; this skill only operates on a sprint-scale date range."
---

# sprint-distill

Turns a sprint's worth of merged work into `knowledge/` updates and `bigin-skills` convention updates — proposal-first, nothing writes until you approve it. Classifies every candidate learning as WHAT/WHY (→ `knowledge/`), HOW-we-work (→ `bigin-skills`), or neither (dropped, but reported). Never both.

**Distillation compresses, never just appends.** Net line delta for `CLAUDE.md` and `.claude/rules/` should be ≤0 across a sprint unless there is explicit budget headroom. Every addition must name what it replaces or compresses.

---

## Phase 0: Scope Confirmation

**Anti-trigger check first.** If the request is actually about one PR, one commit, or one change — not a sprint-scale range — stop and point to `/code-review` or `/review` instead. Do not proceed.

**Determine `SPRINT_START`:**

1. Check whether `knowledge/` exists in this repo.
   - **Missing entirely** → this repo hasn't opted into the Knowledge Bundle. Ask:
     ```
     No knowledge/ bundle found in this repo. Options:
     1. skills-only — distill this sprint's HOW-we-work learnings into bigin-skills
        only; skip knowledge/ classification. I'll ask you for a start date.
     2. bootstrap — set up the Knowledge Bundle first (via bigin-harness-setup),
        then re-run sprint-distill
     ```
     Store `KB_MODE = skills-only` or stop for option 2. If `skills-only`, ask for `SPRINT_START` directly (a date or git ref) since there's no `log.md` cursor.
   - **Exists** → set `KB_MODE = full`. Read `knowledge/log.md`.
     - Last dated `## {DATE}` entry found → `SPRINT_START` = that date.
     - `log.md` exists but has no dated entries yet (fresh bundle) → ask the user for a start date.

2. **Surface version drift.** If this skill is running from a `bigin-skills` git submodule, best-effort print its pinned commit/version (e.g. short SHA or `.claude-plugin/plugin.json` version) so any lag behind the upstream template is visible up front. Don't fail the run if this can't be resolved.

---

## Phase 1: Gather Inputs

1. `git log` merged commits/PRs on the main branch since `SPRINT_START` — titles + bodies.
2. `git diff --stat SPRINT_START..HEAD -- knowledge/` (if `KB_MODE = full`) — concept files touched this sprint.
3. Current `.claude/rules/*.md` — read so you don't re-propose a convention that's already documented.
4. **Stale-rules scan**: for each file in `.claude/rules/` and `CLAUDE.md`, identify the most recent `git log` entry that touched it. Flag any file with no merged PR touching it in the 2 sprints since `SPRINT_START` as a deletion candidate. Output as a list: `{file} — last touched {date}, {N} sprints ago`.
5. Ask the user:
   ```
   Any out-of-repo material for this sprint? (meeting notes, transcripts, client
   docs — paste directly, or say none)
   ```
   Treat pasted material as additional candidate learnings, classified identically to git-derived ones in Phase 2 — no separate pipeline.

---

## Phase 2: Classify

If `KB_MODE = full`, read `knowledge/meta/knowledge-bundle-spec.md` before classifying — this is the authoritative spec; don't restate it here, link to it.

For every candidate learning gathered in Phase 1, apply the sorting rule strictly:

- **WHAT/WHY the system is** (a domain concept, a contract, a system boundary, a constraint that will outlive this sprint) → `knowledge/` concept file (new or update to an existing one).
- **HOW we work** (a convention, a gate, a process change) → a `bigin-skills` update (`.claude/rules/*`, a `SKILL.md`, a reference file).
- **Neither** (noise, a one-off, something already covered) → drop, but report it in the proposal so nothing silently vanishes.
- **Never both.** If a candidate seems to span both, pick the side it primarily belongs to and link to the other rather than writing it twice.

Bias toward DROP when uncertain — `knowledge/` concept files are terse by design; don't grow the bundle to record something obvious or already covered.

**Net-neutral rule**: any proposed addition to `.claude/rules/` or `CLAUDE.md` must either:
- (a) name the rule or text it replaces or compresses (e.g. "replaces the 3-line BFF section"), OR
- (b) cite specific budget headroom (e.g. "CLAUDE.md is at 38/60 lines; adding 4 lines is within budget")

Proposals that just append without a corresponding compression are reclassified as neither-WHAT-nor-HOW and dropped.

**Stale-concept detection** (if `KB_MODE = full`, first-class output, not an afterthought):
- Any concept file whose `resource:`/citation target appears in this sprint's diff, but the concept file itself wasn't updated — flag as possibly stale.
- Any concept file unreachable from `knowledge/index.md` — flag (mirrors what `tools/knowledge_validate.py` warns on).

**Hard constraints while drafting** (non-negotiable, apply regardless of what a candidate learning suggests):
- Concept files ≤ ~60 lines. Terse beats complete.
- Link, don't copy — point at `openapi.yaml`, `.claude/rules/`, source code; never duplicate their content into `knowledge/`.
- Never touch source code, `openapi.yaml`, or migrations. `sprint-distill` only writes to `knowledge/` and `bigin-skills`-side files.
- Follow `knowledge/meta/knowledge-bundle-spec.md` for frontmatter and structure.

---

## Phase 3: Propose — STOP HERE

Output a single structured proposal and **wait for explicit approval before writing anything**:

```
## Knowledge changes
- [new/update] knowledge/<path>.md — <one-line reason>
  ...

## Skills changes
- [new/update] <path> — <one-line reason> [replaces: <what it compresses>]
  ...

## Draft log entry (knowledge/log.md, appended last on approval)
## {DATE}
<summary of what changed in the bundle this sprint>

## Dropped candidates (reported, not written)
- <candidate> — <why it was dropped>
  ...

## Stale-concept flags
- knowledge/<path>.md — <why it looks stale>
  ...

## Deletion candidates (rules untouched for 2+ sprints)
- <file> — last touched <date>; recommend: delete / compress to N lines / keep (reason)
  ...

## Net-neutral check
CLAUDE.md: <current lines> / 60. Rules delta this sprint: +<added> -<removed> = <net> lines.

Approve all / approve some (list which) / request edits?
```

If the user asks for edits, revise and re-propose before applying — don't reinterpret silently.

---

## Phase 4: Apply

Only after explicit approval, and only the items approved:

1. Write approved `knowledge/` changes.
2. Write approved `bigin-skills` changes.
3. **Validator, best-effort:** if `KB_MODE = full` and `tools/knowledge_validate.py` exists at the repo root, run it (`uv run tools/knowledge_validate.py`). If it's missing or errors, don't block — note in the Phase 5 summary that validation didn't run and should be checked manually.
4. Append the `knowledge/log.md` entry **last**, only after the above succeed.

---

## Phase 5: Summary

```
sprint-distill complete for <SPRINT_START>..HEAD

Written:
  knowledge/: <list, or none>
  bigin-skills: <list, or none>

Dropped: <count> (see proposal for reasons)
Stale-concept flags: <count, or none>
Deletion candidates actioned: <count, or none>
Net delta: CLAUDE.md <N> lines, .claude/rules/ <+X/-Y> lines
Validator: [passed | not run — verify manually | not applicable (skills-only mode)]
Log entry: knowledge/log.md updated
```

---

## References

- `knowledge/meta/knowledge-bundle-spec.md` (consumer repo) — authoritative frontmatter/structure/staleness spec; read, never copied
- `knowledge/log.md` (consumer repo) — sprint cursor and log target
- `tools/knowledge_validate.py` (consumer repo, if Knowledge Bundle opted in) — best-effort validation in Phase 4
