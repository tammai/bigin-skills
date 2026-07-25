#!/usr/bin/env node
// Load-bearing-gate test matrix for the team-aware guards.
// Run: node test.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const GUARDS = process.cwd()
const SANDBOX = join(GUARDS, 'sandbox')

let pass = 0
let fail = 0

function reset({ rootPlan = null, taskPlans = null } = {}) {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(join(SANDBOX, 'server', 'api'), { recursive: true })
  mkdirSync(join(SANDBOX, 'app'), { recursive: true })
  writeFileSync(join(SANDBOX, 'server', 'api', 'x.ts'), 'export const x = 1\n')
  writeFileSync(join(SANDBOX, 'app', 'z.ts'), 'export const z = 1\n')
  if (rootPlan !== null) writeFileSync(join(SANDBOX, 'PLAN.md'), rootPlan)
  if (taskPlans) {
    mkdirSync(join(SANDBOX, '.claude', 'task-plans'), { recursive: true })
    for (const [name, body] of Object.entries(taskPlans)) {
      writeFileSync(join(SANDBOX, '.claude', 'task-plans', name), body)
    }
  }
}

// Returns {code, stderr}
function run(guard, payload) {
  try {
    const stdout = execFileSync('node', [join(GUARDS, guard)], {
      input: JSON.stringify(payload),
      cwd: SANDBOX,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return { code: 0, stderr: '', stdout }
  } catch (err) {
    return { code: err.status, stderr: err.stderr ?? '', stdout: err.stdout ?? '' }
  }
}

function check(name, actual, expected, extra = '') {
  if (actual === expected) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    fail++
    console.log(`  FAIL  ${name} — expected exit ${expected}, got ${actual}${extra ? `\n        ${extra.split('\n')[0]}` : ''}`)
  }
}

const bigEdit = { old_string: 'a\n'.repeat(30), new_string: 'b\n'.repeat(30) }
const smallEdit = { old_string: 'a\n'.repeat(3), new_string: 'b\n'.repeat(3) }
const edit = (file, body = bigEdit, actor = null) => ({
  tool_name: 'Edit',
  tool_input: { file_path: join(SANDBOX, file), ...body },
  ...(actor ? { agent_type: actor } : {})
})

console.log('\n=== spec-gate-guard: LEGACY mode (must be unchanged) ===')
reset({ rootPlan: '# Plan\n\nStatus: draft\n' })
check('no approval + big edit blocks', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 2)
check('no approval + small edit allowed (≤20 lines)', run('spec-gate-guard.mjs', edit('server/api/x.ts', smallEdit)).code, 0)
check('trivial path (.md) allowed', run('spec-gate-guard.mjs', edit('README.md')).code, 0)
check('trivial path (tests/) allowed', run('spec-gate-guard.mjs', edit('tests/a.ts')).code, 0)
reset({ rootPlan: '# Plan\n\nStatus: approved\n' })
check('approved + big edit allowed', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 0)
reset({ rootPlan: null })
check('no PLAN.md at all + big edit blocks', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 2)
check('no file_path exits 0', run('spec-gate-guard.mjs', { tool_name: 'Edit', tool_input: {} }).code, 0)

console.log('\n=== spec-gate-guard: SCOPED mode ===')
const approved = (owns, extra = '') => `# Plan\n\nStatus: approved\nOwns: ${owns}\n${extra}`
reset({ taskPlans: { 'api.md': approved('server/api/**'), 'ui.md': approved('app/**') } })
check('approved owner allows', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 0)
const unowned = run('spec-gate-guard.mjs', edit('server/repo/y.ts'))
check('unowned path blocks (big edit)', unowned.code, 2, unowned.stderr)
check('unowned path blocks even for a SMALL edit', run('spec-gate-guard.mjs', edit('server/repo/y.ts', smallEdit)).code, 2)
check('message names the acting teammate', /alpha-2/.test(run('spec-gate-guard.mjs', edit('server/repo/y.ts', bigEdit, 'alpha-2')).stderr), true)
check('message lists current ownership', /api\.md owns: server\/api/.test(unowned.stderr), true)

reset({ taskPlans: { 'api.md': `# Plan\n\nStatus: draft\nOwns: server/api/**\n` } })
check('unapproved owner blocks', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 2)

reset({ taskPlans: { 'a.md': approved('server/api/**'), 'b.md': approved('server/api/**') } })
const collide = run('spec-gate-guard.mjs', edit('server/api/x.ts'))
check('equal-specificity collision blocks', collide.code, 2, collide.stderr)
check('collision message names both plans', /a\.md and .*b\.md/.test(collide.stderr), true)

reset({ taskPlans: { 'specific.md': approved('server/api/x.ts'), 'catchall.md': approved('**') } })
check('specific glob wins over ** catch-all', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 0)
reset({ taskPlans: { 'catchall.md': approved('**') } })
check('** alone still owns a path', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 0)

reset({ taskPlans: { 'broken.md': '# Plan\n\nStatus: approved\nOwns:  \n' } })
check('Owns: with no globs fails CLOSED', run('spec-gate-guard.mjs', edit('server/api/x.ts')).code, 2)

reset({ taskPlans: { 'api.md': approved('server/api/**') } })
check('path outside the repo blocks', run('spec-gate-guard.mjs', { tool_name: 'Edit', tool_input: { file_path: '/etc/hosts', ...bigEdit } }).code, 2)
check('trivial .md path still allowed in scoped mode', run('spec-gate-guard.mjs', edit('notes.md')).code, 0)
reset({ rootPlan: approved('**'), taskPlans: { 'api.md': approved('server/api/**') } })
check('root PLAN.md with Owns: joins the registry as catch-all', run('spec-gate-guard.mjs', edit('app/z.ts')).code, 0)

console.log('\n=== task-plan-gate (TaskCreated) ===')
const created = (subject, description) => ({ hook_event_name: 'TaskCreated', task_id: '1', task_subject: subject, task_description: description, teammate_name: 'alpha' })
reset({ rootPlan: '# Plan\n\nStatus: approved\n' }) // no .claude/task-plans/
check('no task-plans dir → no-op (ordinary session)', run('task-plan-gate.mjs', created('anything', 'no plan here')).code, 0)
reset({ taskPlans: { 'api.md': approved('server/api/**') } })
check('missing Plan: ref blocks', run('task-plan-gate.mjs', created('Add pagination', 'do the thing')).code, 2)
check('[coordination] escape allowed', run('task-plan-gate.mjs', created('Review', '[coordination] review both slices')).code, 0)
check('valid Plan: ref allowed', run('task-plan-gate.mjs', created('Add pagination', 'Plan: .claude/task-plans/api.md')).code, 0)
check('nonexistent plan path blocks', run('task-plan-gate.mjs', created('x', 'Plan: .claude/task-plans/nope.md')).code, 2)
reset({ taskPlans: { 'draft.md': '# Plan\n\nStatus: draft\nOwns: server/api/**\n' } })
check('unapproved plan blocks', run('task-plan-gate.mjs', created('x', 'Plan: .claude/task-plans/draft.md')).code, 2)
reset({ taskPlans: { 'noowns.md': '# Plan\n\nStatus: approved\nOwns:\n' } })
check('plan with empty Owns: blocks', run('task-plan-gate.mjs', created('x', 'Plan: .claude/task-plans/noowns.md')).code, 2)
reset({ taskPlans: { 'a.md': approved('server/api/**'), 'b.md': approved('server/api/**') } })
const dup = run('task-plan-gate.mjs', created('x', 'Plan: .claude/task-plans/a.md'))
check('duplicate glob across plans blocks', dup.code, 2, dup.stderr)
check('unparseable stdin → no-op', (() => {
  try {
    execFileSync('node', [join(GUARDS, 'task-plan-gate.mjs')], { input: 'not json', cwd: SANDBOX, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    return 0
  } catch (e) { return e.status }
})(), 0)

console.log('\n=== task-verify-gate (TaskCompleted) ===')
const completed = (description, subject = 'Add pagination') => ({ hook_event_name: 'TaskCompleted', task_id: '1', task_subject: subject, task_description: description, teammate_name: 'alpha' })
reset({ rootPlan: '# Plan\n\nStatus: approved\n' })
check('no task-plans dir → no-op', run('task-verify-gate.mjs', completed('anything')).code, 0)
reset({ taskPlans: { 'api.md': approved('server/api/**') } })
const unverified = run('task-verify-gate.mjs', completed('Plan: .claude/task-plans/api.md'))
check('no Verified: line blocks', unverified.code, 2, unverified.stderr)
check('block message includes a scoped git diff command', /git diff -- ':\(glob\)server\/api\/\*\*'/.test(unverified.stderr), true)
reset({ taskPlans: { 'api.md': approved('server/api/**', 'Verified: PASS 2026-07-25T09:12:00Z\n') } })
check('Verified: PASS allows', run('task-verify-gate.mjs', completed('Plan: .claude/task-plans/api.md')).code, 0)
reset({ taskPlans: { 'api.md': approved('server/api/**', 'Verified: FAIL\n') } })
check('Verified: FAIL blocks', run('task-verify-gate.mjs', completed('Plan: .claude/task-plans/api.md')).code, 2)
reset({ taskPlans: { 'other.md': approved('app/**') } })
check('plan file already deleted → fails OPEN (no deadlock)', run('task-verify-gate.mjs', completed('Plan: .claude/task-plans/gone.md')).code, 0)
check('[coordination] task allowed', run('task-verify-gate.mjs', completed('[coordination] synthesize')).code, 0)
check('no Plan: ref → no-op (creation gate owns that)', run('task-verify-gate.mjs', completed('just a task')).code, 0)

rmSync(SANDBOX, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
