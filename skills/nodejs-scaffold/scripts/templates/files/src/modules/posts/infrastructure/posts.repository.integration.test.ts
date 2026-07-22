import { describe, it, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { queryClient } from '../../../shared/db/client.js'
import { usersRepository } from '../../users/infrastructure/users.repository.js'
import { postsRepository } from './posts.repository.js'

// Real Postgres via testcontainers (vitest.integration.config.ts's
// globalSetup) — ADR §11: infrastructure/ gets integration tests against a
// real DB, never mocks.
describe('postsRepository (integration)', () => {
  afterAll(async () => {
    await queryClient.end()
  })

  const sorts = [{ column: 'created_at' as const, direction: 'desc' as const }]

  async function makeAuthor() {
    return usersRepository.create({
      email: `post-author-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      name: 'Author',
      passwordHash: 'h',
      roles: ['user']
    })
  }

  it('creates a post and lists it back', async () => {
    const author = await makeAuthor()
    const post = await postsRepository.create({ title: 'Hello', body: 'World', authorId: author.id })

    const page = await postsRepository.list({ limit: 100, sorts, cursorValues: null })
    expect(page.some((p) => p.id === post.id)).toBe(true)
  })

  it('markProcessed dedupes: true only on the first call for a given event id', async () => {
    const eventId = randomUUID()
    expect(await postsRepository.markProcessed(eventId)).toBe(true)
    expect(await postsRepository.markProcessed(eventId)).toBe(false)
  })

  it('anonymizeAuthor nulls out authorId for every post by that author', async () => {
    const author = await makeAuthor()
    const post = await postsRepository.create({ title: 'Mine', body: 'B', authorId: author.id })

    await postsRepository.anonymizeAuthor(author.id)

    const page = await postsRepository.list({ limit: 100, sorts, cursorValues: null })
    expect(page.find((p) => p.id === post.id)?.authorId).toBeNull()
  })

  it('updateWithVersion applies the change and increments version', async () => {
    const author = await makeAuthor()
    const post = await postsRepository.create({ title: 'v1', body: 'B', authorId: author.id })

    const updated = await postsRepository.updateWithVersion(post.id, post.version, { title: 'v2', updatedBy: author.id })

    expect(updated?.title).toBe('v2')
    expect(updated?.version).toBe(post.version + 1)
  })

  it('updateWithVersion returns undefined on a stale version — the optimistic-concurrency guard', async () => {
    const author = await makeAuthor()
    const post = await postsRepository.create({ title: 'v1', body: 'B', authorId: author.id })

    // Someone else's update lands first, advancing the version...
    await postsRepository.updateWithVersion(post.id, post.version, { title: 'someone-else', updatedBy: author.id })

    // ...then a retry using the now-STALE version conflicts instead of overwriting.
    const stale = await postsRepository.updateWithVersion(post.id, post.version, { title: 'stale-write', updatedBy: author.id })
    expect(stale).toBeUndefined()
  })
})
