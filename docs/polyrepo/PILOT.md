# The pilot — what validated this standard

Six repos under `tammai/`, built to answer one question: does any of the polyrepo
standard work outside this plugin's own tests?

It did not, in **thirteen places**. All are fixed — v1.89.0 through v1.96.3 — and each
one is a defect that every gate in this repo had passed, because each only appears when
something real runs.

Six repos under `tammai/`, exercising `bigin-skills`' polyrepo standard end to end.
| Repo | State |
|---|---|
| `pilot-specs` | 3 stories, REPO_MAP source, `story_lint.mjs`, dispatch workflow |
| `pilot-contracts` | `openapi/core.v1.yaml`, tagged `v1.0.0` and `v1.1.0` |
| `pilot-api` | Go. Contract vendored at `v1.1.0`, builds, tests green |
| `pilot-web` | Nuxt. Contract vendored, sample code reconciled, lint + typecheck green |
| `pilot-mobile` | Flutter. Contract vendored, dio client generated, analyze + test green |
| `pilot-qa` | Manual case, traceability stub, synced stories |

## What was proven, on real repos and real CI

- **The contract flow.** An additive change tagged in `pilot-contracts` dispatched to both
  code consumers, each opening a PR containing exactly three files — lock, vendored spec,
  generated client — merged, with `avatar_url` arriving in Go, TypeScript **and** Dart.
- **The story flow.** A story merged in `pilot-specs` dispatched to all four consumers,
  each opening a PR of files stamped `synced: true`, `story-meta/` untouched.
- **The gates.** The guard refuses to edit a synced story and names its sidecar. A UI story
  with no sidecar is not-ready everywhere; adding the sidecar flips it **without touching the
  story file**. A PR naming no story fails; naming one passes; a sync bot's own PR skips.
- **Local-first.** Every one of the above also works with no CI at all — `check` at session
  start, `bump`/`sync` by hand, and `verify` as an offline commit gate.

## What this is not

A client project. The contract is a scaffold's sample, the stories are invented, and the
`bigin-io` copies were deleted once the pilot moved here. Read it as a worked example of the
standard, not as a template to copy.

## Reproducing it

That is what `project-scaffold` is for, and it exists **because** doing it by hand here took
about twenty steps and four mistakes:

```sh
node skills/project-scaffold/scripts/project_scaffold.mjs \
  --project <slug> --owner <login> [--app-id <id> --app-key <path.pem>]
```

Then run `bigin-harness-setup` in each repo — it owns the governance overlay, and
`project-scaffold` deliberately writes none of it.
