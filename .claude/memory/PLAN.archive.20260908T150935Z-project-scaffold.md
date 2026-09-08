# Plan: project-scaffold

Status: approved
Branch: main

Umbrella §8 deferred this skill with a precondition — *"write only after the pieces it
assembles are proven in a pilot."* The pilot proved them, at the cost of thirteen defects
across eleven releases. This is what turns that session's ~20 error-prone manual steps
into one command.

## Spec

**What.** One command stands up a complete polyrepo project: six repos, the right scaffold
in each code repo, the connective tissue between them, and optionally the remotes and CI
credentials.

**Shape — a skill that delegates, plus one script.** `scripts/project_scaffold.mjs` owns
everything deterministic. `SKILL.md` delegates app scaffolding to the existing scaffolders
and the governance overlay to `bigin-harness-setup`, which is the only thing that may write
guards, rules and `settings.json`. Nothing is reimplemented; a second copy of the overlay
would drift the day either changed.

**Inputs.** `--project <slug>` required. `--owner <login>` opts in to creating and pushing
remotes; omitted means local-only. `--app-id` + `--app-key <path>` set CI credentials.
`--repos`, `--dir`, `--no-install`, `--force`.

**Outputs.** `<slug>-{specs,contracts,api,web,mobile,qa}`, each a git repo with one commit;
`REPO_MAP.md` seeded and copied; a lock in each consumer naming `<owner>/<slug>-contracts`;
`story-sync.json` naming `<owner>/<slug>-specs`; workflows with the **toolchain block filled
in per repo type**; a summary naming what was skipped and why.

**Edge cases**, every one taken from the pilot: a toolchain absent (scaffold the shell, say
so, continue); `gh` unauthenticated or the API unreachable (fall back to local-only rather
than half-creating); a repo that already exists (adopt, never clobber); dead org Actions
billing (report it — the symptom is a 3-second job death with no log); partial failure
(report what completed and make re-running safe).

**Security considerations.** The App private key is read from a path and piped straight to
`gh secret set` — never into a variable, never printed, never copied. The token comes from
`gh auth token`. Creating repos and pushing is outward-facing, so `--owner` is explicit with
no inferred default: the destructive-by-accident case is a repo appearing in an org nobody
meant to touch.

**Testing strategy.** A `regress.mjs` group driving it with `--owner` omitted: six
directories of the right shape, configs naming the right project, every workflow valid YAML
with **no commented toolchain block surviving**, and idempotency. No network in the suite.

**Not in scope.** Creating the GitHub App (web UI only). Fixing billing. Seeding `.bmad-core`
— umbrella §9 keeps BA workflow depth a placeholder. Merging anything.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | `scripts/project_scaffold.mjs` — args, six repos, seed content per type | Done | 352 lines, `node:` builtins only |
| 2 | Connective tissue: locks, story-sync.json, scripts/, workflows with the toolchain filled | Done | The toolchain fill is regress-asserted and mutation-checked — it is the defect that broke both pilot consumers |
| 3 | Delegation to the existing scaffolders for api/web/mobile | Done | Invokes their own scripts; a missing toolchain is named and the repo still gets wired |
| 4 | `--owner`: create + push remotes, adopt what exists | Done | No inferred default; falls back to local-only when gh is absent or the API is unreachable |
| 5 | `--app-id`/`--app-key`: variables, secrets, STORY_CONSUMERS | Done | Key piped from disk to gh; never read, logged or copied. Requires --owner |
| 6 | `SKILL.md` + `evals/evals.json` + manifest entry | Done | Description 225 chars after the compression pass |
| 7 | `regress.mjs` group, incl. no-commented-toolchain and idempotency | Done | Group 7b, 8 cases, runs with a PATH holding only node and git so it is offline and fast |
| 8 | Docs sweep + version bump + CHANGELOG | Done | Included a real compression pass on seven descriptions — the 21st skill would not fit otherwise |
