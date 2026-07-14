import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/session'

const LoginBody = z.object({
  email: z.email(),
  password: z.string().min(8)
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = LoginBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 422 })
  }
  // Demo auth — no backend wired yet. Any well-formed credentials succeed;
  // swap this (and signup/route.ts) for a real backend call before shipping.
  const session = await getSession()
  session.user = { email: parsed.data.email }
  await session.save()
  return NextResponse.json({ email: parsed.data.email })
}
