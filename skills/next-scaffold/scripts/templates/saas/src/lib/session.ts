import { cookies } from 'next/headers'
import { getIronSession, type SessionOptions } from 'iron-session'

export type SessionUser = { email: string, name?: string }
export type SessionData = { user?: SessionUser }

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
