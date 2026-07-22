import { eventBus } from '../../shared/event-bus/bus.js'
import { handleUserErased } from './application/handle-user-erased.js'

// posts' public surface. No other module reads posts today, so the only export
// is its event-subscription registration — called once by
// registerAllSubscriptions() before the job runner's first tick.
export function registerSubscriptions(): void {
  eventBus.subscribe('user.erased', handleUserErased)
}
