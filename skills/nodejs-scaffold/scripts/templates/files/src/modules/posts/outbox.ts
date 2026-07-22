// The one narrow file shared/job-queue's relay may import from `posts`.
// Re-exports the outbox table defined in the module's infrastructure schema.
export { outboxEvents } from './infrastructure/posts.schema.js'
