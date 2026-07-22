import type { FastifyInstance } from 'fastify'
import { checkConnection } from '../shared/db/client.js'

// Cross-cutting, not a module: /healthz (liveness) and /readyz (readiness).
// /docs is served by @fastify/swagger-ui (registered in app.ts), replacing the
// old hand-rolled HTML page.
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  // rateLimit: false — a load balancer/orchestrator polls these every few
  // seconds; counting them against @fastify/rate-limit's global budget would
  // let health checks starve real traffic's allowance.
  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ status: 'ok' }))

  app.get('/readyz', { config: { rateLimit: false } }, async (_request, reply) => {
    const ok = await checkConnection()
    if (!ok) {
      reply.code(503)
      return { status: 'unavailable' }
    }
    return { status: 'ready' }
  })
}
