import { describe, it, expect, vi } from 'vitest'

vi.mock('../infrastructure/users.repository.js', () => ({
  usersRepository: { findById: vi.fn() }
}))

const { usersRepository } = await import('../infrastructure/users.repository.js')
const { getUserById } = await import('./get-user.use-case.js')

describe('getUserById', () => {
  it('returns null when the repository finds nothing', async () => {
    vi.mocked(usersRepository.findById).mockResolvedValue(undefined)
    expect(await getUserById('missing')).toBeNull()
  })

  it('projects a found user to UserView', async () => {
    vi.mocked(usersRepository.findById).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      name: 'Ada',
      passwordHash: 'x',
      roles: ['user'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      version: 1,
      deletedAt: null
    })

    expect(await getUserById('u1')).toEqual({
      id: 'u1',
      email: 'a@example.com',
      name: 'Ada',
      createdAt: new Date('2024-01-01')
    })
  })
})
