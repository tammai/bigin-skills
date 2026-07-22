import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../infrastructure/posts.repository.js', () => ({ postsRepository: { create: vi.fn() } }))
vi.mock('../../../shared/auth/rbac.js', () => ({ can: vi.fn() }))

const { postsRepository } = await import('../infrastructure/posts.repository.js')
const { can } = await import('../../../shared/auth/rbac.js')
const { createPost } = await import('./create-post.use-case.js')

describe('createPost', () => {
  beforeEach(() => {
    vi.mocked(postsRepository.create).mockReset()
    vi.mocked(can).mockReset()
  })

  it('rejects an actor without posts:write', async () => {
    vi.mocked(can).mockReturnValue(false)

    await expect(createPost({ title: 't', body: 'b' }, { sub: 'u1', roles: [] })).rejects.toMatchObject({
      statusCode: 403
    })
    expect(postsRepository.create).not.toHaveBeenCalled()
  })

  it('creates the post authored by the actor', async () => {
    vi.mocked(can).mockReturnValue(true)
    vi.mocked(postsRepository.create).mockResolvedValue({
      id: 'p1',
      authorId: 'u1',
      title: 't',
      body: 'b',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      deletedAt: null
    })

    const post = await createPost({ title: 't', body: 'b' }, { sub: 'u1', roles: ['user'] })

    expect(postsRepository.create).toHaveBeenCalledWith({ title: 't', body: 'b', authorId: 'u1' })
    expect(post.id).toBe('p1')
  })
})
