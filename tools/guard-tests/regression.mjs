#!/usr/bin/env node
// Single-agent (non-team) regression suite.
//
// Everything here describes a repo that existed BEFORE agent-teams support and
// never opts in. All of it must behave exactly as it did before.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const GUARDS = process.cwd()
const BOX = join(GUARDS, 'regbox')
let pass = 0
let fail = 0

function reset(files = {}) {
  rmSync(BOX, { recursive: true, force: true })
  mkdirSync(join(BOX, 'src'), { recursive: true })
  mkdirSync(join(BOX, '.claude'), { recursive: true })
  writeFileSync(join(BOX, 'src', 'app.ts'), 'export const a = 1\n')
  for (const [name, body] of Object.entries(files)) {
    const full = join(BOX, name)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, body)
  }
}

function run(guard, payload) {
  try {
    execFileSync('node', [join(GUARDS, guard)], { input: JSON.stringify(payload), cwd: BOX, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    return { code: 0, stderr: '' }
  } catch (err) {
    return { code: err.status, stderr: err.stderr ?? '' }
  }
}

function check(name, actual, expected, note = '') {
  if (actual === expected) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name} — expected ${expected}, got ${actual}${note ? `\n        ${note.split('\n')[0]}` : ''}`) }
}

const big = { old_string: 'a\n'.repeat(30), new_string: 'b\n'.repeat(30) }
const small = { old_string: 'a\n'.repeat(3), new_string: 'b\n'.repeat(3) }
const edit = (file, body = big) => ({ tool_name: 'Edit', tool_input: { file_path: join(BOX, file), ...body } })
const write = (file, content) => ({ tool_name: 'Write', tool_input: { file_path: join(BOX, file), content } })

console.log('\n--- A repo that never heard of agent teams: spec gate ---')
reset()
check('no PLAN.md → non-trivial edit blocked', run('spec-gate-guard.mjs', edit('src/app.ts')).code, 2)
check('no PLAN.md → ≤20-line edit allowed', run('spec-gate-guard.mjs', edit('src/app.ts', small)).code, 0)
check('no PLAN.md → *.md allowed', run('spec-gate-guard.mjs', edit('docs/x.md')).code, 0)
check('no PLAN.md → tests/ allowed', run('spec-gate-guard.mjs', edit('tests/app.test.ts')).code, 0)
check('no PLAN.md → tsconfig.json allowed', run('spec-gate-guard.mjs', edit('tsconfig.json')).code, 0)
check('no PLAN.md → new-file Write of 30 lines blocked', run('spec-gate-guard.mjs', write('src/new.ts', 'x\n'.repeat(30))).code, 2)
check('no PLAN.md → new-file Write of 3 lines allowed', run('spec-gate-guard.mjs', write('src/new.ts', 'x\n'.repeat(3))).code, 0)

reset({ 'PLAN.md': '# Plan: feature\n\nStatus: draft\n\n## Spec\n\nstuff\n' })
check('draft PLAN.md → non-trivial edit blocked', run('spec-gate-guard.mjs', edit('src/app.ts')).code, 2)
reset({ 'PLAN.md': '# Plan: feature\n\nStatus: approved\n\n## Spec\n\nstuff\n\n## Tasks\n\n| # | Task | Status |\n' })
check('approved PLAN.md → non-trivial edit allowed', run('spec-gate-guard.mjs', edit('src/app.ts')).code, 0)
check('approved PLAN.md → huge rewrite allowed', run('spec-gate-guard.mjs', write('src/app.ts', 'y\n'.repeat(500))).code, 0)

console.log('\n--- The dangerous false positive: "Owns:" in a legacy spec body ---')
reset({ 'PLAN.md': '# Plan: data model\n\nStatus: approved\n\n## Spec\n\nOwns: the user record is owned by the accounts service\n' })
const r1 = run('spec-gate-guard.mjs', edit('src/app.ts'))
check('Owns: inside the spec body does NOT arm scoped mode', r1.code, 0, r1.stderr)
reset({ 'PLAN.md': '# Plan: x\n\nStatus: draft\n\n## Notes\n\nOwns: something\n' })
check('...and legacy blocking still applies (draft + big edit)', run('spec-gate-guard.mjs', edit('src/app.ts')).code, 2)

console.log('\n--- Task tools in an ordinary session (no .claude/task-plans/) ---')
reset({ 'PLAN.md': '# Plan\n\nStatus: approved\n' })
const created = { hook_event_name: 'TaskCreated', task_id: '1', task_subject: 'Refactor the parser', task_description: 'no plan reference at all' }
const completed = { hook_event_name: 'TaskCompleted', task_id: '1', task_subject: 'Refactor the parser', task_description: 'no plan reference at all' }
check('TaskCreate with no plan reference → allowed', run('task-plan-gate.mjs', created).code, 0)
check('TaskCompleted with no plan reference → allowed', run('task-verify-gate.mjs', completed).code, 0)
check('TaskCreate is allowed even with a PLAN.md present', run('task-plan-gate.mjs', { ...created, task_description: 'Plan: PLAN.md' }).code, 0)

console.log('\n--- A team-enabled repo before any team runs ---')
// AGENT_TEAMS=yes scaffolds the guards but must NOT create .claude/task-plans/
reset({ 'PLAN.md': '# Plan\n\nStatus: approved\n', '.claude/rules/agent-teams.md': '# Agent Teams\n' })
check('gates inert: TaskCreate allowed (no task-plans dir)', run('task-plan-gate.mjs', created).code, 0)
check('gates inert: TaskCompleted allowed', run('task-verify-gate.mjs', completed).code, 0)
check('spec gate still legacy: approved PLAN.md allows', run('spec-gate-guard.mjs', edit('src/app.ts')).code, 0)
console.log(`  ${existsSync(join(BOX, '.claude', 'task-plans')) ? 'FAIL' : 'PASS'}  scaffold does not create .claude/task-plans/`)
existsSync(join(BOX, '.claude', 'task-plans')) ? fail++ : pass++

console.log('\n--- bash-guard: untouched by this release ---')
reset()
for (const [cmd, expected, label] of [
  ['git commit --no-verify -m x', 2, 'blocks --no-verify'],
  ['git commit -n -m x', 2, 'blocks -n'],
  ['git push --force origin main', 2, 'blocks force-push to main'],
  ['git push --force-with-lease origin feature/x', 0, 'allows --force-with-lease on a branch'],
  ['git commit -m "fix: handle -n in parser"', 0, 'allows a message merely containing -n']
]) {
  const res = run('bash-guard.mjs', { tool_name: 'Bash', tool_input: { command: cmd } })
  check(label, res.code, expected, res.stderr)
}

rmSync(BOX, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
