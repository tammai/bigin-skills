import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { createUser } from '../application/create-user.use-case.js'
import { getUserById } from '../application/get-user.use-case.js'
import { listUsers } from '../application/list-users.use-case.js'
import { eraseUser } from '../application/erase-user.js'
import { notFound } from '../../../shared/errors/app-error.js'
import { ErrorCode } from '../../../shared/errors/codes.js'
import { ErrorResponseSchema } from '../../../shared/errors/codes.js'
import type { UserView } from '../domain/user.entity.js'
import { UserResponse, CreateUserBody, IdParam, ListQuery, UserListResponse } from './users.schemas.js'

function toResponse(user: UserView): { id: string; email: string; name: string; created_at: string } {
  return { id: user.id, email: user.email, name: user.name, created_at: user.createdAt.toISOString() }
}

// Registered at prefix /v1/users by the composition root — every path below is
// relative to that (ADR §4.1: one prefix per module).
export const usersRoutes: FastifyPluginAsyncTypebox = async (app) => {
  // Bind `module: 'users'` into every log line inside this plugin's context.
  app.addHook('onRequest', async (request) => {
    request.log = request.log.child({ module: 'users' })
  })

  // Public sign-up. Idempotent so a retried POST doesn't create duplicates.
  app.post(
    '/',
    {
      config: { idempotent: true },
      schema: {
        body: CreateUserBody,
        response: { 201: UserResponse, 409: ErrorResponseSchema, 422: ErrorResponseSchema }
      }
    },
    async (request, reply) => {
      const user = await createUser(request.body)
      return reply.code(201).send(toResponse(user))
    }
  )

  app.get(
    '/',
    {
      preHandler: app.authenticate,
      schema: { querystring: ListQuery, response: { 200: UserListResponse, 401: ErrorResponseSchema } }
    },
    async (request) => {
      const result = await listUsers(request.query)
      return { data: result.data.map(toResponse), next_cursor: result.nextCursor }
    }
  )

  app.get(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: { params: IdParam, response: { 200: UserResponse, 401: ErrorResponseSchema, 404: ErrorResponseSchema } }
    },
    async (request) => {
      const user = await getUserById(request.params.id)
      if (!user) throw notFound(ErrorCode.UserNotFound, 'user not found')
      return toResponse(user)
    }
  )

  // Self-erase (or admin with users:erase — enforced inside the use-case).
  app.delete('/:id', { preHandler: app.authenticate, schema: { params: IdParam } }, async (request, reply) => {
    await eraseUser(request.params.id, request.user)
    return reply.code(204).send()
  })
}
