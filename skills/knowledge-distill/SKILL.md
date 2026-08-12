---
name: knowledge-distill
description: "Distills a library's docs and source at a pinned version into version-pinned knowledge/libraries/<lib>/ concept files, clean-context verified. Triggers: 'distill knowledge for nuxt@4.0.3', 'create a knowledge bundle for phaser', 'update the nuxt bundle to 4.1.0', /knowledge-distill."
effort: medium
allowed-tools: Bash(git clone *) Bash(git -C * log *) Bash(git -C * diff *) Bash(git -C * ls-remote *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/count_budget.mjs *) Bash(node tools/knowledge_validate.mjs) Bash(node tools/knowledge_drift.mjs)
---

# Knowledge Distill

Turns a library's docs + source **at a pinned version** into concept files under
`knowledge/libraries/<lib>/` in the current repo. Agents then read them through the
index-first protocol the repo already has, instead of guessing at an API that moved.

This is a static-artifact pipeline, not a retrieval tool. It runs when asked, writes files,
and exits. Nothing loads at task time except through `.claude/rules/knowledge.md`.

**Read `references/bundle-format.md` before writing any file.** The output has to pass
`tools/knowledge_validate.mjs`, which runs in the target repo's pre-commit and CI, and every
rule in that reference is there because the validator enforces it.

## Preconditions

- `git` is available and the library's repo is public. Private repos and non-git doc sources
  are out of scope.
- The repo has a `knowledge/` bundle. If `knowledge/index.md` is missing, do Phase 0a first.
- The bundle is on the OKF v0.2 layout. If any `knowledge/libraries/*/index.md` carries a
  `library:` key and has no `pin.md` beside it, that bundle predates v1.62.0 — stop and run
  `node tools/knowledge_migrate_okf.mjs` (dry run first, then `--write`). Distilling over a
  legacy bundle leaves two pins in one directory, and only one of them is the one the drift
  guard reads. The script is in `bigin-harness-setup`'s `references/knowledge-migration.md`
  if the repo doesn't have it yet.

## Phase 0a — Bootstrap the bundle (only when it's absent)

A distilled bundle is self-validating without a repo-level bundle — its own `index.md` seeds
the validator's reachability walk. So what's missing isn't correctness. It's that nothing would ever *read* the bundle (discovery runs through
`.claude/rules/knowledge.md`'s index-first protocol), and Phase 3's validator step would have
no validator to run. Distilling into a repo with neither is paying a clone plus up to three
audit rounds for files no session opens.

Offer two paths and **wait** — writing rule files and a commit-time validator into someone's
repo is a bigger change than "distill a bundle," and it isn't yours to assume:

- **Full harness** (`bigin-harness-setup`) — pick this if the repo has no `CLAUDE.md` or
  `.claude/rules/` either. The knowledge bundle is one phase of a harness such a repo wants
  anyway, and that skill also wires the commit gates and CI.
- **Bundle only** — bootstrap here, then continue into Phase 0.

On "bundle only": do exactly what `bigin-harness-setup` **Phase 5.5 steps 1–3** do, reading its
templates from `bigin-skills skills/bigin-harness-setup/references/knowledge-bundle.md` and
replacing `{DATE}` with today's date in ISO 8601. That phase holds the canonical file list —
**do not restate it here**, or the two drift the first time one is edited. Skip any file that
already exists.

Stop at step 3. Steps 4–6 are enforcement wiring — pre-commit, `AI_REVIEW_CHECKLIST.md`, CI —
and they belong to the harness, not here. Say so when you report, so nobody reads a bootstrapped
repo as a fully gated one: the bundle is validated when *you* run the validator in Phase 3, but
nothing yet runs it on commit. Phase 3 still installs the drift guard and wires it if the repo
turns out to have a pre-commit script.

## Phase 0 — Preflight

1. **Resolve the pin.** Required: the library's git URL and an exact tag or commit.
   - No version given, or the user said "latest" / "current" / "newest" → **ask**. Never
     resolve it yourself. A bundle whose version came from whatever `HEAD` happened to be is
     worse than no bundle: it looks pinned and isn't. `git -C <clone> ls-remote --tags <repo>`
     is fine for *showing* the user the available tags to pick from.
   - Accept `lib@version` shorthand (`nuxt@4.0.3`) and both `v`-prefixed and bare tags.
2. **Clone shallow, outside the project tree.** Clone into the session scratchpad, never into
   the repo being worked on:
   `git clone --depth 1 --branch <tag> <repo> <scratchpad>/distill-<lib>-<tag>`
   Record the resolved SHA (`git -C <clone> rev-parse HEAD`) — that SHA, not the tag, is the
   provenance that survives a retagged release. Delete the clone when the run ends.
3. **Find the docs.** Probe in order: `docs/`, `documentation/`, `content/`, `website/docs/`,
   `apps/docs/`, `docs/content/`. One match → use it. Several plausible matches, or none →
   ask, listing what you found. If there are genuinely no prose docs (godoc-only libraries
   like `pgx`), say so and confirm the user wants a source-derived bundle before continuing.
4. **Propose topics, then stop.** Derive a topic list from the docs tree structure — one
   topic per coherent area a developer would ask about, not one per doc file. Present the
   list plus the per-file budgets from `references/bundle-format.md`.

   **Gate: do not read docs for distillation or write anything until the user confirms the
   topic list and budgets.** Topics decide the whole shape of the bundle and are cheap to
   change now, expensive after Phase 1.

## Phase 1 — Distill

Read `references/distill-prompts.md` → `## Distillation` for what belongs in each file and
what doesn't. Write, per the confirmed topic list:

| File | `type` | Holds |
|---|---|---|
| `knowledge/libraries/<lib>/index.md` | *(reserved — no frontmatter)* | The mental model, decision tables, top anti-patterns, deltas from the previous major, and links to `pin.md` and every topic file. Never a table of contents — if a line adds nothing a filename doesn't already say, cut it. |
| `knowledge/libraries/<lib>/pin.md` | `Contract` | The pin and its provenance, all in frontmatter: `library`, `version`, `source_repo`, `source_commit`, `docs_path`, `conventions_blended`, plus `generated`/`verified`. The body is two lines — what's pinned and how to re-distill it. |
| `knowledge/libraries/<lib>/<topic>.md` | `Domain` | Operational knowledge for one topic: API surface, idioms, anti-patterns, code shapes. |
| `knowledge/libraries/<lib>/sources.md` | `Playbook` | Topic → path-in-source-repo map, so a deep dive knows where to look instead of re-cloning blind. |

Rules that are not negotiable:

- **Rewrite, never copy.** These files are our distillation of someone else's documentation.
  Paraphrase into our own decision-oriented framing; do not paste doc prose or reproduce
  doc pages wholesale. Short illustrative code shapes are fine — a copied chapter is not.
- **Cite in frontmatter.** Every file gets a `sources:` key naming the repo, tag, and the doc
  paths it was derived from — one entry per path, `resource` required on each. This is what
  the bundle spec requires for any externally-sourced claim; the v0.1 `# Citations` section
  is deprecated and the validator warns on it.
- **Blend conventions visibly.** If the user passed team convention docs (`.claude/rules/*`,
  a house style guide), fold the relevant rule in *at the point of relevance* prefixed
  `Team convention:` — never silently merged into a library fact, and never in a separate
  section at the bottom where nobody reads it. List the paths in `conventions_blended`.
- **Budget mechanically, before Phase 2.** Run
  `node ${CLAUDE_SKILL_DIR}/scripts/count_budget.mjs knowledge/libraries/<lib>` and trim
  until it exits 0. Trim by cutting low-value lines, not by moving text into a new file that
  nothing links to — the validator warns on unreachable files and the reader never finds them.

## Phase 2 — Verify (mandatory, clean context)

The failure this phase exists to catch: a hallucinated API in a bundle is worse than no
bundle, because every future session in the repo now reads it as fact.

1. **Dispatch a fresh auditor.** Call the Agent tool with
   `subagent_type: "bigin-skills:knowledge-auditor"`, passing the bundle directory path, the
   clone path, the pinned tag and SHA, and the audit prompt from
   `references/distill-prompts.md` → `## Audit`. Pass **the files themselves and the clone** —
   never your own account of what you distilled or why. That self-report is exactly what the
   independence is for. Parse the response against `references/audit-contract.md`.
2. **On `FAIL`** — fix only what the issues list names, then dispatch a **new** auditor
   (fresh Agent call, new agent ID, no memory of this round) against the corrected bundle.
   Cap at 3 rounds.
3. **Round cap hit** — stop. Show the user the latest issues list and ask whether to cut the
   affected topics, adjust the budgets, or take over manually. Do not commit.
4. **On `PASS`** — append the audit to `pin.md`'s `verified:` list as
   `{ by: knowledge-auditor/<model>, at: <today, ISO 8601> }`. That actor form is what marks
   the bundle machine-confirmed rather than human-reviewed; never write it as `human:<id>`.
   Continue.

**A bundle that has not passed a clean audit must not be committed.** No exceptions for
"small" bundles or re-distills.

## Phase 3 — Commit & wire up

1. **Link it from the root index.** Append one line to `knowledge/index.md` under a
   `## Libraries` heading (create the heading if absent), in the index's existing format:
   `* [Nuxt 4.0.3](/libraries/nuxt/index.md) - distilled API surface and idioms, pinned to 4.0.3`
2. **Validate.** `node tools/knowledge_validate.mjs` must exit 0 with no `ERROR` lines. Fix
   anything it reports before committing — this is the gate that runs in CI anyway.
3. **Install the drift guard, once per repo.** Two independent checks, so a half-install
   completes on the next run instead of staying half-installed:
   - `tools/knowledge_drift.mjs` missing → write it from `references/drift-guard.md`.
   - The repo's pre-commit script (or `simple-git-hooks`/`husky` config) doesn't already run
     it → add `node tools/knowledge_drift.mjs` next to the `knowledge_validate.mjs` step.
   Skip either one that's already done. Never create a second copy or a second hook.
4. **Commit.** Conventional Commits: `feat(knowledge): add <lib> <version> bundle`, or
   `chore(knowledge): update <lib> to <version>` for a re-distill.
5. **Report.** State the files written, the pin, the audit rounds it took, and the validator
   output. Do **not** touch the project's `CLAUDE.md` — `.claude/rules/knowledge.md` already
   routes agents to `knowledge/index.md`, and the new line from step 1 is on that path. A
   per-library pointer in an always-loaded file is exactly the cost this bundle format exists
   to avoid.

## Update flow (version bump)

Triggered by "update the nuxt bundle to 4.1.0". Cheaper than a full re-distill because the
docs diff bounds the work:

1. Clone both tags shallow. `git -C <new-clone> diff <old-tag>..<new-tag> -- <docs_path>` —
   for a shallow clone, fetch the old tag first (`git -C <new-clone> fetch --depth 1 origin
   tag <old-tag>`) or clone the old tag separately and diff the two trees.
2. Rewrite only the topic files the diff touches. Leave the rest byte-identical — a rewritten
   file with no semantic change is pure review noise.
3. Update `pin.md` frontmatter: `version`, `source_commit`, `generated.at`, and **remove any
   `drift_ack`** (it acknowledged staleness that no longer exists) and any stale `verified`
   entries — the new content hasn't been audited yet.
4. Update the root-index line's version, and the deltas section in the bundle's `index.md`.
5. **Phase 2 in full, regardless of diff size.** A three-line docs diff can still invalidate
   a claim three files away.

## When not to use

- General coding, or "how do I use library X" — answer the question; don't distill a bundle.
- Documentation lookup for one API. Read the docs.
- Knowledge about **our own** code — decisions, invariants, playbooks. That's `sprint-distill`
  and the rest of the `knowledge/` bundle.
- Structural facts about our repo — call flow, dependency graph, schema shape. Those live in
  `graphify-out/graph.json` and are extracted, not distilled.
- Generating an `llms.txt`, or anything consumed outside this repo's bundle format.

## References

- `references/bundle-format.md` — output layout, flat frontmatter schema, budgets, and the
  validator constraints behind each rule. Read before writing files.
- `references/distill-prompts.md` — the distillation guidance and the auditor's audit prompt.
- `references/audit-contract.md` — the auditor's JSON output schema.
- `references/drift-guard.md` — `tools/knowledge_drift.mjs` template and its hook wiring.
