import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../infrastructure/refresh-token-repository.js', () => ({
  refreshTokenRepository: { findByHash: vi.fn(), revoke: vi.fn() }
}))

const { refreshTokenRepository } = await import('../infrastructure/refresh-token-repository.js')
const { logout } = await import('./logout.js')

describe('logout', () => {
  beforeEach(() => {
    vi.mocked(refreshTokenRepository.findByHash).mockReset()
    vi.mocked(refreshTokenRepository.revoke).mockReset()
  })

  it('revokes a known, unrevoked token', async () => {
    vi.mocked(refreshTokenRepository.findByHash).mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'h',
      familyId: 'f1',
      revokedAt: null,
      replacedById: null,
      expiresAt: new Date(),
      createdAt: new Date()
    })

    await logout('token')

    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith('rt1', null)
  })

  it('is a no-op for an unknown token (logout never errors)', async () => {
    vi.mocked(refreshTokenRepository.findByHash).mockResolvedValue(undefined)
    await expect(logout('unknown')).resolves.toBeUndefined()
    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled()
  })

  it('is a no-op for an already-revoked token', async () => {
    vi.mocked(refreshTokenRepository.findByHash).mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      tokenHash: 'h',
      familyId: 'f1',
      revokedAt: new Date(),
      replacedById: null,
      expiresAt: new Date(),
      createdAt: new Date()
    })

    await logout('already-revoked')

    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled()
  })
})
