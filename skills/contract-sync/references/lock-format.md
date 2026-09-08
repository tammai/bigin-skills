# `api-contract.lock` — field semantics

JSON at the repo root. One entry per consumed contract.

```json
{
  "contracts": {
    "core": {
      "repo": "bigin-io/acme-contracts",
      "file": "openapi/core.v1.yaml",
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
| `file` | both | which API version file this repo consumes. Mobile may sit on `core.v1.yaml` while web is on `core.v2.yaml` — that is a supported steady state, not drift |
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

Resolved per repo type — never hardcoded. Detection reads `go.mod`, `nuxt.config.*` or
`pubspec.yaml`; `--repo-type` overrides it.

| Repo type | Vendored spec (one contract) | Codegen command |
|---|---|---|
| `api` (go) | `openapi.yaml` | `make generate` |
| `web` (nuxt) | `openapi.yaml` | `pnpm openapi-types` |
| `mobile` (flutter) | `api/openapi.yaml` | `tool/generate_api.sh` |

A repo consuming **more than one** contract cannot use those single paths — one path
cannot hold two specs. Each contract then vendors to `<openapi-dir>/<name>.yaml`
(`openapi/core.yaml`, `api/openapi/billing.yaml`, …), and that repo's own codegen config
must point there. The script writes the files; it never rewrites a repo's codegen config.

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
