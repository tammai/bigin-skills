# CI Templates

CI config for the quality gates the harness already runs locally (lint, typecheck, test, plus a profile's own grep gates) and, when opted in, the Knowledge Bundle validator. `nuxt-marketing` additionally builds, because on that profile the build *is* the locale prerender. Written into the target project during setup — opt-in, per Phase 5.6.

Every job runs on `push` to `main` and on merge/pull requests. Replace nothing by hand — the profile sections below are copy-ready.

---

## github: nuxt

Write to `.github/workflows/ci.yml`.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22   # nuxt-scaffold requires 22+, and runners now force 20 onto 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test --run
```

---

## github: nodejs

Write to `.github/workflows/ci.yml`. Identical to the nuxt job (same package manager and commands).

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22   # nuxt-scaffold requires 22+, and runners now force 20 onto 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test --run
```

---

## github: next

Write to `.github/workflows/ci.yml`. Identical to the nuxt job (same package manager and commands).

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22   # nuxt-scaffold requires 22+, and runners now force 20 onto 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test --run
```

---

## github: go

Write to `.github/workflows/ci.yml`.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff # v5.6.0
        with:
          # Track the repo's own go directive rather than a pinned version that
          # goes stale the first time `go mod tidy` bumps it.
          go-version-file: go.mod
      - run: go build ./...
      - name: lint
        run: |
          go install honnef.co/go/tools/cmd/staticcheck@latest
          # Prefer the repo's own lint target — it knows which generated
          # packages to exclude. Fall back to a plain sweep if there isn't one.
          if grep -q '^lint:' Makefile 2>/dev/null; then make lint; else staticcheck ./...; fi
      - run: go test ./... -count=1
```

---

## github: flutter

Write to `.github/workflows/ci.yml`.

Four things about this job that differ from every other profile:

- **The Flutter action is referenced by its major tag, not a commit SHA**, unlike `actions/checkout` above. The harness cannot resolve a trustworthy SHA for it at authoring time, and a wrong SHA fails the workflow on its first run. Pin it to a SHA yourself right after install — it is a third-party action with full access to the job.
- **`--enforce-lockfile` is the pin the codegen gate depends on.** It fails the job if resolution would deviate from the committed `pubspec.lock`, which is what makes "regenerate and diff" mean something. Dropping it turns the diff step into a random-failure generator on the first transitive bump.
- **An unpinned generator switches the codegen diff off, it does not fail the job.** Exact pins are the *precondition* for "regenerate and diff" meaning anything, and essentially every existing repo carries caret ranges, so failing on them would make the generated workflow red on the first push — the same day-one death the two lint plugins are conditional to avoid. The skip names itself and says what to pin.
- **Both lint mechanisms run, and each skip is named.** `custom_lint` (riverpod_lint + hand-written rules) and `import_lint` (the layer/feature import boundaries) are separate plugin mechanisms with separate CLIs. Neither covers the other; a repo that has only one is told which rules are unenforced.
- **`flutter test integration_test` is not in this job.** It needs a device or simulator — a plain `ubuntu-latest` runner has neither, and a step that always fails gets commented out within a week. Add it as a second job on a macOS runner with a booted simulator, or on an Android emulator action, when the first integration test exists.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      # Third-party action, referenced by major tag — pin it to a commit SHA after install.
      - uses: subosito/flutter-action@v2
        with:
          # Tracks the version in .fvmrc so CI can't drift from local dev.
          flutter-version-file: .fvmrc
          cache: true
      - run: flutter pub get --enforce-lockfile
      - run: dart format --output=none --set-exit-if-changed .
      - run: flutter analyze --fatal-infos
      - name: lint plugins (two mechanisms, both required)
        run: |
          if grep -q 'custom_lint' pubspec.yaml; then
            dart run custom_lint
          else
            echo "custom_lint not configured — riverpod_lint and hand-written rules are NOT running"
          fi
          if grep -q 'import_lint' pubspec.yaml; then
            dart run import_lint
          else
            echo "import_lint not configured — the layer/feature import boundaries are NOT enforced"
          fi
      - name: no base URL literal in lib/
        run: |
          if grep -rInE 'https?://' lib --include='*.dart' \
               --exclude='*.g.dart' --exclude='*.freezed.dart' --exclude='firebase_options*.dart' \
               | grep -v 'url-literal-ok'; then
            echo "^ base URL literal in lib/ — read it from the flavor config"
            exit 1
          fi
      - run: flutter test
      - name: api client matches the vendored contract
        run: |
          if [ ! -f tool/generate_api.sh ]; then
            echo "tool/generate_api.sh not present — this repo does not vendor a contract; skipping"
            exit 0
          fi
          if ! command -v docker >/dev/null 2>&1; then
            echo "docker not available on this runner — the API-client diff is NOT running."
            echo "api/generated/** is unchecked on this job; it is still checked by contract-drift."
            exit 0
          fi
          ./tool/generate_api.sh
          git diff --exit-code -- api/generated || {
            echo "api/generated/** does not match api/openapi.yaml."
            echo "Run ./tool/generate_api.sh and commit the result — never hand-edit generated code."
            exit 1
          }

      - name: generated code matches its source
        run: |
          if ! grep -q 'build_runner' pubspec.yaml; then
            echo "build_runner not configured — the codegen diff is NOT running"
            exit 0
          fi
          # The diff gate is only meaningful if regeneration is deterministic, so an
          # unpinned generator turns it off by name rather than failing the build.
          if grep -qE '^\s+(build_runner|build_verify|json_serializable|riverpod_generator|drift_dev|go_router_builder|freezed|custom_lint):\s*["'"'"']?[>~^]' pubspec.yaml; then
            echo "code generators are on caret/range constraints — the codegen diff is NOT running,"
            echo "because the first unrelated transitive bump would turn it red. Pin build_runner,"
            echo "freezed, json_serializable and friends to exact versions to switch this gate on."
            exit 0
          fi
          dart run build_runner build --delete-conflicting-outputs
          git diff --exit-code
      - name: generated API client matches the contract
        run: |
          # The generator (openapi-generator JAR or Docker tag) is pinned inside this
          # script, which the repo owns — the pin is what makes the diff trustworthy.
          # `-f` then `-x`, not `-x` alone: a script that exists but lost its executable
          # bit means the gate was configured and then broke, and `-x` alone would turn it
          # green forever behind an echo nobody reads in a passing job.
          if [ ! -f tool/generate_api_client.sh ]; then
            echo "tool/generate_api_client.sh missing — API client is NOT diffed against the contract"
          elif [ ! -x tool/generate_api_client.sh ]; then
            echo "^ tool/generate_api_client.sh is not executable — chmod +x it; this gate was configured and is now broken"
            exit 1
          else
            ./tool/generate_api_client.sh
            git diff --exit-code
          fi
```

---

## github: tauri

Write to `.github/workflows/ci.yml`.

Five things about this workflow that differ from every other profile:

- **Two jobs, because one runner image can't cheaply serve both halves.** The frontend job is a plain `ubuntu-latest`; the Rust job spends a minute installing system libraries the frontend job has no use for. Splitting them also means a frontend failure and a Rust failure are two distinct red checks rather than one that stops at whichever came first.
- **Tauri 2 needs Linux system libraries, and `webkit2gtk` is version-specific.** Tauri 2 wants `libwebkit2gtk-4.1-dev`; Tauri 1 wanted `4.0`. Get it wrong and `cargo build` fails on a linker error naming a symbol, not a package. `libayatana-appindicator3-dev` is likewise 2's name where 1 used `libappindicator3-dev`. The list in both jobs is copied **verbatim** from Tauri 2's prerequisites page — do not trim it to the packages that look necessary, since which of them the linker needs depends on the plugin set.
- **`cargo clippy` is the Rust typecheck.** There is no `cargo check` step — clippy runs the compiler front end and then lints, so a `check` beside it compiles the same graph twice.
- **`rust-toolchain.toml` is the pin that decides the build, but the action's `@stable` ref is not it.** `dtolnay/rust-toolchain` selects its toolchain from the `@rev` you request — `@stable` installs stable, `@1.89.0` installs 1.89.0 — and it does not read `rust-toolchain.toml`. Rustup does: a toolchain file is a directory override, so it wins over whatever the action made default, and it pulls the `rustfmt` and `clippy` it declares. That means a repo pinned to 1.82 still *builds* on 1.82 and there is no silent drift — but the action has downloaded stable for nothing, and the ref reads like a version pin it isn't. The explicit `rustup show` step below resolves the override by name instead of leaving it a side effect of the first `cargo` call, so the log says which toolchain the gates actually ran on. **Two third-party actions here are referenced by tag rather than SHA** — `dtolnay/rust-toolchain` and `Swatinem/rust-cache`. The harness can't resolve a trustworthy SHA for either at authoring time, and a wrong one fails the workflow on its first run, so pin both yourself right after install; each has full access to the job.
- **No bundle build here.** `pnpm tauri build` is a three-OS matrix that compiles Rust in release mode and needs the code-signing and notarization secrets. It belongs in a release workflow the team writes once it *has* certificates; as a PR gate it would be red on every pull request for want of an Apple Developer ID, and a gate that is always red gets deleted.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test --run
      - name: no URL literal in app/
        run: |
          if grep -rInE 'https?://' app shared --include='*.ts' --include='*.vue' --include='*.js' 2>/dev/null \
               | grep -v 'url-literal-ok'; then
            echo "^ URL literal in the webview — the API base URL belongs to Rust"
            exit 1
          fi
      - name: no secret in web storage
        run: |
          if grep -rInEi '(localStorage|sessionStorage)\.setItem\([^)]*(token|secret|password|credential|api[_-]?key|jwt|bearer)' \
               app shared --include='*.ts' --include='*.vue' --include='*.js' 2>/dev/null \
               | grep -v 'storage-ok'; then
            echo "^ secret written to web storage — it belongs in the OS keychain, on the Rust side"
            exit 1
          fi
      - name: no server/ directory
        run: |
          # A Nitro route works in `tauri dev` and vanishes from `tauri build`.
          if [ -d server ]; then echo "^ server/ exists — move the logic to a #[tauri::command]"; exit 1; fi

  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - name: tauri 2 system dependencies
        run: |
          sudo apt-get update
          # webkit2gtk-4.1 and libayatana-appindicator3 are Tauri 2's names; 4.0
          # and libappindicator3 are Tauri 1's and fail at link time, not install time.
          # Verbatim from Tauri 2's own prerequisites page — don't trim it by guesswork.
          sudo apt-get install -y --no-install-recommends \
            libwebkit2gtk-4.1-dev build-essential curl wget file \
            libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
      # Third-party action, referenced by tag — pin it to a commit SHA after install.
      # Its @rev picks the toolchain it installs; it does NOT read rust-toolchain.toml.
      - uses: dtolnay/rust-toolchain@stable
      # rust-toolchain.toml is a directory override, so it wins over the action's
      # default and pulls the rustfmt + clippy it declares. Resolve it by name here
      # rather than as a side effect of the first cargo call.
      - run: rustup show
      # Also third-party and also tag-referenced — pin both to SHAs after install.
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - run: cargo fmt --manifest-path src-tauri/Cargo.toml --check
      # clippy is the typecheck — no `cargo check` step, it would compile the same graph twice.
      - run: cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
      - run: cargo test --manifest-path src-tauri/Cargo.toml
      - name: capability audit
        run: |
          if [ -d src-tauri/capabilities ]; then
            if grep -rInE '"(shell:allow-execute|shell:allow-spawn|fs:default)"' src-tauri/capabilities; then
              echo "^ that capability hands the webview arbitrary execution or unscoped file access"
              exit 1
            fi
            if grep -rInE '"(path|url|identifier)"\s*:\s*"\*"' src-tauri/capabilities; then
              echo "^ wildcard scope in a capability — name the paths or origins you actually need"
              exit 1
            fi
          fi
          # Test the file exists first: `grep -q` on a missing path exits 2, which `!`
          # turns true, and the job would blame CSP for a missing config.
          if [ ! -f src-tauri/tauri.conf.json ]; then
            echo "^ src-tauri/tauri.conf.json not found — is this a Tauri repo?"
            exit 1
          fi
          # Tauri enables CSP protection only if the config sets it — absent == null == none.
          if ! grep -q '"csp"' src-tauri/tauri.conf.json \
             || grep -qE '"csp"\s*:\s*null' src-tauri/tauri.conf.json; then
            echo "^ app.security.csp is unset or null — that is the webview's isolation switched off"
            exit 1
          fi
      - name: generated API client matches the contract
        run: |
          # The generator is pinned inside this script, which the repo owns —
          # the pin is what makes the diff trustworthy.
          # `-f` then `-x`, not `-x` alone: a script that exists but lost its executable
          # bit means the gate was configured and then broke, and `-x` alone would turn
          # it green forever behind an echo nobody reads in a passing job.
          if [ ! -f tool/generate_api_client.sh ]; then
            echo "tool/generate_api_client.sh missing — API client is NOT diffed against the contract"
          elif [ ! -x tool/generate_api_client.sh ]; then
            echo "^ tool/generate_api_client.sh is not executable — chmod +x it; this gate was configured and is now broken"
            exit 1
          else
            ./tool/generate_api_client.sh
            git diff --exit-code
          fi
```

---

## github: nuxt-marketing

Write to `.github/workflows/ci.yml`.

Four things about this workflow that differ from the `nuxt` profile's:

- **It builds, and the build is the point.** Every other frontend profile stops at lint/typecheck/test. Here the build *is* the prerender, and a locale that fails to prerender 404s in production and nowhere else — not in `pnpm dev`, which has a Nitro half the deployed assets do not.
- **The prerender assertion is per locale, not a count.** One entry point per locale bundle under `i18n/locales/`, allowing exactly one locale to resolve at the root: with a prefix-except-default URL strategy the default locale has no prefixed directory. Two locales missing a prefixed entry point is a real failure; one is the default locale.
- **The three greps run here as well as in `scripts/pre-commit.sh`.** CI is the backstop for a commit that reached the branch without hooks installed — a fresh clone, a web edit, a teammate who skipped onboarding. Each grep tests its search root first, because `grep` exits 2 on a missing path *even when it matched*, and an exit 2 inside `if` is false — one absent argument would turn the step green over a repo full of violations.
- **No deploy job.** Deploying belongs to the site's own workflow, which the Marketing Site Factory owns. A generated deploy step would be the one generated command whose blast radius is a live client site, and it would need the account's API token to be useful.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4.3.1
      - uses: pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1 # v4.3.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm type-check
      - run: pnpm test --run
      - name: no colour literal outside the token set
        run: |
          # Every grep tests its search root first: grep exits 2 on a missing path
          # even when it matched, and an exit 2 inside `if` is false — so one absent
          # argument would turn this step green over a repo full of violations.
          if [ -d app/components ] \
             && grep -rInE '(#[0-9a-fA-F]{3,8}\b|rgba?\()' app/components \
                  --include='*.vue' --include='*.ts' --include='*.js' --include='*.css' \
                | grep -v 'token-ok'; then
            echo "^ colour literal in a component or block — colour comes from the generated token set"
            exit 1
          fi
      - name: no fallbackLocale in the i18n config
        run: |
          # i18n.config.ts is optional in this stack, so the path list is built from
          # what the repo actually has rather than handed to grep unconditionally.
          i18n_paths=""
          for p in nuxt.config.ts nuxt.config.js i18n.config.ts i18n.config.js i18n; do
            if [ -e "$p" ]; then i18n_paths="$i18n_paths $p"; fi
          done
          if [ -n "$i18n_paths" ] && grep -rIn 'fallbackLocale' $i18n_paths; then
            echo "^ fallbackLocale substitutes the default locale for missing content — this profile hides it instead"
            exit 1
          fi
      - name: no raw img outside app/components/media/
        run: |
          if [ -d app ] \
             && grep -rIn '<img' app --include='*.vue' --include='*.ts' --include='*.js' \
                | grep -v '^app/components/media/' \
                | grep -v 'img-ok'; then
            echo "^ raw <img> outside app/components/media/ — use the NuxtImg wrappers there"
            exit 1
          fi
      - run: pnpm build
      - name: every locale prerendered
        run: |
          if [ ! -d i18n/locales ]; then
            echo "^ i18n/locales/ not found — this profile is a multi-locale site by definition"
            exit 1
          fi
          if [ ! -f .output/public/index.html ]; then
            echo "^ .output/public/index.html missing — the build produced no prerendered root"
            exit 1
          fi
          # One prerendered entry point per locale bundle. Exactly one locale is
          # allowed to resolve at the root: with a prefix-except-default strategy
          # the default locale has no prefixed directory. Two is a real failure.
          rootless=0
          for f in i18n/locales/*.json; do
            code=$(basename "$f" .json)
            if [ ! -f ".output/public/$code/index.html" ]; then
              echo "no prerendered entry point for locale: $code"
              rootless=$((rootless + 1))
            fi
          done
          if [ "$rootless" -gt 1 ]; then
            echo "^ $rootless locales have no prerendered entry point; at most one (the default, served at the root) may"
            exit 1
          fi
```

---

## gitlab: nuxt

Write to `.gitlab-ci.yml`.

```yaml
stages:
  - quality

quality:
  stage: quality
  image: node:20-slim
  before_script:
    - corepack enable
    - corepack prepare pnpm@latest --activate
    - pnpm install --frozen-lockfile
  script:
    - pnpm lint
    - pnpm type-check
    - pnpm test --run
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

---

## gitlab: nodejs

Write to `.gitlab-ci.yml`. Identical to the nuxt job.

```yaml
stages:
  - quality

quality:
  stage: quality
  image: node:20-slim
  before_script:
    - corepack enable
    - corepack prepare pnpm@latest --activate
    - pnpm install --frozen-lockfile
  script:
    - pnpm lint
    - pnpm type-check
    - pnpm test --run
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

---

## gitlab: next

Write to `.gitlab-ci.yml`. Identical to the nuxt job.

```yaml
stages:
  - quality

quality:
  stage: quality
  image: node:20-slim
  before_script:
    - corepack enable
    - corepack prepare pnpm@latest --activate
    - pnpm install --frozen-lockfile
  script:
    - pnpm lint
    - pnpm type-check
    - pnpm test --run
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

---

## gitlab: go

Write to `.gitlab-ci.yml`.

```yaml
stages:
  - quality

quality:
  stage: quality
  image: golang:1.24
  before_script:
    - go install honnef.co/go/tools/cmd/staticcheck@latest
  script:
    - go build ./...
    # Prefer the repo's own lint target — it knows which generated packages to
    # exclude. Fall back to a plain sweep if there isn't one.
    - if grep -q '^lint:' Makefile 2>/dev/null; then make lint; else staticcheck ./...; fi
    - go test ./... -count=1
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

---

## gitlab: flutter

Write to `.gitlab-ci.yml`. Same four caveats as the GitHub job above (lockfile enforcement, both lint mechanisms, no integration tests on a runner with no device, pinned generators). Replace the image tag with the Flutter version in `.fvmrc` — `stable` is a moving target and defeats the point of pinning the SDK locally.

```yaml
stages:
  - quality

quality:
  stage: quality
  image: ghcr.io/cirruslabs/flutter:stable
  script:
    - flutter pub get --enforce-lockfile
    - dart format --output=none --set-exit-if-changed .
    - flutter analyze --fatal-infos
    - if grep -q 'custom_lint' pubspec.yaml; then dart run custom_lint; else echo "custom_lint not configured — riverpod_lint and hand-written rules are NOT running"; fi
    - if grep -q 'import_lint' pubspec.yaml; then dart run import_lint; else echo "import_lint not configured — the layer/feature import boundaries are NOT enforced"; fi
    - if grep -rInE 'https?://' lib --include='*.dart' --exclude='*.g.dart' --exclude='*.freezed.dart' --exclude='firebase_options*.dart' | grep -v 'url-literal-ok'; then echo "base URL literal in lib/ — read it from the flavor config, or mark a doc link // url-literal-ok"; exit 1; fi
    - flutter test
    - if ! grep -q 'build_runner' pubspec.yaml; then echo "build_runner not configured — the codegen diff is NOT running"; elif grep -qE '^\s+(build_runner|build_verify|json_serializable|riverpod_generator|drift_dev|go_router_builder|freezed|custom_lint):\s*["'"'"']?[>~^]' pubspec.yaml; then echo "code generators are on caret/range constraints — the codegen diff is NOT running; pin them to exact versions to switch this gate on"; else dart run build_runner build --delete-conflicting-outputs && git diff --exit-code; fi
    # `-f` then `-x`: a script that exists but lost its executable bit means the gate was
    # configured and then broke, and `-x` alone would turn it green forever behind an echo.
    - if [ ! -f tool/generate_api_client.sh ]; then echo "tool/generate_api_client.sh missing — API client is NOT diffed against the contract"; elif [ ! -x tool/generate_api_client.sh ]; then echo "tool/generate_api_client.sh is not executable — chmod +x it; this gate was configured and is now broken"; exit 1; else ./tool/generate_api_client.sh && git diff --exit-code; fi
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

---

## gitlab: tauri

Write to `.gitlab-ci.yml`. Two jobs for the same reason as the GitHub workflow, and the same five caveats apply — including no bundle build, which on GitLab would additionally need macOS runners you are probably paying for by the minute.

```yaml
stages:
  - quality

frontend:
  stage: quality
  image: node:22
  before_script:
    - corepack enable && corepack prepare pnpm@latest --activate
    - pnpm install --frozen-lockfile
  script:
    - pnpm lint
    - pnpm type-check
    - pnpm test --run
    - if grep -rInE 'https?://' app shared --include='*.ts' --include='*.vue' --include='*.js' 2>/dev/null | grep -v 'url-literal-ok'; then echo "URL literal in the webview — the API base URL belongs to Rust, or mark a doc link // url-literal-ok"; exit 1; fi
    - if grep -rInEi '(localStorage|sessionStorage)\.setItem\([^)]*(token|secret|password|credential|api[_-]?key|jwt|bearer)' app shared --include='*.ts' --include='*.vue' --include='*.js' 2>/dev/null | grep -v 'storage-ok'; then echo "secret written to web storage — it belongs in the OS keychain, on the Rust side"; exit 1; fi
    - if [ -d server ]; then echo "server/ exists — a Nitro route works in tauri dev and vanishes from tauri build; move it to a #[tauri::command]"; exit 1; fi
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'

rust:
  stage: quality
  image: rust:1-bookworm
  before_script:
    # webkit2gtk-4.1 and libayatana-appindicator3 are Tauri 2's names; the 4.0 /
    # libappindicator3 pair is Tauri 1's and fails at link time, not install time.
    # Verbatim from Tauri 2's own prerequisites page — don't trim it by guesswork.
    - apt-get update && apt-get install -y --no-install-recommends libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
    # rust-toolchain.toml pins the channel and pulls rustfmt + clippy; this makes rustup act on it before the gates run.
    - rustup show
  script:
    - cargo fmt --manifest-path src-tauri/Cargo.toml --check
    # clippy is the typecheck — no `cargo check`, it would compile the same graph twice.
    - cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
    - cargo test --manifest-path src-tauri/Cargo.toml
    - if [ -d src-tauri/capabilities ] && grep -rInE '"(shell:allow-execute|shell:allow-spawn|fs:default)"' src-tauri/capabilities; then echo "that capability hands the webview arbitrary execution or unscoped file access"; exit 1; fi
    - if [ -d src-tauri/capabilities ] && grep -rInE '"(path|url|identifier)"\s*:\s*"\*"' src-tauri/capabilities; then echo "wildcard scope in a capability — name the paths or origins you actually need"; exit 1; fi
    # File-exists test first: `grep -q` on a missing path exits 2, which `!` turns true,
    # and the job would blame CSP for a missing config.
    - if [ ! -f src-tauri/tauri.conf.json ]; then echo "src-tauri/tauri.conf.json not found — is this a Tauri repo?"; exit 1; fi
    # Tauri enables CSP protection only if the config sets it — absent == null == none.
    - if ! grep -q '"csp"' src-tauri/tauri.conf.json || grep -qE '"csp"\s*:\s*null' src-tauri/tauri.conf.json; then echo "app.security.csp is unset or null — that is the webview's isolation switched off"; exit 1; fi
    # `-f` then `-x`: a script that exists but lost its executable bit means the gate was
    # configured and then broke, and `-x` alone would turn it green forever behind an echo.
    - if [ ! -f tool/generate_api_client.sh ]; then echo "tool/generate_api_client.sh missing — API client is NOT diffed against the contract"; elif [ ! -x tool/generate_api_client.sh ]; then echo "tool/generate_api_client.sh is not executable — chmod +x it; this gate was configured and is now broken"; exit 1; else ./tool/generate_api_client.sh && git diff --exit-code; fi
  cache:
    key: cargo-$CI_COMMIT_REF_SLUG
    paths:
      - src-tauri/target/
      - .cargo/
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

---

## gitlab: nuxt-marketing

Write to `.gitlab-ci.yml`. Same four caveats as the GitHub workflow — the build is the prerender, the prerender assertion is per locale, the three greps are the backstop, and no deploy job.

```yaml
stages:
  - quality

quality:
  stage: quality
  image: node:22
  before_script:
    - corepack enable && corepack prepare pnpm@latest --activate
    - pnpm install --frozen-lockfile
  script:
    - pnpm lint
    - pnpm type-check
    - pnpm test --run
    # Every grep tests its search root first: grep exits 2 on a missing path even
    # when it matched, and an exit 2 inside `if` is false.
    - if [ -d app/components ] && grep -rInE '(#[0-9a-fA-F]{3,8}\b|rgba?\()' app/components --include='*.vue' --include='*.ts' --include='*.js' --include='*.css' | grep -v 'token-ok'; then echo "colour literal in a component or block — colour comes from the generated token set"; exit 1; fi
    - i18n_paths=""; for p in nuxt.config.ts nuxt.config.js i18n.config.ts i18n.config.js i18n; do if [ -e "$p" ]; then i18n_paths="$i18n_paths $p"; fi; done; if [ -n "$i18n_paths" ] && grep -rIn 'fallbackLocale' $i18n_paths; then echo "fallbackLocale substitutes the default locale for missing content — this profile hides it instead"; exit 1; fi
    - if [ -d app ] && grep -rIn '<img' app --include='*.vue' --include='*.ts' --include='*.js' | grep -v '^app/components/media/' | grep -v 'img-ok'; then echo "raw <img> outside app/components/media/ — use the NuxtImg wrappers there"; exit 1; fi
    - pnpm build
    - if [ ! -d i18n/locales ]; then echo "i18n/locales/ not found — this profile is a multi-locale site by definition"; exit 1; fi
    - if [ ! -f .output/public/index.html ]; then echo ".output/public/index.html missing — the build produced no prerendered root"; exit 1; fi
    # At most one locale (the default, served at the root under a prefix-except-default strategy) may have no prefixed entry point.
    - rootless=0; for f in i18n/locales/*.json; do code=$(basename "$f" .json); if [ ! -f ".output/public/$code/index.html" ]; then echo "no prerendered entry point for locale: $code"; rootless=$((rootless + 1)); fi; done; if [ "$rootless" -gt 1 ]; then echo "$rootless locales have no prerendered entry point; at most one may"; exit 1; fi
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

---

## Running the standard without CI

CI is a **tier of this standard, not a requirement of it**, and it is worth being explicit about that because the assumption is easy to make and expensive to discover late — GitHub bills Actions minutes on private repos, and an organisation with a billing problem has no CI on any project at once.

The sync scripts are **pull-based**. `contract_sync.mjs check` and `story_sync.mjs check` run at session start and say what this repo is behind on; `bump` and `sync` are one command each. The dispatch workflows are a *push notification* on top of that — they save somebody noticing. They are not the mechanism.

| Tier | Needs | What it gives you | What it costs |
|---|---|---|---|
| **Local-first** | nothing | SessionStart staleness notices; `bump`/`sync` by hand; the vendored-spec integrity check and the orphan warning at pre-commit (`hook-guard.md` → `## pre-commit: polyrepo additions`) | nobody hears about a change until they open a session, and a push from a clone with no hooks installed is ungated |
| **Self-hosted runner** | one always-on machine, registered once at org level | everything below, on private repos, for every project — no per-project setup | you maintain a runner |
| **GitHub-hosted CI** | Actions minutes (free on public repos) | auto-PRs on contract and story changes, the generated-client drift job, the story gates on every PR | billed per minute on private repos |

The tiers **layer**: adopting CI later changes no script and no lock, only which machine runs them. Do not treat local-first as a degraded state to be migrated off — it is the honest fallback whenever a runner is down, a contractor has no org access, or a repo is a day old, and the pre-commit block belongs on every consumer repo regardless of which tier that project is on.

The one check with no local equivalent is drift between the lock and the **generated client**: reproducing it means running codegen, which needs the toolchain and a network fetch, and a commit hook may not depend on either. That check stays CI-only, and a local-first project accepts it.

---

## story-sync workflow: github (specs repo)

Write to `.github/workflows/story-dispatch.yml` in the **specs** repo. Fires the event the consumer workflow below listens for.

`vars.STORY_CONSUMERS` is a JSON array of `owner/name` — the consumer repos of this project. It is a repo variable rather than a file so adding a consumer needs no code change.

```yaml
name: story-dispatch

on:
  push:
    branches: [main]
    paths:
      - 'docs/stories/**'
      - 'REPO_MAP.md'

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Mint an App token
        id: app
        uses: actions/create-github-app-token@v1   # pin to a commit SHA in your repo
        with:
          app-id: ${{ vars.CONTRACT_APP_ID }}
          private-key: ${{ secrets.CONTRACT_APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      - name: Tell each consumer repo
        env:
          GH_TOKEN: ${{ steps.app.outputs.token }}
          CONSUMERS: ${{ vars.STORY_CONSUMERS }}
        run: |
          set -euo pipefail
          echo "$CONSUMERS" | jq -r '.[]' | while read -r repo; do
            gh api "repos/$repo/dispatches" -f event_type=story-updated
          done
```

Actions' own `GITHUB_TOKEN` cannot `repository_dispatch` at another repo, which is why this mints an App token — the same reason `contract-bump.yml` does.

---

## story-sync workflow: github (consumer repos)

Write to `.github/workflows/story-sync.yml` in each **consumer** repo (`REPO_TYPE` = `api` / `web` / `mobile` / `qa`).

```yaml
name: story-sync

on:
  repository_dispatch:
    types: [story-updated]
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Mint an App token
        id: app
        uses: actions/create-github-app-token@v1   # pin to a commit SHA in your repo
        with:
          app-id: ${{ vars.CONTRACT_APP_ID }}
          private-key: ${{ secrets.CONTRACT_APP_PRIVATE_KEY }}
          owner: ${{ github.repository_owner }}

      - uses: actions/checkout@v4
        with:
          token: ${{ steps.app.outputs.token }}
      - uses: actions/setup-node@v4
        with:
          node-version: 22   # nuxt-scaffold requires 22+, and runners now force 20 onto 24

      - name: Pull the stories
        env:
          GITHUB_TOKEN: ${{ steps.app.outputs.token }}
        run: node scripts/story_sync.mjs sync

      - name: Open the PR
        env:
          GH_TOKEN: ${{ steps.app.outputs.token }}
        run: |
          set -euo pipefail
          if git diff --quiet; then
            echo "already in step with the specs repo"
            exit 0
          fi
          BRANCH="story-sync/$(date -u +%Y%m%d%H%M%S)"
          git config user.name  "story-sync[bot]"
          git config user.email "story-sync[bot]@users.noreply.github.com"
          git switch -c "$BRANCH"
          git add -A
          git commit -m "docs(stories): sync from the specs repo"
          git push -u origin "$BRANCH"
          gh pr create \
            --title "docs(stories): sync from the specs repo" \
            --body "Automated. Every file here carries \`synced: true\` and is read-only —
          edit stories in the specs repo. Dev-side context goes in \`docs/story-meta/\`,
          which this sync never touches." \
            --head "$BRANCH"
```

The commit subject is `docs(stories):` deliberately: `commit-msg-guard` requires a Conventional Commit, and `docs:` keeps `bugfix-test-guard` out of the way of a PR that contains no code.

---

## story gates: github (consumer repos)

Write to `.github/workflows/story-gates.yml` in each repo that receives synced stories.

Three gates in one job, in the order that makes them useful: the PR must name a story, that story must be ready for dev, and any orphaned sidecar is surfaced. The PR title and body reach the script through `env:` and never through `${{ }}` inside a `run:` block — they are text a contributor wrote.

```yaml
name: story-gates

on:
  pull_request:

jobs:
  gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22   # nuxt-scaffold requires 22+, and runners now force 20 onto 24

      - name: The PR must name a story
        id: story
        env:
          PR_TITLE: ${{ github.event.pull_request.title }}
          PR_BODY: ${{ github.event.pull_request.body }}
        run: echo "ids=$(node scripts/story_gate.mjs pr)" >> "$GITHUB_OUTPUT"

      - name: Those stories must be ready for dev
        run: node scripts/story_gate.mjs ready ${{ steps.story.outputs.ids }}

      - name: Orphaned sidecars
        if: always()
        run: node scripts/story_gate.mjs orphans
```

`orphans` runs with `if: always()` and never fails the build — an orphan means a story was deleted upstream and its sidecar outlived it, which is worth seeing and is not worth blocking a merge over.

**`ready` is deliberately not run over every story.** A story that declares UI and has no sidecar yet is the normal state before dev starts — that is what "not ready for dev" means. A job that failed on it would fail the story-sync PR itself, on the day the story arrives, forever. It runs against the stories *this PR names*, because a PR is the moment work begins.

---

## story gates: gitlab (consumer repos)

Same three gates, in `.gitlab-ci.yml`. GitLab exposes the merge-request title and description as predefined variables, so no interpolation is needed at all.

```yaml
story-gates:
  stage: test
  image: node:20
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - export PR_TITLE="$CI_MERGE_REQUEST_TITLE"
    - export PR_BODY="$CI_MERGE_REQUEST_DESCRIPTION"
    - IDS=$(node scripts/story_gate.mjs pr)
    - node scripts/story_gate.mjs ready $IDS
  after_script:
    - node scripts/story_gate.mjs orphans
```

`orphans` sits in `after_script` for the same reason it carries `if: always()` on GitHub: it reports, it does not gate.

---

## knowledge-validate step: github

Only when `KNOWLEDGE_BUNDLE = true`. Insert as the last step of the `quality` job, after the profile's test step. No setup step needed — GitHub's ubuntu runners ship Node.

```yaml
      - name: knowledge validate
        run: node tools/knowledge_validate.mjs
```

---

## knowledge-validate step: gitlab

Only when `KNOWLEDGE_BUNDLE = true`. Add the run to `script`, after the profile's test command.

`script` addition:
```yaml
    - node tools/knowledge_validate.mjs
```

For the **go and flutter profiles** (neither the `golang` nor the Flutter image ships Node), also add a `before_script`:
```yaml
  before_script:
    - apt-get update -qq && apt-get install -y -qq nodejs
```
(For go, that line joins the existing `before_script`; the flutter job has none yet, so add the key.) The nuxt/nuxt-marketing/nodejs/next profiles run on a `node` image — no addition needed.

---

## cursor-mirror step: github

Only when `AGENT_HOSTS` includes `cursor`. Insert as the last step of the `quality` job. The pre-commit gate already runs this, so CI is the backstop for a commit that reached the branch without hooks installed — a fresh clone, a web edit, or a teammate who skipped the onboarding step.

```yaml
      - name: cursor mirror up to date
        run: node tools/cursor_mirror.mjs --check
```

---

## cursor-mirror step: gitlab

Only when `AGENT_HOSTS` includes `cursor`. Add the run to `script`.

`script` addition:
```yaml
    - node tools/cursor_mirror.mjs --check
```

Same Node caveat as the knowledge validator above: the **go and flutter profiles** need the `nodejs` `before_script` line, and it's the same line — add it once even when both steps are present.

---

## Clearing the spec gate before writing CI (Phase 5.6, step 0)

`spec-gate-guard.mjs` blocks any `Write` outside its trivial allowlist, and a CI workflow isn't on that list — so on a repo that *already* has the guard registered (a second harness run, or a first run where CI was declined and is being added later) every write below dies with `PLAN.md missing or not approved`. Two non-fixes to rule out: reordering this phase ahead of Phase 5 doesn't help, because a `PreToolUse` block is `exit 2` that nothing in this run can override and on a re-run the guard is live from the session's first tool call; and widening the guard's allowlist is worse than the bug, since a workflow file executes with access to CI secrets and defines which gates run at all — it's the single file most worth gating.

   Check for `.claude/guards/spec-gate-guard.mjs` **and** its `PreToolUse` registration in `.claude/settings.json`. If either is missing, nothing is gating — go to step 1.

   If it is active:
   - **`PLAN.md` already exists** — never clobber it; it may govern a task in flight. If its `Status:` is `approved` and its `Branch:` matches `HEAD`, the gate already passes: go to step 1 and leave the file alone. Otherwise skip this phase entirely, tell the user CI was skipped because `PLAN.md` is mid-task, and point them at re-running once it's cleared.
   - **No `PLAN.md`** — write a minimal one: `Status: approved`, `Branch: {git branch --show-current}`, a one-line spec naming the provider, profile, and exact target paths, and one task row per file to be written. Then do steps 1–3, and **delete `PLAN.md`** immediately after, reporting both the creation and the delete in the Phase 7 summary.

   That last move is narrow on purpose. It is not a self-approval and must never be generalized into one: the user already approved CI in Phase 1.5, and this only records that existing decision in the form the guard can read. It applies to the CI paths in this phase and nothing else, and the plan is deleted the moment they're written — an approved `PLAN.md` left behind would hold the gate open for whatever the user does next.
