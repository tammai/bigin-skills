// A domain event as it flows outbox → relay → bus → subscriber.
// `id` == the producing outbox row's id, reused by subscribers as the inbox
// dedup key (event_id) so at-least-once delivery can't double-process.
export interface DomainEvent<T = unknown> {
  id: string
  type: string
  schemaVersion: number
  payload: T
  occurredAt: Date
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void
