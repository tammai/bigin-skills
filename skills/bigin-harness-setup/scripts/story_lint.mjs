#!/usr/bin/env node
/**
 * story_lint.mjs — checks that every story declares its contract impact.
 *
 * Usage:
 *   node story_lint.mjs [path ...]      # default: docs/stories
 *
 * Runs in the specs repo at commit time and in CI. Exit 0 clean, 1 findings,
 * 2 bad usage. Node >=20 stdlib only.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ASSUMPTIONS ABOUT BMAD'S STORY FORMAT
 *
 * No BMAD story template ships in bigin-skills, so this was written against the
 * documented shape rather than a real corpus. Every assumption lives in
 * parseContractImpact() below and nowhere else, so reworking it against a live
 * specs repo is one function, not a rewrite:
 *
 *   1. Stories are markdown, one story per file, under docs/stories/.
 *   2. The section is an H2 spelled exactly `## Contract impact`.
 *   3. It holds three `- key: value` lines: contracts, breaking, ui.
 *   4. contracts is `none`, or `<service>.v<major>` optionally followed by
 *      ` — <free text>`. breaking and ui are `yes` or `no`.
 *   5. Everything else in the story is ignored. This lints one section; it is
 *      not a story linter.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_DIR = join('docs', 'stories')

// ── the whole assumption surface ────────────────────────────────────────

const HEADING = /^##\s+Contract impact\s*$/im
const CONTRACTS = /^-\s*contracts:\s*(none|[a-z0-9-]+\.v\d+(?:\s+[—-]\s+.+)?)\s*$/im
const BREAKING = /^-\s*breaking:\s*(yes|no)\s*$/im
const UI = /^-\s*ui:\s*(yes|no)\s*$/im

function parseContractImpact(text) {
  const at = text.match(HEADING)
  if (!at) return { ok: false, problem: 'no `## Contract impact` section' }

  // Only the block between this heading and the next one. A key that happens to
  // appear elsewhere in the story must not satisfy the section.
  const after = text.slice(text.indexOf(at[0]) + at[0].length)
  const next = after.search(/^##\s+/m)
  const block = next === -1 ? after : after.slice(0, next)

  const missing = []
  if (!CONTRACTS.test(block)) missing.push('contracts')
  if (!BREAKING.test(block)) missing.push('breaking')
  if (!UI.test(block)) missing.push('ui')
  if (missing.length > 0) {
    return { ok: false, problem: `missing or malformed: ${missing.join(', ')}` }
  }
  return { ok: true, ui: block.match(UI)[1].toLowerCase() === 'yes' }
}

// ── walk ────────────────────────────────────────────────────────────────

function storyFiles(target) {
  if (!existsSync(target)) return []
  if (statSync(target).isFile()) return target.endsWith('.md') ? [target] : []
  return readdirSync(target)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => join(target, f))
}

const targets = process.argv.slice(2)
const roots = targets.length > 0 ? targets : [DEFAULT_DIR]
const files = roots.flatMap(storyFiles)

if (files.length === 0) {
  // Not a failure: a specs repo with no stories yet is a normal state, and a lint
  // that fails on an empty repo gets removed from the hook on day one.
  console.log('[story-lint] no story files found — nothing to check')
  process.exit(0)
}

const findings = []
for (const f of files) {
  let text
  try {
    text = readFileSync(f, 'utf8')
  } catch (e) {
    findings.push(`${f}: could not read (${e.message})`)
    continue
  }
  const verdict = parseContractImpact(text)
  if (!verdict.ok) findings.push(`${f}: ${verdict.problem}`)
}

if (findings.length === 0) {
  console.log(`[story-lint] OK — ${files.length} story file(s) declare contract impact`)
  process.exit(0)
}

console.error('[story-lint] every story needs a filled-in Contract impact section:\n')
for (const f of findings) console.error(`  ${f}`)
console.error(`
Add this to the story, filling in the real values:

## Contract impact
- contracts: none | <service>.v<major> — endpoints touched
- breaking: yes | no
- ui: yes | no
`)
process.exit(1)
