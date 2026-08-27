# Epic: Implementation logs — keep the history, not just the distillate

Status: approved
Approved: 2026-08-27

## Goal

`PLAN.md` and `EPIC.md` are deleted at cleanup today, so the only thing that survives a task
or an epic is whatever got distilled into a `knowledge/` concept — the invariant, never the
reasoning that produced it. Keep both as an append-only implementation log inside the
knowledge bundle. Done when a finished task and a finished epic each leave a durable,
validator-clean log entry, in a repo with a bundle and in a repo without one.

Provenance: a BigIn engineer's suggestion that keeping the history beats distilling and
tracking only the current state. It reverses a position `docs/KNOWLEDGE.md` states explicitly
(§6, "Per-task narrative in `knowledge/`" as a non-goal); unit 5 rewrites that into a
boundary rather than leaving the two in contradiction.

## Constraints

- **Each unit ships itself** — its own `CHANGELOG.md` entry and a version bump across the four
  manifest version fields (`.claude-plugin/plugin.json` is the source of truth;
  `.cursor-plugin/plugin.json` and two fields in `.cursor-plugin/marketplace.json` follow).
  `.claude-plugin/marketplace.json` carries no version field.
- **No OKF v0.2 divergence.** `RESERVED` stays `{index.md, log.md}` — those two are reserved by
  OKF §8-§9 and adding a third is a format fork. Log entries are ordinary concept files under a
  new allowed `type`, so the validator's shape is unchanged.
- **`knowledge/implementation/`, never `knowledge/logs/`.** `knowledge/log.md` already exists as
  OKF's per-sprint change history; two homes one character apart will be confused.
- **The log must not reach the always-loaded surface.** The index-first protocol reads
  `knowledge/index.md`; implementation logs get their own nested index and are not read
  preemptively. Budget gate at epic start: 8267/12000 chars, and it should not move.
- **Units 1 and 5 touch `bigin-harness-setup/references/knowledge-bundle.md`**, which is copied
  verbatim into target repos — each needs a CHANGELOG `patch` block or already-scaffolded repos
  never receive the change.
- **The no-bundle fallback is not optional.** Neither this repo nor most target repos have a
  `knowledge/` bundle. A bundle-only log means "never delete again" silently fails in the
  majority of repos, which is the whole point of the epic.

## Units

| # | Unit | Acceptance | Blocked by | Status | Notes |
|---|------|-----------|------------|--------|-------|
| 1 | Bundle format gains `knowledge/implementation/` and `type: implementation-log` | `knowledge-bundle.md`'s spec, frontmatter schema, allowed-`type` list, validator and templates all accept a log entry; a nested `knowledge/implementation/index.md` keeps entries index-reachable so the validator raises no unreachable warning; `RESERVED` is unchanged; a CHANGELOG `patch` block delivers it to already-scaffolded repos | — | Done | Shipped as **v1.76.0**. **Type is `Record`, not `implementation-log`** — `ALLOWED_TYPES` is capitalized single nouns (`Contract`, `Playbook`, `Constraint`) and `Log` is already a v0.1 `LEGACY_TYPES` entry the validator warns on, so the approved name would have shipped inconsistent and half-colliding. Folder is `implementation/` as approved. **The only code change is one entry in `ALLOWED_TYPES`** — everything else the format already supported, which is why there is no OKF divergence: `RESERVED` is untouched, records are ordinary concept files, and nested `index.md` files were already reachability *seeds* rather than leaves. That last property is load-bearing for the whole epic — appending a record touches `knowledge/implementation/index.md` and never the bundle-root index the index-first protocol reads, so a bundle with two hundred records costs the same per-session context as one with none. **A defect caught before shipping, twice, both the same species:** the root-index template links `/implementation/index.md`, so that file had to join Phase 5.5 step 2's canonical starter list in `bigin-harness-setup/SKILL.md` or every fresh scaffold would fail its own validator on a broken link; and the nested-index template originally carried an example record bullet, which would have been a second broken link — the template now says explicitly not to seed one. `knowledge-distill` Phase 0a reuses that starter list verbatim, so it follows automatically. Verified against an extracted copy of the patched validator on a real fixture, four cases: a `Record` linked from the nested index gives 0 errors 0 warnings; the same fixture on the pre-change validator errors `type 'Record' not in allowed list` (so the one line is what enables it, nothing else); an unlinked record warns `not reachable from an index.md` (so units 2-3 appending to the index is enforced, not merely instructed); and a fresh scaffold — empty index, zero records — is clean. Exit 1 on error, 0 on clean, so the pre-commit gate holds. Six CHANGELOG `patch` blocks (three spec anchors, the validator line, the root index, plus `create-if-missing` for the nested index); patch mode applies every block in an entry in order, so one entry carries all six. This repo has no `knowledge/` bundle, so the fixture in the session scratchpad is the only dogfooding available — kept out of the repo. Implement/verify loop not run: session is configured not to call the Agent tool unless asked. **For units 2-4:** the record body is the working file *verbatim*, not a summary — that is the point of the epic, so do not let a "concise" record slip in; and `Record` is exempt from the entire staleness policy, which unit 4 has to respect in `sprint-distill`'s sweep.
| 2 | `task-workflow` step 6 archives `PLAN.md` instead of deleting it | A finished task writes a validator-clean entry under `knowledge/implementation/` and `PLAN.md` is gone from the repo root; with no bundle present it writes `.claude/memory/PLAN.archive.<ISO>-<slug>.md` instead; the distill prompt is unchanged and the log entry does not restate the concept it proposed | 1 | Not started | |
| 3 | `epic-workflow` step 10 archives `EPIC.md` instead of deleting it | Same two paths as unit 2, for `EPIC.md`, including the `## Amendments` log; the epic-level distill prompt is unchanged | 1 | Not started | |
| 4 | `sprint-distill` exempts the log from its compression sweep | Its stale-concept sweep never proposes deleting or shrinking a `type: implementation-log` file, and says why in place; its per-sprint `knowledge/log.md` entry may cite implementation logs but never absorbs them | 1 | Not started | |
| 5 | Docs reconciliation | `docs/KNOWLEDGE.md` §6's "per-task narrative" non-goal is rewritten as a boundary (narrative → the log, invariant → a concept, neither restating the other), §3 and §5's mermaid cover the new home, and `docs/USER_GUIDE.md` + `README.md` describe cleanup as archiving rather than deleting | 2, 3, 4 | Not started | |

## Not in scope

- Backfilling logs for tasks and epics already shipped. The two existing
  `.claude/memory/*.archive.*.md` files stay where they are.
- Changing what gets distilled into a concept. The distill prompts in `task-workflow` step 6 and
  `epic-workflow` step 10 are untouched — this epic adds a second destination, it does not
  redirect the first.
- A retention or pruning policy for the log. Append-only is the point; if the bundle later needs
  one, that is its own decision.
