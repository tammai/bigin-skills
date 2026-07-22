import { describe, it, expect, vi } from 'vitest'
import type { Post } from '../domain/post.entity.js'

vi.mock('../infrastructure/posts.repository.js', () => ({ postsRepository: { list: vi.fn() } }))
// The cross-module read-composition dependency, mocked at its public surface
// — exactly what other modules are allowed to see (see index.ts).
vi.mock('../../users/index.js', () => ({ getManyByIds: vi.fn() }))

const { postsRepository } = await import('../infrastructure/posts.repository.js')
const { getManyByIds } = await import('../../users/index.js')
const { listPosts } = await import('./list-posts.use-case.js')

function post(id: string, authorId: string | null, createdAt: string): Post {
  return { id, authorId, title: 't', body: 'b', createdAt: new Date(createdAt), updatedAt: new Date(createdAt), version: 1, deletedAt: null }
}

describe('listPosts', () => {
  it('batches every page author into ONE getManyByIds call (no N+1)', async () => {
    vi.mocked(postsRepository.list).mockResolvedValue([post('p1', 'u1', '2024-01-03'), post('p2', 'u2', '2024-01-02')])
    vi.mocked(getManyByIds).mockResolvedValue(
      new Map([
        ['u1', { id: 'u1', name: 'Ada' }],
        ['u2', { id: 'u2', name: 'Bo' }]
      ])
    )

    const result = await listPosts({ limit: 20 })

    expect(getManyByIds).toHaveBeenCalledTimes(1)
    expect(getManyByIds).toHaveBeenCalledWith(['u1', 'u2'])
    expect(result.data[0].author_name).toBe('Ada')
    expect(result.data[1].author_name).toBe('Bo')
  })

  it('resolves a null author_name for an anonymized (null authorId) post', async () => {
    vi.mocked(postsRepository.list).mockResolvedValue([post('p1', null, '2024-01-01')])
    vi.mocked(getManyByIds).mockResolvedValue(new Map())

    const result = await listPosts({ limit: 20 })

    expect(getManyByIds).toHaveBeenCalledWith([])
    expect(result.data[0].author_name).toBeNull()
  })
})
