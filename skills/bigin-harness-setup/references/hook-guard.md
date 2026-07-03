# Hook & Guard Templates

Scripts for enforcement gates. Written into the target project during setup.

---

## bash-guard.py

Write to `.claude/guards/bash-guard.py`.

```python
#!/usr/bin/env python3
"""
Blocks Bash commands that bypass quality gates.
Claude Code PreToolUse hook — reads tool input from stdin, exits 2 to block.
"""
import json
import sys
import re

data = json.load(sys.stdin)
command = data.get("tool_input", {}).get("command", "")

# Strip quoted strings so flags inside commit messages don't trigger false positives.
scrubbed = re.sub(r"'[^']*'", "''", command)
scrubbed = re.sub(r'"[^"]*"', '""', scrubbed)

BLOCKED = [
    (r"--no-verify", "Error: --no-verify bypasses pre-commit gates. Fix the underlying issue."),
    # -n only in the flag region (a chain of -flags after `commit`), never inside a quoted message
    (r"git\s+commit\s+(?:-\w+\s+)*-n\b", "Error: git commit -n bypasses pre-commit gates. Fix the underlying issue."),
    # --force but NOT --force-with-lease (which is the sanctioned alternative)
    (r"git\s+push\b.*--force(?!-with-lease)(\s|$)", "Error: --force push is blocked. Use --force-with-lease on a feature branch."),
    (r"git\s+push\b.*\s-f(\s|$)", "Error: force push is blocked. Use --force-with-lease on a feature branch."),
]

for pattern, message in BLOCKED:
    if re.search(pattern, scrubbed):
        print(message, file=sys.stderr)
        sys.exit(2)  # exit 2 = block the tool call in Claude Code
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
if [ -f tools/context_budget.py ]; then python3 tools/context_budget.py; fi

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
if [ -f tools/context_budget.py ]; then python3 tools/context_budget.py; fi

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
if [ -f tools/context_budget.py ]; then python3 tools/context_budget.py; fi

echo "All gates passed."
```
