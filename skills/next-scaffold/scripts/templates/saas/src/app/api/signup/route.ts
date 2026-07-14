import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'

const SignupBody = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8)
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = SignupBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 422 })
  }
  // Demo auth — no backend wired yet; see api/login/route.ts.
  const session = await getSession()
  session.user = { email: parsed.data.email, name: parsed.data.name }
  await session.save()
  return NextResponse.json({ email: parsed.data.email, name: parsed.data.name })
}
