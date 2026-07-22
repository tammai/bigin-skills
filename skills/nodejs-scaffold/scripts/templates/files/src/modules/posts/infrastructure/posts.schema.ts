import { pgSchema, uuid, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'

export const postsSchema = pgSchema('posts')

export const posts = postsSchema.table(
  'posts',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    // nullable + NOT a sort column — anonymized (set null) on user.erased. The
    // cursor allowlist never includes it (a nullable sort column breaks keyset
    // pagination — see cursor.ts).
    authorId: uuid('author_id'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at', { withTimezone: true })
  },
  (t) => [index('posts_author_idx').on(t.authorId), index('posts_created_idx').on(t.createdAt)]
)

export const outboxEvents = postsSchema.table(
  'outbox_events',
  {
    id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
    eventType: text('event_type').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    // null = eligible now; set to a future time on a retryable failure so the
    // relay backs off instead of hammering a still-failing handler every tick.
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deadLetteredAt: timestamp('dead_lettered_at', { withTimezone: true })
  },
  (t) => [index('posts_outbox_unpublished_idx').on(t.publishedAt)]
)

// Inbox (dedup) table: event_id == the producing outbox row's id. Insert-or-noop
// before acting so at-least-once delivery can't double-process an event.
export const processedEvents = postsSchema.table('processed_events', {
  eventId: uuid('event_id').primaryKey(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow()
})
