import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { LogoutButton } from './logout-button'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.user) redirect('/login')

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="font-semibold">{PROJECT_NAME}</span>
        <LogoutButton />
      </header>
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Signed in as {session.user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This is a private area — only reachable when logged in (see src/proxy.ts).
              Auth here is a demo stand-in with no backend wired; swap the /api/login and
              /api/signup routes for real calls before shipping.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
