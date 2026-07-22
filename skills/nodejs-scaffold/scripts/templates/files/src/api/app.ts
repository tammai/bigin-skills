import { randomUUID } from 'node:crypto'
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { env } from '../shared/config/env.js'
import { errorHandler } from '../shared/errors/error-handler.js'
import { registerJwt } from '../shared/auth/jwt.js'
import { registerAuthGuard } from '../shared/auth/guard.js'
import { idempotencyPlugin } from '../shared/idempotency/plugin.js'
import { registerAllSubscriptions } from '../subscriptions.js'
import { healthRoutes } from './health.routes.js'
import { usersRoutes } from '../modules/users/api/users.routes.js'
import { authRoutes } from '../modules/users/api/auth.routes.js'
import { postsRoutes } from '../modules/posts/api/posts.routes.js'

// The composition root. This file is intentionally OUTSIDE the module boundary
// elements — it is allowed to reach into every module's api plugin to wire the
// app together. Everything the boundary lint governs lives under src/modules
// and src/shared.
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    // request-id: honor an inbound x-request-id, else mint a uuid. Renames
    // Fastify's default `reqId` log key to `request_id`.
    genReqId: (req) => {
      const header = req.headers['x-request-id']
      return typeof header === 'string' && header.length > 0 ? header : randomUUID()
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'request_id'
  }).withTypeProvider<TypeBoxTypeProvider>()

  app.setErrorHandler(errorHandler)

  // Echo x-request-id back explicitly (don't rely on version-specific auto-echo).
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })

  await app.register(cors, { origin: env.corsOrigins, credentials: true })
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
    // trustProxy defaults to false — assume this server sits directly on the
    // internet. Behind a proxy (ALB/nginx/Cloudflare), set trustProxy so rate
    // limiting keys off the real client IP, not the proxy's.
  })

  // Auth must be registered on the root app before module plugins so its
  // decorators (request.jwtVerify, app.authenticate) propagate downward.
  await registerJwt(app)
  registerAuthGuard(app)
  idempotencyPlugin(app)

  // Swagger must be registered before the routes it documents.
  await app.register(swagger, {
    openapi: {
      // Pinned 3.0.3 (see the Nullable() spike). Nullable fields use the helper;
      // enums use { type, enum } — no `const`, no `type: "null"`.
      openapi: '3.0.3',
      info: { title: '{{PROJECT_NAME}} API', version: '0.1.0' }
    }
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  // Each module plugin gets its own prefix (ADR §4.1's wiring example) — the
  // users module owns two route files under two prefixes (users CRUD +
  // erase at /v1/users, auth at /v1/auth), posts owns /v1/posts.
  await app.register(healthRoutes)
  await app.register(usersRoutes, { prefix: '/v1/users' })
  await app.register(authRoutes, { prefix: '/v1/auth' })
  await app.register(postsRoutes, { prefix: '/v1/posts' })

  // Wire event-bus subscriptions so app.inject-based flows see them too. The
  // guard inside makes the server.ts call harmless.
  registerAllSubscriptions()

  return app
}
