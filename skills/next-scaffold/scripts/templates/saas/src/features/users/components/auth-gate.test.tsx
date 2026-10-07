import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthGate } from './auth-gate'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), GET: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: vi.fn() }) }))
vi.mock('@/shared/api-client', () => ({ apiClient: { GET: mocks.GET } }))

function renderGate() {
  // retryDelay: 1 keeps the 5xx case (which retries twice) fast.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthGate><p>private</p></AuthGate>
    </QueryClientProvider>
  )
}

describe('AuthGate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders nothing and does not redirect while the profile read is in flight', () => {
    mocks.GET.mockReturnValue(new Promise(() => {}))
    renderGate()
    expect(screen.queryByText('private')).toBeNull()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('renders its children once GET /user/profile succeeds', async () => {
    mocks.GET.mockResolvedValue({ data: { id: 1, email: 'a@example.com', role: 'user' }, response: { status: 200 } })
    renderGate()
    expect(await screen.findByText('private')).toBeInTheDocument()
    expect(mocks.GET).toHaveBeenCalledWith('/user/profile')
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('redirects to /login on a 401 and never shows the children', async () => {
    mocks.GET.mockResolvedValue({ data: undefined, response: { status: 401 } })
    renderGate()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByText('private')).toBeNull()
    expect(mocks.GET).toHaveBeenCalledTimes(1)
  })

  it('shows a retry instead of redirecting when the API fails with a 5xx', async () => {
    mocks.GET.mockResolvedValue({ data: undefined, response: { status: 503 } })
    renderGate()
    expect(await screen.findByText('Could not reach the API.')).toBeInTheDocument()
    expect(mocks.replace).not.toHaveBeenCalled()
    expect(screen.queryByText('private')).toBeNull()
  })
})
