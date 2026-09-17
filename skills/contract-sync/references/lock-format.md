# `api-contract.lock` — field semantics

JSON at the repo root. One entry per consumed contract.

```json
{
  "contracts": {
    "core": {
      "repo": "bigin-io/acme-contracts",
      "file": "openapi/core.v1.yaml",
      "vendoredTo": "api/openapi.yaml",
      "ref": "v2.3.0",
      "commit": "8f2a91c0d4b7e6f1a3c5d9e8b2f4a6c8d0e2f4a6",
      "sha256": "9c1185a5c5e9fc54612808977ee8f548b2258d31…"
    }
  }
}
```

| Field | Audience | Rule |
|---|---|---|
| `repo` | both | `owner/name` of the contracts repo |
| `file` | both | which API version file this repo consumes, **in the contracts repo**. Mobile may sit on `core.v1.yaml` while web is on `core.v2.yaml` — that is a supported steady state, not drift |
| `vendoredTo` | both | where the document lands **in this repo**. Optional, and the one field a human may set: it records a filing decision this repo owns, not something fetched. Recorded by `bump`; resolved from disk when absent |
| `ref` | humans | display and changelog lookup. **Never fetched by.** A ref is a label; labels move |
| `commit` | machine | the only thing ever fetched. Recorded by `bump` |
| `sha256` | machine | digest of the blob at that commit. Verified after every fetch, before any write |

`commit` and `sha256` are written by `bump` and must never be hand-edited. A hand-set value
either fails every later `sync` or, worse, blesses bytes nobody verified.

## Why two pins

`ref` alone is not a pin. Git tags are mutable: a contracts repo can re-tag `v2.3.0` onto a
different commit, and a consumer that only recorded the tag would silently vendor different
bytes under the same version number. So `sync` re-resolves `ref` and compares against
`commit`; a mismatch is a hard failure naming both SHAs, with no fallback and no re-pin.

`sha256` covers the rest: a commit is immutable, but the transport is not. The digest is
computed on the fetched bytes and compared before anything touches the working tree, so a
mismatch leaves the repo exactly as it was.

## Vendored paths

Resolved from the repo, never hardcoded — and this time the script means it. `vendoredPath()`
in `contract_sync.mjs` is the only implementation, and `node scripts/contract_sync.mjs where`
prints its answer so nothing else has to re-derive it. Precedence:

1. **`--spec-path <path>`** — the explicit override, and what `bump` then records.
2. **`vendoredTo` in the lock**, when the repo has recorded one. Authoritative even if the
   file is absent: that is how `sync` restores it to the right place in a fresh clone.
3. **The spec already on disk**, probed across every layout below — for a repo whose lock
   predates the field, or that vendored by hand once. Two candidates on disk and no
   `vendoredTo` is a hard failure naming both, not a guess.
4. **The repo type's default**, only for a repo with no vendored document at all.

`where` needs no lock and no network, so it also answers in a repo being set up.

| Repo type | Default (nothing vendored yet) | Codegen command |
|---|---|---|
| `api` (go) | `openapi.yaml` | `make generate` |
| `web` (nuxt) | `openapi.yaml` | `pnpm openapi-types` |
| `mobile` (flutter) | `api/openapi.yaml` | `tool/generate_api.sh` |

Those are **starting points for a fresh scaffold**, not where a given repo's contract is. A Go
service that vendors to `api/openapi.yaml` because it serves that file at runtime is filing it
correctly; step 3 finds it, `bump` records it, and `where` reports it to everything that needs
to scope a glob or a `paths:` entry at it.

A repo consuming **more than one** contract cannot use those single paths — one path
cannot hold two specs. Each contract then vendors to `<openapi-dir>/<name>.yaml`
(`openapi/core.yaml`, `api/openapi/billing.yaml`, …), and that repo's own codegen config
must point there. The script writes the files; it never rewrites a repo's codegen config.

## The document's kind is not this script's business

`file` names the document upstream, `vendoredTo` names it here, and the repo's own codegen
command interprets it. Nothing between those two points parses, validates or even recognises
the format — the blob is fetched, checksummed and written. **A vendored AsyncAPI document is
therefore supported**, at whatever filename the repo gives it (`api/collab.yaml`), and so is
anything else a codegen command can read. The defaults above are OpenAPI-shaped only because
that is what the shipped scaffolders produce.

What is **not** supported yet is a repo type with no adapter. A Node service has no marker
that distinguishes it from any other `package.json` repo, so `--repo-type` cannot name one and
`contract_sync.mjs` will not run there — a repo-type gap, not a spec-kind one. Tracked
separately; until then such a repo vendors with its own script.

`tool/generate_api.sh` is a repo-owned script holding the pinned `openapi-generator`
(dart-dio) Docker invocation. The pin lives with the repo that depends on it, so this
plugin carries no codegen logic and no generator version.

## Auth

`GITHUB_TOKEN` (or `GH_TOKEN`), then `gh auth token`, then unauthenticated. `gh` is a
prerequisite for consumer repos; the token is never logged, never echoed into an error
message, and never written to the lock.

`check` degrades quietly — offline, unauthenticated or rate-limited, it prints one skip
line and exits 0, because it runs at session start and must never hold a session up. Every
call it makes is bounded by a 1500 ms timeout and cached for 15 minutes.

`sync` and `bump` fail loudly instead: they write to the repo, and writing from an
unverified fetch is the one thing this file exists to prevent.
