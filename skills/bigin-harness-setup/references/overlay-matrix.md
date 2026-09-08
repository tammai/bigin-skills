# Phase 5: per-profile overlay differences

Phase 5 writes the same enforcement layer for every profile. Five steps branch, and this file holds the branch table plus the argued reason for each exception, so `SKILL.md` carries the per-run instruction and not the rationale.

## The matrix

| Step | nuxt | nuxt-marketing | next | tauri | go | nodejs | flutter | generic | specs | contracts | qa |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **5-1** pre-commit | skip if a manager exists | **always write + chain** | skip if a manager exists | **always write + chain** | write | write | write | write | write (story lint) | write (spec lint) | write (E2E lint, if any) |
| **5-3** settings.json | merge (scaffold wrote one) | write/merge | merge | merge | write/merge | write/merge | write/merge | write/merge | write | write | write |
| **5-3b** `.vscode/settings.json` | ESLint | ESLint | ESLint | ESLint **+ rust-analyzer** | — | — | — | — | — | — | — |
| **5-3b2** `analysis_options.yaml` | — | — | — | — | — | — | **merge** | — | — | — | — |
| **5-3b3** `rust-toolchain.toml` + `tauri.conf.json` | — | — | — | **write / check** | — | — | — | — | — | — | — |
| **5.6** CI extra | — | build + prerender + 3 greps, no deploy | — | 2 jobs, no installers | — | — | `.fvmrc` | no CI at all | story lint only | **none — see below** | E2E on a schedule |

Everything not in that table is identical across the eight stack profiles: all ten guard scripts, `hook-io.mjs`, the context-budget gate, the commit-msg gate, the version marker, and the model-routing config.

**The three polyrepo profiles are the exception, and it is the gate set itself that differs** — see `## Polyrepo profiles: which gates apply` below.

---

## 5-1: why `tauri` and `nuxt-marketing` write a gate anyway

Every other profile treats an existing hook manager as *the* gate and stands down, because two competing `pre-commit` mechanisms is a worse outcome than one imperfect one.

Two profiles can't, and both for the same structural reason: their gate's whole security argument is a set of grep steps that `lint-staged` does not and cannot run.

`tauri` is the first, and the reason is structural rather than stylistic. Its frontend half comes from `nuxt-scaffold`, so it arrives with `simple-git-hooks` → `pnpm lint-staged` already installed — and `lint-staged` runs ESLint over staged JS/TS. It never runs `cargo fmt`, `cargo clippy` or `cargo test`, so **half the application is ungated**, and it never runs the four grep gates that are the entire security argument for this profile: no API URL literal in `app/`, no secret in web storage, no `server/` directory, no dangerous Tauri capability. Standing down here doesn't mean "one imperfect gate", it means "no gate on the Rust side and none on the boundary".

So write `scripts/pre-commit.sh` from `hook-guard.md` → `## pre-commit: tauri`, `chmod +x` it, then wire it to whatever already owns the hook — chaining, never replacing:

| Found | Action |
|---|---|
| `simple-git-hooks` in `package.json` | set its `"pre-commit"` to `"pnpm lint-staged && sh scripts/pre-commit.sh"`, keeping whatever was there as the first half, then re-run `pnpm simple-git-hooks`. Skip 5-1b's symlink — the manager owns `.git/hooks/pre-commit` |
| `.husky/` | append `sh scripts/pre-commit.sh` to `.husky/pre-commit` |
| neither | continue to 5-1b and install the symlink normally |

Name which of the three in the Phase 7 summary. It is still **one** gate, not two: `lint-staged && sh scripts/pre-commit.sh`.

**`nuxt-marketing` is the second, and the chaining table above applies to it unchanged.** A site scaffolded by `nuxt-marketing-scaffold` has no hook manager, so the gate is written plainly; a site that arrives from an external template usually has `simple-git-hooks` → `pnpm lint-staged` already installed, and `lint-staged` runs ESLint over staged files — which is every check this profile does *not* need and none of the three it does. The three greps (no hex or `rgb()` colour literal under the component and block trees, no `fallbackLocale` in the i18n config, no raw `<img` outside `app/components/media/`) are the profile's entire enforcement layer, and none of them is expressible as an ESLint rule, because each is about a string or a path rather than a syntax tree. Standing down here means the design-token boundary, the hidden-not-substituted locale rule and the image policy are enforced by prose only. Script: `references/hook-guard.md` → `## pre-commit: nuxt-marketing`.

## 5-3: the two settings.json shapes

- **nuxt / next / tauri, `SCAFFOLDED = true`** — the scaffold already wrote `.claude/settings.json` with `permissions.allow` and a `PostToolUse` `lint-fix-file.mjs` hook. Merge in, per event: `PreToolUse` `bash-guard.mjs` + `spec-gate-guard.mjs` + `injection-gate-guard.mjs` (matcher `Bash|Write|Edit|WebFetch|mcp__.*`), `PreToolUse` `bugfix-test-guard.mjs` + `commit-msg-guard.mjs` (matcher `Bash`), a `SessionStart` block with `canary-seed.mjs` and `session-resume-check.mjs`, a `PreCompact` **and** `SessionEnd` block both pointing at `precompact-snapshot.mjs`, a `Setup` block pointing at `install-hooks.mjs`, missing `permissions.allow` entries, and a second `PostToolUse` entry for `injection-scan-guard.mjs` **alongside** the existing `lint-fix-file.mjs` one. Never replace or duplicate that existing entry. Show additions before writing.
- **everything else** (including `nuxt-marketing`, and onboarding an existing nuxt/next/tauri repo) — read the whole template from `references/profile-{PROFILE}.md` → `## settings.json Template`. Merge the `hooks` block and missing `permissions.allow` entries per event if the file exists; write fresh if not. For an existing nuxt/next/tauri repo and for every `nuxt-marketing` repo, also write `.claude/guards/lint-fix-file.mjs` first if it's missing. `nuxt-marketing` is always in this branch: this skill has no scaffolder for a marketing site, so `SCAFFOLDED` is never true for it — the template that produced the repo is the Factory's, not one of Phase 0.5's.

Two allowlist notes: the `tauri` template adds the `cargo` surface but deliberately omits `cargo install`, `cargo update`, `rustup` and `pnpm up` — each either rewrites a lockfile the codegen and CI gates depend on, or installs an arbitrary binary. The `generic` template pre-approves git only; an unknown toolchain gets no blanket allowlist, and the user approves its commands as they come up.

## 5-3b: `.vscode/settings.json`

ESLint format-on-save, from `profile-nuxt.md` / `profile-next.md` / `profile-nuxt-marketing.md` → `## .vscode/settings.json Template`. Merge keys if the file exists (show additions first), write fresh if not. `nuxt-marketing`'s block is the same one as `nuxt`'s.

`tauri` gets that same ESLint block **plus** the `rust-analyzer` block from `profile-tauri.md` → `## .vscode/settings.json`. `rust-analyzer.linkedProjects` is the load-bearing key: the `Cargo.toml` sits at `src-tauri/`, not the repo root, and rust-analyzer looks only at the root by default — without it the whole Rust half is unanalyzed in the editor while CI goes red on findings the author never saw.

Skipped for go and nodejs (backend-only, no editor-format concern), flutter (the official Dart/Flutter extension already formats on save with `dart format`'s single style — nothing to configure and no rival formatter to disable) and generic (formatter unknown).

## 5-3b2: `analysis_options.yaml` (flutter)

From `profile-flutter.md` → `## analysis_options.yaml`. **Merge, never overwrite** — every Flutter repo already has this file and an existing one is usually customized. No top-level `analyzer:` key → add the block; an `analyzer:` with no `exclude:` → add the list; already excluding generated output → do nothing. Leave `include:` and `linter:` untouched.

Without it this profile's own `{TYPECHECK}` gate (`flutter analyze --fatal-infos`) fails on committed generated code that the same profile forbids anyone to hand-edit — a red gate with no legal fix. Say in the Phase 7 summary whether the block was added or was already there.

## 5-3b3: `rust-toolchain.toml` + `tauri.conf.json` (tauri)

**`rust-toolchain.toml`** — write if absent, per `profile-tauri.md` → `## rust-toolchain.toml`, substituting the channel from `rustc --version`. Rustup treats a toolchain file as a directory override, so this one file decides the toolchain for local dev and CI alike and the generated workflow needs no version of its own. If Rust isn't on `PATH`, skip it and say so in the summary — the generated CI reads this file, so its absence is a first-run failure with a one-line fix.

**`tauri.conf.json`** — **read-only.** It belongs to `tauri init` and the first slice. Check three values, rewrite none, and name each in the Phase 7 summary (`profile-tauri.md` → `## tauri.conf.json — what the overlay checks`):

- `identifier` still `com.tauri.dev` → Tauri refuses to bundle at all. Better heard at install time than at the first release attempt.
- `app.security.csp` absent or `null` → Tauri enables CSP protection only when the config sets it, so both mean no policy and the gate fails on both. A red first commit unless it's set now; `default-src 'self'` is the starting point.
- `app.withGlobalTauri` `true` → the IPC bridge is on `window`, reachable by any script the webview runs.

Report, don't fix. Each is an application decision with a real value behind it, and a silently-written `identifier` is the one that orphans every installed user's local data if the guess turns out wrong.

## 5.6: CI caveats

- **flutter** — the workflow reads its SDK version from `.fvmrc`, and `subosito/flutter-action` **errors when that file is missing**. Before writing the GitHub workflow, if `.fvmrc` is absent, run `flutter --version --machine` and write `{"flutter": "<frameworkVersion>"}`. Flutter not on `PATH` → skip the file and say so; the workflow needs a version pinned by hand before its first run. GitLab needs no equivalent — its `image:` tag defaults to `stable` and runs as written. Two things for the user, both named in the summary: pin `subosito/flutter-action@v2` to a SHA, and move the GitLab image tag off `stable`.
- **tauri** — two jobs and no installer build. The frontend job is an ordinary runner; the Rust job first installs Tauri 2's Linux system libraries, since a plain runner has none and `cargo build` then fails on a linker error that names a symbol rather than the missing package. Building installers is a three-OS matrix needing the code-signing and notarization secrets, so it belongs in a release workflow the team writes once it has certificates — as a PR gate it would be red on every pull request for want of an Apple Developer ID, and an always-red gate gets deleted. `rust-toolchain.toml` decides the toolchain; `dtolnay/rust-toolchain` and `Swatinem/rust-cache` are both tag-referenced and want SHAs, named in the summary.
- **nuxt-marketing** — the only frontend profile whose workflow **builds**, because on this profile the build *is* the locale prerender and a locale that fails to prerender 404s in production and nowhere else. The three greps run here too, as the backstop for a commit that reached the branch with no hooks installed. Every grep tests its search root first: `grep` exits 2 on a missing path *even when it matched*, and an exit 2 inside `if` is false, so one absent argument would turn a step green over a repo full of violations. **No deploy job** — that belongs to the site's own workflow, which the Factory owns, and it is the one generated command whose blast radius is a live client site.
- **generic** — no CI at all. `references/ci.md` has no generic template, and an inferred workflow for an unknown stack would be wrong more often than right.

---

## Polyrepo profiles: which gates apply

`specs`, `contracts` and `qa` are the only profiles that install a **different set of gates** rather than the same set configured differently. The rule is one line: *a gate is installed where its premise holds.* Installing one whose premise is false teaches people that gates are noise to be worked around, which costs more than the gate was ever worth.

| Gate | specs | contracts | qa |
|---|---|---|---|
| `bash-guard` | yes | yes | yes |
| `injection-gate-guard` + `injection-scan-guard` + `canary-seed` | yes | yes | yes |
| `session-resume-check` | yes | yes | yes |
| `precompact-snapshot` | yes | yes | yes |
| `commit-msg-guard` | **no** | yes | yes |
| `bugfix-test-guard` | **no** | **no** | yes |
| `spec-gate-guard` | **no** | yes | **no** |
| **count of the nine** | 6 | 8 | 8 |

`install-hooks.mjs` is installed by all three; it is a `Setup` bootstrap, not one of the nine.

**`commit-msg-guard` off in `specs`** — its authors are business analysts writing prose. `feat(scope): subject` on a user story is dev ceremony with no reader, and a BA whose first commit is rejected on a format they were never taught learns that this repo fights them.

**`bugfix-test-guard` off in `specs` and `contracts`.** It needs a test surface. `specs` has none. `contracts` has one in principle — `oasdiff` — but that is a workstream outside this release, and the guard's trivial-path allowlist covers `.md`, `.env.example`, `graphify-out/` and a fixed list of JS config files, **not `.yaml`**: a `fix:` commit staging `openapi/core.v1.yaml` would be blocked on a regression test that cannot exist, so every contract fix would carry `[no-test]`. It stays on in `qa`, where a fix to an E2E spec *is* a test file and satisfies the guard's own patterns, and manual cases are markdown the allowlist already covers.

**`spec-gate-guard` off in `specs` and `qa`.** In both, writing the artifact *is* the work: a gate demanding an approved `PLAN.md` before a BA may write a story, or a tester a test case, inverts the workflow it exists to protect. It stays on in `contracts`, where an API change is a design change and the ≤20-line threshold already lets a small schema fix through.

**`contracts` gets no CI from this profile at all.** Lint, `oasdiff` breaking-change gating, tagging and the consumer dispatch are that repo's own workstream. A generated pipeline that tags and dispatches without first checking compatibility would publish breaking changes on a schedule — worse than the gap it fills. Name it in the Phase 7 summary instead.
