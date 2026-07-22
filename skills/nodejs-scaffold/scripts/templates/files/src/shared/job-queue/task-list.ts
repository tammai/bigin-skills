import type { TaskList } from 'graphile-worker'
import { runOutboxRelay } from './tasks/outbox-relay.js'
import { cleanupExpiredIdempotencyKeys } from '../idempotency/plugin.js'

export const taskList: TaskList = {
  'outbox-relay': async () => {
    await runOutboxRelay()
  },
  'idempotency-cleanup': async () => {
    await cleanupExpiredIdempotencyKeys()
  }
}

// Graphile Worker crontab. Granularity is per-minute (Graphile crontab can't do
// sub-minute) — fine for this scaffold's latency-tolerant jobs. For lower
// outbox latency, switch to a self-rescheduling task or a short setInterval;
// documented, not built.
export const crontab = ['* * * * * outbox-relay', '0 * * * * idempotency-cleanup'].join('\n')
