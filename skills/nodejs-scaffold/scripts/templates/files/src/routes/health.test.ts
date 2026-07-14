import { describe, it, expect, vi } from 'vitest'

vi.mock('../db/client.js', () => ({
  checkConnection: vi.fn().mockResolvedValue(false)
}))

const { buildApp } = await import('../app.js')

describe('health routes', () => {
  it('GET /healthz always returns 200', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
  })

  it('GET /readyz returns 503 when the db is unreachable — no live DB needed to prove this', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/readyz' })
    expect(res.statusCode).toBe(503)
  })
})
