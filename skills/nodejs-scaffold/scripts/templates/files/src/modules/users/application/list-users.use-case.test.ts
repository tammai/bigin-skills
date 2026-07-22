import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '../domain/user.entity.js'

vi.mock('../infrastructure/users.repository.js', () => ({
  usersRepository: { list: vi.fn() }
}))

const { usersRepository } = await import('../infrastructure/users.repository.js')
const { listUsers } = await import('./list-users.use-case.js')

function user(id: string, name: string, createdAt: string): User {
  return {
    id,
    email: `${id}@example.com`,
    name,
    passwordHash: 'x',
    roles: ['user'],
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    version: 1,
    deletedAt: null
  }
}

describe('listUsers', () => {
  beforeEach(() => {
    vi.mocked(usersRepository.list).mockReset()
  })

  it('requests one extra row to detect hasMore, and trims it from the page', async () => {
    vi.mocked(usersRepository.list).mockResolvedValue([user('1', 'A', '2024-01-03'), user('2', 'B', '2024-01-02')])

    const result = await listUsers({ limit: 1 })

    expect(usersRepository.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }))
    expect(result.data).toHaveLength(1)
    expect(result.nextCursor).not.toBeNull()
  })

  it('returns a null cursor when there is no next page', async () => {
    vi.mocked(usersRepository.list).mockResolvedValue([user('1', 'A', '2024-01-01')])

    const result = await listUsers({ limit: 20 })

    expect(result.nextCursor).toBeNull()
  })

  it('rejects a sort column outside the allowlist', async () => {
    await expect(listUsers({ sort: 'password_hash' })).rejects.toMatchObject({ statusCode: 400 })
    expect(usersRepository.list).not.toHaveBeenCalled()
  })
})
