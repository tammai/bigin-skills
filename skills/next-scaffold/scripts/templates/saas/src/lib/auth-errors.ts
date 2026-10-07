import { NextResponse } from 'next/server'
import { BackendError } from '@/lib/backend'

// login/signup route.ts's status-code/error-code branching, extracted as pure
// functions so the mapping lives in one place instead of two near-identical
// catch blocks. Never forwards the raw backend body to the browser.

export function loginErrorResponse(err: unknown): NextResponse {
  if (err instanceof BackendError) {
    // A 401 is the expected "bad credentials" case; anything else the backend
    // can't serve collapses to the same generic client code.
    const status = err.status >= 400 && err.status < 500 ? err.status : 502
    return NextResponse.json({ error: { code: 'unauthenticated', message: 'Invalid email or password' } }, { status })
  }
  // fetch threw (backend unreachable / timeout) — not a BackendError.
  return NextResponse.json({ error: { code: 'internal_error', message: 'Login failed, try again' } }, { status: 502 })
}

export function signupErrorResponse(err: unknown): NextResponse {
  if (err instanceof BackendError) {
    // The backend's error body is { error: "<message>" } with no code, so the
    // client-facing code is chosen here from the status alone.
    if (err.status === 409) {
      return NextResponse.json({ error: { code: 'users.email_taken', message: 'That email is already registered' } }, { status: 409 })
    }
    // The backend validates with 400 (bad email, short password, name length).
    if (err.status === 400) {
      return NextResponse.json({ error: { code: 'validation_failed', message: 'Invalid sign-up details' } }, { status: 400 })
    }
    const status = err.status >= 400 && err.status < 500 ? err.status : 502
    return NextResponse.json({ error: { code: 'backend_error', message: 'Sign up failed' } }, { status })
  }
  return NextResponse.json({ error: { code: 'internal_error', message: 'Sign up failed, try again' } }, { status: 502 })
}
