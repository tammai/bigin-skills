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
          go-version: "1.22"
      - run: go build ./...
      - name: lint
        run: |
          go install honnef.co/go/tools/cmd/staticcheck@latest
          staticcheck ./...
      - run: go test ./... -count=1
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
  image: golang:1.22
  before_script:
    - go install honnef.co/go/tools/cmd/staticcheck@latest
  script:
    - go build ./...
    - staticcheck ./...
    - go test ./... -count=1
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

For the **go profile only** (the `golang` image has no Node), also add to `before_script`:
```yaml
    - apt-get update -qq && apt-get install -y -qq nodejs
```
The nuxt/nodejs/next profiles run on a `node` image — no addition needed.
