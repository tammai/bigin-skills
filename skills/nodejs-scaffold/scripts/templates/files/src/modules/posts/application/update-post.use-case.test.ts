import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Post } from '../domain/post.entity.js'

vi.mock('../infrastructure/posts.repository.js', () => ({
  postsRepository: { findById: vi.fn(), updateWithVersion: vi.fn() }
}))

const { postsRepository } = await import('../infrastructure/posts.repository.js')
const { updatePost } = await import('./update-post.use-case.js')

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    authorId: 'u1',
    title: 't',
    body: 'b',
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    deletedAt: null,
    ...overrides
  }
}

describe('updatePost', () => {
  beforeEach(() => {
    vi.mocked(postsRepository.findById).mockReset()
    vi.mocked(postsRepository.updateWithVersion).mockReset()
  })

  it('throws not_found for a missing post', async () => {
    vi.mocked(postsRepository.findById).mockResolvedValue(undefined)

    await expect(updatePost('missing', { version: 1 }, { sub: 'u1', roles: ['user'] })).rejects.toMatchObject({
      statusCode: 404
    })
  })

  it('rejects an editor who is not the author', async () => {
    vi.mocked(postsRepository.findById).mockResolvedValue(post())

    await expect(updatePost('p1', { version: 1 }, { sub: 'someone-else', roles: ['user'] })).rejects.toMatchObject({
      statusCode: 403
    })
    expect(postsRepository.updateWithVersion).not.toHaveBeenCalled()
  })

  it('rejects a stale version with 409 before even attempting the update', async () => {
    vi.mocked(postsRepository.findById).mockResolvedValue(post({ version: 3 }))

    await expect(updatePost('p1', { version: 1 }, { sub: 'u1', roles: ['user'] })).rejects.toMatchObject({
      statusCode: 409,
      code: 'posts.version_conflict'
    })
    expect(postsRepository.updateWithVersion).not.toHaveBeenCalled()
  })

  it('re-throws a conflict if the conditional UPDATE loses a race after the version check', async () => {
    vi.mocked(postsRepository.findById).mockResolvedValue(post({ version: 1 }))
    vi.mocked(postsRepository.updateWithVersion).mockResolvedValue(undefined)

    await expect(updatePost('p1', { version: 1 }, { sub: 'u1', roles: ['user'] })).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('updates when the author matches and the version is current', async () => {
    vi.mocked(postsRepository.findById).mockResolvedValue(post({ version: 1 }))
    vi.mocked(postsRepository.updateWithVersion).mockResolvedValue(post({ version: 2, title: 'new' }))

    const result = await updatePost('p1', { title: 'new', version: 1 }, { sub: 'u1', roles: ['user'] })

    expect(result.version).toBe(2)
    expect(postsRepository.updateWithVersion).toHaveBeenCalledWith('p1', 1, {
      title: 'new',
      body: undefined,
      updatedBy: 'u1'
    })
  })
})
