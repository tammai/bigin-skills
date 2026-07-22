import { generateRefreshToken, hashRefreshToken } from '../../../shared/auth/tokens.js'
import { unauthenticated } from '../../../shared/errors/app-error.js'
import { ErrorCode } from '../../../shared/errors/codes.js'
import { env } from '../../../shared/config/env.js'
import { usersRepository } from '../infrastructure/users.repository.js'
import { refreshTokenRepository } from '../infrastructure/refresh-token-repository.js'
import type { LoginResult } from './login.js'

// Rotating refresh with reuse detection: presenting an already-revoked token
// means the lineage is compromised — revoke the whole family and reject.
export async function refresh(rawToken: string): Promise<LoginResult> {
  const tokenHash = hashRefreshToken(rawToken)
  const existing = await refreshTokenRepository.findByHash(tokenHash)
  if (!existing) throw unauthenticated(ErrorCode.InvalidRefreshToken, 'invalid refresh token')

  if (existing.revokedAt) {
    await refreshTokenRepository.revokeFamily(existing.familyId)
    throw unauthenticated(ErrorCode.InvalidRefreshToken, 'refresh token reuse detected')
  }
  if (existing.expiresAt.getTime() < Date.now()) {
    throw unauthenticated(ErrorCode.InvalidRefreshToken, 'refresh token expired')
  }

  const user = await usersRepository.findById(existing.userId)
  if (!user) throw unauthenticated(ErrorCode.InvalidRefreshToken, 'invalid refresh token')

  const newToken = generateRefreshToken()
  const created = await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(newToken),
    familyId: existing.familyId, // same lineage
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86400_000)
  })
  await refreshTokenRepository.revoke(existing.id, created.id)

  return { principal: { id: user.id, roles: user.roles }, refreshToken: newToken }
}
