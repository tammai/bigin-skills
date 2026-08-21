# Established-repo mode

Most discovery does not start on an empty directory. It starts on a repo that already answers
half the questions, where the fastest way to lose the user's confidence is to ask them
something their own `CLAUDE.md` says on line 3.

**A repo is established if it carries anything worth deriving from: application source, project
documentation, or a `knowledge/` bundle.** Any one of the three is enough on its own. Don't test
this by looking for source files — a repo holding a bundle and some markdown and no code at all
is one of the richest reads you will ever get here, because a bundle is a previous discovery's
conclusions already written down, and a `CLAUDE.md` plus a `docs/` tree answers most of a brief's
Constraints section without a single question.

Only a genuinely bare repo is greenfield: a licence, a `.gitignore`, an empty README, nothing
else. Say so and go straight to elicitation.

## Read in this order

Cheapest and highest-signal first. Stop as soon as the brief's sections are answerable — this
is a read for a product brief, not a code review.

| Read | What it answers |
| --- | --- |
| `docs/product/` | whether a brief or PRD already exists. This is the resume check, and it comes first for that reason |
| `CLAUDE.md` / `AGENTS.md` | the stack, the commands, the conventions, the boundaries someone already decided |
| `README.md` | what the product claims to be, and who it claims to be for |
| `knowledge/index.md` | the contracts and invariants already written down — one line each, and enough for most of this |
| `docs/` | existing product or architecture documents, and how much of them survived contact |
| package manifests (`package.json`, `go.mod`, `pubspec.yaml`, …) | the stack as it actually is, and the declared scripts |
| the surface inventory — routes, handlers, pages, screens | what the product *does* today, which is rarely what the README says it does |
| the test suite | the acceptance criteria that already exist. The most reliable written statement of intended behaviour in any repo, because it is the only one that fails when it's wrong |
| `git log --oneline -30` | what is moving right now, which tells you what the ask is really adjacent to |

## Never ask what the repo answers

| Don't ask | Read instead |
| --- | --- |
| "What stack is this?" | package manifest, `CLAUDE.md` |
| "How do you run the tests?" | `CLAUDE.md`, the manifest's scripts, the CI config |
| "What are your conventions?" | `.claude/rules/`, `CLAUDE.md` |
| "What does the system do today?" | the surface inventory, then the tests |
| "What's the data model?" | migrations, schema, or the generated contract |
| "What have you already decided?" | `knowledge/index.md`, then the concept files it names |
| "Is there an API contract?" | `openapi.yaml` or its equivalent, plus `knowledge/`'s contract concepts |

What is left after this read is the discovery question — and it is usually much smaller than
the original ask suggested. Say what you derived and what remains, then ask only the remainder.

## Run it before you write it down

**Every command that appears in the brief was executed in the session that wrote the brief.**
Not inferred from a README, not copied from `CLAUDE.md`, not assumed because the file exists.
Record the command and its verdict.

A command that fails is recorded as failing. It is a finding — often the most useful one in the
whole read, because a documented command that no longer runs is a claim the repo has been
making to every agent and every new hire since it broke. Never quietly upgrade a failure into
the aspiration the doc stated.

Where a document and the running code disagree, **the code wins**, and the disagreement itself
goes in `## Derived from`. Don't silently adopt either side.

### Read-only, without exception

| Fine to run | Never run |
| --- | --- |
| the repo's declared lint, typecheck, test, and build commands | migrations, seeds, or anything that touches a database |
| `git log`, `git status`, `git diff`, `git ls-files`, `git remote -v` | `git push`, `git commit`, anything that writes to a remote |
| `--version`, `--help`, dependency listing, route listing | package installs — they rewrite the lockfile |
| generator or formatter **check** modes (`--check`, `--dry-run`) | generator or formatter **write** modes (`--fix`, `--write`) |

Build caches and coverage output are acceptable side effects. A tracked file, a database, or a
remote is not. **If the only way to verify a claim is a mutating command, don't run it** —
record the claim as unverified and say which command would settle it. An unverified line in a
brief costs a sentence; a discovery session that ran a migration costs considerably more.

A command suggested by a document is not thereby safe. Apply the table above to it, not the
document's confidence.

## Secrets: record the provenance, never the value

Deriving a brief means grepping source, and source contains configuration. The rule is absolute:

**Write down where a value comes from. Never write down the value.**

```
Good:  Payments provider — credentials supplied via STRIPE_SECRET_KEY, read in
       server/utils/payments.ts, absent from the repo (documented in .env.example).
Bad:   Payments provider — key sk_live_… in server/utils/payments.ts.
```

In practice:

- Grep for **key names**, not values, and never echo a matched line containing one. This applies
  to the conversation as much as to the file: a transcript is as durable as a commit, and the
  brief is not the only place a leaked value survives.
- `.env` files are usually untracked, so prefer `.env.example` and the code's own reads
  (`process.env.X`, `os.Getenv("X")`) — those give you the full inventory of what the system
  needs without ever reading a real value.
- A secret found **committed in tracked source** is a security finding, not a brief line.
  Report it to the user directly, name the file and the key, quote nothing, and let them decide
  whether to rotate before this goes any further. Do not put it in `docs/product/brief.md`,
  where writing it down is what makes it permanent.

What the brief legitimately needs from configuration is the **shape** of the integration — which
third parties the system depends on, which are configured per environment, and which are
missing. All three are answerable from names alone.

## What this produces

The brief's `## Derived from` section: one line per claim that came from the repo rather than
from the user, naming what was read or run and what it established. That section is what makes
the brief auditable — a reader can tell which sentences are the repo's and which are the user's,
and re-run the second column to check the first.
