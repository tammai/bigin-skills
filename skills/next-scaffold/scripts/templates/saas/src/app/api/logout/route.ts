import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { backendLogout } from '@/lib/backend'

export async function POST() {
  const session = await getSession()
  const tokens = session.tokens
  // Best-effort backend revocation (backendLogout swallows its own errors).
  // Logout must ALWAYS succeed client-side: if the backend is slow or down the
  // user still expects to be signed out here, and any dangling refresh token
  // expires on its own server-side. So the local session is torn down
  // regardless of the backend call's outcome.
  if (tokens) {
    await backendLogout(tokens.access_token, tokens.refresh_token)
  }
  session.destroy()
  return NextResponse.json({ ok: true })
}
