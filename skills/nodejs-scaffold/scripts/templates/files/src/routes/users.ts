import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { userService } from '../services/user-service.js'
import type { paths } from '../types/api.js'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1)
})

const idParamSchema = z.object({
  id: z.string().uuid()
})

type UserResponse = paths['/users']['post']['responses']['201']['content']['application/json']

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.post('/users', async (request, reply) => {
    const body = createUserSchema.parse(request.body)
    const user = await userService.create(body)
    reply.code(201).send(toResponse(user))
  })

  app.get('/users/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const user = await userService.get(id)
    if (!user) {
      reply.code(404).send({ code: 'not_found', message: 'user not found' })
      return
    }
    reply.send(toResponse(user))
  })
}

function toResponse(user: { id: string; email: string; name: string; createdAt: Date }): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.createdAt.toISOString()
  }
}
