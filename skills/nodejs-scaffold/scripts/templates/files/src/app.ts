import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { env } from './config/env.js'
import { errorHandler } from './middleware/error-handler.js'
import { healthRoutes } from './routes/health.js'
import { userRoutes } from './routes/users.js'

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL }
  })

  app.setErrorHandler(errorHandler)

  app.register(cors, {
    origin: env.corsOrigins,
    credentials: true
  })

  app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
    // trustProxy defaults to false — this server is assumed to sit directly
    // on the internet. If you put a reverse proxy in front (ALB, nginx,
    // Cloudflare), set `trustProxy: true` (or a trusted CIDR list) so rate
    // limiting keys off the real client IP, not the proxy's.
  })

  app.register(healthRoutes)
  app.register(userRoutes, { prefix: '/api/v1' })

  return app
}
