#!/usr/bin/env node
// Auto-formats only the file just written/edited via ESLint --fix.
// Claude Code PostToolUse hook — reads tool input from stdin.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

let data
try {
  data = JSON.parse(readFileSync(0, 'utf-8'))
} catch {
  process.exit(0)
}

const filePath = data?.tool_input?.file_path
if (!filePath) process.exit(0)

spawnSync('pnpm', ['exec', 'eslint', '--fix', '--cache', filePath], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
