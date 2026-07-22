import type { DomainEvent } from '../../../shared/event-bus/types.js'
import { postsRepository } from '../infrastructure/posts.repository.js'

interface UserErasedPayload {
  userId: string
}

// The consuming half of the outbox → relay → inbox example. Subscribed to
// `user.erased` (wired in this module's index.ts). event.id == the producing
// outbox row id; markProcessed inserts it into the inbox and returns false if
// already seen — so at-least-once redelivery is a safe no-op.
export async function handleUserErased(event: DomainEvent): Promise<void> {
  const firstTime = await postsRepository.markProcessed(event.id)
  if (!firstTime) return

  const payload = event.payload as UserErasedPayload
  await postsRepository.anonymizeAuthor(payload.userId)
}
