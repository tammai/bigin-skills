# Phase 1b: Verify Mode (`INSTALL_MODE=verify` only)

Self-contained — skip Phases 1.5 through 8 entirely when this runs; it ends with its own summary below.

Verify mode **installs nothing**. No rule file, no guard, no CI config, no pre-commit hook — and it does not touch `.claude/harness-version`, because no version changed: nothing was installed. The only file it may edit is the target repo's own `CLAUDE.md`.

**Shrink, don't append.** Every fix is made in place — the stale line is rewritten, or the stale row is removed. Never append a correction, never leave the stale line standing with a note beside it. **A verify pass may shrink `CLAUDE.md` or leave it the same size; a verify pass that grows it is a bug.** "Append a clarification next to the stale line" is the first thing that comes to mind here, and it is the exact failure mode this mode exists to prevent.

---

## The distinction that decides every rewrite

| What happened | What it means | What verify does |
|---|---|---|
| The command **cannot run** — no such script in `package.json`, no such target in the `Makefile`, no such task, binary not on `PATH`, `command not found` | A **stale claim**: `CLAUDE.md` is telling every agent and every new hire to run something that isn't there | Rewrite that row's command to the `TODO:` placeholder below, name it at the top of the summary, and quote what it used to say |
| The command **ran and failed** — red tests, lint errors, type errors; a command that exists, executed, and exited non-zero | The repo's **current state**, not a false claim. The command is real and correct; the code under it is broken | Keep the row exactly as it is. Report the failure. Change nothing in `CLAUDE.md` |

Conflating these two is the one mistake here that does real damage: it deletes a repo's test command because the suite is red. Read the failure, not just the exit code — a non-zero exit is not by itself evidence of a stale claim. If you cannot tell which of the two happened, it is **could-not-verify**: report it and leave the row untouched.

---

## The TODO: placeholder

**One notation, and it already exists** — `references/profile-generic.md` records an undetected command as the literal `TODO: <lint|typecheck|test> command`, and Phase 4 keeps that same string for `generic` when it fills `AI_REVIEW_CHECKLIST.md`. Verify mode writes exactly that, with the row's own purpose word in the slot: the `test` row becomes `TODO: test command`, the `lint` row `TODO: lint command`. No other word can reach that slot, because no other row is ever executed (see the bound below), and a row that was never run is never rewritten.

Phase 2 writes the same string, for the same reason, when a command fails to run at install time. This section is where the notation lives — `SKILL.md` points here rather than re-spelling it.

---

## The command-execution bound

Verify mode executes commands read out of a file in the target repo. `CLAUDE.md` is committed and reviewed, so this is not attacker-controlled input in the usual sense — the bound holds anyway, because the whole value of the mode is that it runs what the repo claims and nothing else.

- Run **only** the commands recorded in that `CLAUDE.md`'s `## Commands` table, exactly as recorded, **one at a time**.
- Never assemble a command from anything else in the file, never chain or combine two rows, never run a command the table doesn't hold, and never add flags to make a recorded command runnable — the recorded command is the claim under test.
- Only the **lint**, **typecheck** and **test** rows are ever executed. A `dev`, `build`, `format`, `start`, `watch`, `deploy`, or migration row is **not executed** and is reported as could-not-verify: anything that waits for input, starts a long-running process, rewrites the working tree, or touches a remote is out of bounds. The harness must not start a dev server to check a table row.
- A recorded command whose **own text would be re-interpreted by a shell** — `$(…)`, backticks, `&&`, `||`, `;`, a pipe, a redirect, a trailing `&` — is reported, not run, however plausible the row looks. Run each recorded command directly, never through a shell that expands what the table contains beyond the recorded command itself: once expansion is in play, what executes is no longer the claim under test.
- Judge by the command, not by the `Purpose` label. A row that would do something other than lint/typecheck/test — whatever the label says — is reported, not run.
- Run non-interactively, with a timeout. A command that hangs or waits for input is killed and reported as could-not-verify; do not retry it with different flags.

---

## Procedure

1. **Read `CLAUDE.md`** at the target repo root.
   - Missing → print `No CLAUDE.md in this repo — verify mode has nothing to verify. Run a normal install instead (Phase 1 → yes) to generate one.` and stop. Write nothing.

2. **Inventory the checkable claims.** Exactly three kinds, and nothing else:
   - the `Stack:` line, plus any other header line naming a language, runtime, package manager, or framework (`Auth:`, `Runtime:`, …);
   - each row of the `## Commands` table;
   - every path in the file that names a file or directory on disk (a rule file, a directory a convention points at, `openapi.yaml`, …).

   Everything else — hard rules, workflow pointers, prose — is not a claim about disk and is not verify's business. A line or row that can't be parsed is **could-not-verify** and stays untouched: verify checks claims, not layout, and reformatting someone's hand-edited file is not a stale-claim fix. A `CLAUDE.md` whose shape matches no template is still verifiable this way, claim by claim.

3. **Check the header claims against the manifests**, clause by clause, and split them the same way the commands split:
   - **Contradicted** by a manifest (the file says `pnpm`, `packageManager` says `npm@10`; the file names a framework the manifest doesn't depend on) → stale. Correct it in place to what the manifest says, or remove the clause if the manifest gives no replacement. Quote the old text.
   - **Merely unsupported** — no manifest speaks to it either way (`Node ≥22` with no `engines` field, a runtime target nothing records) → **could-not-verify**. Leave it exactly as it is. Deleting a claim you couldn't check is not shrinking, it is guessing, and it is how a verify pass loses the right to touch the file at all.

   Only a claim verify actually checked may be changed. That rule holds for every bucket below, not just this step.

4. **Check the path claims.** Path present on disk → verified. Path absent → the claim is stale: correct it in place if a rename is unambiguous, otherwise remove it. Quote the old text.

5. **Run the commands**, within the bound above, and apply the distinction table to each result. A row already carrying a `TODO:` placeholder is reported as a **gap** — never as "verified", and never rewritten.

6. **Print the summary** below. Nothing is ever rewritten silently: every correction and every removal appears with what it used to say, so a wrong removal is visible in one read rather than found later in a diff.

---

## Edge cases

- **No `CLAUDE.md`** → nothing to verify (step 1). Point at the normal install and stop.
- **Hand-edited `CLAUDE.md` in no recognizable shape** → verify claims, not layout. Unparseable rows and lines are could-not-verify and are left exactly as they are.
- **A command that runs but fails** → reported, row kept. See the distinction table.
- **A command that can't be run safely or non-interactively** → not executed, reported as could-not-verify.
- **`TODO:` rows already present** → reported as gaps, never "verified", never rewritten.
- **A claim no manifest and no path check can settle** → could-not-verify, left alone (step 3). Only a checked claim may be changed.
- **A manifest that still points at something gone** (`"main": "src/index.js"` with no `src/`) → the disk wins for the `CLAUDE.md` claim, and the stale manifest field is *reported*, not edited: verify edits `CLAUDE.md` and nothing else.
- **Nothing stale** → say so, and change nothing. A no-op verify pass is a successful one.
- **Every claim removed is quoted** in the summary.
- Verify mode never touches anything outside `CLAUDE.md` — not the rules, not the guards, not `.claude/harness-version`. Rules, guards and knowledge bundles keep their own existing checks.

---

## Print a verify summary

```
Verified CLAUDE.md against this repo — {N} claims checked, no harness file installed

Broken (recorded command no longer runs):
  test — `pnpm test --run`  →  rewritten to `TODO: test command`
      package.json has no "test" script

Failing (command runs, the repo is red — row kept as-is):
  typecheck — `pnpm type-check` exited 1 (3 errors in app/)

Verified (unchanged):
  lint — `pnpm lint` exited 0
  ".claude/rules/" — present

Corrected:
  Stack: — was "Nuxt 4 fullstack · Cloudflare Pages", now "Nuxt 4 fullstack"
      (no wrangler config, no Cloudflare preset in nuxt.config.ts)

Removed:
  ".claude/rules/conventions-server.md" — no such file

Could not verify:
  dev — `pnpm dev` (long-running; never executed by verify)

CLAUDE.md: 58 lines → 55 lines. Nothing was appended.
.claude/harness-version unchanged ({VERSION}) — verify installs nothing.
```

Omit any bucket that is empty rather than printing an empty heading — a row that was already a `TODO:` before this run prints under one more, `Gaps (already TODO before this run)`. The **Broken** bucket goes first and is never folded into a list of successes — a recorded command that no longer runs is the finding a verify pass exists to surface.
