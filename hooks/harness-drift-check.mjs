#!/usr/bin/env node
/**
 * harness-drift-check.mjs — a SessionStart notice: does the repo in front of us
 * have harness changes it has never applied?
 *
 * This hook ships with the PLUGIN, not with the harness, and that is the whole
 * point. Anything templated into a repo only reaches repos that have already run
 * patch mode — which is the problem it would be trying to solve. Living here, it
 * reaches every repo that ever installed the harness, retroactively, with nothing
 * to install.
 *
 * It reports UNAPPLIED PATCH BLOCKS, never "versions behind". Of the releases
 * shipped so far, roughly three in four carry no patch block at all: skills,
 * references and agents are read live from the plugin, so a repo on a stale stamp
 * already has them. Announcing those would light a permanent warning that is
 * wrong 75% of the time, and a warning people learn to skip is worse than none —
 * the same reason a gate only goes where its premise holds.
 *
 * It never blocks, never writes, and never asks. A session-start question whose
 * answer is usually "not now" is a tax on every session in the repo until someone
 * clears it (v1.98.3). Applying the blocks unasked would be worse still: a block
 * can apply cleanly and still produce a broken guard, and a hook that fails to
 * parse exits non-zero, which the host treats as non-blocking — so the damage
 * would be silent. The notice hands over a command; a human picks the moment.
 *
 * Claude Code only, deliberately. Cursor's plugin manifest declares skills and
 * agents; there is no plugin-level hook to attach this to, so Cursor-only repos
 * hear about a release one patch run late. That is a host gap, not a fork — there
 * is no second copy of this file anywhere, and the `.claude/guards/*.mjs` rule
 * about never printing a host envelope directly is about guards templated into
 * repos, which run on both hosts. This one has exactly one host.
 *
 * Node ≥20 stdlib only. Always exits 0.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TAG = '[bigin-skills]'
const MAX_NAMED_TARGETS = 4

// Where the session is. CLAUDE_PROJECT_DIR is the documented answer; the stdin
// payload's `cwd` is the fallback, read defensively because a hook with no pipe
// on fd 0 throws rather than returning empty.
function projectDir() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR
  try {
    return JSON.parse(readFileSync(0, 'utf8'))?.cwd ?? process.cwd()
  } catch {
    return process.cwd()
  }
}

function parseVersion(raw) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(raw).trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

// Numerically, per component. 1.100.0 is newer than 1.99.0, and a string compare
// says the opposite — which would hide every block in between.
function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  return 0
}

function say(text) {
  console.log(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text }
  }))
}

// Every patch block in (installed, current], with the repo-side file each one
// targets. `mode: create-if-missing` blocks count too — they are a file the repo
// does not have yet.
function unappliedBlocks(changelog, installed, current) {
  const headings = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\][^\n]*$/gm)]
  let count = 0
  const targets = []
  for (const [i, h] of headings.entries()) {
    const version = parseVersion(h[1])
    if (!version) continue
    if (!(cmp(version, installed) > 0 && cmp(version, current) <= 0)) continue
    const body = changelog.slice(h.index, headings[i + 1]?.index ?? changelog.length)
    for (const block of body.matchAll(/```patch\ntarget: ([^\n]+)/g)) {
      count++
      const target = block[1].trim()
      if (!targets.includes(target)) targets.push(target)
    }
  }
  return { count, targets }
}

// A hook command that resolves relative to the session's current directory, which
// moves whenever the agent works inside a subdirectory. From there node cannot find
// the guard, exits 1 — non-blocking — and the gate allows everything it was
// installed to stop, announcing it only as a yellow line naming a Node internal.
// Repos scaffolded before 1.101.1 all carry this. Checked on its own, not behind the
// version comparison: a repo that never runs patch mode, or whose anchors missed,
// still needs to hear about it, and this reads the state rather than inferring it.
function relativeGuardCommands(dir) {
  const settings = join(dir, '.claude', 'settings.json')
  if (!existsSync(settings)) return 0
  try {
    return (readFileSync(settings, 'utf8').match(/"command":\s*"node \.claude\/guards\//g) ?? []).length
  } catch {
    return 0
  }
}

function main() {
  const root = process.env.CLAUDE_PLUGIN_ROOT
  if (!root) return // not running as a plugin hook; nothing to compare against

  const dir = projectDir()
  const stampPath = join(dir, '.claude', 'harness-version')
  if (!existsSync(stampPath)) return // no harness here, so there is no drift

  const relative = relativeGuardCommands(dir)
  if (relative > 0) {
    say(`${TAG} ${relative} hook command${relative === 1 ? '' : 's'} in .claude/settings.json `
      + 'resolve relative to the working directory, so every gate silently stops gating '
      + 'whenever a session works in a subdirectory — node cannot load the guard, exits 1, '
      + 'and 1 is non-blocking. Fix: give each one an absolute path, '
      + 'node "${CLAUDE_PROJECT_DIR}/.claude/guards/<name>.mjs". '
      + 'Run bigin-harness-setup in patch mode to do it, or edit the file directly.')
    return // the louder problem; do not bury it under a version line
  }

  const manifestPath = join(root, '.claude-plugin', 'plugin.json')
  if (!existsSync(manifestPath)) return

  const current = parseVersion(JSON.parse(readFileSync(manifestPath, 'utf8')).version)
  if (!current) return

  const raw = readFileSync(stampPath, 'utf8').trim()
  const installed = parseVersion(raw)
  if (!installed) {
    // Worth one line rather than silence: patch mode cannot pick a starting point
    // from this either, and it will stop and ask.
    say(`${TAG} .claude/harness-version reads "${raw}", which is not a version. `
      + 'Patch mode cannot tell what to apply from that — set it to the version this '
      + 'harness was last set up with, or re-run bigin-harness-setup.')
    return
  }

  if (cmp(installed, current) >= 0) return // current, or ahead of a downgraded plugin

  const changelogPath = join(root, 'CHANGELOG.md')
  if (!existsSync(changelogPath)) return
  const { count, targets } = unappliedBlocks(readFileSync(changelogPath, 'utf8'), installed, current)

  // The common case by a wide margin: releases that changed only plugin-side
  // content, which this repo already has. The stamp is stale; the repo is not.
  if (count === 0) return

  const named = targets.slice(0, MAX_NAMED_TARGETS).join(', ')
  const rest = targets.length > MAX_NAMED_TARGETS ? `, +${targets.length - MAX_NAMED_TARGETS} more` : ''
  say(
    `${TAG} Harness at ${raw}, plugin at ${current.join('.')} — `
    + `${count} unapplied patch block${count === 1 ? '' : 's'} touching ${named}${rest}. `
    + 'Run bigin-harness-setup in patch mode to apply them. Everything else in those '
    + 'releases is plugin-side and already in effect. Mention this only if asked — it is '
    + 'a status line, not a task.'
  )
}

try {
  main()
} catch {
  // A SessionStart hook cannot block and must never hold up a session. If anything
  // here is unreadable, the session is better off with no notice than with a crash.
}
process.exit(0)
