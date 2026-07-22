import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../infrastructure/users.repository.js', () => ({
  usersRepository: { findByEmail: vi.fn(), create: vi.fn() }
}))
vi.mock('../../../shared/auth/password.js', () => ({
  hashPassword: vi.fn()
}))

const { usersRepository } = await import('../infrastructure/users.repository.js')
const { hashPassword } = await import('../../../shared/auth/password.js')
const { createUser } = await import('./create-user.use-case.js')

describe('createUser', () => {
  beforeEach(() => {
    vi.mocked(usersRepository.findByEmail).mockReset()
    vi.mocked(usersRepository.create).mockReset()
    vi.mocked(hashPassword).mockReset()
  })

  it('throws conflict when the email is already registered', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      name: 'Ada',
      passwordHash: 'x',
      roles: ['user'],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      deletedAt: null
    })

    await expect(createUser({ email: 'a@example.com', name: 'Ada', password: 'password123' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'users.email_taken'
    })
    expect(usersRepository.create).not.toHaveBeenCalled()
  })

  it('hashes the password and creates the user with the default role', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(undefined)
    vi.mocked(hashPassword).mockResolvedValue('hashed')
    vi.mocked(usersRepository.create).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      name: 'Ada',
      passwordHash: 'hashed',
      roles: ['user'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      version: 1,
      deletedAt: null
    })

    const result = await createUser({ email: 'a@example.com', name: 'Ada', password: 'password123' })

    expect(usersRepository.create).toHaveBeenCalledWith({
      email: 'a@example.com',
      name: 'Ada',
      passwordHash: 'hashed',
      roles: ['user'],
      createdBy: null
    })
    expect(result).toEqual({ id: 'u1', email: 'a@example.com', name: 'Ada', createdAt: new Date('2024-01-01') })
  })
})
