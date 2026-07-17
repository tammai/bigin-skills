---
name: oss-port
description: >-
  Reimplements ("clones") an existing project — usually open source — into a
  different tech stack through a gated, spec-first workflow (license check,
  behavioral inventory, contract extraction, vertical slice, then
  module-by-module port with parity tests). Use this skill whenever the user
  wants to port, clone, rewrite, reimplement, migrate, or rebuild an existing
  codebase or OSS project in another language or framework — e.g. "port this
  Express app to Go", "clone this repo in Nuxt", "rewrite this Python tool in
  TypeScript", "reimplement X with our stack", "migrate this service from
  Node to Go", "chuyển repo này sang Go", "viết lại project này bằng Nuxt".
  Trigger even if the user only says "clone" or "copy" a project with a
  different stack implied. Do NOT use for same-stack refactors or version
  upgrades (e.g. Vue 2 → Vue 3) — those are migrations, not ports.
---

# OSS Port

Reimplement an existing project in a different tech stack without behavior drift. The source project is the spec; the port is judged by parity, not by resemblance.

Core discipline: **never one-shot the port.** Every phase below ends in a gate — a concrete artifact the user approves before the next phase starts. Do not skip gates even if the user seems eager; a wrong pattern approved at the vertical slice costs one file to fix, the same pattern discovered at Phase 6 costs forty.

## Phase overview

| Phase | Output artifact | Gate |
|---|---|---|
| 0. License & scope | License verdict + scope note | User confirms legal/scope OK |
| 1. Reference setup | `reference/` (read-only source) | — (mechanical) |
| 2. Behavioral inventory | `PORT/FEATURES.md` | User trims/approves scope |
| 3. Contract extraction | `PORT/contract/` (OpenAPI/schemas) | User approves contract |
| 4. Target scaffold | Runnable empty skeleton | CI green on empty skeleton |
| 5. Vertical slice | One entity, end-to-end, tested + `PORT/PATTERNS.md` | User approves the *patterns* |
| 6. Module-by-module port | Ported modules + parity tests | Tests green (capped retries) + independent verify + user approves, per module |
| 7. Parity report | `PORT/PARITY.md` | User signs off |

Phases 0–3 are analysis only — write no target code before the contract gate passes.

## Resuming a port

A port can span many sessions with no conversation memory carried between them. Before starting any work, check whether `PORT/` already exists in the target repo — if so, this is a resume, not a fresh start:

1. Read `PORT/FEATURES.md` first. Checked-off modules are done; the first unchecked module in dependency order is where Phase 6 picks back up.
2. Read `PORT/PATTERNS.md` and `PORT/contract/` if present — those gates are already locked, don't re-derive or re-litigate them.
3. Only ask the user what's in progress if `PORT/FEATURES.md` itself is ambiguous (e.g. a module edited with no checkbox either way) — don't rely on conversation history to reconstruct state; a new session has none.

## Phase 0 — License & scope

Read the source repo's LICENSE and any NOTICE files before anything else.

- **MIT / Apache-2.0 / BSD**: proceed; note attribution requirements in `PORT/FEATURES.md`.
- **GPL / AGPL / SSPL / BUSL**: STOP and tell the user plainly: a reimplementation that follows the source's structure and logic is likely a derivative work and inherits the license. Ask whether that is acceptable for their use before continuing. Do not soften this.
- **No license file**: default is all-rights-reserved. Warn the user; only a clean-room reimplementation from documented behavior (not source reading) avoids the issue, and this skill's workflow reads source. Get explicit confirmation.

Also confirm scope in one sentence with the user: full port, or a subset of features? This shapes the inventory.

## Phase 1 — Reference setup

```bash
git clone --depth 1 <source-url> reference/
```

Treat `reference/` as read-only. Never edit it, never copy files from it verbatim into the target. If the target repo already exists, add `reference/` to its `.gitignore` now; if Phase 4 will scaffold a fresh target repo instead, clone `reference/` as a sibling directory for the moment and fold it into the new repo's `.gitignore` once that repo exists.

Record source commit hash in `PORT/FEATURES.md` header — parity claims are meaningless without pinning what you ported.

## Phase 2 — Behavioral inventory → FEATURES.md

Read the source and produce `PORT/FEATURES.md` using the template in `references/templates.md`. This is the single most important artifact: everything not in FEATURES.md will not be ported, and everything in it will be.

Inventory by reading in this order:
1. **Entry points** — routes/CLI commands/exported API. This is the feature surface.
2. **Data model** — entities, relations, constraints, migrations.
3. **Business rules** — validation, permissions, state machines, calculations. Read the code paths, not just names.
4. **Side effects** — emails, webhooks, queues, cron/background jobs, file I/O.
5. **Config & environment** — env vars, feature flags, secrets shape.
6. **Deliberate exclusions** — dead code, features the user descoped, source-stack-specific workarounds that don't apply to the target.

Rate each feature: `CORE` (port exactly), `ADAPT` (port with target-idiomatic changes, note them), `SKIP` (with reason). Present FEATURES.md to the user for trimming. **Gate: user approves.**

## Phase 3 — Contract extraction

The contract, not the source code, becomes the source of truth from here on.

- **HTTP API source**: extract or generate an OpenAPI spec into `PORT/contract/openapi.yaml`. If the source has one, verify it against actual routes (they drift). If not, generate it from the route handlers.
- **CLI tool**: document commands/flags/exit codes/stdout formats in `PORT/contract/cli.md`.
- **Library**: document the public API surface with types in `PORT/contract/api.md`.
- **UI app**: document routes, key user flows, and the data each view consumes in `PORT/contract/views.md`. Pixel parity is out of scope unless the user asks.

Where possible, write the contract so a black-box test suite can run against *both* implementations (see `references/parity-testing.md`). **Gate: user approves contract.**

## Phase 4 — Target scaffold

Before scaffolding, check available skills for a stack-specific scaffolder (e.g. `go-scaffold`, `nodejs-scaffold`) and use it if the target stack matches — do not hand-roll a skeleton that a scaffold skill already standardizes.

The skeleton must be runnable and CI-green while empty: builds, lints, one placeholder test passes. Porting into a broken skeleton hides which failures are port bugs vs. setup bugs.

## Phase 5 — Vertical slice

Port exactly **one** representative entity end-to-end before anything else: its data model, migrations, handlers/commands, validation, error handling, and tests. Pick the entity that touches the most architectural decisions (auth, DB layer, validation style), not the simplest one.

The point of this phase is to fix the *patterns*: error shape, logging, transaction handling, test structure, directory layout. Present the slice and state the patterns explicitly ("errors are returned as X, validated at Y, tested via Z").

**Gate: user approves the patterns.** Every later module copies these patterns; changing them after Phase 6 starts means rework across the whole port. Once approved, write them down verbatim in `PORT/PATTERNS.md` — Phase 6 briefs a fresh subagent per module and needs a file to point it at, not a recollection from earlier in the conversation.

## Phase 6 — Module-by-module port

Work through FEATURES.md one module at a time, in dependency order (entities before features that use them). A full port can run dozens of modules — doing each one inline in the main conversation (re-reading source, writing target code, running tests) makes context grow without bound over a long or unattended run, especially in "auto"/looped execution with no natural checkpoint to compact. Avoid that by dispatching each module to a fresh subagent via the Agent tool instead of porting it inline, and by pairing it with an independent check rather than trusting its own self-report of what it did:

1. Spawn a `general-purpose` subagent (not a `task-workflow` tier agent like `standard-worker` — those assume `PLAN.md`, a verifier loop, and other harness scaffolding that a port target repo won't have unless `bigin-harness-setup` was separately run there).
2. Give it a self-contained prompt: the module's exact FEATURES.md rows, the full contents of `PORT/PATTERNS.md`, the specific `reference/` file path(s) to port from, and the contract file(s) it must satisfy. Tell it to discover how the target repo actually runs tests (`package.json` scripts, `Makefile`, `go test`, etc.) rather than assuming a command. It should not need anything else from this conversation.
3. Instruct it to: re-read the source module in `reference/` (port from code, not from memory of Phase 2), implement using the patterns and target-stack idioms — **translate intent, not syntax**, see `references/idiom-translation.md` for common transliteration traps per stack pair — then write/extend parity tests against the contract and run them.
4. Have it return a short structured result only: module name, files touched, test command output (pass/fail), and any deviations from FEATURES.md or the patterns. Don't have it paste full diffs back.
5. If tests fail, resume the *same* subagent with the failure output (don't re-brief from scratch) and retry, capped at 3 rounds. Past that, stop and escalate to the user with what's failing rather than looping indefinitely or letting it force a pass.
6. Once tests are green, spawn a second, independent subagent restricted to read-only tools (`Read`, `Grep`, `Glob`, `Bash` — no `Write`/`Edit`) to check the diff against the module's FEATURES.md rows and `PORT/PATTERNS.md` **directly**, not against the porting subagent's own summary. A subagent that both implements a module and self-reports its own deviations can soften or miss them — this closes the same self-report gap that `task-workflow`'s independent `verifier` agent closes for spec drift, applied here to port drift.
7. Present both the port summary and the independent verify result to the user. **Gate: user approves the module** before the next one starts — even in an unattended/auto run, stop and wait here rather than chaining straight to the next module. Pull up the actual diff if either summary reports a failure, a deviation, or the user asks to see it.
8. Once approved, mark the module done in FEATURES.md with a checkbox and the test file that covers it, then move to the next module.

Never batch multiple modules into one subagent call "to save time" — behavior drift compounds silently across batched modules, and a single subagent covering many modules just recreates the same unbounded-context problem this dispatch is meant to avoid. Neither the retry loop nor the independent verify step reopens that problem: the main thread only ever holds terse summaries, never the source reads, diffs, or retry rounds, no matter how many modules get approved in sequence.

## Phase 7 — Parity report

Produce `PORT/PARITY.md`: per feature in FEATURES.md — ported/adapted/skipped, covering test, and any known behavioral differences (there are always some: error message wording, timestamp precision, sort stability). Deliberate differences are fine; undocumented ones are bugs.

If a shared black-box suite exists, run it against both implementations and include the results.

## Anti-patterns (refuse these politely, cite the phase instead)

- **One-shot port** ("just rewrite the whole thing in Go") → run Phases 0–3 first; explain that the inventory *is* the fast path, because drift discovered late costs more than the analysis.
- **Transliteration** — callbacks emulated in Go, classes forced into idiomatic-functional stacks, ORMs reproduced where the target convention is query builders. The contract defines *what*; the target stack defines *how*.
- **Porting from memory** — always re-open the source file when porting its module.
- **Copying source code verbatim** into the target repo — license risk and stack mismatch in one move.
- **Silent scope growth** — features found mid-port that aren't in FEATURES.md go back through the Phase 2 gate as an amendment, not straight into code.
- **Trusting the porting subagent's self-report as verification** — skipping Phase 6's independent verify step to save a round trip defeats its purpose; a subagent grading its own compliance is exactly the blind spot it exists to close.

## Reference files

- `references/templates.md` — FEATURES.md and PARITY.md templates. Read when starting Phase 2 or 7.
- `references/parity-testing.md` — how to build a black-box suite that runs against both implementations. Read at Phase 3.
- `references/idiom-translation.md` — per-stack-pair transliteration traps (JS→Go, Python→TS, etc.). Read at Phase 5 and when starting Phase 6.
