import { pgSchema, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'

// NOTE: this file is named `idempotency.schema.ts` (not `schema.ts`) so that
// drizzle.config.ts's `./src/shared/**/*.schema.ts` glob actually picks it up.
export const sharedSchema = pgSchema('shared')

export const idempotencyKeys = sharedSchema.table('idempotency_keys', {
  key: text('key').primaryKey(),
  requestHash: text('request_hash').notNull(),
  // null status = a request is still in-flight holding the lock; set on onSend.
  statusCode: integer('status_code'),
  responseBody: jsonb('response_body'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
})
