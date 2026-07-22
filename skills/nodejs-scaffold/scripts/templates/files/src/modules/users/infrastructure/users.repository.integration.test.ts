import { describe, it, expect, afterAll } from 'vitest'
import { queryClient } from '../../../shared/db/client.js'
import { usersRepository } from './users.repository.js'

// Real Postgres via testcontainers (vitest.integration.config.ts's
// globalSetup) — ADR §11: infrastructure/ gets integration tests against a
// real DB, never mocks.
describe('usersRepository (integration)', () => {
  afterAll(async () => {
    await queryClient.end()
  })

  function uniqueEmail(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  }

  it('creates a user and finds it by id and by email', async () => {
    const email = uniqueEmail('create')
    const created = await usersRepository.create({ email, name: 'Ada', passwordHash: 'hash', roles: ['user'] })

    expect(await usersRepository.findById(created.id)).toMatchObject({ id: created.id, name: 'Ada' })
    expect(await usersRepository.findByEmail(email)).toMatchObject({ id: created.id })
  })

  it('findManyByIds returns only the requested, existing rows (the posts-module batch-get path)', async () => {
    const a = await usersRepository.create({ email: uniqueEmail('many-a'), name: 'A', passwordHash: 'h', roles: ['user'] })
    const b = await usersRepository.create({ email: uniqueEmail('many-b'), name: 'B', passwordHash: 'h', roles: ['user'] })

    const found = await usersRepository.findManyByIds([a.id, b.id, '00000000-0000-7000-8000-000000000000'])

    expect(found.map((u) => u.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('list() excludes soft-deleted rows through the raw-SQL path', async () => {
    const email = uniqueEmail('softdel')
    const user = await usersRepository.create({ email, name: 'ToDelete', passwordHash: 'h', roles: ['user'] })
    const sorts = [{ column: 'created_at' as const, direction: 'desc' as const }]

    const before = await usersRepository.list({ limit: 1000, sorts, cursorValues: null })
    expect(before.some((u) => u.id === user.id)).toBe(true)

    // Soft-delete directly — exercises the SAME `list()` raw-SQL WHERE the
    // NOT_DELETED_RAW fix targets, regardless of which use-case would trigger it.
    await queryClient`UPDATE users.users SET deleted_at = now() WHERE id = ${user.id}`

    const after = await usersRepository.list({ limit: 1000, sorts, cursorValues: null })
    expect(after.some((u) => u.id === user.id)).toBe(false)
    expect(await usersRepository.findById(user.id)).toBeUndefined()
  })
})
