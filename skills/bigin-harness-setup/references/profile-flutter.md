# Flutter Profile Templates

Stack: Flutter mobile client against an existing HTTP API — Riverpod (`@riverpod`), `go_router`, Drift, generated dio client

Marker file: `pubspec.yaml` — **and it alone is not enough.** A plain Dart package (CLI, server, shared library) has one too, so Phase 0 matches this profile only when that file carries a top-level `flutter:` key, or `flutter:` with `sdk: flutter` under `dependencies:`. Without either, the repo is not a Flutter app and belongs in `generic`; writing widget, navigation and golden-test conventions for a package with no widgets is the mismatch `generic` exists to avoid.

Empty repo → scaffolded by **`flutter create`** itself (Phase 0.5, pinned arguments — see `references/scaffold-delegation.md`). There is no `flutter-scaffold` skill: what one would add beyond `flutter create` (flavors + the native half, the state layer, the local store, the boundary-lint config) is exactly what the project's architecture ADRs decide, so it is not a fixed template yet.

The architecture this profile writes conventions for is BigIn's Flutter client stack: feature-first layering with lint-enforced import boundaries, a frozen upstream contract behind a generated dio client, one Riverpod graph, one `go_router` table, one local store. **Every rule below is stated here in full.** This file is the source, not a summary of one — `bigin-skills` depends on no other plugin, so a profile must never defer to a document outside this repo for the conventions it writes.

---

## Commands

```
lint:       dart format --output=none --set-exit-if-changed . && dart run custom_lint && dart run import_lint
typecheck:  flutter analyze --fatal-infos
test:       flutter test
integration: flutter test integration_test          # needs a device/simulator — not a plain CI runner
dev:        flutter run --flavor dev -t lib/main_dev.dart --dart-define-from-file=config/dev.json
generate:   dart run build_runner build --delete-conflicting-outputs
```

**`--output=none` is not optional in a gate.** Plain `dart format --set-exit-if-changed .` *rewrites every unformatted file in the tree* and then exits 1. In a pre-commit hook that reformats files the developer never staged, leaves the staged snapshot unformatted, and lands a commit that differs from the one the gate checked. `--output=none` makes it a pure check — same exit code, no writes. Use the bare form only when you actually want the files rewritten.

**Why the three harness slots map that way.** Dart has no separate typecheck binary — the analyzer *is* the type checker, so `flutter analyze --fatal-infos` takes the `{TYPECHECK}` slot and the formatter plus the two analyzer-plugin CLIs take `{LINT}`. `--fatal-infos` is deliberate: analyzer *infos* are where the unused-import and dead-null-check findings land, and without it they never fail anything.

**`dart run custom_lint` and `dart run import_lint` are two mechanisms, not one command with two names.** `import_lint` is a standalone analyzer plugin on Dart's first-party `plugins:` mechanism (Dart 3.10+ / Flutter 3.38+) with its own CLI; `custom_lint` is the older mechanism `riverpod_lint` is built on. **Only `import_lint` runs the layer/feature import boundaries.** A template that runs one and claims the boundaries are covered is the defect to avoid — both commands, always, and if only one is configured the gate says which rules are therefore unenforced instead of passing quietly.

Both are conditional in the generated gates (`references/hook-guard.md` → `## pre-commit: flutter`, `references/ci.md` → `## github: flutter`): a repo fresh out of `flutter create` has neither dependency, and a gate that dies on day one gets deleted. Each is skipped with a named, visible message — never silently.

---

## CLAUDE.md Template

```markdown
# CLAUDE.md

Stack: Flutter mobile client · Riverpod (@riverpod) · go_router · Drift · generated dio client
The HTTP API is an existing service this repo does not own. Its contract is frozen input.

## Commands
| Purpose     | Command                                                        |
|-------------|----------------------------------------------------------------|
| dev         | `flutter run --flavor dev -t lib/main_dev.dart --dart-define-from-file=config/dev.json` |
| test        | `flutter test`                                                 |
| integration | `flutter test integration_test` (device/simulator required)     |
| analyze     | `flutter analyze --fatal-infos`                                |
| format      | `dart format --output=none --set-exit-if-changed .`            |
| lint        | `dart run custom_lint` **and** `dart run import_lint` — two mechanisms, both required |
| generate    | `dart run build_runner build --delete-conflicting-outputs`      |

## Rules
See `.claude/rules/` — path-scoped conventions, testing, security, architecture.

## Hard Rules (non-negotiable)
- **No `http(s)://` literal anywhere in `lib/`**, `core/network/` included — the base URL comes from the flavor config (`--dart-define-from-file`). Enforced by a grep step in the pre-commit gate and CI. A staging URL shipped to production is the most common mobile release incident.
- **`--dart-define` is configuration, not secrecy.** Every value is recoverable from the shipped binary. Base URLs and flavor names: fine. Anything whose disclosure matters: server-side, or a per-user token stored per the security rule.
- `api/generated/**` and every `*.g.dart` are generated — never hand-edit. Change the source (the contract, or the annotated file), regenerate, *then* write code against it. CI regenerates and fails on a diff. They are also excluded from the analyzer (`analysis_options.yaml`), because `--fatal-infos` otherwise fails the build on code nobody is allowed to fix.
- That diff gate only works if regeneration is deterministic: `pubspec.lock` is committed, `build_runner`/`json_serializable` are pinned to **exact** versions, and the API generator is pinned to a JAR version or Docker tag.
- `features/*/domain/**` imports nothing from `data/`, nothing generated, and neither `package:dio` nor `package:drift`. No feature imports another feature's `data/` or `presentation/`. `core/` imports no feature. Enforced by `dart run import_lint` — the *only* command that checks it, and it needs Dart 3.10+ / Flutter 3.38+. Below that floor nothing enforces this rule: the gates skip it by name, and it is review discipline until the SDK moves.
- Tokens live in `flutter_secure_storage`, never `SharedPreferences`, never Drift, never a logged provider.
- One state library, one navigator, one object graph. A second one is an ADR, not a commit.
- A Drift `schemaVersion` bump ships a migration step **and** a migration test. A crash-on-launch after upgrade cannot be hotfixed.
- No `--no-verify`, no `// ignore:` without a comment saying why the rule is wrong here.
- Commit messages are Conventional Commits — `type(scope): subject` (enforced by `commit-msg-guard.mjs`).
- Every bug fix ships a regression test that fails before the fix (enforced by `bugfix-test-guard.mjs`, which recognizes `*_test.dart` anywhere — `test/`, `integration_test/`, or beside the code).

## Not enforced by any tool — review discipline
`ref.watch` in `build` / `ref.read` in callbacks, and "no raw hex, magic padding or inline `TextStyle` in a widget", have **no off-the-shelf lint**. Treat both as review rules, or write the `custom_lint` rule. Do not assume a gate is catching them.

## Task workflow
Non-trivial features: /task-workflow. Bugs: /debug-workflow. Review: /code-review, /security-review.
```

---

## conventions.md Template

Paths frontmatter scopes this file to Dart source and the manifests — only loaded when those files are in context.

```markdown
---
paths:
  - "lib/**"
  - "api/**"
  - "pubspec.yaml"
  - "analysis_options.yaml"
---
# Conventions

## Editable surface
Hand-written: `lib/**` (except `*.g.dart`), `test/**`, `integration_test/**`, `pubspec.yaml`, `analysis_options.yaml`, `config/*.json`, the native `ios/`/`android/` halves.

Generated, never hand-edited: every `*.g.dart` (build_runner) and `api/generated/**` (the API client, generated from the frozen contract). Both are committed, and CI regenerates and diffs them. If you are about to edit a file with a `// GENERATED CODE - DO NOT MODIFY` header, edit its source instead.

`api/openapi.yaml` is a copy or symlink of a contract owned by another team and frozen upstream. It is not edited here to make the client compile — a shape the app needs and the API does not provide is a contract finding, recorded as one.

## Layering

Feature-first, three layers inside each feature. Dependencies point one way:

```
presentation ──▶ domain ◀── data
     (widgets, controllers)   (repo impls, DTO mappers, DAOs, generated client)
                    ▲
                  core/  (design, error, network, storage, l10n, logging) — imports no feature
```

- **domain** — entities, repository *interfaces*, use cases. No `dio`, no `drift`, no `*.g.dart`, no DTOs. This is the rule whose absence turns an API change into a whole-app refactor.
- **data** — repository implementations, Drift DAOs, generated-client calls, DTO↔entity mappers.
- **presentation** — widgets and Riverpod controllers. No widget touches a DAO or the generated client.
- **core** — shared infrastructure any layer may import; it imports no feature.

`dart run import_lint` enforces these as import rules. Two things it cannot do, so know them: it matches import paths, not string literals (the base-URL ban is a grep step), and it is lint, not the resolver. Splitting features into separate packages in a `melos`/pub workspace makes the boundary resolver-enforced instead — stronger, costlier, and a live option worth an ADR rather than a road already closed.

## Feature boundaries
- A feature reaches another feature only through its `domain/` interface, exposed as a provider. Never its `data/`, never its `presentation/`.
- A shared entity moves to `core/` — and that is an ADR, because a shared entity is a shared reason to change.
- One feature owns each Drift table. A DAO reaching into another feature's tables goes through the owning feature's repository.
- A DTO↔entity mapper is required where the wire shape and the UI shape actually diverge (date/enum parsing, nullable-vs-required mismatches, flattening, locally-authored state). Using a generated type directly in `domain/` for a flat value object the UI uses verbatim is a *stated* exception recorded in the ADR — not a per-feature argument.

## Naming
- Files: `snake_case.dart`, named for the thing (`order_repository_impl.dart`, `order_list_controller.dart`).
- Types: `UpperCamelCase`; members `lowerCamelCase`; a private member gets a leading `_`.
- Directories: `features/<feature>/{domain,data,presentation}` and `core/<concern>/`. There is no app-wide `models/` or `services/` directory — recreating one recreates the coupling this layout replaces.

## State & navigation
- Riverpod providers are the object graph. No `get_it`, no static `instance` singleton. The composition root is the flavor entrypoint plus `app.dart`; nothing else constructs a `Dio`, a `Database`, or a repository.
- State is a sealed/immutable type (`AsyncValue`, or a sealed `Loading|Data|Failure`) — never `isLoading` + `data` + `error` fields that can express impossible combinations.
- `StatefulWidget` state is for ephemeral UI only (animation, text, scroll). No business `await` in a widget.
- `go_router`: one declarative route table, typed routes. Auth guarding is a `redirect` driven by the session provider, never an `if (!loggedIn) Navigator.push` in a screen. Deep links and push payloads are entries in that table — cold start, background and foreground must land on the same route.
- A background isolate has no `ProviderContainer` at all: reading a provider there fails deterministically, everywhere. Background code takes its dependencies as parameters and gets its own database handle, Dio and logger.

## Errors
- One sealed `Failure` in `core/error/`, mapped once from the API error shape, transport errors, and local (storage/permission/platform) errors. Nothing above `data/` ever sees a `DioException`.
- Offline, unauthenticated, and everything-else are distinct cases because the UI must behave differently. The UI switches on the type, never on a message string.
- No `catch (_) {}`. An unexpected error is reported *and* shown — a silent catch is worse than a crash, which at least reaches a dashboard.

## Networking
- One `Dio`, built in `core/network/`, with interceptors in a stated order: logging → auth → retry → error mapping. Order is part of the design: a retry ahead of token refresh retries a 401 four times and then fails.
- Token refresh is a **`QueuedInterceptor`**, not a hand-rolled mutex. Plain interceptors run concurrently across requests, so ordering alone serializes nothing, and concurrent 401s must produce one refresh with a queue of retries — on a backend that rotates refresh tokens, the losing races invalidate the winner's and log the user out at random.
- **Connect, receive and send timeouts are set explicitly**, from the flavor config. Dio's default receive timeout is unbounded: that is how the app hangs forever on a captive-portal Wi-Fi that accepts the connection and answers nothing.
- No repository returns a generated DTO where the wire shape and the UI shape differ. `api/generated/**` is imported only by `data/`.

## Flavors
- Three entrypoints (`main_dev`/`main_staging`/`main_prod`), three bundle IDs, config via `--dart-define-from-file=config/<flavor>.json`. No URL literal in `lib/` — the pre-commit and CI gates fail on one.
- **A flavor that exists only in Dart is half-built.** Three bundle IDs need Xcode build configurations and schemes, Android `productFlavors`, and per-flavor entitlements, URL schemes, App Group IDs and `google-services.json` / `GoogleService-Info.plist`. `flutter create` generates none of it and neither does this harness; it is a real day of work per platform, and skipping it is how a staging build ships to production users.
- `--dart-define` is configuration, not secrecy: every value is recoverable from the shipped binary. A real secret belongs on the server, or is a per-user token in `flutter_secure_storage`.

## Persistence
- Drift (SQLite) for relational state, in `getApplicationSupportDirectory()` — not Documents (user-visible, App Review consequence), not Caches (the OS deletes it). `flutter_secure_storage` for secrets. `SharedPreferences` only for genuinely trivial preferences.
- Offline policy is declared per feature — online-only, read-through cache with a stated TTL, or offline-first with an outbox — and written into that feature's spec. No feature gets an outbox by accident; an outbox nobody designed is a data-loss bug with a queue in front of it.

## Formatting & the analyzer
`dart format` is the formatter; there is no second style opinion. Run the gate rather than hand-aligning — and use `--output=none` in any gate, or it rewrites the tree instead of checking it.

`analysis_options.yaml` excludes generated output from the analyzer. `flutter analyze --fatal-infos` is the typecheck gate, and generated code routinely trips analyzer infos and warnings (`freezed`'s `==` parameter types, deprecated members in older generator output) that nobody may fix by hand. Excluding them keeps the gate about *your* code; a finding that genuinely matters there is a generator-version problem, not a source edit.
```

---

## testing.md Template

Paths frontmatter scopes this file to the two test trees — only loaded when test files are in context.

```markdown
---
paths:
  - "test/**"
  - "integration_test/**"
---
# Testing Conventions

## Location
`test/` mirrors `lib/` (`lib/features/orders/domain/order.dart` → `test/features/orders/domain/order_test.dart`). `integration_test/` holds flow tests only. `*_test.dart` is the filename contract — a differently-named file silently never runs.

## What is tested where
| Layer | What | How |
|---|---|---|
| domain | entities, use cases, mappers | pure `flutter test`, no device, no fakes needed |
| data | repository impls | fake generated client + in-memory Drift |
| presentation | controllers, one widget test per screen | `ProviderScope(overrides: [...])` |
| design system | goldens, light/dark × the two extreme text scales | `flutter test`, one pinned platform |
| flows | one per acceptance criterion | `integration_test` on a real device/simulator |

## Rules
- Every dependency is a provider, so every dependency is overridable — override the provider, don't reach for a mocking framework to intercept HTTP.
- **Fixtures come from the contract's examples**, never a JSON blob pasted from a browser. A pasted fixture keeps passing after the contract moves.
- **Goldens need one pinned platform or they are worthless.** They are font- and platform-sensitive: run and regenerate them on a single pinned CI image (or shard per platform), or they fail on every machine that is not the author's and get deleted within a fortnight. `golden_toolkit` is unmaintained — use `alchemist` or plain `matchesGoldenFile`.
- **A Drift `schemaVersion` bump ships a migration test for that step**, including the interrupted-and-resumed case. This is not optional: a migration that crashes on launch has no hotfix path.
- Each acceptance criterion maps 1:1 to one integration test. Where behavior is ambiguous, the app being replaced is the arbiter — run it, don't guess.
- Cover the negative cases directly: offline, expired token, a concurrent-401 refresh race, a permission denied, a locale with a different plural rule.
```

---

## architecture addendum

Prepend `paths: ["lib/**", "api/openapi.yaml"]` as YAML frontmatter when writing `architecture.md` (see `references/files-shared.md` → `## paths substitutions`).

```markdown
## [Flutter] Feature-First Layering
- The unit of decomposition is the feature, and the three layers live *inside* it: `features/<f>/{presentation,domain,data}`. An app-wide `models/` or `services/` directory is the coupling this layout exists to prevent.
- `presentation → domain ← data`, never reversed; `domain` declares the repository interface `data` implements. `core/` is importable by any layer and imports no feature.
- The mechanism is `dart run import_lint`, run in CI and pre-commit. It is lint, not the resolver: a developer can silence it, and it is a small package carrying the project's central structural invariant. Accepted knowingly.
- The stronger option stays open: features as separate packages in a `melos`/pub workspace, where the resolver refuses an undeclared import and `implementation_imports` blocks reaching into another package's `lib/src/`. Choosing lint over that is a decision to record, not a limitation of Dart.

## [Flutter] Frozen Contract, Generated Client
- The API is an existing service. Its contract is transcribed ground truth, locked upstream, and `api/generated/**` is generated from it — `openapi-generator` (dart-dio) or `swagger_dart_code_generator`, committed and CI-diffed.
- A "requested" contract variant, if one exists, is a request to another team and is **not** an input to codegen.
- The regenerate-and-diff gate is only meaningful if regeneration is deterministic: committed `pubspec.lock`, exact constraints on `build_runner`/`json_serializable`, a pinned generator JAR or Docker tag. Unpinned, the first transitive bump turns the gate red for reasons unrelated to the contract, and a gate that cries wolf gets deleted — which is worse than never having had it.
- One `Dio`, configured in `core/network/`, interceptors in a stated order: logging → auth → retry → error mapping. The order is part of the decision; a retry ahead of token refresh retries a 401 four times and then fails.
- Refresh is one serialized `QueuedInterceptor`, not a hand-rolled mutex — plain interceptors run concurrently, so ordering alone serializes nothing, and concurrent 401s that each refresh will invalidate each other's token on any backend with reuse detection.
- A response the app needs and the API does not provide is a contract finding, recorded. Not a client-side join across three endpoints pretending to be one; two of those in a row means the backend belongs in scope.

## [Flutter] One Graph, One Navigator, One Store
- Riverpod providers *are* the DI container. A service locator alongside them is two graphs.
- One `go_router` table. A nested `Navigator` is a second source of truth for "where am I" and needs an ADR. A WebView-hosted flow is a third navigation surface with its own history and session — decide who owns it rather than letting it appear inside a route.
- One local store, one place each fact lives: server, local store, or a widget's build method — never two with no stated precedence.

## [Flutter] Device-Side Constraints
- A client release cannot be rolled back the way a server can. The health signal is crash-free sessions (plus ANR on Android) watched per release against a staged rollout, and there is no hotfix lever unless one was deliberately chosen.
- The platform floor is a fact about real users, not a preference: users below it cannot receive the app at all, so they are permanently frozen on whatever they have. It constrains any forced-upgrade or migration plan and belongs in an ADR with a number attached.
- Store-submission artifacts (Apple privacy manifest with per-SDK required-reason declarations, Play data-safety, permission usage strings, minimum-OS declaration) are re-derived from *this* app's dependency set — never inherited from the app being replaced — and are due before the first internal build, not the first release.
- Anything a user already has on their device (session, local data, files, granted permissions, deep links, entitlements) is migration surface, and migration work never runs on the launch path.
```

---

## analysis_options.yaml

**Not written fresh — merged into whatever the repo already has** (`flutter create` writes one, and an existing repo's is usually customized). Add the `analyzer:` block below if it is absent; leave any existing `linter:`/`include:` alone.

`flutter analyze --fatal-infos` is the `{TYPECHECK}` slot, and `--fatal-infos` is what makes unused imports and dead null-checks fail. It also promotes every analyzer info in **generated** code to a build failure — `freezed` emits `non_nullable_equals_parameter` warnings for each union, and generator output written against an older SDK carries `deprecated_member_use` infos. That output is committed, CI-diffed, and explicitly never hand-edited, so without this exclude the profile's own typecheck gate is red on day one with no legal fix. (Measured on a real 118-file app: 12 of 39 findings were in `*.freezed.dart`.)

Excluding is the right lever rather than downgrading the severities: a real problem in generated code is a generator-version or contract problem, and the regenerate-and-diff step in CI is what catches it.

```yaml
analyzer:
  exclude:
    - "**/*.g.dart"
    - "**/*.freezed.dart"
    - "**/*.gr.dart"
    - "api/generated/**"
```

---

## .vscode/settings.json

None. Dart's formatter and analyzer come from the official Dart/Flutter extension, which already formats on save with `dart format`'s single style — there is no second formatter to disable and nothing to configure per repo. Phase 5-3b skips this profile.

---

## settings.json Template

`permissions.allow` pre-approves the read/analyze/test surface and the two lint CLIs by name rather than blanket `dart run:*`, which would pre-approve any executable in any dependency. `dart fix --apply` and `flutter pub upgrade` are deliberately absent — both rewrite committed files or the lockfile the codegen gate depends on. There is no `PostToolUse` formatter hook: `dart format` is a pre-commit and CI gate, and a per-file format hook would mean a tenth guard script for a formatter that has no configuration to get wrong.

```json
{
  "permissions": {
    "allow": [
      "Bash(flutter analyze:*)",
      "Bash(flutter test:*)",
      "Bash(flutter run:*)",
      "Bash(flutter build:*)",
      "Bash(flutter pub get:*)",
      "Bash(flutter pub add:*)",
      "Bash(flutter pub remove:*)",
      "Bash(flutter pub run:*)",
      "Bash(flutter gen-l10n:*)",
      "Bash(flutter clean:*)",
      "Bash(flutter doctor:*)",
      "Bash(flutter devices:*)",
      "Bash(dart format:*)",
      "Bash(dart analyze:*)",
      "Bash(dart pub get:*)",
      "Bash(dart run build_runner:*)",
      "Bash(dart run custom_lint:*)",
      "Bash(dart run import_lint:*)",
      "Bash(fvm flutter:*)",
      "Bash(fvm dart:*)",
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
    ]
  }
}
```
