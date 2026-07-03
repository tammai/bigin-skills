import { drizzle } from 'drizzle-orm/d1'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { D1Database } from '@cloudflare/workers-types'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique()
})

// Pass the D1 binding — e.g. `useDrizzle(event.context.cloudflare.env.DB)` on Cloudflare.
export function useDrizzle(d1: D1Database) {
  return drizzle(d1, { schema: { users } })
}
