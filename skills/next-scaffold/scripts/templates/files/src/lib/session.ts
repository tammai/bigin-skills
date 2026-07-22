import { cookies } from 'next/headers'
import { getIronSession, type SessionOptions } from 'iron-session'

// The BFF's sealed-cookie session. It carries the identity we show in the UI
// plus the backend token pair the proxy replays as `Authorization: Bearer`.
// The access/refresh tokens never reach the browser — they live only inside
// this AES-sealed cookie, unsealed server-side (route handlers + proxy).
export type SessionUser = { id?: string, email: string, name?: string }

// `expires_at` is an absolute epoch-ms deadline computed from the backend's
// `expires_in` at write time, so the proxy can cheaply check "is the access
// token stale?" without decoding/verifying the JWT on every request.
export type SessionTokens = { access_token: string, refresh_token: string, expires_at: number }

export type SessionData = { user?: SessionUser, tokens?: SessionTokens }

// Lazy env read inside the function (never at module load): a missing
// SESSION_PASSWORD must fail at request time, not break `next build`/`pnpm lint`
// for every route that happens to import this module.
export async function getSession() {
  const password = process.env.SESSION_PASSWORD
  if (!password) throw new Error('SESSION_PASSWORD is not configured')
  const sessionOptions: SessionOptions = {
    password,
    cookieName: 'session',
    cookieOptions: { secure: process.env.NODE_ENV === 'production' }
  }
  return getIronSession<SessionData>(await cookies(), sessionOptions)
}
