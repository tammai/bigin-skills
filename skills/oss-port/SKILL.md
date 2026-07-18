---
name: oss-port
description: >-
  Reimplements ("clones") an existing project — usually open source — into a
  different tech stack through a gated, spec-first workflow (license check,
  behavioral inventory, per-module specs + contract extraction, a sprint plan
  for multi-session execution, vertical slice, then module-by-module port with
  parity tests). Use this skill whenever the user
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

Reimplement an existing project in a different tech stack without behavior drift. The source project is ground truth; `PORT/spec/` is its written-down behavioral contract, and the port is judged by parity, not by resemblance.

Core discipline: **never one-shot the port.** Every phase below ends in a gate — a concrete artifact the user approves before the next phase starts. Do not skip gates even if the user seems eager; a wrong pattern approved at the vertical slice costs one file to fix, the same pattern discovered at Phase 7 costs forty.

## Phase overview

| Phase | Output artifact | Gate |
|---|---|---|
| 0. License & scope | License verdict + scope note | User confirms legal/scope OK |
| 1. Reference setup | `reference/` (read-only source) | — (mechanical) |
| 2. Behavioral inventory | `PORT/FEATURES.md` | User trims/approves scope |
| 3. Spec & contract extraction | `PORT/spec/<module>.md` + `PORT/contract/` | User approves specs + contract |
| 4. Port plan | `PORT/PLAN.md` (sprints of modules) | User approves the plan |
| 5. Target scaffold | Runnable empty skeleton | CI green on empty skeleton |
| 6. Vertical slice | One entity, end-to-end, tested + `PORT/PATTERNS.md` | User approves the *patterns* |
| 7. Module-by-module port | Ported modules + parity tests | Tests green (capped retries) + independent verify + user approves, per module |
| 8. Parity report | `PORT/PARITY.md` | User signs off |

Phases 0–4 are analysis only — write no target code before the plan gate passes.

## Resuming a port

A port can span many sessions with no conversation memory carried between them. Before starting any work, check whether `PORT/` already exists in the target repo — if so, this is a resume, not a fresh start:

1. Read `PORT/PLAN.md` first, if it exists — the sprint/module tables say which sprint is in flight and which module is next.
2. Read `PORT/FEATURES.md` for row-level status. It is authoritative for module done-ness in both directions: if a module's rows are all checked but PLAN.md's Status doesn't say Done, correct PLAN.md's Status to Done; if PLAN.md's Status says Done or In progress but the module's rows aren't all checked, correct PLAN.md's Status back down to match FEATURES.md instead. Either direction is a mechanical correction, not the kind of disagreement that needs a user question.
3. Read `PORT/PATTERNS.md`, the in-flight module's `PORT/spec/<module>.md`, and `PORT/contract/` if present — those gates are already locked, don't re-derive or re-litigate them.
4. Only ask the user what's in progress if the disk artifacts disagree or are ambiguous (e.g. a module edited with no checkbox either way) — don't rely on conversation history to reconstruct state; a new session has none.

**If `PORT/` exists with a FEATURES.md but no PLAN.md**, check `PORT/spec/` before assuming why: partial `PORT/spec/<module>.md` files present means this is a current-version port resuming mid-Phase-3a — cross-check FEATURES.md's `Module` column against which modules already have a spec, finish the rest, then continue to Phase 4. No `PORT/spec/` at all means the port started under an older skill version: offer the user a choice — backfill the Phase 3–4 artifacts (specs + plan) for the remaining modules, or continue on FEATURES.md checkboxes alone.

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

Treat `reference/` as read-only. Never edit it, never copy files from it verbatim into the target. If the target repo already exists, add `reference/` to its `.gitignore` now; if Phase 5 will scaffold a fresh target repo instead, clone `reference/` as a sibling directory for the moment and fold it into the new repo's `.gitignore` once that repo exists.

Record source commit hash in `PORT/FEATURES.md` header — parity claims are meaningless without pinning what you ported.

### Optional: reference graph (graphify)

At the end of Phase 1, ask the user whether to build a `graphify` graph of `reference/` for structural navigation during Phases 2–7 — their call, no size check. If yes, follow `references/graph-index.md` to install graphify and index `./reference` (graph lands in `reference/graphify-out/`, covered by the `reference/` gitignore). If the graph exists in later phases, use it — but source reads stay ground truth. Never index the target/clone repo itself.

## Phase 2 — Behavioral inventory → FEATURES.md

Read the source and produce `PORT/FEATURES.md` using the template in `references/templates.md`. This is the single most important artifact: everything not in FEATURES.md will not be ported, and everything in it will be. If a `reference/graphify-out/` graph exists (Phase 1), use `graphify query`/`explain` to enumerate entry points and trace structure before reading — the graph navigates, the source read decides.

Inventory by reading in this order:
1. **Entry points** — routes/CLI commands/exported API. This is the feature surface.
2. **Data model** — entities, relations, constraints, migrations.
3. **Business rules** — validation, permissions, state machines, calculations. Read the code paths, not just names.
4. **Side effects** — emails, webhooks, queues, cron/background jobs, file I/O.
5. **Config & environment** — env vars, feature flags, secrets shape.
6. **Deliberate exclusions** — dead code, features the user descoped, source-stack-specific workarounds that don't apply to the target.

Rate each feature: `CORE` (port exactly), `ADAPT` (port with target-idiomatic changes, note them), `SKIP` (with reason). Present FEATURES.md to the user for trimming. **Gate: user approves.**

## Phase 3 — Spec & contract extraction

The specs and contract, not raw recollection of the source, become the reviewable source of truth from here on.

### 3a. Module decomposition + specs

Group FEATURES.md's CORE/ADAPT rows into named modules — dependency-coherent units, each small enough to port in one Phase 7 subagent run. Record each row's module in the FEATURES.md `Module` column. For each module, write `PORT/spec/<module>.md` from the template in `references/templates.md`, derived by reading the reference source (not the inventory alone): what the module does, inputs/outputs, business rules, edge cases and error behavior, side effects. Write it stack-neutrally except the Target adaptations section. Quote exact thresholds/conditions with `reference/` file:line — these are what drift first. If a `reference/graphify-out/` graph exists, use `graphify query`/`path` to trace module boundaries and dependencies — the graph navigates, the source read decides.

Scale to the port: for a small port (≤~5 modules), closely related modules may share one combined spec file, and each spec's depth should match the module's complexity — a CRUD module needs a few lines per section, a permissions engine needs every rule quoted. Never skip specs entirely.

### 3b. Contract

- **HTTP API source**: extract or generate an OpenAPI spec into `PORT/contract/openapi.yaml`. If the source has one, verify it against actual routes (they drift). If not, generate it from the route handlers.
- **CLI tool**: document commands/flags/exit codes/stdout formats in `PORT/contract/cli.md`.
- **Library**: document the public API surface with types in `PORT/contract/api.md`.
- **UI app**: document routes, key user flows, and the data each view consumes in `PORT/contract/views.md`. Pixel parity is out of scope unless the user asks.

Where possible, write the contract so a black-box test suite can run against *both* implementations (see `references/parity-testing.md`). Cross-check before gating: every contract surface maps to a module spec, and every spec's inputs/outputs point at a contract surface.

**Gate: user approves specs + contract.** Writing all specs upfront is the default. A very large port (>~10 modules) may defer later specs instead — see Phase 4 for how that deferral is recorded.

## Phase 4 — Port plan

Organize the approved module list into `PORT/PLAN.md` using the template in `references/templates.md`: sprints in dependency order (entities before features that use them), each sprint a batch of modules sized for roughly one working session, each with an explicit gate. FEATURES.md stays the fine-grained row-level ledger; PLAN.md is the sprint/module execution tracker and the first artifact read on resume. A small port still gets a PLAN.md — a single-sprint table is cheap and keeps resume behavior uniform.

For a very large port (>~10 modules), Phase 3 may have deferred specs for later sprints instead of writing them all upfront. If so, add a "write + approve specs" row to PLAN.md's **Modules** table before that sprint's first module row — the deferred sprint cannot start until that row is done and its specs are gated.

**Gate: user approves the plan.** Scope changes after this go back through the Phase 2 gate as a FEATURES.md amendment *and* an update to the affected spec and PLAN.md — never straight into code.

## Phase 5 — Target scaffold

Before scaffolding, check available skills for a stack-specific scaffolder (e.g. `go-scaffold`, `nodejs-scaffold`) and use it if the target stack matches — do not hand-roll a skeleton that a scaffold skill already standardizes.

The skeleton must be runnable and CI-green while empty: builds, lints, one placeholder test passes. Porting into a broken skeleton hides which failures are port bugs vs. setup bugs.

## Phase 6 — Vertical slice

Port exactly **one** representative entity end-to-end before anything else: its data model, migrations, handlers/commands, validation, error handling, and tests. Pick the entity that touches the most architectural decisions (auth, DB layer, validation style), not the simplest one.

The point of this phase is to fix the *patterns*: error shape, logging, transaction handling, test structure, directory layout. Present the slice and state the patterns explicitly ("errors are returned as X, validated at Y, tested via Z").

**Gate: user approves the patterns.** Every later module copies these patterns; changing them after Phase 7 starts means rework across the whole port. Once approved, write them down verbatim in `PORT/PATTERNS.md` — Phase 7 briefs a fresh subagent per module and needs a file to point it at, not a recollection from earlier in the conversation.

## Phase 7 — Module-by-module port

Work through PLAN.md sprint by sprint, modules in dependency order (entities before features that use them). A full port can run dozens of modules — doing each one inline in the main conversation (re-reading source, writing target code, running tests) makes context grow without bound over a long or unattended run, especially in "auto"/looped execution with no natural checkpoint to compact. Avoid that by dispatching each module to a fresh subagent via the Agent tool instead of porting it inline, and by pairing it with an independent check rather than trusting its own self-report of what it did:

1. If this module's spec was deferred at the Phase 3 gate, write and gate it now — before dispatching, never after.
2. Spawn a `general-purpose` subagent (not a `task-workflow` tier agent like `standard-worker` — those assume task-workflow's root `PLAN.md`, a verifier loop, and other harness scaffolding that a port target repo won't have unless `bigin-harness-setup` was separately run there — `PORT/PLAN.md` is this skill's own artifact, not that harness).
3. Give it a self-contained prompt: the module's `PORT/spec/<module>.md` in full, the module's exact FEATURES.md rows, the full contents of `PORT/PATTERNS.md`, the specific `reference/` file path(s) to port from, and the contract file(s) it must satisfy. If a `reference/graphify-out/` graph exists, say so in the brief so the subagent can use `graphify path`/`query` (with `--graph reference/graphify-out/graph.json`) to locate related reference code instead of re-discovering it by grep. Tell it to discover how the target repo actually runs tests (`package.json` scripts, `Makefile`, `go test`, etc.) rather than assuming a command. It should not need anything else from this conversation.
4. Instruct it to: re-read the source module in `reference/` (the spec says what the behavior must be; the source stays ground truth for exact mechanics — port from code, not from memory of Phase 2), implement using the patterns and target-stack idioms — **translate intent, not syntax**, see `references/idiom-translation.md` for common transliteration traps per stack pair — then write/extend parity tests against the contract and run them.
5. Have it return a short structured result only: module name, files touched, test command output (pass/fail), and any deviations from FEATURES.md or the patterns. Don't have it paste full diffs back.
6. If tests fail, resume the *same* subagent with the failure output (don't re-brief from scratch) and retry, capped at 3 rounds. Past that, stop and escalate to the user with what's failing rather than looping indefinitely or letting it force a pass.
7. Once tests are green, spawn a second, independent subagent restricted to read-only tools (`Read`, `Grep`, `Glob`, `Bash` — no `Write`/`Edit`) to check the diff against the module's `PORT/spec/<module>.md`, its FEATURES.md rows, and `PORT/PATTERNS.md` **directly**, not against the porting subagent's own summary. A subagent that both implements a module and self-reports its own deviations can soften or miss them — this closes the same self-report gap that `task-workflow`'s independent `verifier` agent closes for spec drift, applied here to port drift.
8. Present both the port summary and the independent verify result to the user. **Gate: user approves the module** before the next one starts — even in an unattended/auto run, stop and wait here rather than chaining straight to the next module. Pull up the actual diff if either summary reports a failure, a deviation, or the user asks to see it.
9. Once approved, mark the module's rows done in FEATURES.md with checkboxes and the test file that covers them, and update the module's Status in PLAN.md. When a sprint's last module lands, mark the sprint Done and stop at the sprint gate before starting the next sprint. At a sprint boundary: if stopping for the session, propose `session-handoff` so the next session resumes from PLAN.md; if the target repo has a knowledge bundle, offer `sprint-distill`.

Never batch multiple modules into one subagent call "to save time" — behavior drift compounds silently across batched modules, and a single subagent covering many modules just recreates the same unbounded-context problem this dispatch is meant to avoid. Neither the retry loop nor the independent verify step reopens that problem: the main thread only ever holds terse summaries, never the source reads, diffs, or retry rounds, no matter how many modules get approved in sequence.

## Phase 8 — Parity report

Produce `PORT/PARITY.md`: per feature in FEATURES.md — ported/adapted/skipped, covering test, and any known behavioral differences (there are always some: error message wording, timestamp precision, sort stability). Where a module has a `PORT/spec/<module>.md`, its Business rules and Side effects sections supersede FEATURES.md's terser entry for the same rows (see `references/templates.md`) — check the spec, not just FEATURES.md, before writing up a feature's behavior. Deliberate differences are fine; undocumented ones are bugs. The summary also confirms every PLAN.md sprint is Done — an unfinished sprint means the report is premature.

If a shared black-box suite exists, run it against both implementations and include the results.

## Anti-patterns (refuse these politely, cite the phase instead)

- **One-shot port** ("just rewrite the whole thing in Go") → run Phases 0–4 first; explain that the inventory *is* the fast path, because drift discovered late costs more than the analysis.
- **Transliteration** — callbacks emulated in Go, classes forced into idiomatic-functional stacks, ORMs reproduced where the target convention is query builders. The contract defines *what*; the target stack defines *how*.
- **Porting from memory** — always re-open the source file when porting its module.
- **Copying source code verbatim** into the target repo — license risk and stack mismatch in one move.
- **Silent scope growth** — features found mid-port that aren't in FEATURES.md go back through the Phase 2 gate as an amendment (FEATURES.md + the affected spec + PLAN.md), not straight into code.
- **Porting a module with no approved spec** — "the code is right there" is how behavior drift starts; a module whose spec was deferred gets its spec written and gated before its subagent is dispatched, not after.
- **Trusting the porting subagent's self-report as verification** — skipping Phase 7's independent verify step to save a round trip defeats its purpose; a subagent grading its own compliance is exactly the blind spot it exists to close.

## Reference files

- `references/templates.md` — FEATURES.md, spec, PLAN.md, and PARITY.md templates. Read when starting Phase 2, 3, 4, or 8.
- `references/parity-testing.md` — how to build a black-box suite that runs against both implementations. Read at Phase 3.
- `references/idiom-translation.md` — per-stack-pair transliteration traps (JS→Go, Python→TS, etc.). Read at Phase 6 and when starting Phase 7.
- `references/graph-index.md` — optional `graphify` graph of the `reference/` repo for structural navigation (user opts in at Phase 1). Read at Phase 1 when the user says yes.
