---
name: contract-sync
description: "Vendors an OpenAPI contract at a pinned commit and regenerates its client — check, sync, bump against api-contract.lock. Triggers: 'absorb the contract bump', 'sync the API contract', 'our openapi.yaml is stale'."
argument-hint: [check | sync | bump <ref>]
effort: medium
allowed-tools: Bash(node scripts/contract_sync.mjs *) Bash(node ${CLAUDE_SKILL_DIR}/scripts/contract_sync.mjs *) Bash(gh auth token) Bash(git diff *)
---

# contract-sync

Keeps a consumer repo's vendored OpenAPI spec, its `api-contract.lock`, and its generated
client in lockstep with the contracts repo that owns them. The flow is one-way — contracts
→ consumers — and this script is the only thing that writes any of the three.

## When not to use

- **Changing an API.** That work belongs in the contracts repo, in its own session. If a
  shape the app needs doesn't exist, say so and stop; do not add it to the vendored file.
- **A repo with no `api-contract.lock`.** It isn't a consumer repo. Setting one up is
  `bigin-harness-setup` with a repo type of `api`, `web` or `mobile`.
- **Authoring a spec in a standalone (non-polyrepo) backend.** A Go repo that owns its own
  `openapi.yaml` keeps the `make generate` loop it already has.

## Step 1: Confirm the repo is set up

The script must be **committed into the repo**, not run from the plugin: CI runs it too,
and CI has no plugin installed. Check both:

```sh
test -f api-contract.lock && test -f scripts/contract_sync.mjs && echo ready
```

Missing `scripts/contract_sync.mjs` → copy this skill's own copy in and commit it:

```sh
mkdir -p scripts && cp ${CLAUDE_SKILL_DIR}/scripts/contract_sync.mjs scripts/
```

Missing `api-contract.lock` → start from `${CLAUDE_SKILL_DIR}/templates/api-contract.lock.json`,
fill in `repo` and `file`, then run `bump <ref>` to record `commit` and `sha256`. Never
hand-write those two fields; they are machine-verified and a wrong value fails every later
sync.

## Step 2: Read the current state

```sh
node scripts/contract_sync.mjs check
```

One line per contract:

```
core: lock v2.3.0 (8f2a91c) — latest v2.5.0; sync PR #142 open
```

`check` writes nothing, never fails a session, and degrades to a skip line when offline,
unauthenticated or rate-limited. It caches for 15 minutes, so repeated runs cost one
network call — pass `--no-cache` to force a fresh look.

## Step 3: Absorb a bump

```sh
node scripts/contract_sync.mjs bump v2.5.0
```

Resolves the tag to a commit, fetches the spec blob at that commit, records the commit and
its checksum in the lock, writes the vendored spec, and runs the repo's own codegen. Lock,
spec and generated code move in one commit — that is the whole point, and a PR containing
only two of the three is wrong.

To re-apply what the lock already pins (after a fresh clone, or to prove no drift):

```sh
node scripts/contract_sync.mjs sync
```

Then review the **type diff**, which is what the reviewer is actually approving:

```sh
git diff --stat && git diff -- <generated client path>
```

## Command reference

| Command | Effect | Writes |
|---|---|---|
| `check [--contract <name>] [--no-cache]` | compare lock against the contracts repo's latest tag; report | nothing |
| `verify [--contract <name>]` | **offline.** re-hash the vendored spec and compare with the lock | nothing |
| `sync [--contract <name>]` | verify the pinned tag still resolves to the pinned commit, fetch, checksum, vendor, regenerate | spec + generated code |
| `bump <ref> [--contract <name>] [--file <path>]` | resolve a new ref, record commit + checksum, vendor, regenerate | lock + spec + generated code |

`--repo-type api\|web\|mobile` overrides detection, which normally reads `go.mod`,
`nuxt.config.*` or `pubspec.yaml`. `--file` on `bump` switches which API version file this
repo consumes — that is how mobile stays on `core.v1.yaml` while web moves to `core.v2.yaml`.

Exit codes: `0` ok, `1` runtime failure, `2` bad usage.

## When it refuses

Three failures are deliberate and must not be worked around. In every one, nothing was
written — the repo is exactly as it was.

**The tag moved.** The lock's `ref` no longer resolves to its `commit`. A published version
number now points at different bytes. This is a contracts-repo problem: take it there. Do
not re-pin past it with a fresh `bump` to make the error go away.

**Checksum mismatch.** The blob fetched at the pinned commit is not the blob the lock
recorded. Report it; do not re-record the new checksum.

**Codegen entry point missing.** The repo has no `Makefile` (api), no `openapi-types`
script (web), or no `tool/generate_api.sh` (mobile). Fix the repo's toolchain, then re-run.
The check happens before any write precisely so a missing generator can't leave a new spec
next to a stale client.

## What holds this in place

- A PreToolUse guard denies `Edit`/`Write` on the vendored spec and `api-contract.lock` —
  unconditionally, including for you. Editing either by hand is never the answer.
- SessionStart surfaces `check`'s report as a notice. It writes nothing and never blocks.
- **`verify` at pre-commit** re-hashes the vendored spec against the lock, offline and in
  milliseconds. This is the check with no other cover: the PreToolUse guard only sees edits
  made *through an agent*, so a human with an editor bypasses it entirely.
- A CI job runs `sync` and `git diff --exit-code`, so drift between the lock and the
  *generated client* fails the build. Template: `templates/workflows/contract-drift.yml`.
  That one is CI-only — reproducing it needs the toolchain and a network fetch, which a
  commit hook may not depend on.
- A `repository_dispatch` from the contracts repo opens the bump PR automatically.
  Template: `templates/workflows/contract-bump.yml`.

Lock field semantics, the auth chain, and the multi-contract path convention:
`references/lock-format.md`.
