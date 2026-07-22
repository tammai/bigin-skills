import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { createPost } from '../application/create-post.use-case.js'
import { listPosts } from '../application/list-posts.use-case.js'
import { updatePost } from '../application/update-post.use-case.js'
import { ErrorResponseSchema } from '../../../shared/errors/codes.js'
import { PostResponse, CreatePostBody, UpdatePostBody, IdParam, ListQuery, PostListResponse } from './posts.schemas.js'

// Registered at prefix /v1/posts by the composition root — every path below
// is relative to that.
export const postsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', async (request) => {
    request.log = request.log.child({ module: 'posts' })
  })

  app.post(
    '/',
    {
      preHandler: app.authenticate,
      config: { idempotent: true },
      schema: {
        body: CreatePostBody,
        response: { 201: PostResponse, 401: ErrorResponseSchema, 403: ErrorResponseSchema }
      }
    },
    async (request, reply) => {
      const post = await createPost(request.body, request.user)
      return reply.code(201).send({
        id: post.id,
        author_id: post.authorId,
        title: post.title,
        body: post.body,
        created_at: post.createdAt.toISOString(),
        version: post.version
      })
    }
  )

  app.get(
    '/',
    {
      preHandler: app.authenticate,
      schema: { querystring: ListQuery, response: { 200: PostListResponse, 401: ErrorResponseSchema } }
    },
    async (request) => {
      const result = await listPosts(request.query)
      return { data: result.data, next_cursor: result.nextCursor }
    }
  )

  app.patch(
    '/:id',
    {
      preHandler: app.authenticate,
      config: { idempotent: true },
      schema: {
        params: IdParam,
        body: UpdatePostBody,
        response: {
          200: PostResponse,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema
        }
      }
    },
    async (request) => {
      const post = await updatePost(request.params.id, request.body, request.user)
      return {
        id: post.id,
        author_id: post.authorId,
        title: post.title,
        body: post.body,
        created_at: post.createdAt.toISOString(),
        version: post.version
      }
    }
  )
}
