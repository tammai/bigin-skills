import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './page'

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), GET: vi.fn(), POST: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }))
vi.mock('@/shared/api-client', () => ({ apiClient: { GET: mocks.GET, POST: mocks.POST } }))

const user = { id: 1, email: 'a@example.com', full_name: 'Ada', role: 'user' }
const signedOut = { data: undefined, response: { status: 401, ok: false } }

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } })}>
      <LoginPage />
    </QueryClientProvider>
  )
}

function submit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!)
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.GET.mockResolvedValue(signedOut)
  })

  it('posts the credentials to /auth/session and goes to the dashboard', async () => {
    mocks.POST.mockResolvedValue({ data: { user }, response: { status: 201, ok: true } })
    renderPage()
    submit('a@example.com', 'correct horse')
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'))
    expect(mocks.POST).toHaveBeenCalledWith('/auth/session', { body: { email: 'a@example.com', password: 'correct horse' } })
  })

  it('shows a bad-credentials message on a 401 and stays put', async () => {
    mocks.POST.mockResolvedValue({ data: undefined, response: { status: 401, ok: false } })
    renderPage()
    submit('a@example.com', 'wrong password')
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('shows a generic message when the API fails', async () => {
    mocks.POST.mockResolvedValue({ data: undefined, response: { status: 502, ok: false } })
    renderPage()
    submit('a@example.com', 'correct horse')
    expect(await screen.findByText('Login failed — try again.')).toBeInTheDocument()
  })

  it('rejects a short password without calling the API', async () => {
    renderPage()
    submit('a@example.com', 'short')
    expect(await screen.findByText('Must be at least 8 characters')).toBeInTheDocument()
    expect(mocks.POST).not.toHaveBeenCalled()
  })

  it('redirects to the dashboard when the profile read already succeeds', async () => {
    mocks.GET.mockResolvedValue({ data: user, response: { status: 200, ok: true } })
    renderPage()
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'))
  })
})
