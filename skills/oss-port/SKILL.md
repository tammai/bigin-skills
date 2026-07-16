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
| 5. Vertical slice | One entity, end-to-end, tested | User approves the *patterns* |
| 6. Module-by-module port | Ported modules + parity tests | Tests green per module |
| 7. Parity report | `PORT/PARITY.md` | User signs off |

Phases 0–3 are analysis only — write no target code before the contract gate passes.

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

Treat `reference/` as read-only. Never edit it, never copy files from it verbatim into the target. Add `reference/` to the target repo's `.gitignore`.

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

**Gate: user approves the patterns.** Every later module copies these patterns; changing them after Phase 6 starts means rework across the whole port.

## Phase 6 — Module-by-module port

Work through FEATURES.md one module at a time, in dependency order (entities before features that use them). For each module:

1. Re-read the source module in `reference/` — port from code, not from memory of Phase 2.
2. Implement using Phase 5 patterns and target-stack idioms. **Translate intent, not syntax** — see `references/idiom-translation.md` for the common transliteration traps per stack pair.
3. Write/extend parity tests against the contract.
4. Mark the module done in FEATURES.md with a checkbox and the test file that covers it.

Never batch multiple modules into one pass "to save time" — behavior drift compounds silently across batched modules.

## Phase 7 — Parity report

Produce `PORT/PARITY.md`: per feature in FEATURES.md — ported/adapted/skipped, covering test, and any known behavioral differences (there are always some: error message wording, timestamp precision, sort stability). Deliberate differences are fine; undocumented ones are bugs.

If a shared black-box suite exists, run it against both implementations and include the results.

## Anti-patterns (refuse these politely, cite the phase instead)

- **One-shot port** ("just rewrite the whole thing in Go") → run Phases 0–3 first; explain that the inventory *is* the fast path, because drift discovered late costs more than the analysis.
- **Transliteration** — callbacks emulated in Go, classes forced into idiomatic-functional stacks, ORMs reproduced where the target convention is query builders. The contract defines *what*; the target stack defines *how*.
- **Porting from memory** — always re-open the source file when porting its module.
- **Copying source code verbatim** into the target repo — license risk and stack mismatch in one move.
- **Silent scope growth** — features found mid-port that aren't in FEATURES.md go back through the Phase 2 gate as an amendment, not straight into code.

## Reference files

- `references/templates.md` — FEATURES.md and PARITY.md templates. Read when starting Phase 2 or 7.
- `references/parity-testing.md` — how to build a black-box suite that runs against both implementations. Read at Phase 3.
- `references/idiom-translation.md` — per-stack-pair transliteration traps (JS→Go, Python→TS, etc.). Read at Phase 5 and when starting Phase 6.
