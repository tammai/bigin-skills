import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DashboardPage from './page'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), GET: vi.fn(), DELETE: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }))
vi.mock('@/shared/api-client', () => ({ apiClient: { GET: mocks.GET, DELETE: mocks.DELETE } }))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })}>
      <DashboardPage />
    </QueryClientProvider>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the signed-in user from GET /user/profile', async () => {
    mocks.GET.mockResolvedValue({ data: { id: 1, email: 'a@example.com', role: 'user' }, response: { status: 200, ok: true } })
    renderPage()
    expect(await screen.findByText('Signed in as a@example.com')).toBeInTheDocument()
  })

  it('sends a signed-out visitor to /login', async () => {
    mocks.GET.mockResolvedValue({ data: undefined, response: { status: 401, ok: false } })
    renderPage()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByText('Sign out')).toBeNull()
  })

  it('signs out through DELETE /auth/session and returns to /login', async () => {
    mocks.GET.mockResolvedValue({ data: { id: 1, email: 'a@example.com', role: 'user' }, response: { status: 200, ok: true } })
    mocks.DELETE.mockResolvedValue({ response: { status: 200, ok: true } })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'))
    expect(mocks.DELETE).toHaveBeenCalledWith('/auth/session')
  })
})
