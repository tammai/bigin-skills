import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/client.js', () => ({
  checkConnection: vi.fn().mockResolvedValue(true)
}))

vi.mock('../services/user-service.js', () => ({
  userService: {
    create: vi.fn(),
    get: vi.fn()
  }
}))

const { buildApp } = await import('../app.js')
const { userService } = await import('../services/user-service.js')

describe('user routes', () => {
  it('POST /users rejects an invalid body via Zod, not a raw parser error', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/v1/users', payload: { email: 'not-an-email' } })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('invalid_request')
  })

  it('POST /users with malformed JSON does not leak the raw parser error text', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: '{not valid json',
      headers: { 'content-type': 'application/json' }
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).not.toMatch(/Unexpected token/)
  })

  it('POST /users creates a user', async () => {
    const now = new Date()
    vi.mocked(userService.create).mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com', name: 'A', createdAt: now })
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      payload: { email: 'a@b.com', name: 'A' }
    })
    expect(res.statusCode).toBe(201)
  })

  it('GET /users/:id returns 404 for an unknown user', async () => {
    vi.mocked(userService.get).mockResolvedValue(undefined)
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/v1/users/00000000-0000-0000-0000-000000000000' })
    expect(res.statusCode).toBe(404)
  })
})
