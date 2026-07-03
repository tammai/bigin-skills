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
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
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
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
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
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
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
The nuxt/nodejs profiles run on a `node` image — no addition needed.
