#!/usr/bin/env node
/**
 * story_gate.mjs — the three story gates that live in a consumer repo.
 *
 * Usage:
 *   node story_gate.mjs pr        # a PR must name a story (reads PR_TITLE / PR_BODY)
 *   node story_gate.mjs ready ST-042 [...]   # a UI story needs a final Figma sidecar
 *   node story_gate.mjs orphans   # sidecars with no story — warns, never fails
 *
 * Exit 0 clean, 1 findings, 2 bad usage. Node >=20 stdlib only.
 *
 * WHY `ready` IS NOT RUN OVER EVERY STORY.
 * A story that declares UI and has no sidecar yet is the NORMAL state before dev
 * starts — that is what "not ready for dev" means. A CI job that failed on it would
 * fail the story-sync PR itself, on the day the story arrives, forever. So the gate
 * runs against the stories a PR names: a PR is the moment work begins, which is the
 * moment "ready for dev" is a real question. `pr` supplies those IDs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ASSUMPTIONS, all confined to the three parsers below
 *   1. Story IDs look like ST-<digits>.
 *   2. Stories are docs/stories/<ID>.md; sidecars are docs/story-meta/<ID>.yaml.
 *   3. A story declares UI with `- ui: yes` inside `## Contract impact`
 *      (story_lint.mjs is what guarantees the section exists at all).
 *   4. A sidecar is ready when it carries a figma URL with a node-id and
 *      `status: final`. Read by regex, not a YAML parser — zero dependencies,
 *      and the shape is fixed by templates/story-meta.schema.yaml.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const STORIES = join('docs', 'stories')
const META = join('docs', 'story-meta')
const ID = /\bST-\d+\b/g

function fail(msg, code = 1) {
  console.error(`[story-gate] ${msg}`)
  process.exit(code)
}

// ── parsers (the whole assumption surface) ──────────────────────────────

function declaresUi(storyText) {
  const at = storyText.match(/^##\s+Contract impact\s*$/im)
  if (!at) return false
  const after = storyText.slice(storyText.indexOf(at[0]) + at[0].length)
  const next = after.search(/^##\s+/m)
  const block = next === -1 ? after : after.slice(0, next)
  return /^-\s*ui:\s*yes\s*$/im.test(block)
}

function sidecarVerdict(text) {
  const figma = text.match(/^\s*figma:\s*(\S+)/im)?.[1]
  const status = text.match(/^\s*status:\s*(\S+)/im)?.[1]?.toLowerCase()
  if (!figma) return 'has no figma: link'
  if (!/node-id=/.test(figma)) return 'figma link has no node-id — link the frame, not the file'
  if (status !== 'final') return `design status is ${status ?? 'unset'}, not final`
  return null
}

// ── commands ────────────────────────────────────────────────────────────

function cmdPr() {
  // Read from the environment rather than argv: a PR title is untrusted text and
  // has no business on a command line.
  const haystack = `${process.env.PR_TITLE ?? ''}\n${process.env.PR_BODY ?? ''}`
  const ids = [...new Set(haystack.match(ID) ?? [])]
  if (ids.length === 0) {
    fail(
      'this PR names no story. Put a story ID (ST-123) in the title or the body — it is how\n'
      + '  a change is traced back to what asked for it, and QA finds it the same way.'
    )
  }
  console.log(ids.join(' '))
  return 0
}

function cmdReady(ids) {
  if (ids.length === 0) fail('ready needs at least one story ID', 2)
  const problems = []
  for (const id of ids) {
    const story = join(STORIES, `${id}.md`)
    if (!existsSync(story)) {
      // Not a failure: a PR may name a story this repo does not receive.
      console.log(`[story-gate] ${id}: no story file here — skipped`)
      continue
    }
    if (!declaresUi(readFileSync(story, 'utf8'))) {
      console.log(`[story-gate] ${id}: not a UI story — no design sidecar needed`)
      continue
    }
    const sidecar = join(META, `${id}.yaml`)
    if (!existsSync(sidecar)) {
      problems.push(`${id} declares ui: yes but has no ${sidecar}`)
      continue
    }
    const verdict = sidecarVerdict(readFileSync(sidecar, 'utf8'))
    if (verdict) problems.push(`${id}: ${sidecar} ${verdict}`)
    else console.log(`[story-gate] ${id}: ready for dev`)
  }
  if (problems.length === 0) return 0
  console.error('[story-gate] not ready for dev:\n')
  for (const p of problems) console.error(`  ${p}`)
  console.error(`
Add the sidecar — it is yours, and the story file stays untouched:

  ${META}/<ID>.yaml
    story: <ID>
    design:
      figma: https://www.figma.com/design/FILE?node-id=123-456
      status: final
`)
  process.exit(1)
}

// Warns, never fails. An orphan usually means the story was deleted upstream and
// the sidecar outlived it — worth seeing, never worth blocking a merge over.
function cmdOrphans() {
  if (!existsSync(META)) return 0
  const orphans = readdirSync(META)
    .filter(f => f.endsWith('.yaml'))
    .map(f => f.replace(/\.yaml$/, ''))
    .filter(id => !existsSync(join(STORIES, `${id}.md`)))
  if (orphans.length === 0) {
    console.log('[story-gate] no orphaned sidecars')
    return 0
  }
  for (const id of orphans) {
    console.log(`::warning::${META}/${id}.yaml has no story — ${id} was probably deleted upstream. Delete the sidecar or restore the story.`)
  }
  console.log(`[story-gate] ${orphans.length} orphaned sidecar(s) — warning only`)
  return 0
}

const [command, ...rest] = process.argv.slice(2)
if (command === 'pr') process.exit(cmdPr())
if (command === 'ready') process.exit(cmdReady(rest))
if (command === 'orphans') process.exit(cmdOrphans())
console.log('Usage: story_gate.mjs pr | ready <ID>... | orphans')
process.exit(2)
