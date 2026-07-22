import { and, eq } from 'drizzle-orm'
import { db, queryClient } from '../../../shared/db/client.js'
import { notDeleted, NOT_DELETED_RAW } from '../../../shared/db/soft-delete.js'
import { buildKeysetWhere, type SortSpec } from '../../../shared/pagination/cursor.js'
import { posts, processedEvents } from './posts.schema.js'
import type { Post } from '../domain/post.entity.js'

type Row = typeof posts.$inferSelect

export interface CreatePostRow {
  title: string
  body: string
  authorId: string
}

function toEntity(r: Row): Post {
  return {
    id: r.id,
    authorId: r.authorId,
    title: r.title,
    body: r.body,
    // Coerce timestamps to Date — the raw `queryClient.unsafe` list() path hands
    // timestamptz back as strings (Drizzle reconfigures the shared client's
    // timestamp parsing); new Date() is correct and idempotent for the
    // query-builder paths too. See users.repository for the full note.
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    version: r.version,
    deletedAt: r.deletedAt ? new Date(r.deletedAt) : null
  }
}

export interface UpdatePostPatch {
  title?: string
  body?: string
  updatedBy: string
}

export const postsRepository = {
  async create(input: CreatePostRow): Promise<Post> {
    const [row] = await db
      .insert(posts)
      .values({ title: input.title, body: input.body, authorId: input.authorId, createdBy: input.authorId })
      .returning()
    return toEntity(row)
  },

  async findById(id: string): Promise<Post | undefined> {
    const [row] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), notDeleted(posts.deletedAt)))
    return row ? toEntity(row) : undefined
  },

  // Optimistic concurrency (ADR §9.4): the WHERE on version = expectedVersion
  // is the atomic guard — a concurrent editor's update in between the
  // use-case's read and this call makes this affect 0 rows (returns
  // undefined), not a lost-update overwrite.
  async updateWithVersion(id: string, expectedVersion: number, patch: UpdatePostPatch): Promise<Post | undefined> {
    const set: { title?: string; body?: string; updatedAt: Date; updatedBy: string; version: number } = {
      updatedAt: new Date(),
      updatedBy: patch.updatedBy,
      version: expectedVersion + 1
    }
    if (patch.title !== undefined) set.title = patch.title
    if (patch.body !== undefined) set.body = patch.body

    const [row] = await db
      .update(posts)
      .set(set)
      .where(and(eq(posts.id, id), eq(posts.version, expectedVersion), notDeleted(posts.deletedAt)))
      .returning()
    return row ? toEntity(row) : undefined
  },

  // Cursor-paginated. Same postgres.js `unsafe` + spike-verified keyset path as
  // users.repository (see the comment there).
  async list(opts: { limit: number; sorts: SortSpec[]; cursorValues: (string | number)[] | null }): Promise<Post[]> {
    const orderBy = [...opts.sorts, { column: 'id', direction: 'asc' as const }]
      .map((s) => `${s.column} ${s.direction === 'desc' ? 'DESC' : 'ASC'}`)
      .join(', ')

    const params: (string | number)[] = []
    let where = NOT_DELETED_RAW
    if (opts.cursorValues && opts.cursorValues.length > 0) {
      const keyset = buildKeysetWhere(opts.sorts, opts.cursorValues)
      where += ` AND (${keyset.sql})`
      params.push(...keyset.params)
    }
    params.push(opts.limit)

    const query = `
      SELECT id, author_id AS "authorId", title, body,
             created_at AS "createdAt", updated_at AS "updatedAt",
             created_by AS "createdBy", updated_by AS "updatedBy",
             version, deleted_at AS "deletedAt"
      FROM posts.posts
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length}`

    const rows = (await queryClient.unsafe(query, params)) as unknown as Row[]
    return rows.map(toEntity)
  },

  // Inbox dedup: returns true only the FIRST time this event id is seen.
  async markProcessed(eventId: string): Promise<boolean> {
    const inserted = await db
      .insert(processedEvents)
      .values({ eventId })
      .onConflictDoNothing()
      .returning({ eventId: processedEvents.eventId })
    return inserted.length > 0
  },

  async anonymizeAuthor(authorId: string): Promise<void> {
    await db.update(posts).set({ authorId: null, updatedAt: new Date() }).where(eq(posts.authorId, authorId))
  }
}
