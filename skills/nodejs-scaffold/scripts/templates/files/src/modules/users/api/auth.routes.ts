import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { login } from '../application/login.js'
import { refresh } from '../application/refresh.js'
import { logout } from '../application/logout.js'
import { durationToSeconds } from '../../../shared/auth/tokens.js'
import { env } from '../../../shared/config/env.js'
import { ErrorResponseSchema } from '../../../shared/errors/codes.js'
import type { AuthPrincipal } from '../application/login.js'
import { LoginBody, RefreshBody, LogoutBody, TokenPairResponse } from './users.schemas.js'

// Registered at prefix /v1/auth by the composition root — every path below is
// relative to that. Self-erase lives in users.routes.ts (/v1/users/:id), not
// here — it's a users-resource operation, not an auth operation. JWT signing
// lives here (a framework concern); credential/rotation logic lives in
// application/.
export const authRoutes: FastifyPluginAsyncTypebox = async (app) => {
  function issue(principal: AuthPrincipal, refreshToken: string): {
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
  } {
    const accessToken = app.jwt.sign({ sub: principal.id, roles: principal.roles })
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: durationToSeconds(env.JWT_ACCESS_TTL)
    }
  }

  app.post(
    '/login',
    { schema: { body: LoginBody, response: { 200: TokenPairResponse, 401: ErrorResponseSchema } } },
    async (request) => {
      const result = await login(request.body.email, request.body.password)
      return issue(result.principal, result.refreshToken)
    }
  )

  app.post(
    '/refresh',
    { schema: { body: RefreshBody, response: { 200: TokenPairResponse, 401: ErrorResponseSchema } } },
    async (request) => {
      const result = await refresh(request.body.refresh_token)
      return issue(result.principal, result.refreshToken)
    }
  )

  // 204 responses declare no response schema: the TypeBox provider would
  // otherwise constrain reply.code() to the declared codes, and a 204 body
  // schema (e.g. Type.Null) is not valid OpenAPI 3.0.3 anyway.
  app.post(
    '/logout',
    { preHandler: app.authenticate, schema: { body: LogoutBody } },
    async (request, reply) => {
      await logout(request.body.refresh_token)
      return reply.code(204).send()
    }
  )
}
