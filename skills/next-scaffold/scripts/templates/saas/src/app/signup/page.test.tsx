import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SignupPage from './page'

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), GET: vi.fn(), POST: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }))
vi.mock('@/shared/api-client', () => ({ apiClient: { GET: mocks.GET, POST: mocks.POST } }))

const user = { id: 1, email: 'a@example.com', full_name: 'Ada Lovelace', role: 'user' }

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })}>
      <SignupPage />
    </QueryClientProvider>
  )
}

function submit() {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada Lovelace' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!)
}

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.GET.mockResolvedValue({ data: undefined, response: { status: 401, ok: false } })
  })

  it('signs up, then logs in, then goes to the dashboard', async () => {
    mocks.POST.mockImplementation(async (path: string) => path === '/auth/signup'
      ? { data: user, response: { status: 201, ok: true } }
      : { data: { user }, response: { status: 201, ok: true } })
    renderPage()
    submit()
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'))
    // Signup does not sign you in, so the login call follows it, in that order.
    expect(mocks.POST.mock.calls).toEqual([
      ['/auth/signup', { body: { full_name: 'Ada Lovelace', email: 'a@example.com', password: 'correct horse' } }],
      ['/auth/session', { body: { email: 'a@example.com', password: 'correct horse' } }]
    ])
  })

  it('says the email is taken on a 409 and does not log in', async () => {
    mocks.POST.mockResolvedValue({ data: undefined, response: { status: 409, ok: false } })
    renderPage()
    submit()
    expect(await screen.findByText('That email is already registered.')).toBeInTheDocument()
    expect(mocks.POST).toHaveBeenCalledTimes(1)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('redirects to the dashboard when the profile read already succeeds', async () => {
    mocks.GET.mockResolvedValue({ data: user, response: { status: 200, ok: true } })
    renderPage()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'))
  })
})
