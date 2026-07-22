// The one narrow file the boundary-lint config lets shared/job-queue's relay
// import from this module. Re-exports the outbox table (defined co-located in
// the infrastructure schema) — nothing else in `users` is reachable this way.
export { outboxEvents } from './infrastructure/users.schema.js'
