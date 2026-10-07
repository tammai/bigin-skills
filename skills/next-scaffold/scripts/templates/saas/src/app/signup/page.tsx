'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { isApiError } from '@/shared/api-client/errors'
import { useRedirectIfSignedIn, useSignup } from '@/features/users/hooks/use-session'

const schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  email: z.email('Invalid email'),
  password: z.string().min(8, 'Must be at least 8 characters')
})

export default function SignupPage() {
  const router = useRouter()
  const signup = useSignup()
  const [error, setError] = useState<string | null>(null)
  useRedirectIfSignedIn()

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)
    const parsed = schema.safeParse({
      full_name: formData.get('full_name'),
      email: formData.get('email'),
      password: formData.get('password')
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    try {
      await signup.mutateAsync(parsed.data)
    } catch (err) {
      if (isApiError(err, 409)) setError('That email is already registered.')
      else if (isApiError(err, 400)) setError('Invalid sign-up details.')
      else setError('Sign up failed — try again.')
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Already have an account? <a href="/login" className="underline">Login</a>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Name</Label>
              <Input id="full_name" name="full_name" type="text" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={signup.isPending}>Create account</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
