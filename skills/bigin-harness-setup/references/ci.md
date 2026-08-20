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
    - dart format --output=none --set-exit-if-changed .
    - flutter analyze --fatal-infos
    - if grep -q 'custom_lint' pubspec.yaml; then dart run custom_lint; else echo "custom_lint not configured — riverpod_lint and hand-written rules are NOT running"; fi
    - if grep -q 'import_lint' pubspec.yaml; then dart run import_lint; else echo "import_lint not configured — the layer/feature import boundaries are NOT enforced"; fi
    - if grep -rInE 'https?://' lib --include='*.dart' --exclude='*.g.dart' --exclude='*.freezed.dart' --exclude='firebase_options*.dart' | grep -v 'url-literal-ok'; then echo "base URL literal in lib/ — read it from the flavor config, or mark a doc link // url-literal-ok"; exit 1; fi
    - flutter test
    - if ! grep -q 'build_runner' pubspec.yaml; then echo "build_runner not configured — the codegen diff is NOT running"; elif grep -qE '^\s+(build_runner|build_verify|json_serializable|riverpod_generator|drift_dev|go_router_builder|freezed|custom_lint):\s*["'"'"']?[>~^]' pubspec.yaml; then echo "code generators are on caret/range constraints — the codegen diff is NOT running; pin them to exact versions to switch this gate on"; else dart run build_runner build --delete-conflicting-outputs && git diff --exit-code; fi
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

---

## Clearing the spec gate before writing CI (Phase 5.6, step 0)

`spec-gate-guard.mjs` blocks any `Write` outside its trivial allowlist, and a CI workflow isn't on that list — so on a repo that *already* has the guard registered (a second harness run, or a first run where CI was declined and is being added later) every write below dies with `PLAN.md missing or not approved`. Two non-fixes to rule out: reordering this phase ahead of Phase 5 doesn't help, because a `PreToolUse` block is `exit 2` that nothing in this run can override and on a re-run the guard is live from the session's first tool call; and widening the guard's allowlist is worse than the bug, since a workflow file executes with access to CI secrets and defines which gates run at all — it's the single file most worth gating.

   Check for `.claude/guards/spec-gate-guard.mjs` **and** its `PreToolUse` registration in `.claude/settings.json`. If either is missing, nothing is gating — go to step 1.

   If it is active:
   - **`PLAN.md` already exists** — never clobber it; it may govern a task in flight. If its `Status:` is `approved` and its `Branch:` matches `HEAD`, the gate already passes: go to step 1 and leave the file alone. Otherwise skip this phase entirely, tell the user CI was skipped because `PLAN.md` is mid-task, and point them at re-running once it's cleared.
   - **No `PLAN.md`** — write a minimal one: `Status: approved`, `Branch: {git branch --show-current}`, a one-line spec naming the provider, profile, and exact target paths, and one task row per file to be written. Then do steps 1–3, and **delete `PLAN.md`** immediately after, reporting both the creation and the delete in the Phase 7 summary.

   That last move is narrow on purpose. It is not a self-approval and must never be generalized into one: the user already approved CI in Phase 1.5, and this only records that existing decision in the form the guard can read. It applies to the CI paths in this phase and nothing else, and the plan is deleted the moment they're written — an approved `PLAN.md` left behind would hold the gate open for whatever the user does next.
