import { uuid, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'
import { sharedSchema } from '../idempotency/idempotency.schema.js'

// Populated by the outbox relay after MAX_ATTEMPTS failed publish attempts.
// The source outbox row is ALSO flagged (dead_lettered_at) so the relay stops
// re-selecting it; this table is the queryable DLQ view for manual inspection
// — an event lands here, it is never silently dropped (ADR §8).
export const deadLetterEvents = sharedSchema.table('dead_letter_events', {
  id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
  sourceTable: text('source_table').notNull(), // e.g. "users.outbox_events"
  originalEventId: uuid('original_event_id').notNull(),
  eventType: text('event_type').notNull(),
  schemaVersion: integer('schema_version').notNull(),
  payload: jsonb('payload').notNull(),
  attempts: integer('attempts').notNull(),
  lastError: text('last_error'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true }).notNull().defaultNow()
})
