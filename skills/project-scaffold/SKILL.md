---
name: project-scaffold
description: "Stands up a whole polyrepo project — six repos (specs, contracts, api, web, mobile, qa), the right scaffold in each, locks and workflows wired between them. Triggers: 'set up a new polyrepo project', 'scaffold the six repos'."
argument-hint: [project slug]
effort: medium
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/project_scaffold.mjs *) Bash(gh auth status) Bash(gh api user)
---

# project-scaffold

One command for what otherwise takes about twenty manual steps: six repos, the right scaffold in each code repo, and the connective tissue between them — which repo pairs with which, what each lock points at, which toolchain each workflow needs.

The standard it builds is described in `${CLAUDE_PLUGIN_ROOT}/docs/polyrepo/README.md`.

## When not to use

- **A single repo.** That's `bigin-harness-setup`, or one of the `*-scaffold` skills for an empty one. Six repos for a project that has one frontend and no separate QA team is ceremony.
- **A project that already exists.** This creates and adopts, but it will not migrate a working repo into the standard — that's a per-repo `bigin-harness-setup` run plus a contract-sync setup.
- **Just adding a repo** to a project that already follows the standard. Use `--repos` with the one you need.

A project that has no mobile app, or no separate web frontend, is the same command with the types it does have: `--repos specs,contracts,api,web,qa`. Everything downstream is keyed off repo type, so the omitted one leaves no lock, no codegen workflow and no entry in the consumer list.

## Step 1: Get the slug, and decide about remotes

Ask for the project slug if it wasn't given — kebab-case, and it becomes the prefix of all six repo names, which is what `Phase 0a` reads to decide each repo's type.

Then ask **one** question, because the answer is not reversible by default: *create the GitHub repos now, or set up locally first?* Local-only is a real mode — the pilot ran that way for hours — and remotes can be added later by re-running with `--owner`.

If they want remotes, confirm the **owner** explicitly. Never infer it from `gh auth status`: the accident this prevents is six repos appearing in an organisation nobody meant to touch.

## Step 2: Run it

```sh
node ${CLAUDE_SKILL_DIR}/scripts/project_scaffold.mjs --project <slug> [--dir <path>]
     [--owner <login>] [--app-id <id> --app-key <path.pem>]
     [--repos specs,contracts,api,web,mobile,qa] [--no-install]
```

Stream its output. It creates each repo, seeds it, wires it, commits, and — with `--owner` — creates and pushes the remote. Every skipped step is named in the summary rather than passed over: a missing toolchain, an unreachable API, a repo it adopted rather than created.

`--app-id`/`--app-key` set `CONTRACT_APP_ID` and `CONTRACT_APP_PRIVATE_KEY` on every repo. The key goes from disk to `gh` and is never read into the script, logged, or copied. They need `--owner`, since there is nothing to set them on otherwise.

`STORY_CONSUMERS` on the specs repo is **wiring, not a credential** — the story-dispatch workflow reads it whoever created the App — so `--owner` alone sets it. It is the project's consumer list, so a `--repos` run that adds one repo **unions** it into whatever is already there rather than replacing it, and a value it cannot read or parse is reported and left alone, since a wrong list here fails silently.

## Step 3: Install the harness in each repo

**The script writes no guard, no rule file, no `settings.json` and no `CLAUDE.md`.** `bigin-harness-setup` owns the governance overlay, and a second implementation here would drift the day either changed.

So run it once per repo. Phase 0a reads the name suffix, confirms it, and installs that repo's profile — plus, on `api`/`web`/`mobile`, the consumer overlay and `vendored-contract-guard.mjs`.

## Step 4: The first contract

The contracts repo is seeded with an empty `openapi/core.v1.yaml`. Write the real one there, tag it, then in each consumer:

```sh
node scripts/contract_sync.mjs bump <tag>
```

That records the commit and checksum, vendors the spec, and regenerates the client — in one commit, which is the invariant everything downstream depends on.

## Step 5: Say what is left

Three things this cannot do, and the summary should name whichever apply:

1. **Create the GitHub App.** Web UI only. Until it exists and is *installed on the owner*, every dispatch fails at "Mint an App token" with a 404.
2. **Fix Actions billing.** A failed payment or a $0 spending limit blocks Actions across every repo an account owns, and the symptom is a job dying in about three seconds with no log. Worth checking before blaming a workflow.
3. **Seed `.bmad-core`.** BA workflow depth is a deliberate placeholder; the specs repo gets the directory structure and `story_lint.mjs`, not a story template.

Everything the standard needs beyond that works without CI at all — see `references/ci.md` → `## Running the standard without CI`.
