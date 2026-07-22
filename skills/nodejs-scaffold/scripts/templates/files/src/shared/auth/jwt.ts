import fastifyJwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import { env } from '../config/env.js'

// Access-token payload shape. Declaration-merged into @fastify/jwt so
// request.user is typed everywhere.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; roles: string[] }
    user: { sub: string; roles: string[] }
  }
}

// Registered ONCE on the root app before any module plugin. Fastify decorators
// (request.jwtVerify, app.jwt) propagate downward into child-registered plugins,
// so every module can use `preHandler: app.authenticate` with no fastify-plugin
// wrapper needed.
export async function registerJwt(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL }
  })
}
