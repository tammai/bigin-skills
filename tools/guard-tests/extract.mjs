#!/usr/bin/env node
// Extracts every guard template out of hook-guard.md into a temp dir, so the test
// suites run against exactly what gets scaffolded into target repos rather than a
// hand-kept copy that can drift.
//
// Usage: node tools/guard-tests/extract.mjs <outDir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = 'skills/bigin-harness-setup/references/hook-guard.md'
const GUARDS = [
  'bash-guard.mjs',
  'spec-gate-guard.mjs',
  'bugfix-test-guard.mjs',
  'task-plan-gate.mjs',
  'task-verify-gate.mjs'
]

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: node tools/guard-tests/extract.mjs <outDir>')
  process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const doc = readFileSync(SOURCE, 'utf-8')
let count = 0
for (const name of GUARDS) {
  const re = new RegExp(`## ${name.replace('.', '\\.')}[^\\n]*\\n\\n[\\s\\S]*?\\n\`\`\`javascript\\n([\\s\\S]*?)\\n\`\`\``)
  const match = doc.match(re)
  if (!match) {
    console.error(`ERROR ${name} has no \`\`\`javascript template section in ${SOURCE}`)
    process.exit(1)
  }
  writeFileSync(join(outDir, name), `${match[1]}\n`)
  count++
}
console.log(`extracted ${count} guard(s) from ${SOURCE} to ${outDir}`)
