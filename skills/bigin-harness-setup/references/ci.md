# CI Templates

CI config for the two quality gates the harness already runs locally (lint, typecheck, test) plus, when opted in, the Knowledge Bundle validator. Written into the target project during setup — opt-in, per Phase 5.6.

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
          node-version: 20
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
          node-version: 20
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
          node-version: 20
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
      - run: dart format --set-exit-if-changed .
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
               --exclude='*.g.dart' --exclude='*.freezed.dart' --exclude='firebase_options.dart' \
               | grep -v 'url-literal-ok'; then
            echo "^ base URL literal in lib/ — read it from the flavor config"
            exit 1
          fi
      - run: flutter test
      - name: generated code matches its source
        run: |
          if ! grep -q 'build_runner' pubspec.yaml; then
            echo "build_runner not configured — skipping the codegen diff"
            exit 0
          fi
          # The diff gate is only meaningful if regeneration is deterministic.
          if grep -qE '^\s+(build_runner|build_verify|json_serializable|riverpod_generator|drift_dev|go_router_builder|freezed|custom_lint):\s*["'"'"']?[>~^]' pubspec.yaml; then
            echo "pin every code generator to an exact version — a caret range makes this gate flap on an unrelated bump"
            exit 1
          fi
          dart run build_runner build --delete-conflicting-outputs
          git diff --exit-code
      - name: generated API client matches the contract
        run: |
          # The generator (openapi-generator JAR or Docker tag) is pinned inside this
          # script, which the repo owns — the pin is what makes the diff trustworthy.
          if [ -x tool/generate_api_client.sh ]; then
            ./tool/generate_api_client.sh
            git diff --exit-code
          else
            echo "tool/generate_api_client.sh missing — API client is NOT diffed against the contract"
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
    - dart format --set-exit-if-changed .
    - flutter analyze --fatal-infos
    - if grep -q 'custom_lint' pubspec.yaml; then dart run custom_lint; else echo "custom_lint not configured — riverpod_lint and hand-written rules are NOT running"; fi
    - if grep -q 'import_lint' pubspec.yaml; then dart run import_lint; else echo "import_lint not configured — the layer/feature import boundaries are NOT enforced"; fi
    - if grep -rInE 'https?://' lib --include='*.dart' --exclude='*.g.dart' --exclude='*.freezed.dart' --exclude='firebase_options.dart' | grep -v 'url-literal-ok'; then echo "base URL literal in lib/ — read it from the flavor config, or mark a doc link // url-literal-ok"; exit 1; fi
    - flutter test
    - if grep -qE '^\s+(build_runner|build_verify|json_serializable|riverpod_generator|drift_dev|go_router_builder|freezed|custom_lint):\s*["'"'"']?[>~^]' pubspec.yaml; then echo "pin every code generator to an exact version — a caret range makes this gate flap on an unrelated bump"; exit 1; fi
    - if grep -q 'build_runner' pubspec.yaml; then dart run build_runner build --delete-conflicting-outputs && git diff --exit-code; else echo "build_runner not configured — skipping the codegen diff"; fi
    - if [ -x tool/generate_api_client.sh ]; then ./tool/generate_api_client.sh && git diff --exit-code; else echo "tool/generate_api_client.sh missing — API client is NOT diffed against the contract"; fi
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == "main"'
```

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
(For go, that line joins the existing `before_script`; the flutter job has none yet, so add the key.) The nuxt/nodejs/next profiles run on a `node` image — no addition needed.

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
