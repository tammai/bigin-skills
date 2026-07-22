import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { backendLogin, BackendError } from '@/lib/backend'

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(8)
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'validation_failed', message: 'Invalid request body' } }, { status: 422 })
  }
  try {
    const tokens = await backendLogin(parsed.data.email, parsed.data.password)
    const session = await getSession()
    // The login response carries no user object — store the email from the
    // request body for display. We deliberately do NOT decode the JWT just to
    // recover an email; the token pair is all the proxy needs.
    session.user = { email: parsed.data.email }
    session.tokens = tokens
    await session.save()
    return NextResponse.json({ email: parsed.data.email })
  } catch (err) {
    if (err instanceof BackendError) {
      // Pass through a clean status — never the raw backend body, which carries
      // a request_id and internal phrasing not meant for the browser. A 401 is
      // the expected "bad credentials" case.
      const status = err.status >= 400 && err.status < 500 ? err.status : 502
      return NextResponse.json({ error: { code: 'unauthenticated', message: 'Invalid email or password' } }, { status })
    }
    // fetch threw (backend unreachable / timeout)
    return NextResponse.json({ error: { code: 'internal_error', message: 'Login failed, try again' } }, { status: 502 })
  }
}
