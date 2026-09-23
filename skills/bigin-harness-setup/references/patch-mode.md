# Phase 1a: Patch Mode (`INSTALL_MODE=patch` only)

Self-contained — skip Phases 1.5 through 8 entirely when this runs; it ends with its own summary below.

Usually reached because the plugin's `SessionStart` notice (`hooks/harness-drift-check.mjs`) said this repo has unapplied patch blocks. That notice counts blocks rather than versions, so if it fired there is something here to apply.

1. **Read the installed version.** Look for `.claude/harness-version` in the target repo.
   - Found → that's `FROM_VERSION`.
   - Missing → ask: `No .claude/harness-version found — which bigin-skills version was this harness last set up or patched with? (check git log for a "bigin-harness-setup" commit, or CHANGELOG.md history)`. If the user doesn't know, tell them patch mode can't determine a safe starting point and suggest `yes` (full overwrite, diffed first) or `new` instead, then stop.

2. **Read the current version.** From this plugin's own `.claude-plugin/plugin.json` → `version`. Call it `TO_VERSION`. If `FROM_VERSION == TO_VERSION`, tell the user the harness is already current and stop.

3. **Collect eligible changes.** Read this plugin's own `CHANGELOG.md`. For every version strictly between `FROM_VERSION` (exclusive) and `TO_VERSION` (inclusive), in ascending order — **compare the three components numerically, not as text**: `1.100.0` is newer than `1.99.0`, and sorting those as strings silently skips every block in between — extract every fenced ` ```patch ` block in that entry (format in `.claude/rules/skill-authoring.md`). Entries with no `patch` block are informational-only for target repos — skip them.

4. **Apply each patch block, in order:**
   - **`mode: create-if-missing` blocks** (`target` + full file content, no `anchor`/`insert` — used for a wholly new file with nothing existing to anchor against, e.g. a new guard script):
     - `target` already exists in this repo → skip, note "already present, left untouched".
     - `target` missing → write the content verbatim as the new file, note "created".
   - **Anchor-based blocks** (`target` + `anchor` + `insert`):
     - If `target` doesn't exist in this repo (e.g. `knowledge/constraints/agent-rules.md` when Knowledge Bundle was declined) → skip, note "target not present (feature not installed)".
     - Search `target` for the `anchor` string, matched on content (ignore each line's leading/trailing whitespace — indentation varies by context, e.g. a numbered-list continuation line).
       - Found → apply the operation: `insert: after` / `insert: before` (add `content` as a new line adjacent to `anchor`, reusing the anchor line's own indentation, and keep `anchor`) or `insert: replace` (replace the matched `anchor` text with `content`, preserving the anchor's indentation).
       - Not found (likely hand-edited) → skip, note "anchor not found — apply manually, see CHANGELOG.md vX.Y.Z".
     - **`optional: true` on the block** → an anchor miss is *expected*, not a problem: the line exists only in some profiles (a guard this repo never installed, a hook another stack registers). Skip it **silently** — leave it out of both lists. Use it only where the block's own release says the target may legitimately be absent; a block without it still reports a miss, which is how a hand-edited file gets noticed.
     - Never fuzzy-match on *meaning* — the anchor's words must match exactly (whitespace aside). An exact-match miss is a skip, not a best-effort insert.
   - **A block carrying `resolve: SPEC_PATH`** is an anchor-based block whose content holds `{SPEC_PATH}`, which no static block can know: where a repo vendors its contract is a property of *that* repo. Before matching, run this in the target repo and substitute the result (one line per contract, at the placeholder line's own indentation):
     ```sh
     node ${CLAUDE_PLUGIN_ROOT}/skills/contract-sync/scripts/contract_sync.mjs where
     ```
     - The command needs no lock, no network and no credentials. It exits non-zero only when it cannot tell (two candidate specs on disk, or a repo type it does not recognise) → skip the block and note "could not resolve the vendored spec path — apply manually", never substitute a guess.
     - **If the substituted content equals what is already in `target`, skip it** and say nothing: the repo is already correct, and this is the common case for a repo whose layout matches its scaffolder's default.

5. **Write `.claude/harness-version`** with `TO_VERSION`, even if some patches were skipped — re-running patch mode later shouldn't replay changes that already landed or were already flagged from this version range.

6. **Print a patch summary:**
   ```
   Patched harness: {FROM_VERSION} → {TO_VERSION}

   Applied:
     AI_TASK_GUIDE.md            (v1.22.10: security considerations line)
     AI_REVIEW_CHECKLIST.md      (v1.22.10: security checklist bullet)
     .claude/rules/security.md   (v1.22.10: plan-for-it bullet)
     .claude/guards/injection-scan-guard.mjs (v1.26.0: created — new file)

   Skipped (needs manual review):
     knowledge/constraints/agent-rules.md — anchor not found (v1.22.10) — likely hand-edited; see CHANGELOG.md

   .claude/harness-version updated to {TO_VERSION}.
   ```

   A `create-if-missing` block whose `target` already exists is a silent no-op — nothing needs manual review, so it doesn't appear in either list.
