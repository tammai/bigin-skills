import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from '../errors/app-error.js'
import { ErrorCode } from '../errors/codes.js'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

// Decorate the root app with `authenticate` — a preHandler that verifies the
// bearer JWT and binds user_id into the request logger. Registered once; usable
// as `preHandler: app.authenticate` inside every module.
export function registerAuthGuard(app: FastifyInstance): void {
  app.decorate('authenticate', async function authenticate(request: FastifyRequest): Promise<void> {
    try {
      await request.jwtVerify()
    } catch {
      throw new AppError(401, ErrorCode.Unauthenticated, 'authentication required')
    }
    // Structured-logging binding: every log line for this request now carries
    // user_id. `module` binding is added per-module in each module's api plugin.
    request.log = request.log.child({ user_id: request.user.sub })
  })
}
