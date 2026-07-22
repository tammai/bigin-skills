import { v7 as uuidv7 } from 'uuid'
import { verifyPassword } from '../../../shared/auth/password.js'
import { generateRefreshToken, hashRefreshToken } from '../../../shared/auth/tokens.js'
import { unauthenticated } from '../../../shared/errors/app-error.js'
import { ErrorCode } from '../../../shared/errors/codes.js'
import { env } from '../../../shared/config/env.js'
import { usersRepository } from '../infrastructure/users.repository.js'
import { refreshTokenRepository } from '../infrastructure/refresh-token-repository.js'

export interface AuthPrincipal {
  id: string
  roles: string[]
}

export interface LoginResult {
  principal: AuthPrincipal
  refreshToken: string
}

// Verifies credentials and issues a fresh refresh-token family. The access-JWT
// itself is signed in the api layer (app.jwt.sign) — signing is a framework
// concern, credential logic is the use-case's.
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await usersRepository.findByEmail(email)
  // Verify against a real-looking hash even on a missing user is out of scope;
  // the generic error message already avoids user enumeration.
  if (!user) throw unauthenticated(ErrorCode.InvalidCredentials, 'invalid credentials')

  const ok = await verifyPassword(user.passwordHash, password)
  if (!ok) throw unauthenticated(ErrorCode.InvalidCredentials, 'invalid credentials')

  const refreshToken = generateRefreshToken()
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    familyId: uuidv7(),
    expiresAt: new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86400_000)
  })

  return { principal: { id: user.id, roles: user.roles }, refreshToken }
}
