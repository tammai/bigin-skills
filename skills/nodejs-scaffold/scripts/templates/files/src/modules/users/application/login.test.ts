import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../infrastructure/users.repository.js', () => ({ usersRepository: { findByEmail: vi.fn() } }))
vi.mock('../infrastructure/refresh-token-repository.js', () => ({ refreshTokenRepository: { create: vi.fn() } }))
vi.mock('../../../shared/auth/password.js', () => ({ verifyPassword: vi.fn() }))

const { usersRepository } = await import('../infrastructure/users.repository.js')
const { refreshTokenRepository } = await import('../infrastructure/refresh-token-repository.js')
const { verifyPassword } = await import('../../../shared/auth/password.js')
const { login } = await import('./login.js')

function existingUser() {
  return {
    id: 'u1',
    email: 'a@example.com',
    name: 'Ada',
    passwordHash: 'h',
    roles: ['user'],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    deletedAt: null
  }
}

describe('login', () => {
  beforeEach(() => {
    vi.mocked(usersRepository.findByEmail).mockReset()
    vi.mocked(verifyPassword).mockReset()
    vi.mocked(refreshTokenRepository.create).mockReset()
  })

  it('rejects an unknown email with a generic error (no user enumeration)', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(undefined)
    await expect(login('nobody@example.com', 'x')).rejects.toMatchObject({
      statusCode: 401,
      code: 'users.invalid_credentials'
    })
  })

  it('rejects a wrong password', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(existingUser())
    vi.mocked(verifyPassword).mockResolvedValue(false)
    await expect(login('a@example.com', 'wrong')).rejects.toMatchObject({ statusCode: 401 })
    expect(refreshTokenRepository.create).not.toHaveBeenCalled()
  })

  it('issues a refresh token on valid credentials', async () => {
    vi.mocked(usersRepository.findByEmail).mockResolvedValue(existingUser())
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(refreshTokenRepository.create).mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'h',
      familyId: 'f1',
      revokedAt: null,
      replacedById: null,
      expiresAt: new Date(),
      createdAt: new Date()
    })

    const result = await login('a@example.com', 'correct')

    expect(result.principal).toEqual({ id: 'u1', roles: ['user'] })
    expect(typeof result.refreshToken).toBe('string')
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }))
  })
})
