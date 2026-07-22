import type { DomainEvent, EventHandler } from './types.js'

// A genuinely tiny in-process pub/sub singleton — no broker, no network.
//
// COHERENCE CONSTRAINT: the bus has no state outside the process running it.
// Whichever process ticks the outbox relay must have ALREADY run every module's
// subscribe() calls (registerAllSubscriptions). That is exactly why the job
// runner runs in the SAME process as the API server (see src/server.ts) rather
// than a separate worker that would have to duplicate that registration.
class EventBus {
  private readonly handlers = new Map<string, EventHandler[]>()

  subscribe<T>(type: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(type) ?? []
    list.push(handler as EventHandler)
    this.handlers.set(type, list)
  }

  // Awaits every handler. A throwing handler propagates so the relay can count
  // the attempt and (eventually) dead-letter the outbox row.
  async publish(event: DomainEvent): Promise<void> {
    for (const handler of this.handlers.get(event.type) ?? []) {
      await handler(event)
    }
  }

  // Test-only: drop all subscriptions.
  reset(): void {
    this.handlers.clear()
  }
}

export const eventBus = new EventBus()
