import { and, isNull, type Column, type SQL } from 'drizzle-orm'

// The ONLY place `deleted_at IS NULL` is ever written. Every repository read
// routes through here so soft-delete filtering can't drift row-by-row.
export function notDeleted(deletedAt: Column): SQL {
  return isNull(deletedAt)
}

// Combine the not-deleted filter with an optional extra predicate.
export function whereActive(deletedAt: Column, extra?: SQL): SQL | undefined {
  return extra ? and(notDeleted(deletedAt), extra) : notDeleted(deletedAt)
}

// Raw-SQL counterpart for `queryClient.unsafe()` list() paths, which build a
// WHERE clause as a string and can't accept a Drizzle SQL builder fragment
// like notDeleted() above. Same predicate, same single source — every raw-SQL
// repository list() imports this instead of retyping the literal.
export const NOT_DELETED_RAW = 'deleted_at IS NULL'
