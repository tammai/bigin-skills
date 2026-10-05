#!/usr/bin/env node
// Auto-formats only the file just written/edited via ESLint --fix.
// Claude Code PostToolUse hook — reads tool input from stdin.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

let data
try {
  data = JSON.parse(readFileSync(0, 'utf-8'))
} catch {
  process.exit(0)
}

const filePath = data?.tool_input?.file_path
if (!filePath) process.exit(0)

// Run ESLint's own entry script with this Node binary: no shell and no
// `pnpm.cmd`, so a path with spaces or `&` can't be reinterpreted by cmd.exe on Windows.
const eslint = join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), 'node_modules', 'eslint', 'bin', 'eslint.js')
if (!existsSync(eslint)) process.exit(0)
spawnSync(process.execPath, [eslint, '--fix', '--cache', filePath], { stdio: 'inherit' })
