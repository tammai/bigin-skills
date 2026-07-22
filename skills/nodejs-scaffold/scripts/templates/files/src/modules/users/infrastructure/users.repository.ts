import { and, eq, inArray } from 'drizzle-orm'
import { db, queryClient } from '../../../shared/db/client.js'
import { notDeleted, NOT_DELETED_RAW } from '../../../shared/db/soft-delete.js'
import { buildKeysetWhere, type SortSpec } from '../../../shared/pagination/cursor.js'
import { users } from './users.schema.js'
import type { User } from '../domain/user.entity.js'

type Row = typeof users.$inferSelect

export interface CreateUserRow {
  email: string
  name: string
  passwordHash: string
  roles: string[]
  createdBy?: string | null
}

function toEntity(r: Row): User {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    passwordHash: r.passwordHash,
    roles: r.roles,
    // Coerce timestamps to Date. Drizzle reconfigures the shared postgres.js
    // client to hand back timestamptz columns as raw strings (it does its own
    // per-column coercion), so the raw `queryClient.unsafe` list() path below
    // returns strings here while the query-builder paths return Dates. new Date()
    // is correct and idempotent for both. (jsonb/int stay natively parsed.)
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    version: r.version,
    deletedAt: r.deletedAt ? new Date(r.deletedAt) : null
  }
}

export const usersRepository = {
  async create(input: CreateUserRow): Promise<User> {
    const [row] = await db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        roles: input.roles,
        createdBy: input.createdBy ?? null
      })
      .returning()
    return toEntity(row)
  },

  async findById(id: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), notDeleted(users.deletedAt)))
    return row ? toEntity(row) : undefined
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), notDeleted(users.deletedAt)))
    return row ? toEntity(row) : undefined
  },

  // Batch-get — the read-composition surface exposed (through index.ts) to other
  // modules. Dedupe is the caller's job (get-many-users-by-ids.use-case).
  async findManyByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return []
    const rows = await db
      .select()
      .from(users)
      .where(and(inArray(users.id, ids), notDeleted(users.deletedAt)))
    return rows.map(toEntity)
  },

  // Cursor-paginated list. Uses postgres.js `unsafe` with the spike-verified
  // keyset generator (see shared/pagination/cursor.ts). Column names come only
  // from the endpoint's allowlist, so interpolating them is safe; values are
  // parameterized. Timestamp cursor values arrive pre-hydrated to Date objects
  // (see hydrateCursorValues) so postgres.js binds them as timestamptz.
  async list(opts: { limit: number; sorts: SortSpec[]; cursorValues: (string | number)[] | null }): Promise<User[]> {
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
      SELECT id, email, name, password_hash AS "passwordHash", roles,
             created_at AS "createdAt", updated_at AS "updatedAt",
             created_by AS "createdBy", updated_by AS "updatedBy",
             version, deleted_at AS "deletedAt"
      FROM users.users
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT $${params.length}`

    const rows = (await queryClient.unsafe(query, params)) as unknown as Row[]
    return rows.map(toEntity)
  }
}
