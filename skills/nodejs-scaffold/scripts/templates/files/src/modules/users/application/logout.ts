import { hashRefreshToken } from '../../../shared/auth/tokens.js'
import { refreshTokenRepository } from '../infrastructure/refresh-token-repository.js'

// Revoke the presented refresh token. Idempotent: an unknown or
// already-revoked token is a no-op (logout should never error).
export async function logout(rawToken: string): Promise<void> {
  const existing = await refreshTokenRepository.findByHash(hashRefreshToken(rawToken))
  if (existing && !existing.revokedAt) {
    await refreshTokenRepository.revoke(existing.id, null)
  }
}
