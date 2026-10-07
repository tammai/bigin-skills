import { cookies } from 'next/headers'
import { getIronSession, type SessionOptions } from 'iron-session'

// The BFF's sealed-cookie session. It carries the identity we show in the UI
// plus the backend token pair the proxy replays as `Authorization: Bearer`.
// The access/refresh tokens never reach the browser — they live only inside
// this AES-sealed cookie, unsealed server-side (route handlers + proxy).
// Field names follow the backend's User schema (id, email, full_name, role).
export type SessionUser = { id?: number, email: string, full_name?: string, role?: string }

export type SessionTokens = { access_token: string, refresh_token: string }

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
