import { NextResponse } from 'next/server'
import { BackendError } from '@/lib/backend'

// login/signup route.ts's status-code/error-code branching, extracted as pure
// functions so the mapping lives in one place instead of two near-identical
// catch blocks. Never forwards the raw backend body (request_id + internal
// phrasing) to the browser.

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
    if (err.status === 409) {
      return NextResponse.json({ error: { code: 'users.email_taken', message: 'That email is already registered' } }, { status: 409 })
    }
    if (err.status === 422) {
      return NextResponse.json({ error: { code: 'validation_failed', message: 'Invalid sign-up details' } }, { status: 422 })
    }
    const status = err.status >= 400 && err.status < 500 ? err.status : 502
    return NextResponse.json({ error: { code: err.code, message: 'Sign up failed' } }, { status })
  }
  return NextResponse.json({ error: { code: 'internal_error', message: 'Sign up failed, try again' } }, { status: 502 })
}
