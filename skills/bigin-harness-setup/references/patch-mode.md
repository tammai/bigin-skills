# Phase 1a: Patch Mode (`INSTALL_MODE=patch` only)

Self-contained — skip Phases 1.5 through 8 entirely when this runs; it ends with its own summary below.

1. **Read the installed version.** Look for `.claude/harness-version` in the target repo.
   - Found → that's `FROM_VERSION`.
   - Missing → ask: `No .claude/harness-version found — which bigin-skills version was this harness last set up or patched with? (check git log for a "bigin-harness-setup" commit, or CHANGELOG.md history)`. If the user doesn't know, tell them patch mode can't determine a safe starting point and suggest `yes` (full overwrite, diffed first) or `new` instead, then stop.

2. **Read the current version.** From this plugin's own `.claude-plugin/plugin.json` → `version`. Call it `TO_VERSION`. If `FROM_VERSION == TO_VERSION`, tell the user the harness is already current and stop.

3. **Collect eligible changes.** Read this plugin's own `CHANGELOG.md`. For every version strictly between `FROM_VERSION` (exclusive) and `TO_VERSION` (inclusive), in ascending order, extract every fenced ` ```patch ` block in that entry (format in `.claude/rules/skill-authoring.md`). Entries with no `patch` block are informational-only for target repos — skip them.

4. **Apply each patch block, in order:**
   - If `target` doesn't exist in this repo (e.g. `knowledge/constraints/agent-rules.md` when Knowledge Bundle was declined) → skip, note "target not present (feature not installed)".
   - Search `target` for the `anchor` string, matched on content (ignore each line's leading/trailing whitespace — indentation varies by context, e.g. a numbered-list continuation line).
     - Found → apply the operation: `insert: after` / `insert: before` (add `content` as a new line adjacent to `anchor`, reusing the anchor line's own indentation, and keep `anchor`) or `insert: replace` (replace the matched `anchor` text with `content`, preserving the anchor's indentation).
     - Not found (likely hand-edited) → skip, note "anchor not found — apply manually, see CHANGELOG.md vX.Y.Z".
   - Never fuzzy-match on *meaning* — the anchor's words must match exactly (whitespace aside). An exact-match miss is a skip, not a best-effort insert.

5. **Write `.claude/harness-version`** with `TO_VERSION`, even if some patches were skipped — re-running patch mode later shouldn't replay changes that already landed or were already flagged from this version range.

6. **Print a patch summary:**
   ```
   Patched harness: {FROM_VERSION} → {TO_VERSION}

   Applied:
     AI_TASK_GUIDE.md            (v1.22.10: security considerations line)
     AI_REVIEW_CHECKLIST.md      (v1.22.10: security checklist bullet)
     .claude/rules/security.md   (v1.22.10: plan-for-it bullet)

   Skipped (needs manual review):
     knowledge/constraints/agent-rules.md — anchor not found (v1.22.10) — likely hand-edited; see CHANGELOG.md

   .claude/harness-version updated to {TO_VERSION}.
   ```
