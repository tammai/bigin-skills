#!/usr/bin/env node
// Enforce per-file budgets on a distilled library bundle before it goes to the audit phase.
// The index file is read routinely (it feeds the index-first protocol in .claude/rules/knowledge.md)
// so it keeps the bundle spec's ~60-line cap; topic files are single on-demand reads of one
// contiguous API surface and get 100. Frontmatter is excluded from both counts.
// Chars-to-tokens uses the same /4 estimate as tools/context_budget.mjs — nothing here counts
// real tokens, so don't report as if it does.
// Usage: node count_budget.mjs <bundle-dir> [--index-lines 60] [--topic-lines 100]
// Exit codes: 0 within budget, 1 over budget, 2 bad usage.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const DEFAULTS = { indexLines: 60, indexChars: 2400, topicLines: 100, topicChars: 4000 }

function stripFrontmatter(raw) {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  if (!text.startsWith('---')) return text
  const end = text.indexOf('\n---', 3)
  if (end === -1) return text
  const bodyStart = text.indexOf('\n', end + 1)
  return bodyStart === -1 ? '' : text.slice(bodyStart + 1)
}

function main() {
  const argv = process.argv.slice(2)
  const limits = { ...DEFAULTS }
  let dir = null

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--index-lines') limits.indexLines = Number(argv[++i])
    else if (argv[i] === '--topic-lines') limits.topicLines = Number(argv[++i])
    else if (argv[i] === '--index-chars') limits.indexChars = Number(argv[++i])
    else if (argv[i] === '--topic-chars') limits.topicChars = Number(argv[++i])
    else if (argv[i].startsWith('--')) {
      console.error(`unknown flag: ${argv[i]}`)
      return 2
    } else if (dir === null) dir = argv[i]
    else {
      console.error('expected exactly one bundle directory')
      return 2
    }
  }

  if (dir === null) {
    console.error('usage: node count_budget.mjs <bundle-dir> [--index-lines N] [--topic-lines N]')
    return 2
  }
  if (Object.values(limits).some(v => !Number.isFinite(v) || v <= 0)) {
    console.error('limits must be positive numbers')
    return 2
  }

  let entries
  try {
    if (!statSync(dir).isDirectory()) throw new Error('not a directory')
    entries = readdirSync(dir).filter(name => name.endsWith('.md')).sort()
  } catch {
    console.error(`ERROR ${dir}: not a readable directory`)
    return 1
  }

  if (entries.length === 0) {
    console.error(`ERROR ${dir}: no .md files found`)
    return 1
  }

  const failures = []
  let totalChars = 0

  for (const name of entries) {
    const path = join(dir, name)
    const body = stripFrontmatter(readFileSync(path, 'utf-8'))
    const lines = body.split('\n').length
    const chars = body.length
    totalChars += chars

    const isIndex = basename(name) === 'index.md'
    const maxLines = isIndex ? limits.indexLines : limits.topicLines
    const maxChars = isIndex ? limits.indexChars : limits.topicChars

    if (lines > maxLines) failures.push(`${path}: ${lines} lines (limit ${maxLines})`)
    if (chars > maxChars) failures.push(`${path}: ${chars} chars (limit ${maxChars})`)
    console.log(`${lines > maxLines || chars > maxChars ? 'OVER' : ' ok '} ${path} — ${lines} lines, ${chars} chars`)
  }

  console.log(`\n${entries.length} file(s), ${totalChars} chars total (~${Math.round(totalChars / 4)} tokens est.)`)

  if (failures.length) {
    for (const msg of failures) console.log(`ERROR ${msg}`)
    console.log('\nTrim by cutting low-value lines. Do not shard into a file the index does not link — the validator reports it unreachable and no reader finds it.')
    return 1
  }
  return 0
}

process.exit(main())
