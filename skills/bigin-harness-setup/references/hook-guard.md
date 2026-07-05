# Hook & Guard Templates

Scripts for enforcement gates. Written into the target project during setup. Guards are Node (`.mjs`) so they run on macOS, Linux, and Windows — `python3` is not guaranteed on Windows.

---

## bash-guard.mjs

Write to `.claude/guards/bash-guard.mjs`.

```javascript
#!/usr/bin/env node
// Blocks Bash commands that bypass quality gates.
// Claude Code PreToolUse hook — reads tool input from stdin, exits 2 to block.
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(0, 'utf-8'))
const command = data?.tool_input?.command ?? ''

// Strip quoted strings so flags inside commit messages don't trigger false positives.
let scrubbed = command.replace(/'[^']*'/g, '\'\'')
scrubbed = scrubbed.replace(/"[^"]*"/g, '""')

const BLOCKED = [
  [/--no-verify/, 'Error: --no-verify bypasses pre-commit gates. Fix the underlying issue.'],
  // -n only in the flag region (a chain of -flags after `commit`), never inside a quoted message
  [/git\s+commit\s+(?:-\w+\s+)*-n\b/, 'Error: git commit -n bypasses pre-commit gates. Fix the underlying issue.'],
  // --force but NOT --force-with-lease (which is the sanctioned alternative)
  [/git\s+push\b.*--force(?!-with-lease)(\s|$)/, 'Error: --force push is blocked. Use --force-with-lease on a feature branch.'],
  [/git\s+push\b.*\s-f(\s|$)/, 'Error: force push is blocked. Use --force-with-lease on a feature branch.']
]

for (const [pattern, message] of BLOCKED) {
  if (pattern.test(scrubbed)) {
    console.error(message)
    process.exit(2) // exit 2 = block the tool call in Claude Code
  }
}
```

---

## spec-gate-guard.mjs

Write to `.claude/guards/spec-gate-guard.mjs`.

```javascript
#!/usr/bin/env node
// Blocks non-trivial Edit/Write/MultiEdit before PLAN.md is approved.
// Claude Code PreToolUse hook — reads tool input from stdin, exits 2 to block.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const data = JSON.parse(readFileSync(0, 'utf-8'))
const toolName = data?.tool_name ?? ''
const toolInput = data?.tool_input ?? {}
const filePath = toolInput.file_path ?? ''

if (!filePath) process.exit(0)

// Trivial paths never require an approved plan: tests, docs, env examples, config files.
const TRIVIAL_PATTERNS = [
  /(^|[/\\])tests?[/\\]/i,
  /\.md$/i,
  /\.env\.example$/i,
  /(^|[/\\])(\.eslintrc(\.\w+)?|eslint\.config\.\w+|\.prettierrc(\.\w+)?|prettier\.config\.\w+|tsconfig(\.\w+)?\.json|vite\.config\.\w+|vitest\.config\.\w+|nuxt\.config\.\w+|\.editorconfig|\.gitignore|\.npmrc)$/i
]

if (TRIVIAL_PATTERNS.some(p => p.test(filePath))) process.exit(0)

function isPlanApproved() {
  const planPath = join(process.cwd(), 'PLAN.md')
  if (!existsSync(planPath)) return false
  const match = readFileSync(planPath, 'utf-8').match(/^Status:\s*(\S+)/m)
  return !!match && match[1].toLowerCase() === 'approved'
}

if (isPlanApproved()) process.exit(0)

function lineCount(text) {
  return text === '' ? 0 : text.split('\n').length
}

// Proxy for the skill's own "≤20 lines of logic" spec-gate exemption.
const LINE_THRESHOLD = 20

function changeSize() {
  if (toolName === 'Edit') {
    return Math.max(lineCount(toolInput.old_string ?? ''), lineCount(toolInput.new_string ?? ''))
  }
  if (toolName === 'MultiEdit') {
    return (toolInput.edits ?? []).reduce(
      (sum, e) => sum + Math.max(lineCount(e.old_string ?? ''), lineCount(e.new_string ?? '')),
      0
    )
  }
  if (toolName === 'Write') {
    const newLines = lineCount(toolInput.content ?? '')
    if (existsSync(filePath)) return Math.abs(newLines - lineCount(readFileSync(filePath, 'utf-8')))
    return newLines
  }
  return Infinity
}

if (changeSize() > LINE_THRESHOLD) {
  console.error('Error: PLAN.md missing or not approved. Get spec approval (see task-workflow skill) before non-trivial edits, or keep the change ≤20 lines.')
  process.exit(2)
}
```

---

## pre-commit: nuxt

Write to `scripts/pre-commit.sh`.

```bash
#!/bin/sh
# Pre-commit quality gates — nuxt profile
set -e

echo "Running pre-commit gates..."

echo "  lint..."
pnpm lint

echo "  typecheck..."
pnpm type-check

echo "  tests..."
pnpm test --run

echo "  context budget..."
if [ -f tools/context_budget.mjs ]; then node tools/context_budget.mjs; fi

echo "All gates passed."
```

---

## pre-commit: go

Write to `scripts/pre-commit.sh`.

```bash
#!/bin/sh
# Pre-commit quality gates — go profile
set -e

echo "Running pre-commit gates..."

echo "  build/typecheck..."
go build ./...

echo "  lint..."
if command -v staticcheck >/dev/null 2>&1; then
  staticcheck ./...
else
  echo "  staticcheck not found — skipping (run: go install honnef.co/go/tools/cmd/staticcheck@latest)"
fi

echo "  tests..."
go test ./... -count=1

echo "  context budget..."
if [ -f tools/context_budget.mjs ]; then node tools/context_budget.mjs; fi

echo "All gates passed."
```

---

## pre-commit: nodejs

Write to `scripts/pre-commit.sh`.

```bash
#!/bin/sh
# Pre-commit quality gates — nodejs profile
set -e

echo "Running pre-commit gates..."

echo "  lint..."
pnpm lint

echo "  typecheck..."
pnpm type-check

echo "  tests..."
pnpm test --run

echo "  context budget..."
if [ -f tools/context_budget.mjs ]; then node tools/context_budget.mjs; fi

echo "All gates passed."
```
