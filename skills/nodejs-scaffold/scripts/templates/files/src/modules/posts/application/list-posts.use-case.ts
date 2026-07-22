import {
  parseSort,
  serializeSort,
  encodeCursor,
  decodeCursor,
  hydrateCursorValues,
  type SortSpec
} from '../../../shared/pagination/cursor.js'
import { postsRepository } from '../infrastructure/posts.repository.js'
// The cross-module read-composition dependency. `users` is reachable ONLY
// through its public index.ts — the boundary lint blocks importing its
// repository/schema directly. This is an in-process call, not an RPC.
import { getManyByIds } from '../../users/index.js'
import type { Post, PostListItem } from '../domain/post.entity.js'

const ALLOWED_SORTS = ['created_at', 'title'] as const
const TIMESTAMP_COLUMNS = ['created_at'] as const
const DEFAULT_SORT = '-created_at'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface ListPostsInput {
  cursor?: string
  limit?: number
  sort?: string
}

export interface ListPostsResult {
  data: PostListItem[]
  nextCursor: string | null
}

export async function listPosts(input: ListPostsInput): Promise<ListPostsResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const sorts = parseSort(input.sort, ALLOWED_SORTS, DEFAULT_SORT)
  const sortKey = serializeSort(sorts)
  const cursorValues = input.cursor
    ? hydrateCursorValues(sorts, decodeCursor(input.cursor, sortKey), TIMESTAMP_COLUMNS)
    : null

  const rows = await postsRepository.list({ limit: limit + 1, sorts, cursorValues })
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  // BATCH-GET: one call for the WHOLE page's authors — the concrete proof the
  // module boundary works. A naive `getById` per row would be an obvious N+1;
  // the boundary's public surface exists precisely to make the batched form the
  // natural one.
  const authorIds = page.map((p) => p.authorId).filter((id): id is string => id !== null)
  const authors = await getManyByIds(authorIds)

  const data = page.map((post) => toListItem(post, authors.get(post.authorId ?? '')?.name ?? null))
  const nextCursor = hasMore ? encodeCursor(sortKey, cursorTuple(page[page.length - 1], sorts)) : null
  return { data, nextCursor }
}

function toListItem(post: Post, authorName: string | null): PostListItem {
  return {
    id: post.id,
    author_id: post.authorId,
    author_name: authorName,
    title: post.title,
    body: post.body,
    created_at: post.createdAt.toISOString(),
    version: post.version
  }
}

function cursorTuple(post: Post, sorts: SortSpec[]): (string | number)[] {
  const values = sorts.map((s) => (s.column === 'created_at' ? post.createdAt.toISOString() : post.title))
  return [...values, post.id]
}
