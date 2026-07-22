import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../infrastructure/users.repository.js', () => ({ usersRepository: { findById: vi.fn() } }))
vi.mock('../infrastructure/refresh-token-repository.js', () => ({
  refreshTokenRepository: { findByHash: vi.fn(), create: vi.fn(), revoke: vi.fn(), revokeFamily: vi.fn() }
}))

const { usersRepository } = await import('../infrastructure/users.repository.js')
const { refreshTokenRepository } = await import('../infrastructure/refresh-token-repository.js')
const { refresh } = await import('./refresh.js')

interface FakeRefreshTokenRow {
  id: string
  userId: string
  tokenHash: string
  familyId: string
  revokedAt: Date | null
  replacedById: string | null
  expiresAt: Date
  createdAt: Date
}

function tokenRow(overrides: Partial<FakeRefreshTokenRow> = {}): FakeRefreshTokenRow {
  return {
    id: 'rt1',
    userId: 'u1',
    tokenHash: 'h',
    familyId: 'f1',
    revokedAt: null,
    replacedById: null,
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    ...overrides
  }
}

describe('refresh', () => {
  beforeEach(() => {
    vi.mocked(usersRepository.findById).mockReset()
    vi.mocked(refreshTokenRepository.findByHash).mockReset()
    vi.mocked(refreshTokenRepository.create).mockReset()
    vi.mocked(refreshTokenRepository.revoke).mockReset()
    vi.mocked(refreshTokenRepository.revokeFamily).mockReset()
  })

  it('rejects an unknown token', async () => {
    vi.mocked(refreshTokenRepository.findByHash).mockResolvedValue(undefined)
    await expect(refresh('nope')).rejects.toMatchObject({ statusCode: 401, code: 'users.invalid_refresh_token' })
  })

  it('revokes the whole family and rejects on reuse of a revoked token', async () => {
    vi.mocked(refreshTokenRepository.findByHash).mockResolvedValue(tokenRow({ revokedAt: new Date() }))
    await expect(refresh('reused')).rejects.toMatchObject({ statusCode: 401 })
    expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith('f1')
  })

  it('rejects an expired token', async () => {
    vi.mocked(refreshTokenRepository.findByHash).mockResolvedValue(tokenRow({ expiresAt: new Date(Date.now() - 1000) }))
    await expect(refresh('expired')).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rotates: issues a new token in the same family and revokes the old one', async () => {
    vi.mocked(refreshTokenRepository.findByHash).mockResolvedValue(tokenRow())
    vi.mocked(usersRepository.findById).mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      name: 'A',
      passwordHash: 'x',
      roles: ['user'],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      deletedAt: null
    })
    vi.mocked(refreshTokenRepository.create).mockResolvedValue(tokenRow({ id: 'rt2' }))

    const result = await refresh('valid')

    expect(result.principal).toEqual({ id: 'u1', roles: ['user'] })
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(expect.objectContaining({ familyId: 'f1' }))
    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('rt1', 'rt2')
  })
})
