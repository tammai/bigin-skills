import { NextResponse, type NextRequest } from 'next/server'
import { unsealData } from 'iron-session'
import type { SessionData } from '@/lib/session'

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
  matcher: ['/dashboard/:path*', '/login', '/signup']
}
