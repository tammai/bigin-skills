import {
  parseSort,
  serializeSort,
  encodeCursor,
  decodeCursor,
  hydrateCursorValues,
  type SortSpec
} from '../../../shared/pagination/cursor.js'
import { usersRepository } from '../infrastructure/users.repository.js'
import { toUserView, type UserView } from '../domain/user.entity.js'

// Allowlist: NON-NULLABLE columns only (see cursor.ts's ALLOWLIST INVARIANT).
const ALLOWED_SORTS = ['created_at', 'name'] as const
const TIMESTAMP_COLUMNS = ['created_at'] as const
const DEFAULT_SORT = '-created_at'
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export interface ListUsersInput {
  cursor?: string
  limit?: number
  sort?: string
}

export interface ListUsersResult {
  data: UserView[]
  nextCursor: string | null
}

export async function listUsers(input: ListUsersInput): Promise<ListUsersResult> {
  const limit = Math.min(Math.max(input.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)
  const sorts = parseSort(input.sort, ALLOWED_SORTS, DEFAULT_SORT)
  const sortKey = serializeSort(sorts)
  const cursorValues = input.cursor
    ? hydrateCursorValues(sorts, decodeCursor(input.cursor, sortKey), TIMESTAMP_COLUMNS)
    : null

  // Fetch limit + 1 to detect hasMore without a second count query.
  const rows = await usersRepository.list({ limit: limit + 1, sorts, cursorValues })
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const nextCursor = hasMore ? encodeCursor(sortKey, cursorTuple(page[page.length - 1], sorts)) : null
  return { data: page.map(toUserView), nextCursor }
}

function cursorTuple(user: UserView, sorts: SortSpec[]): (string | number)[] {
  const values = sorts.map((s) => (s.column === 'created_at' ? user.createdAt.toISOString() : user.name))
  return [...values, user.id]
}
