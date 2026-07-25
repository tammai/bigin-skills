#!/usr/bin/env node
// Agent-teams platform probe — settles the facts our team-mode guards depend on.
//
// Claude Code's agent-teams contract has gaps the public docs don't close: the
// exact team-hook payload field names, whether a teammate gets its own
// session_id, whether any agent-identity field reaches a teammate's PreToolUse,
// and whether a teammate's member record carries a sessionId. Guessing wrong
// means a guard that silently never fires, so we measure instead.
//
// Node stdlib only. Never blocks a tool call or a turn: always exits 0.
//
// Modes:
//   node tools/team-probe.mjs              hook mode — appends one JSONL record
//   node tools/team-probe.mjs --settings   print the settings.json block to merge
//   node tools/team-probe.mjs --report     answer the open questions from the log
//   node tools/team-probe.mjs --reset      delete the log and start over
//
// Runbook: skills/agent-teams/references/platform-facts.md

import { appendFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// TEAM_PROBE_LOG pins the log to one absolute path, so the probe can run in a
// throwaway repo (keeping teammates away from real in-flight work) while
// --report still reads the same file from anywhere.
const LOG =
  process.env.TEAM_PROBE_LOG ||
  join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'team-probe.jsonl')

// Values safe to record verbatim. Every other CLAUDE_* var is recorded by NAME
// ONLY — the environment can hold API keys and we never want them in a log file
// that lands in a working tree.
//
// A hook process inherits the whole Claude process environment, not just the
// documented CLAUDE_PROJECT_DIR/CLAUDE_PLUGIN_ROOT/CLAUDE_SESSION_ID trio — so
// CLAUDE_CODE_SESSION_ID (this agent's own id) and CLAUDE_EFFORT (its effort
// level) are observable too. Both are load-bearing here: comparing them across
// agents is what settles "does a teammate get its own session_id" and "do
// teammates really inherit the lead's effort".
const SAFE_ENV = [
  'CLAUDE_SESSION_ID',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_HOST_SESSION_ID',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_PROJECT_DIR',
  'CLAUDE_PLUGIN_ROOT',
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  'CLAUDE_EFFORT',
  'CLAUDE_PID',
]

const EVENTS = [
  'SessionStart',
  'PreToolUse',
  'TeammateIdle',
  'TaskCreated',
  'TaskCompleted',
]

// Identity fields we're hunting for. Presence/absence per event is the finding.
//
// `effort` is load-bearing: it is the ONLY way to answer "do teammates inherit
// the lead's effort, or does a definition's effort: apply?" on the in-process
// backend, where every agent shares one session and therefore one CLAUDE_EFFORT
// environment variable. The payload value is per-invocation, so it can differ
// per agent even when the env cannot.
const IDENTITY_KEYS = [
  'session_id',
  'agent_id',
  'agent_type',
  'team_name',
  'teammate_name',
  'assignee',
  'owner',
  'task_id',
  'task_subject',
  'task_description',
  'effort',
  'model',
  'permission_mode',
]

function safeEnv() {
  const values = {}
  const namesOnly = []
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('CLAUDE')) continue
    if (SAFE_ENV.includes(key)) values[key] = value
    else namesOnly.push(key)
  }
  return { values, namesOnly: namesOnly.sort() }
}

function hookMode() {
  let payload = null
  let raw = ''
  try {
    raw = readFileSync(0, 'utf-8')
    payload = JSON.parse(raw)
  } catch {
    payload = { _unparseable: raw.slice(0, 500) }
  }

  const env = safeEnv()
  const record = {
    at: new Date().toISOString(),
    event: payload?.hook_event_name ?? null,
    tool: payload?.tool_name ?? null,
    payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload).sort() : [],
    identity: Object.fromEntries(
      IDENTITY_KEYS.filter((k) => payload?.[k] !== undefined).map((k) => [k, payload[k]])
    ),
    env: env.values,
    otherClaudeEnvNames: env.namesOnly,
  }

  // One pre-serialized line per append: the standard way to keep concurrent
  // writers from interleaving mid-record. Not a hard guarantee, but every
  // record here is far under PIPE_BUF and this is a probe, not a gate.
  appendFileSync(LOG, JSON.stringify(record) + '\n')
}

function settingsMode() {
  const cmd = 'node "$CLAUDE_PROJECT_DIR/tools/team-probe.mjs"'
  const block = {
    env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' },
    hooks: Object.fromEntries(
      EVENTS.map((event) => [
        event,
        [
          event === 'PreToolUse'
            ? { matcher: 'Write|Edit|MultiEdit', hooks: [{ type: 'command', command: cmd }] }
            : { hooks: [{ type: 'command', command: cmd }] },
        ],
      ])
    ),
  }
  console.log(JSON.stringify(block, null, 2))
  console.log('\n// Merge into .claude/settings.local.json, then start a NEW claude session.')
  console.log('// The team is created at session start — enabling the flag mid-session does nothing.')
}

function readTeamConfigs() {
  const dir = join(homedir(), '.claude', 'teams')
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name, 'config.json')
    if (!existsSync(path)) continue
    try {
      const cfg = JSON.parse(readFileSync(path, 'utf-8'))
      out.push({
        team: name,
        topLevelKeys: Object.keys(cfg).sort(),
        leadSessionId: cfg.leadSessionId ?? null,
        members: (cfg.members ?? []).map((m) => ({
          name: m.name,
          agentId: m.agentId,
          agentType: m.agentType ?? null,
          keys: Object.keys(m).sort(),
          sessionIdField: Object.keys(m).find((k) => /session/i.test(k)) ?? null,
        })),
      })
    } catch {
      out.push({ team: name, error: 'unreadable' })
    }
  }
  return out
}

function reportMode() {
  if (!existsSync(LOG)) {
    console.log(`No probe log at ${LOG}.`)
    console.log('If the probe session set TEAM_PROBE_LOG, pass the same value here:')
    console.log('  TEAM_PROBE_LOG=/tmp/team-probe.jsonl node tools/team-probe.mjs --report')
    console.log('Otherwise: run --settings, restart claude, drive a two-teammate session, then re-run --report.')
    return
  }

  const records = readFileSync(LOG, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    })
    .filter(Boolean)

  console.log(`# team-probe report\n\n${records.length} record(s) from ${LOG}\n`)

  // Q1/Q3: real payload shape per event.
  console.log('## Payload keys observed per event\n')
  const byEvent = new Map()
  for (const r of records) {
    const key = r.event ?? '(no hook_event_name)'
    if (!byEvent.has(key)) byEvent.set(key, { keys: new Set(), identity: new Set(), count: 0 })
    const slot = byEvent.get(key)
    slot.count++
    r.payloadKeys.forEach((k) => slot.keys.add(k))
    Object.keys(r.identity ?? {}).forEach((k) => slot.identity.add(k))
  }
  for (const [event, slot] of [...byEvent.entries()].sort()) {
    console.log(`- **${event}** (${slot.count}×)`)
    console.log(`  - all keys: ${[...slot.keys].sort().join(', ') || '(none)'}`)
    console.log(`  - identity fields present: ${[...slot.identity].sort().join(', ') || 'NONE'}`)
  }
  for (const event of EVENTS) {
    if (!byEvent.has(event)) console.log(`- **${event}**: never fired — not registered, or not reached in this run`)
  }

  // Q2: distinct session ids, from the payload and from the environment.
  console.log('\n## Session identity\n')
  const ids = new Map()
  const envIds = new Set()
  for (const r of records) {
    const envId = r.env?.CLAUDE_CODE_SESSION_ID ?? r.env?.CLAUDE_SESSION_ID ?? null
    if (envId) envIds.add(envId)
    const id = r.identity?.session_id ?? envId
    if (!id) continue
    if (!ids.has(id)) ids.set(id, new Set())
    ids.get(id).add(r.event ?? '?')
  }
  console.log(`Distinct session ids seen: **${ids.size}** (payload \`session_id\`, falling back to env)`)
  for (const [id, events] of ids) console.log(`- \`${id}\` → ${[...events].sort().join(', ')}`)
  console.log(`\nDistinct ids visible in the environment: **${envIds.size}**`)
  // Named agents seen at all, from any event — the real per-actor discriminator.
  const named = new Set()
  for (const r of records) {
    const name = r.identity?.teammate_name ?? r.identity?.agent_type
    if (name) named.add(name)
  }
  const sessionStarts = records.filter((r) => r.event === 'SessionStart').length

  // A run with no TeammateIdle/TaskCreated records and no `a<name>-<hash>` agent
  // ids almost certainly formed no team — Claude falls back to plain subagents,
  // and every team conclusion below would then be measuring the wrong thing.
  // Headless `claude -p` is one known case where this happens.
  const teamEvents = records.filter((r) => ['TeammateIdle', 'TaskCreated', 'TaskCompleted'].includes(r.event)).length
  const teammateIds = records.filter((r) => /^a.+-[0-9a-f]{16}$/.test(r.identity?.agent_id ?? '')).length
  if (teamEvents === 0 && teammateIds === 0) {
    console.log(
      '\n> **WARNING: no team appears to have formed in this log.** No TeammateIdle/TaskCreated/TaskCompleted\n' +
        '> records, and no `a<name>-<hash>` agent ids. Claude most likely used plain subagents instead of\n' +
        '> teammates, so nothing below tells you anything about team behavior. Known cause: headless\n' +
        '> `claude -p` does not form teams — drive an interactive session instead.\n'
    )
  }

  console.log(
    ids.size > 1
      ? '\n→ Teammates DO get their own session_id; it can discriminate actors.'
      : `\n→ Only ONE session id across ${records.length} records, but ${named.size} distinct agent name(s) appeared (${[...named].sort().join(', ') || 'none'}). Teammates SHARE the lead's session_id, so it is useless as an actor discriminator — and every tmpdir-keyed guard (injection flag, canary) is team-global.`
  )
  console.log(
    `\n\`SessionStart\` records: **${sessionStarts}** for ${named.size} teammate(s) + 1 lead.` +
      (sessionStarts <= 1
        ? ' Teammates do NOT fire SessionStart → no duplicated resume prompts, and no per-teammate canary re-seed.'
        : ' Teammates DO fire SessionStart → expect duplicated resume prompts and canary re-seeding.')
  )

  // Which fields can actually identify the acting agent, per event.
  console.log('\n## Actor identification per event\n')
  const actorKeys = ['teammate_name', 'agent_type', 'agent_id']
  for (const [event, slot] of [...byEvent.entries()].sort()) {
    const available = actorKeys.filter((k) => slot.identity.has(k))
    console.log(`- **${event}**: ${available.length ? available.join(', ') : 'NO actor field — cannot attribute'}`)
  }
  const samples = records
    .filter((r) => r.identity?.agent_type || r.identity?.agent_id)
    .map((r) => `${r.event}: agent_type=${JSON.stringify(r.identity.agent_type)} agent_id=${JSON.stringify(r.identity.agent_id)}`)
  if (samples.length) {
    console.log('\nSamples (check whether these are teammate NAMES or definition names):')
    for (const s of [...new Set(samples)]) console.log(`  ${s}`)
  }

  // Effort, per agent, from the PAYLOAD — which works even when every agent
  // shares one session (and therefore one CLAUDE_EFFORT env var).
  console.log('\n## Effort per agent (payload `effort`)\n')
  // The payload's `effort` is an OBJECT — {level: "high"} — not a string.
  // Comparing the raw values would compare object identities and report every
  // record as a different effort.
  const effortOf = (value) => (value && typeof value === 'object' ? (value.level ?? JSON.stringify(value)) : value)
  const perAgent = new Map()
  for (const r of records) {
    const effort = effortOf(r.identity?.effort)
    if (!effort) continue
    const name = r.identity?.teammate_name ?? r.identity?.agent_type ?? '(lead / main thread)'
    if (!perAgent.has(name)) perAgent.set(name, new Set())
    perAgent.get(name).add(effort)
  }
  if (perAgent.size === 0) {
    console.log('No payload `effort` field seen — only `PreToolUse` carries it, so drive at least one teammate edit.')
  } else {
    for (const [name, values] of [...perAgent.entries()].sort()) {
      console.log(`- **${name}**: ${[...values].join(', ')}`)
    }
    const distinct = new Set([...perAgent.values()].flatMap((v) => [...v]))
    console.log(
      distinct.size > 1
        ? "\n→ Agents report DIFFERENT efforts — a definition's `effort:` DOES reach a teammate. Our docs claiming it's inert are wrong; fix them."
        : "\n→ Every agent reports the same effort. If the spawned definitions declared an effort DIFFERENT from the lead's, this confirms teammates inherit the lead's effort and a definition's `effort:` is inert. If they declared the same one, the run wasn't discriminating — re-run with a definition whose effort differs from the lead's."
    )
  }
  const envEfforts = new Set(records.map((r) => r.env?.CLAUDE_EFFORT).filter(Boolean))
  if (envEfforts.size > 0) console.log(`\n(env CLAUDE_EFFORT, shared per process: ${[...envEfforts].join(', ')})`)

  // Q6: was the gate actually set?
  const flagged = records.filter((r) => r.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1').length
  console.log(`\n## Env gate\n\nRecords with CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1: **${flagged}/${records.length}**`)
  console.log('Other CLAUDE_* names seen (values withheld):')
  const otherNames = new Set(records.flatMap((r) => r.otherClaudeEnvNames ?? []))
  console.log(`  ${[...otherNames].sort().join(', ') || '(none)'}`)

  // Q4: member records.
  console.log('\n## ~/.claude/teams/*/config.json\n')
  const teams = readTeamConfigs()
  if (teams.length === 0) console.log('No team dirs found.')
  for (const t of teams) {
    if (t.error) {
      console.log(`- ${t.team}: ${t.error}`)
      continue
    }
    console.log(`- **${t.team}** — top-level: ${t.topLevelKeys.join(', ')}`)
    for (const m of t.members) {
      console.log(
        `  - ${m.name} (${m.agentType ?? 'no agentType'}) keys: ${m.keys.join(', ')}` +
          (m.sessionIdField ? ` → session field: \`${m.sessionIdField}\`` : ' → NO session field')
      )
    }
  }
  console.log(
    '\n→ If a teammate member record carries a session field, a guard can map session_id → teammate name (name-keyed ownership).' +
      '\n→ If not, ownership must be claim-based: first writer of a path records its session_id.'
  )
}

function main() {
  const arg = process.argv[2]
  if (arg === '--settings') return settingsMode()
  if (arg === '--report') return reportMode()
  if (arg === '--reset') {
    if (existsSync(LOG)) rmSync(LOG)
    console.log(`Removed ${LOG}`)
    return
  }
  return hookMode()
}

try {
  main()
} catch (err) {
  // A probe must never break the session it's measuring.
  if (process.argv[2]) console.error(`team-probe: ${err.message}`)
}
process.exit(0)
