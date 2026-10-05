# Epic: Fix the 2026-10-05 audit findings

Status: complete
Approved: 2026-10-05 (user: "write a plan for fix all findings … then start the fix")
Completed: 2026-10-05 (units 1-7, v1.104.0)

## Goal

Close every finding in `docs/audit-2026-10-05.md`: 8 high, 29 medium and 41 low, plus the token-waste and implementation-record sections. It is done when each finding ID below is fixed or carries a one-line reason it was declined, all gates pass (`node tools/regress.mjs`), and one release (v1.104.0) ships the lot with `patch` blocks for every templated reference it changed.

## Finding IDs

The full text of each finding (evidence, repro, suggested fix) is in `docs/audit-2026-10-05.md`, under the section shown here.

| Prefix | Report section | Range |
|---|---|---|
| H | Harness templates | H1–H19 |
| S | Skills + agents | S1–S28 |
| D | Docs + manifests | D1–D22 |
| T | Tooling + gates | T1–T9 |
| W | Token waste | W1–W7 (W8 already fixed in v1.101.1; W9 not plugin-caused) |
| R | Implementation records | R1–R5 |

## Constraints

- **Records stay full and verbatim** (owner decision, 2026-10-05). The R fixes stop records being read without a traceback need. They never shrink a record.
- **One release at the end.** Units do not bump versions or write `CHANGELOG.md`. Each unit appends what it changed in a templated reference to `## Patch-block ledger` below, and unit 7 writes the CHANGELOG entry and patch blocks from that ledger.
- **Budget.** T4 makes the gate count agent descriptions and stop counting user-only skills. The corrected total (~13.2k) is over the 12,000 cap, so unit 5 must trim agent descriptions (and skill descriptions if needed) until the corrected gate passes. Raising the cap is not an option.
- **Guards keep one body for both hosts** (`lib/hook-io.mjs`). Every block/allow case in `.claude/rules/skill-authoring.md` must still pass on both payload shapes, and each new bypass from H1/H5/H7/H8 becomes a block case in the rule and in `regress.mjs`.
- **W1, the epic hard stop.** epic-workflow stops and asks for `/clear` after **2 units in one session**. That is a count, not a feeling the model has to judge. The existing semantic stop conditions stay. Resuming is already free (step 8).
- Units 1–5 own disjoint files and run in parallel in separate worktrees. Unit 6 (docs) runs after them because it describes their behavior. Unit 7 (release) runs last.

## Units

| # | Unit | Findings | Files owned | Blocked by | Status | Notes |
|---|------|----------|-------------|------------|--------|-------|
| 1 | Guards and hook-io | H1, H2, H3, H5, H6, H7, H8, H9, H10, H13, H16, H18 | `skills/bigin-harness-setup/references/hook-guard.md`, its block/allow list in `.claude/rules/skill-authoring.md`, guard cases in `tools/regress.mjs` | — | Done | Merged into the main tree, uncommitted. Passed on verifier round 3; round 1 failed with regressions and RCE, round 2 on a non-idempotent hook-io block. 26 patch blocks are in `scratchpad/unit-1-patch-blocks.md`. regress: 174 passed. |
| 2 | Harness templates (not guards) and records | H4, H11, H12, H14, H15, H17, H19, D1 (scaffold-delegation paths), D7 (retro patch blocks noted in ledger), R1, R2, R4, R5, S10 | `skills/bigin-harness-setup/` except `hook-guard.md`; `skills/knowledge-distill/` | — | Done | Merged into the main tree, uncommitted. Passed on verifier round 2: the flutter D7 anchor indentation and the specs commit-msg hook were fixed. 23 patch blocks are in `scratchpad/unit-2.md`. |
| 3 | Routing classifier | S3, S5, S6, S26, S14 | `skills/model-router/` | — | Done | Merged into the main tree, uncommitted. The S3 allowlist passed on the second verifier round. S15 and the W4 model-router lines were applied after the merge. |
| 4 | Workflows, agents, token waste | W1–W7, R3, S4, S7, S8, S9, S15, S16, S20, S28 | `skills/task-workflow/`, `skills/epic-workflow/`, `skills/discovery-workflow/`, `agents/` | — | Done | Merged into the main tree, uncommitted. Passed on verifier round 2; the archive command was tested in bash and pwsh 7.7. Known edge: a `$` in a title passed in double quotes gets expanded. S15 was moved to unit 3. |
| 5 | Other skills and tooling | S1, S2, S11, S12, S13, S17, S18, S19, S21, S22, S23, S24, S25, S27; T1–T9 | the other `skills/*`, `tools/` (except regress guard cases), `scripts/git-hooks/`, `hooks/`, `.gitattributes` | — | Done | Trims descriptions so T4's corrected budget passes. Merged into the main tree, uncommitted, and passed the verifier on round 1. The standard-worker description trims were applied by hand over unit 4. Budget after merging 3+4+5: 11,663 / 12,000. |
| 6 | Docs and manifests | D2–D6, D8–D22 | `README.md`, `docs/`, `site/src/`, `CLAUDE.md`, `.claude/rules/` (except the guard list), manifest descriptions | 1–5 | Done | Re-check that each doc claim matches the code as changed in 1–5.  Gates pass and the budget is 11,926 / 12,000. D22 was moot after unit 2 added `paths:`. D4's skill-side copies were applied by me. Still open until unit 1 merges: the S20 text in skill-authoring.md:74, the bash-guard "Blocked" tables in GATES.md §2 and USER_GUIDE §6, and a recheck of the isGateFile list in GATES.md §2 and SPEC-GATE.md §6–7. |
| 7 | Release v1.104.0 | — | version fields, `CHANGELOG.md`, `site/dist/`, generated README tables | 6 | Done | Gates plus `regress.mjs`, then confirm with the user before committing. |

Each of units 1–5 gets an independent verifier pass against this table before it is merged.

## Patch-block ledger

Units append one line per templated reference they change: `file — anchor/section — what changed`.

## Declined

Finding IDs not fixed, one line each with the reason.

## Amendments
- 2026-10-05: follow-ups routed between units. S15's model-router half (`skills/model-router/references/agent-invocation.md:52`, a diff-scoped test command instead of `go test ./...`) is applied after unit 3 merges. Unit 6 picks up `docs/USER_GUIDE.md:353`, `site/src/pages/handbook.html:609` (old "context is tight" stop) and the epic-queue reason in `.claude/rules/skill-authoring.md` (S20). Unit 5 owns S21 (`write-tests` waits for confirmation when spawned).
- 2026-10-05: owner decided that new docs and config files are not new files. `plannedNewFiles` now keeps only allowlisted code types (classify.mjs, SKILL.md:46, scoring-rubric.md:46, task-workflow SKILL.md:43). Verified: `docs/new.md` and `config/new.json` give `[]`, `src/new.ts` still lists itself.
- 2026-10-05: unit 4's verifier found that `skills/model-router/SKILL.md:95` and `references/scoring-rubric.md:49` still pass "Normal gates … output shown" to implementers, which conflicts with W4. This is applied after unit 3 merges, together with S15.
- 2026-10-05: unit 5 handed two items to other units. S22 goes to unit 2: `knowledge-distill` uses plain `git ls-remote --tags <repo>`, plus `allowed-tools` entries for `git -C * rev-parse *` and `git ls-remote *`. T9 goes to unit 6: CLAUDE.md Structure and Gotchas text, in `scratchpad/unit-5.md`. The `budget-gate.md` code and prose come from `scratchpad/bg/`, applied after unit 2 merges. Agent description trims will conflict with unit 4's merged agents/ edits, so they are re-applied by hand. The corrected budget is 11,755 / 12,000, which leaves 245 chars for unit 6.
- 2026-10-05: unit 2 is done, pending verification. Its two `install-hooks.mjs` shim and polyrepo-wording items went to unit 1, and S22 plus the `budget-gate.md` mirror went back to unit 2. Unit 6 picks up the "always loaded" claims about `knowledge.md` at `docs/KNOWLEDGE.md:42,90` and `docs/USER_GUIDE.md:143`, plus the D1 wording at README:37 and USER_GUIDE:74. The release puts the 4 D7 retro patch blocks in the v1.104.0 entry as `optional: true`. Four changes can't be patch blocks and need manual steps in the release notes (see `scratchpad/unit-2.md`).
- 2026-10-05: unit 1 is done, pending verification. H16's matcher change in the profile templates goes to me after unit 2 merges, and H18's `lint-fix-file.mjs` quoting goes to me after the merge (exact fixes in `scratchpad/unit-1.md`). Side effect of H13: edits to guard files ask in Claude Code and are denied in Cursor, so patch mode prompts in Claude Code and Cursor users apply guard patches by hand. The release notes must say this. `lib/hook-io.mjs` must be patched first.
- 2026-10-05: unit 1 round 1 FAILED adversarial verification. The new tokenizer let through wrappers (`find -exec`, `stdbuf`, …), `$VAR`/`$(…)` args and commands piped into a shell, all of which the old regex blocked. bugfix-test-guard forwarded the command's `GIT_CONFIG_*` prefixes into its own `git diff`, which runs arbitrary code inside the hook (new). Guard self-protection could be bypassed with Bash redirects. The Cursor hard-deny breaks patch mode for guard and settings blocks. Round 2 sent back with every one of these, plus the pre-existing bypasses (`GIT_CONFIG_GLOBAL`, `push --mirror`, `git config` hooksPath/alias), fail-closed on malformed fields, and real patch blocks. Rule for round 2: the new guard must block a superset of what the old guard blocked.
- 2026-10-05: unit 2 passed verifier round 2 and is merged, uncommitted. I applied two items by hand. H16: `MultiEdit` added to the injection-gate matcher in all 11 profile templates and in overlay-matrix.md. H18: `lint-fix-file.mjs` now runs `node_modules/eslint/bin/eslint.js` with `process.execPath` and no shell, tested with a path containing a space and `&`. `pnpm.cmd` without a shell is refused by current Node on Windows, so the suggested fix wouldn't have worked. NotebookEdit on the spec-gate matcher waits until unit 1 sizes NotebookEdit by `new_source`. Ledger: the injection-gate matcher line in each profile's settings block, and the nuxt-scaffold `lint-fix-file.mjs` template, which is not a harness reference (release notes only).
- 2026-10-05: unit 1 round 2 is done, 27 patch blocks, pending adversarial re-verification. Applied by hand in unit 2's files:
  - patch-mode.md: a "Blocks targeting the gates' own files" bullet, plus a "Needs manual apply (Cursor)" summary list. Cursor's `preToolUse` can't ask, so gate-file edits are denied there, while its shell event now gets a real ask.
  - SKILL.md: the commit-msg citation renamed to `## commit-msg: all profiles except specs`.
  - `NotebookEdit` added to the spec-gate matcher in the 9 profile templates that register spec-gate. The lint-fix PostToolUse matchers were left alone.
  - Ledger: the spec-gate matcher line in each profile settings block.
- 2026-10-05: unit 1 round 2 re-verify. The guard held: 303 cases, no old→new regressions, all round-1 items closed. It FAILED on patch block 5 (hook-io): its content contains its own anchor, so a second patch run duplicates the lib and every guard fails open. Round 3 sent: re-anchor block 5, make regress assert idempotency for guard blocks, and close `include.path`, `${IFS}` and `remote.*.mirror`. Unit 6 started early in the main checkout, without touching hook-guard.md, skill-authoring.md or tools/, since units 2–5 are merged. D22's skill-authoring text comes back as a report for me to apply.
