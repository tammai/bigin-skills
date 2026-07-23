import { NextResponse, type NextRequest } from 'next/server'
import { unsealData } from 'iron-session'
import type { SessionData } from '@/lib/session'
import { isCrossSiteMutation } from '@/lib/csrf'

async function isLoggedIn(request: NextRequest) {
  const sealed = request.cookies.get('session')?.value
  const password = process.env.SESSION_PASSWORD
  if (!sealed || !password) return false
  try {
    const { user } = await unsealData<SessionData>(sealed, { password })
    return Boolean(user)
  } catch {
    return false
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CSRF defense for the session-establishing auth routes (ADR §7): the
  // backend proxy (src/app/api/backend/[...path]/route.ts) already guards
  // itself, but /api/login, /api/signup, /api/logout also mutate server-side
  // session state and need the same protection — sharing isCrossSiteMutation
  // means both enforcement points can't drift out of sync, and any future
  // auth-adjacent route under /api/ is covered automatically.
  if (pathname.startsWith('/api/') && isCrossSiteMutation(request)) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'cross-origin request rejected' } }, { status: 403 })
  }

  const loggedIn = await isLoggedIn(request)

  if (pathname.startsWith('/dashboard') && !loggedIn) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if ((pathname === '/login' || pathname === '/signup') && loggedIn) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/api/:path*']
}
