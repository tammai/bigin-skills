import { describe, it, expect, vi } from 'vitest'

// Replace the DB client so buildApp() can boot with no live Postgres. No test
// here executes a real query.
vi.mock('../shared/db/client.js', () => ({
  checkConnection: vi.fn().mockResolvedValue(false),
  db: {},
  queryClient: {}
}))

const { buildApp } = await import('./app.js')

describe('health routes', () => {
  it('GET /healthz always returns 200', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
    await app.close()
  })

  it('GET /readyz returns 503 when the db is unreachable — no live DB needed', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/readyz' })
    expect(res.statusCode).toBe(503)
    await app.close()
  })

  it('unauthenticated GET /v1/users is rejected with the nested error envelope', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/v1/users' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('unauthenticated')
    expect(typeof res.json().error.request_id).toBe('string')
    await app.close()
  })
})
