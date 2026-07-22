import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app.js'
import { runOutboxRelay } from '../shared/job-queue/tasks/outbox-relay.js'
import { queryClient } from '../shared/db/client.js'

// Full HTTP round trip against a real Postgres (testcontainers) — the
// automated version of the manual curl golden path in SKILL.md, and the one
// place all the module-boundary/outbox/idempotency/optimistic-concurrency
// pieces are proven working TOGETHER, not just individually mocked.
describe('golden path (integration, full HTTP round trip)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    await queryClient.end()
  })

  async function signupAndLogin(namePrefix: string): Promise<{ userId: string; accessToken: string }> {
    const email = `${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`

    const signup = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: { 'idempotency-key': `signup-${email}` },
      payload: { email, name: namePrefix, password: 'password123' }
    })
    expect(signup.statusCode).toBe(201)
    const userId = (signup.json() as { id: string }).id

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'password123' }
    })
    expect(login.statusCode).toBe(200)
    const accessToken = (login.json() as { access_token: string }).access_token

    return { userId, accessToken }
  }

  it('signup -> login -> create post -> list shows author_name -> version-checked update -> erase -> outbox anonymizes', async () => {
    const author = await signupAndLogin('author')
    const viewer = await signupAndLogin('viewer')

    const create = await app.inject({
      method: 'POST',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${author.accessToken}`, 'idempotency-key': `post-${author.userId}` },
      payload: { title: 'Hello', body: 'World' }
    })
    expect(create.statusCode).toBe(201)
    const post = create.json() as { id: string; version: number }

    const listBefore = await app.inject({
      method: 'GET',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${viewer.accessToken}` }
    })
    expect(listBefore.statusCode).toBe(200)
    const itemsBefore = listBefore.json().data as Array<{ id: string; author_name: string | null }>
    expect(itemsBefore.find((p) => p.id === post.id)?.author_name).toBe('author')

    // Stale version -> 409, never a silent overwrite (ADR §9.4).
    const staleUpdate = await app.inject({
      method: 'PATCH',
      url: `/v1/posts/${post.id}`,
      headers: { authorization: `Bearer ${author.accessToken}`, 'idempotency-key': `stale-${post.id}` },
      payload: { title: 'stale', version: post.version + 100 }
    })
    expect(staleUpdate.statusCode).toBe(409)

    const update = await app.inject({
      method: 'PATCH',
      url: `/v1/posts/${post.id}`,
      headers: { authorization: `Bearer ${author.accessToken}`, 'idempotency-key': `update-${post.id}` },
      payload: { title: 'Updated', version: post.version }
    })
    expect(update.statusCode).toBe(200)
    expect((update.json() as { version: number }).version).toBe(post.version + 1)

    // Self-erase: hard-delete + outbox row in one transaction.
    const erase = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${author.userId}`,
      headers: { authorization: `Bearer ${author.accessToken}` }
    })
    expect(erase.statusCode).toBe(204)

    // Anonymization is async: outbox -> relay -> event bus -> posts' inbox
    // handler. The relay only runs on a cron tick in production; tick it
    // manually here rather than sleeping for a minute.
    await runOutboxRelay()

    const listAfter = await app.inject({
      method: 'GET',
      url: '/v1/posts',
      headers: { authorization: `Bearer ${viewer.accessToken}` }
    })
    const itemsAfter = listAfter.json().data as Array<{ id: string; author_id: string | null; author_name: string | null }>
    const afterItem = itemsAfter.find((p) => p.id === post.id)
    expect(afterItem?.author_id).toBeNull()
    expect(afterItem?.author_name).toBeNull()
  })

  it('/readyz reflects a live DB', async () => {
    const ready = await app.inject({ method: 'GET', url: '/readyz' })
    expect(ready.statusCode).toBe(200)
    expect(ready.json().status).toBe('ready')
  })
})
