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
              Auth is wired to a real backend: /api/login and /api/signup call
              BACKEND_URL and store the returned token pair in the sealed session;
              authenticated data calls go through the /api/backend/* proxy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
