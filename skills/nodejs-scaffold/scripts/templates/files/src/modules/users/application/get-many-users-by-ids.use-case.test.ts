import { describe, it, expect, vi } from 'vitest'

vi.mock('../infrastructure/users.repository.js', () => ({ usersRepository: { findManyByIds: vi.fn() } }))

const { usersRepository } = await import('../infrastructure/users.repository.js')
const { getManyUsersByIds } = await import('./get-many-users-by-ids.use-case.js')

describe('getManyUsersByIds', () => {
  it('returns an empty map without querying for an empty input', async () => {
    const result = await getManyUsersByIds([])
    expect(result.size).toBe(0)
    expect(usersRepository.findManyByIds).not.toHaveBeenCalled()
  })

  it('dedupes ids and drops empty strings before querying', async () => {
    vi.mocked(usersRepository.findManyByIds).mockResolvedValue([])
    await getManyUsersByIds(['u1', 'u1', '', 'u2'])
    expect(usersRepository.findManyByIds).toHaveBeenCalledWith(['u1', 'u2'])
  })

  it('narrows results to the public view, keyed by id', async () => {
    vi.mocked(usersRepository.findManyByIds).mockResolvedValue([
      {
        id: 'u1',
        name: 'Ada',
        email: 'a@example.com',
        passwordHash: 'x',
        roles: ['user'],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        deletedAt: null
      }
    ])

    const result = await getManyUsersByIds(['u1'])

    expect(result.get('u1')).toEqual({ id: 'u1', name: 'Ada' })
  })
})
