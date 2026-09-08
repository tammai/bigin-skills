# Spec: `contract-sync` skill

- **Status:** Approved (decisions recorded §11; corrections C2–C6, C8, C10 applied 2026-09-08)
- **Target release:** bigin-skills vNext
- **Owner:** Tam Mai
- **Depends on:** repo type (`specs | contracts | api | web | mobile | qa`, umbrella §7 R1); a contracts repo with per-version spec files (`openapi/<service>.v<major>.yaml`)
- **Implementation plan:** [../../PLAN.md](../../PLAN.md) Phase 1

---

## 1. Problem Statement

The polyrepo standard makes the contracts repo the single source of truth for API specs, but distributing generated clients as packages was rejected: it hides type changes behind a registry, adds a publish pipeline, and breaks the "diff shows everything" review model. Consumer repos (api, web, mobile) need the spec vendored in-repo at a pinned ref, with generated code committed alongside it, and with drift between lock, spec, and generated code made impossible to miss.

A manual precursor already ships and must be retired by this skill (C8): `nuxt-scaffold/scripts/scaffold.mjs:731-732` prints "openapi.yaml is a committed snapshot of the paired backend contract; after a backend change, copy its api/openapi.yaml over it and run `pnpm openapi-types`" into every scaffolded web repo. Left as-is, that text instructs the dev to hand-edit a file §7's guard will block.

## 2. Goals

1. One command syncs the vendored spec and regenerates client code in any consumer repo; a contract bump PR shows the exact type diff.
2. Lock pins both a semver tag (human-readable) and a commit SHA + file checksum (machine-verified). A tag that no longer resolves to its recorded SHA is a hard failure.
3. Manual edits to the vendored spec are blocked at write time (hook) and drift is caught at merge time (CI), so the one-way flow contracts → consumers holds without dev policing it.
4. Session start reports staleness without writing anything; the dev decides when to absorb a contract bump.
5. Zero runtime dependencies, `node:` builtins only — the `scaffold.mjs` convention. (C6: *not* "single file". Every scaffolder here ships a `scripts/templates/` tree, as §9 does.) `check` is bounded by one timed-out fetch; `sync` by one network fetch.

## 3. Non-Goals

- **Package publishing.** Rejected by design; this skill replaces it.
- **Breaking-change policy.** `oasdiff` gating and the multi-version file convention live in the contracts repo CI — separate workstream.
- **Story sync.** `story_sync.mjs` owns story and REPO_MAP distribution (umbrella R2).
- **Auto-merging sync PRs.** The dispatch flow opens PRs; humans merge them.
- **Spec authoring.** Editing `openapi/*.yaml` happens only in contracts repo sessions; this skill runs in consumer repos.

## 4. Lock file contract — `api-contract.lock`

JSON at repo root, one entry per consumed contract:

```json
{
  "contracts": {
    "core": {
      "repo": "bigin-io/acme-contracts",
      "file": "openapi/core.v1.yaml",
      "ref": "v2.3.0",
      "commit": "8f2a91c0d4b7e6f1a3c5d9e8b2f4a6c8d0e2f4a6",
      "sha256": "<checksum of the yaml blob at that commit>"
    }
  }
}
```

Field roles:

| Field | Audience | Rule |
|---|---|---|
| `ref` | humans | display and changelog lookup only; never fetched by |
| `commit` | machine | the only ref fetched; recorded when `bump` resolves the tag |
| `sha256` | machine | verified after every fetch; mismatch aborts before any write |
| `file` | both | selects the API version file; mobile may pin `v1` while web pins `v2` at the same `commit` |

At `sync` time the script re-resolves `ref` → SHA via the GitHub API and compares with `commit`. Mismatch means the tag moved: hard fail with a message naming both SHAs, no fallback.

## 5. Script — `contract_sync.mjs`

Node ≥ 20 built-ins only (`fetch`, `node:crypto`, `node:fs`, `node:child_process`).

| Command | Effect | Writes |
|---|---|---|
| `sync` | resolve + verify per §4, fetch blob at `commit`, write vendored spec, run codegen adapter | spec + generated code |
| `check` | compare lock against contracts repo latest tag; print report | none |
| `bump <ref> [--file <path>]` | resolve tag → SHA, update lock, then run `sync` | lock + spec + generated code |

`check` output shape (consumed verbatim by the SessionStart hook):

```
core: lock v2.3.0 (8f2a91c) — latest v2.5.0; sync PR #142 open
```

**Auth chain:** `GITHUB_TOKEN`, then `gh auth token` (wrapped, non-fatal), then unauthenticated/offline. `gh` is a documented prerequisite for consumer repos. The token is never logged, never echoed into an error message, and never written to the lock.

**Timing (C5):** every fetch is bounded by `AbortSignal.timeout(1500)`. `check` makes at most one network call per session and caches its result under `.claude/memory/`; on timeout, offline, or missing token it prints one skip line and exits 0. `sync` and `bump` fail loudly instead.

## 6. Codegen adapters

Adapter selected by repo type, invoked after the spec is written. **This table was corrected against the shipped profiles and scaffolders (C2) — every row of the draft named an output this repo does not produce.**

| Repo type | Vendored spec (C3) | Command | Output |
|---|---|---|---|
| `api` (go) | `openapi.yaml` (repo root) | `make generate` | `internal/openapi/openapi.gen.go` |
| `web` (nuxt) | `openapi.yaml` (repo root) | `pnpm openapi-types` | `shared/api-client/schema.d.ts` — `layers/shared/api-client/schema.d.ts` on the `starter` template |
| `mobile` (flutter) | `api/openapi.yaml` | pinned `openapi-generator` (dart-dio, Docker tag) → `dart run build_runner build` | `api/generated/**` |

Evidence: `profile-go.md:17,45,79` and `go-scaffold/scripts/scaffold.mjs:38-41,206` (one `oapi-codegen` run against one config — **not** per-module `include-tags`, and not `internal/gen/`); `profile-nuxt.md:168-174` and `nuxt-scaffold/scripts/scaffold.mjs:627-636`; `profile-flutter.md:95,210`.

**The mobile adapter is new work, not a delegation.** The draft assumed "the flutter scaffold's existing client-gen entry point"; no flutter scaffold exists (`scaffold-delegation.md:56`), `flutter create --empty` produces no API client (`:67`), and `profile-flutter.md:21,51`'s `generate:` is `build_runner` only. `profile-flutter.md:210` left the generator as an unresolved "or". Resolved: **`openapi-generator`, dart-dio, pinned by Docker tag, `serializationLibrary: json_serializable`** — matching the profile's stated single-`Dio` architecture and its existing exact pin on `json_serializable` (`:60`). The codegen-diff gates in `hook-guard.md → ## pre-commit: flutter` and `ci.md → ## github|gitlab: flutter` must run the API generator too and skip with a named, visible message when Docker is absent, per the convention `profile-flutter.md:30` already sets for that profile's conditional gates.

**The mobile seam is `tool/generate_api.sh`**, a repo-owned script holding the pinned
`openapi-generator` Docker invocation. The flutter profile writes it (PLAN task 18);
`contract_sync.mjs` only shells out to it, so the pinned tag lives with the repo that
depends on it rather than in this plugin.

**One contract per repo vendors at the adapter's path; several do not fit.** A repo
consuming one contract gets the table's path, which is what every shipped profile's
codegen config already points at. A repo consuming several gets
`<openapi-dir>/<name>.yaml` per contract — `openapi/core.yaml`, `api/openapi/billing.yaml`
— and that repo's own codegen config must point there. The script writes the files; it
never rewrites a repo's codegen config.

**Adapter readiness is asserted before anything is written.** A missing `Makefile`,
a missing `openapi-types` script, or a missing `tool/generate_api.sh` aborts with the
repo untouched. Vendoring a new contract and *then* failing to regenerate leaves exactly
the lock/spec/code drift this skill exists to prevent, and the CI job would only catch it
a commit later.

The vendored path is resolved from this table per repo type — never hardcoded (C3). Adapters run the repo's own pinned tool; the sync script carries no codegen logic itself. Generated output is committed; `.gitattributes` marks it `linguist-generated` so PR review focuses on the spec diff.

## 7. Guards

| Layer | Rule | Installed on |
|---|---|---|
| PreToolUse hook | deny `Edit`/`Write`/`MultiEdit` on the vendored spec path and `api-contract.lock` **unconditionally** | consumer repo types only |
| SessionStart hook | run `check`, surface the report as a notice, never write — by **extending `session-resume-check.mjs`**, not adding a second SessionStart script | consumer repo types only |
| CI job | `contract_sync.mjs sync` + `git diff --exit-code` — any drift between lock, spec, and generated code fails the build | consumer repos |

C4: the draft's "unless invoked by `contract_sync.mjs`" is not expressible. A PreToolUse hook sees a tool call, not process ancestry, and `isWriteShaped()` does not match a script's own `node:fs` writes inside a Bash call. The script therefore passes **by construction** — it never routes through `Edit`/`Write` — and its invocation goes in each consumer profile's `permissions.allow` so the run itself is not prompted.

The contracts repo gets none of these; its own CI (lint, `oasdiff`, tag, dispatch) is out of scope per §3.

## 8. Event flow

1. PR merges in `acme-contracts`; CI mints a GitHub App installation token and fires `repository_dispatch` (`contract-updated`, payload: tag) to each consumer repo. Actions' own `GITHUB_TOKEN` cannot dispatch across repos.
2. Consumer workflow (template shipped by this skill) runs `bump <tag>` on a branch and opens a PR titled with the tag and the story ID from the dispatch payload. **It mints an App token too (C10)** — a PR opened with Actions' `GITHUB_TOKEN` does not trigger workflows, so the PR's own §7 drift-check job would never run. The dispatch payload is untrusted text: sanitised into the PR title, never interpolated into a shell command.
3. Dev reviews the type diff and merges when ready — possibly not immediately (mobile lives on older API version files by design).

## 9. Skill package layout

```
skills/contract-sync/
├── SKILL.md                      # workflow + command reference
├── scripts/contract_sync.mjs
├── templates/
│   ├── api-contract.lock.json
│   └── workflows/contract-bump.yml   # dispatch consumer template
├── references/lock-format.md
└── evals/evals.json                  # required — docs_sync.mjs --check fails closed without it
```

Hook entries land in the repo-type profile bundles, not in this folder — the harness setup installs them per §7. Packaging debt beyond the tree: a `tools/docs-manifest.json` entry, `description` ≤ 350 chars, README regenerated, four version fields across three manifests, a CHANGELOG entry.

## 10. Acceptance criteria

- [ ] `bump v2.5.0` in a consumer repo updates lock, spec, and generated code in one commit; tampering with the fetched blob (checksum mismatch) aborts with no partial writes
- [ ] Re-tagging `v2.3.0` to a different commit makes `sync` fail naming old and new SHA
- [ ] Two repos pinning different `file` values at the same `commit` both sync correctly; two contracts in one repo vendor to separate paths rather than overwriting each other
- [ ] A missing codegen entry point aborts `sync` and `bump` with the spec and lock untouched
- [ ] Hand-editing the vendored spec in a Claude Code session is blocked by the hook; editing it outside a session is caught by the CI drift job
- [ ] `check` with no network exits 0 with a skip line, having made at most one attempt bounded by a 1500 ms timeout
- [ ] Dispatch template produces an auto-PR whose diff contains only lock + spec + generated code, **and whose own drift-check job runs** (C10)
- [ ] The scaffolded-Nuxt hint text no longer instructs a hand-copy the guard would block (C8)

## 11. Decisions and open questions

**Decided 2026-09-08:**

1. **Auth for local fetch** — `GITHUB_TOKEN`, then `gh auth token`, in that order. Nothing in this repo fetched anything or shelled out to `gh` before, so this is a new convention either way; `gh` is documented as a prerequisite, including for BA/QA-adjacent repos.
2. **Mobile entry point** — none existed. `openapi-generator` dart-dio, pinned by Docker tag, per §6.

**Open:**

1. **Adapter config location** (non-blocking): infer everything from repo type, or allow a `contractSync` block in the lock file for per-repo overrides (output dir, extra codegen flags)? — Tam
