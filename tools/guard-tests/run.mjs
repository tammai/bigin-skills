#!/usr/bin/env node
// Runs both guard suites against the shipped templates.
// Usage: node tools/guard-tests/run.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const box = mkdtempSync(join(tmpdir(), 'bigin-guard-tests-'))
let failed = false
try {
  execFileSync('node', ['tools/guard-tests/extract.mjs', box], { stdio: 'inherit' })
  for (const suite of ['regression.mjs', 'matrix.mjs']) {
    copyFileSync(join('tools/guard-tests', suite), join(box, suite))
    console.log(`\n=== ${suite} ===`)
    try {
      execFileSync('node', [suite], { cwd: box, stdio: 'inherit' })
    } catch {
      failed = true
    }
  }
} finally {
  rmSync(box, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
