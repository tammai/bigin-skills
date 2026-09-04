# Tauri Profile Templates

Stack: Tauri 2 desktop app — Nuxt 4 SPA frontend, Rust shell, against an existing HTTP API

Marker file: `src-tauri/tauri.conf.json` — and it is checked **before** `nuxt.config.ts`, because a Tauri + Nuxt repo has both. First match wins in the Phase 0 ladder, so if `nuxt` were checked first every Tauri repo would be onboarded as a web app: `ssr: true`, a `server/` BFF that does not exist at runtime, and no rule anywhere about capabilities, the updater, or the IPC trust boundary. The ordering is the whole mechanism — see `references/profile-detection.md`.

Empty repo → the frontend is scaffolded by **`nuxt-scaffold`**, then the Rust half by **`pnpm tauri init`** (Phase 0.5, pinned arguments — see `references/scaffold-delegation.md`). There is no `tauri-scaffold` skill: `create-tauri-app` has no Nuxt template, and what one would add past `tauri init` (the capability set, the keychain and store layers, the typed API client, the signing and update path) is exactly what the project's architecture ADRs decide.

The architecture this profile writes conventions for: **the webview never talks to the network.** Every call the app makes crosses the IPC boundary into Rust, and Rust owns the HTTP client, the tokens, and the local cache. That is the same rule the `nuxt` profile states as "the browser never calls the backend directly" — with `#[tauri::command]` in place of `server/api/`, and a stronger reason, because a desktop bundle sits on the user's disk where they can read every byte of it.

**Every rule below is stated here in full.** This file is the source, not a summary of one — `bigin-skills` depends on no other plugin, so a profile must never defer to a document outside this repo for the conventions it writes.

---

## Commands

```
lint:       pnpm lint && cargo fmt --manifest-path src-tauri/Cargo.toml --check && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
format:     pnpm lint --fix && cargo fmt --manifest-path src-tauri/Cargo.toml
typecheck:  pnpm type-check
test:       pnpm test --run && cargo test --manifest-path src-tauri/Cargo.toml
dev:        pnpm tauri dev
build:      pnpm tauri build
generate:   pnpm openapi:generate          # typed client from the frozen contract
```

**`cargo fmt` without `--check` rewrites every unformatted file in `src-tauri/` and exits 0.** In a pre-commit hook that reformats files the developer never staged, leaves the staged snapshot unformatted, and lands a commit that differs from the one the gate checked. `--check` makes it a pure check — writes nothing, exits 1 on a diff. Identical trap to `dart format` in the `flutter` profile; use the bare form only when you actually want the files rewritten.

**`--manifest-path` rather than `cd src-tauri`** so every row runs from the repo root and can be pasted straight out of `CLAUDE.md`. In the generated shell gates a `(cd src-tauri && …)` subshell reads better and does the same thing; both forms are correct.

**There is no Rust typecheck row, on purpose.** `cargo clippy` *is* a full type-check — it runs the compiler front end and then adds lints. Adding `cargo check` next to it compiles the same dependency graph a second time for no finding the first pass didn't already have. The `{TYPECHECK}` slot is `pnpm type-check` (vue-tsc) alone, and `{LINT}` carries the three Rust-and-frontend checks.

**`cargo clippy` on a cold `target/` takes minutes**, because a Tauri dependency tree is large. On a warm one it is seconds. This is the one gate a team will want to move to CI-only after a `cargo clean`; the honest trade is that a clippy finding caught at commit time is a finding that never reaches a reviewer, and `target/` stays warm in normal use. Say so rather than letting someone discover it on their first commit.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Tauri 2 desktop app · Nuxt 4 SPA frontend · Rust shell
Runtime: Node ≥22 · pnpm only · Rust toolchain pinned in `rust-toolchain.toml`
The HTTP API is an existing service this repo does not own. Its contract is frozen input.

## Commands
| Purpose   | Command                                                                 |
|-----------|-------------------------------------------------------------------------|
| dev       | `pnpm tauri dev`                                                        |
| build     | `pnpm tauri build`                                                      |
| test      | `pnpm test --run` **and** `cargo test --manifest-path src-tauri/Cargo.toml` |
| typecheck | `pnpm type-check`                                                       |
| lint      | `pnpm lint`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` |
| format    | `pnpm lint --fix` and `cargo fmt --manifest-path src-tauri/Cargo.toml`  |
| generate  | `pnpm openapi:generate`                                                 |

## Rules
See `.claude/rules/` — path-scoped conventions (frontend and Rust), testing, security, architecture.

## Hard Rules (non-negotiable)
- **The webview holds no secret and makes no network call.** No access token, refresh token, API key or signing key in `app/`, in `localStorage`/`sessionStorage`, or in the JS bundle — a desktop bundle is a file on the user's disk, readable by them and by anything running as them. Every call goes `invoke()` → `#[tauri::command]` → Rust HTTP client. Both halves are grep steps in the pre-commit gate and CI.
- **No `http(s)://` literal in `app/`.** The API base URL is Rust's, read from `tauri.conf.json` or the build environment. A doc link is fine — mark it `// url-literal-ok`.
- **`tauri.conf.json` is configuration, not secrecy.** Every value in it is recoverable from the shipped binary. Base URLs and feature flags: fine. Anything whose disclosure matters: server-side, or in the OS keychain.
- **No `server/` directory.** Nuxt runs as a static SPA (`ssr: false`); there is no Node process at runtime, so a Nitro route works in `pnpm tauri dev` and silently vanishes from `pnpm tauri build`. The gate fails on the directory existing.
- **Capabilities are the security boundary, and they are default-deny.** Every permission is written into `src-tauri/capabilities/*.json` scoped to a named window. `shell:allow-execute`, `shell:allow-spawn`, and a `"*"` in any scope are refused by the gate. Never `tauri-plugin-sql` — it hands arbitrary SQL execution to the webview, which is the boundary gone.
- **`app.security.csp` is set to a real policy.** Tauri enables CSP protection *only* if the config sets it, so an absent or `null` value is not "no policy needed" — it is the webview's isolation switched off. Both fail the gate.
- `identifier` in `tauri.conf.json` is OS and store identity. It derives the app-data directory and the update feed, so changing it later orphans every installed user's local data. Set it from the ADR before the first build — Tauri refuses to bundle while it is still `com.tauri.dev`, which is the one error message here that saves you.
- The updater's minisign **private** key never enters the repo (`TAURI_SIGNING_PRIVATE_KEY` in CI secrets). Lose it and no installed copy of the app can ever be updated again — there is no recovery path but a manual reinstall by every user.
- `Cargo.lock` and `pnpm-lock.yaml` are committed. `src-tauri/target/`, `.output/`, `dist/` are not.
- No `--no-verify`. No `unsafe`. No `#[allow(...)]`, `eslint-disable`, `@ts-ignore` or `as any` without a comment saying why the rule is wrong here.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- Every bug fix ships a regression test that fails before the fix (`bugfix-test-guard.mjs`). It matches files, so put the Rust one in `src-tauri/tests/` — an inline `#[cfg(test)]` module is invisible to it and needs `[no-test]` plus the reason.

## Task workflow
Non-trivial features: /task-workflow. Bugs: /debug-workflow. Review: /code-review, /security-review.
```

---

## conventions-frontend.md Template

Paths frontmatter scopes this file to the Nuxt half — only loaded when frontend files are in context.

```markdown
---
paths:
  - "app/**"
  - "shared/**"
  - "nuxt.config.ts"
---
# Frontend Conventions (Nuxt SPA)

## What this frontend is not
It is a Nuxt app with the server half deliberately removed. `ssr: false`, no `server/` directory, no Nitro route, no `useFetch` against a remote origin, no `runtimeConfig` secret. Nuxt is here for the router, the component conventions, Nuxt UI and the build — not for its backend. Every Nuxt tutorial answer that reaches for `server/api/` is wrong in this repo, and wrong in a way that passes `pnpm dev`.

Required in `nuxt.config.ts`: `ssr: false`, and the build that Tauri consumes is `pnpm generate` → `.output/public` (`nuxi build` still emits a Nitro server even with `ssr: false`, and a Tauri bundle has nothing to run it with).

**Deep routes are the thing to test early.** The bundle is served over Tauri's asset protocol, which resolves real files. A route with no `index.html` of its own does not resolve on a cold load — so either prerender the route list (`nitro.prerender.routes`) or use hash-mode routing, and write the cold-load-a-deep-route test before there are twelve routes to retrofit.

## Naming
- Components: PascalCase (`OrderCard.vue`). Composables: camelCase with `use` (`useOrderList.ts`). Pinia stores: `use<Thing>Store.ts`. Types: PascalCase.

## The IPC layer is the only way out
- Components and pages call composables. Composables call **one** typed IPC wrapper per domain in `app/ipc/<domain>.ts`. Nothing else in `app/` imports `invoke`.
- `import { invoke } from '@tauri-apps/api/core'` — `@tauri-apps/api/tauri` is the Tauri 1 path and does not exist in 2.
- One wrapper file per domain, each function named for the Rust command it calls, arguments and return type stated. The wrapper is where a Rust `AppError` becomes a typed frontend error; nothing above it sees a raw IPC rejection.
- No `fetch`, `$fetch`, `useFetch` or `axios` against a remote origin anywhere in `app/`. If a feature seems to need one, the command is missing on the Rust side — that is the change to make.

## State
- Client state (UI, filters, drafts, the session's *shape*, never its token) → Pinia stores in `app/stores/`.
- Server data → Pinia Colada (`useQuery`/`useMutation`) over the IPC wrappers, one file per domain in `app/composables/queries/<domain>.ts`. Keys defined there once, never inline: `['<domain>', '<scope>', ...params]`.
- Never wrap `useQuery`/`useMutation` inside a Pinia store — Colada's cache already lives in Pinia, so wrapping duplicates the state and breaks lifecycle tracking.
- Cache invalidation happens inside the mutation composable via `useQueryCache()`, never in a component.

## Errors
- Rust returns a tagged `AppError`. The UI switches on the tag — `Offline`, `Unauthenticated`, `Forbidden`, `NotFound`, `Conflict`, `Internal` — never on a message string, which is untranslatable and changes without notice.
- An `Internal` error shows a generic message and reports; it never renders the Rust detail, which can carry a URL, a header or a row of somebody's data.

## Desktop-shaped UI
- The window is resizable and the user will make it small and very large. No fixed pixel heights on containers; the scroll container is explicit.
- Native affordances belong to Rust: menus, tray, notifications, file dialogs, deep links. A web-styled reimplementation of a system dialog is the wrong half of the app.
- Keyboard is a first-class input on desktop, not a nicety. Every destructive action has a confirm step and `Esc` closes it.
```

---

## conventions-rust.md Template

Paths frontmatter scopes this file to the Rust half.

```markdown
---
paths:
  - "src-tauri/**"
---
# Rust Conventions (the Tauri shell)

## Layering

```
app/ (webview)  ──invoke──▶  commands/  ──▶  api/ ──HTTP──▶ the existing service
                                  │           store/  (SQLite cache)
                                  └──▶        secrets/ (OS keychain)
                                              error.rs (one AppError)
```

- **`commands/`** — thin IPC adapters, one module per domain. Each `#[tauri::command]` validates its arguments, delegates, and maps to `AppError`. No HTTP call, no SQL, no business rule lives here. A command longer than about twenty lines is holding logic that belongs a layer down.
- **`api/`** — the client for the frozen contract, plus DTO↔domain mapping. The only module that constructs a `reqwest::Client` or knows the base URL.
- **`store/`** — SQLite (`sqlx` or `rusqlite`), schema versions, migrations. A **cache**: the service is the source of truth.
- **`secrets/`** — the OS keychain (`keyring`), the only place a token is read or written.
- **`error.rs`** — one `AppError`, and it is the only type that crosses IPC as an error.

## Every command argument is attacker-controlled
Treat the IPC boundary the way you would treat an HTTP handler, because a webview that ever loads remote content — an embedded page, an OAuth redirect, a rendered snippet — can call every command you exposed.

- A path argument is canonicalized and asserted to be inside an allowed root before it is opened. `..` is the whole attack.
- Nothing is interpolated into a shell command or a SQL string. Parameter binding always; `Command::new` with an argument vector, never a string a user contributed to.
- Numeric and length bounds are checked at the command, not hoped for from the UI. The UI is the part the attacker replaced.

## Errors
- One `AppError` enum, `thiserror` for the variants, `serde::Serialize` derived — a `#[tauri::command]` returning `Result<T, E>` requires `E: Serialize`, and `anyhow::Error` is not. Reaching for `anyhow` in a command signature is the first thing that will not compile; the fix is to map into `AppError`, not to stringify.
- Serialize as a **tag plus an optional user-safe message**, never `Display` of the underlying error. A `reqwest` error's `Display` can contain the URL; a `sqlx` one can contain a row.
- Offline, unauthenticated, forbidden, not-found and conflict are distinct variants because the UI must behave differently for each. Everything else is `Internal`: logged with its cause, sent without it.
- No `let _ = …` on a fallible call and no swallowed error. `unwrap()`/`expect()` are denied outside `#[cfg(test)]` — a panic on the main thread closes the window with no message, which is the worst failure this app can produce.

## Async and the main thread
- **A synchronous `#[tauri::command]` runs on the main thread and freezes the UI for its whole duration.** Anything that touches the network, the disk or the keychain is `async`.
- An `async` command runs on Tauri's Tokio runtime, which does not make blocking work non-blocking: a synchronous SQLite call inside an `async` command still occupies a runtime worker. Wrap it in `spawn_blocking`, or use an async driver.
- Long work reports progress by emitting an event to the window, not by holding the command open. A command that takes thirty seconds is a spinner the user cannot cancel.

## HTTP
- One `reqwest::Client`, built once in `api/` and held in Tauri's managed state. Building one per call throws away the connection pool and, on some platforms, leaks a file descriptor per request.
- **Connect and total timeouts are set explicitly.** `reqwest` has no default total timeout: that is how the app hangs forever on a captive-portal Wi-Fi that accepts the connection and answers nothing.
- Token refresh is serialized behind a single lock or a dedicated task — concurrent 401s must produce one refresh and a queue of retries. On a service that rotates refresh tokens, the losing races invalidate the winner's and log the user out at random.
- Retry only idempotent requests, with backoff and a cap. A retried `POST` is a duplicate order.
- The token is read from `secrets/` at the point of use and never logged, never returned across IPC, never written to the store.

## Secrets
- `keyring` (macOS Keychain, Windows Credential Manager, Linux Secret Service) for tokens. Never the SQLite store, never a plain file, never a `tauri.conf.json` value.
- **Linux Secret Service needs a running daemon**, and a headless CI runner has none — so the keychain sits behind a trait with a fake for tests, or every Rust test that touches auth fails on CI for a reason unrelated to the code.

## Store
- The database lives under `AppHandle::path().app_data_dir()`, resolved at runtime. Never a hardcoded path, and never next to the executable — on Windows that directory is not writable for an installed app.
- Schema changes are numbered migrations, forward-only, applied on launch inside a transaction. **A schema bump ships a migration test for that step**, including the interrupted-and-resumed case: a migration that fails on launch has no hotfix path, because the user has the old binary and it will not start.
- Offline policy is declared per feature — online-only, read-through cache with a stated TTL, or an outbox — and written into that feature's spec. An outbox nobody designed is a data-loss bug with a queue in front of it.

## Lints
`src-tauri/Cargo.toml` carries the policy so it applies to every build, not just to whoever remembers the flag:

```toml
[lints.rust]
unsafe_code = "forbid"

[lints.clippy]
unwrap_used = "deny"
expect_used = "deny"
```

`[lints]` applies to test targets too, so a test module that legitimately unwraps opens with `#![allow(clippy::unwrap_used, clippy::expect_used)]` — a stated, scoped exception rather than a weakened policy.
```

---

## testing.md Template

```markdown
---
paths:
  - "tests/**"
  - "src-tauri/tests/**"
  - "vitest.config.ts"
---
# Testing Conventions

## Where each thing is tested
| Layer | What | How |
|---|---|---|
| Rust unit | mappers, validation, error mapping, pure helpers | `#[cfg(test)]` beside the code, `cargo test` |
| Rust integration | commands, store migrations, the API client against a stub | `src-tauri/tests/*.rs`; `tauri::test::mock_builder()` for commands (needs the `test` feature on the `tauri` crate) |
| frontend unit | composables, stores, IPC wrappers | Vitest; `mockIPC` from `@tauri-apps/api/mocks`, `clearMocks()` in `afterEach` |
| frontend component | one test per screen | Vitest + Testing Library, IPC mocked |
| E2E | one per acceptance criterion | WebDriver — the **WebdriverIO service**, not `tauri-driver` directly |

**Use the WebdriverIO service, not `tauri-driver` directly.** Driven directly, `tauri-driver` supports only Windows and Linux on desktop — macOS has no WKWebView driver tool. The WebdriverIO service works on all three because it embeds its own WebDriver server, which is the whole reason to prefer it: on a Mac team, driving `tauri-driver` directly means E2E runs in CI and on nobody's machine, and a suite no developer can run locally is a suite whose failures nobody reads.

## Rules
- **Regression tests for bug fixes go in `src-tauri/tests/` or a frontend `*.test.ts`.** `bugfix-test-guard.mjs` matches file paths and cannot see an inline `#[cfg(test)]` module, so an inline-only fix commit is blocked and needs `[no-test]` with the reason. Prefer the integration test — a bug fix is behavioural.
- **Fixtures come from the contract's examples**, never a JSON blob pasted out of a browser. A pasted fixture keeps passing after the contract moves.
- The keychain and the clock are behind traits with fakes. Real keychain access in a test fails on CI (no Secret Service) and pollutes the developer's own login keychain.
- **A schema bump ships a migration test for that step**, from the previous version's real database, including the interrupted-and-resumed case.
- Cover the negative cases directly: offline, expired token, a concurrent-401 refresh race, a corrupt store file, a read-only data directory, a second instance of the app launching.
- Each acceptance criterion maps 1:1 to one E2E test.
```

---

## architecture addendum

Prepend `paths: ["app/**", "src-tauri/**", "openapi.yaml"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Tauri] The IPC Boundary Is the Architecture
- Two processes, one contract: a webview that renders and a Rust core that does. The boundary is the set of `#[tauri::command]` signatures, and it is designed, reviewed and versioned like any other API — not grown one `invoke` at a time.
- Everything privileged is on the Rust side *because* the webview cannot hold it: the bundle ships to the user's disk, so a token, a key or an origin secret in `app/` is disclosed by definition. This is stronger than the browser case, where at least the server keeps its own secrets.
- The commands are the audit surface. A capability granted in `src-tauri/capabilities/*.json` is a permission granted to whatever the webview is executing, which includes any remote content it was ever made to load. Default-deny, window-scoped, and reviewed as a diff.
- `tauri-plugin-sql` and a broadly-scoped `fs` capability both collapse the boundary in one line — arbitrary SQL and arbitrary file access from the renderer. If a feature seems to need either, it needs a command instead.

## [Tauri] Frozen Contract, Rust-Side Client
- The API is an existing service. Its contract is transcribed ground truth, locked upstream; the typed client is generated from it and committed, and CI regenerates and diffs.
- The diff gate is only meaningful if regeneration is deterministic: `Cargo.lock` and `pnpm-lock.yaml` committed, the generator pinned to an exact version or a digest. Unpinned, the first transitive bump turns the gate red for reasons unrelated to the contract, and a gate that cries wolf gets deleted — worse than never having had it.
- A response the app needs and the service does not provide is a contract finding, recorded as one. Not a client-side join across three endpoints pretending to be one; two of those in a row means the service belongs in scope.
- One `reqwest::Client` in managed state, explicit timeouts, one serialized refresh path. Ordering matters the same way interceptor ordering does elsewhere: a retry ahead of refresh retries a 401 until it gives up.

## [Tauri] Desktop Release Constraints
- **A desktop release cannot be rolled back.** Users have the binary. The lever is the updater, and it only exists if it was built, signed and shipped from the first release — retrofitting an updater into an installed base is a manual-reinstall campaign.
- The updater's private signing key is the single point of no return in this stack. It lives in CI secrets with a documented custodian and an offline backup, and losing it strands every installed copy permanently. Decide where it lives before the first release, not after.
- Code signing is a per-platform, lead-time decision: an Apple Developer ID plus notarization or Gatekeeper refuses to open the app, and a Windows certificate (OV needs reputation to accumulate, EV does not) or SmartScreen warns every downloader. Both are due before the first external build.
- Users on old OS versions cannot receive the app at all, so the minimum OS version is a fact about real users rather than a preference, and it constrains any forced-upgrade plan. Give it a number in an ADR.
- Anything already on a user's machine — the local store, the keychain entry, the data directory, registered deep links, granted permissions — is migration surface. The migration path runs before the first window is shown and never on the UI thread.
- The health signal is crash-free sessions per release plus update-adoption rate, watched against a staged rollout. Without adoption data you cannot tell a healthy release from one nobody received.
```

---

## nuxt.config.ts additions

**Not written fresh — merged into what `nuxt-scaffold` produced.** Three changes make the Nuxt half a Tauri frontend, and the first two are what the Rust build actually depends on:

```ts
ssr: false,                       // no Node process exists at runtime
devServer: { host: '127.0.0.1' }, // Tauri's devUrl; loopback, never 0.0.0.0
```

- `ssr: false` alone is not enough: `nuxi build` still emits a Nitro server, so the Tauri build consumes `pnpm generate` → `.output/public`, which is what `frontendDist` points at.
- `devServer.host` stays on loopback. A dev server on `0.0.0.0` is your whole app, plus HMR, offered to the local network.
- Delete `server/` if the scaffold created one, and say so in the Phase 7 summary. Anything in it worked in dev and would have disappeared from the bundle.

## tauri.conf.json — what the overlay checks

The file itself is `tauri init`'s and the first slice's. The overlay writes none of it and **checks three things**, reporting each in the Phase 7 summary:

- `identifier` is not `com.tauri.dev`. Tauri refuses to bundle while it is, so this is a build-blocker the user should hear about at install time rather than at their first release attempt.
- `app.security.csp` is set to something. Tauri's own docs are explicit that "the CSP protection is only enabled if set on the Tauri configuration file", so **absent and `null` are the same thing** — no policy — and the gate fails on both. Fixing it at install time is the difference between that and a red first commit. `default-src 'self'` is the starting point, tightened per feature.
- `app.withGlobalTauri` is absent or `false`. `true` puts the IPC bridge on `window`, reachable by any script the webview runs.

## .vscode/settings.json

Take the frontend half from `references/profile-nuxt.md` → `## .vscode/settings.json Template` (ESLint format-on-save), then add `rust-analyzer` pointing at the Rust half — without `linkedProjects` it does not find a `Cargo.toml` that is not at the repo root, and the whole Rust side sits unanalyzed in the editor while CI is red.

```json
{
  "rust-analyzer.linkedProjects": ["src-tauri/Cargo.toml"],
  "rust-analyzer.check.command": "clippy",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer",
    "editor.formatOnSave": true
  }
}
```

Merge these keys into whatever the scaffold wrote; never replace the file.

## rust-toolchain.toml

Write if absent. Rustup honours it on the first `cargo` call, so this one file pins the toolchain for both local dev and CI — no second pin in the workflow to drift against.

```toml
[toolchain]
channel = "1.90.0"
components = ["rustfmt", "clippy"]
```

Substitute the channel with the output of `rustc --version` on the machine doing the install. If Rust is not on `PATH`, skip the file and say so in the Phase 7 summary — the generated CI reads this file, and its absence is a first-run failure with a one-line fix.

---

## settings.json Template

`permissions.allow` pre-approves the read/build/test surface by name. `cargo install`, `cargo update`, `rustup` and `pnpm up` are deliberately absent — each rewrites a lockfile the codegen and CI gates depend on, or installs an arbitrary binary. `pnpm tauri build` is allowed; it is slow but writes only into `target/` and the bundle directory. The `PostToolUse` lint-fix hook is inherited from the Nuxt half and touches only the edited file; it does nothing on a `.rs` file, which `cargo fmt` handles at the gate.

```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm dev:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm generate:*)",
      "Bash(pnpm lint:*)",
      "Bash(pnpm test:*)",
      "Bash(pnpm type-check:*)",
      "Bash(pnpm typecheck:*)",
      "Bash(pnpm openapi:generate:*)",
      "Bash(pnpm install:*)",
      "Bash(pnpm add:*)",
      "Bash(pnpm remove:*)",
      "Bash(pnpm tauri dev:*)",
      "Bash(pnpm tauri build:*)",
      "Bash(pnpm tauri info:*)",
      "Bash(cargo fmt:*)",
      "Bash(cargo clippy:*)",
      "Bash(cargo check:*)",
      "Bash(cargo test:*)",
      "Bash(cargo build:*)",
      "Bash(cargo tree:*)",
      "Bash(cargo add:*)",
      "Bash(cargo remove:*)",
      "Bash(rustc --version:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git pull:*)",
      "Bash(git stash:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bash-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/bugfix-test-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/commit-msg-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/spec-gate-guard.mjs"
          }
        ]
      },
      {
        "matcher": "Bash|Write|Edit|WebFetch|mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-gate-guard.mjs"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/lint-fix-file.mjs"
          }
        ]
      },
      {
        "matcher": "WebFetch|mcp__.*|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/injection-scan-guard.mjs"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/canary-seed.mjs"
          },
          {
            "type": "command",
            "command": "node .claude/guards/session-resume-check.mjs"
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/precompact-snapshot.mjs"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/precompact-snapshot.mjs"
          }
        ]
      }
    ],
    "Setup": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/guards/install-hooks.mjs"
          }
        ]
      }
    ]
  }
}
```
