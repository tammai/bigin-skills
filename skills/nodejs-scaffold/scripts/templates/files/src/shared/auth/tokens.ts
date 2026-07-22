import { createHash, randomBytes } from 'node:crypto'

// A refresh token is a 256-bit server-generated random value — nothing to
// brute-force — so it's stored as a plain sha256 (fast), NOT argon2id. A slow
// hash here would only add latency to every refresh call and buy nothing.
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// Parse a JWT-style TTL string ("15m", "3600", "1h") into seconds — used for
// the `expires_in` field of the token response.
export function durationToSeconds(d: string): number {
  const m = /^(\d+)([smhd])$/.exec(d.trim())
  if (!m) return Number(d) || 0
  const n = Number(m[1])
  switch (m[2]) {
    case 's':
      return n
    case 'm':
      return n * 60
    case 'h':
      return n * 3600
    case 'd':
      return n * 86400
    default:
      return n
  }
}
