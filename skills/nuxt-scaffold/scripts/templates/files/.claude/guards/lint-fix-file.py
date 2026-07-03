#!/usr/bin/env python3
"""
Auto-formats only the file just written/edited via ESLint --fix.
Claude Code PostToolUse hook — reads tool input from stdin.
"""
import json
import subprocess
import sys

try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)

file_path = data.get("tool_input", {}).get("file_path")
if not file_path:
    sys.exit(0)

subprocess.run(["pnpm", "exec", "eslint", "--fix", "--cache", file_path])
