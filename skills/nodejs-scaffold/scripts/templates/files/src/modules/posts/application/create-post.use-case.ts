import { can } from '../../../shared/auth/rbac.js'
import { unauthorized } from '../../../shared/errors/app-error.js'
import { ErrorCode } from '../../../shared/errors/codes.js'
import { postsRepository } from '../infrastructure/posts.repository.js'
import type { Post } from '../domain/post.entity.js'

export interface Actor {
  sub: string
  roles: string[]
}

export interface CreatePostInput {
  title: string
  body: string
}

export async function createPost(input: CreatePostInput, actor: Actor): Promise<Post> {
  // RBAC checked in the use-case, not the route.
  if (!can(actor.roles, 'posts:write')) {
    throw unauthorized(ErrorCode.Unauthorized, 'not allowed to create posts')
  }
  return postsRepository.create({ title: input.title, body: input.body, authorId: actor.sub })
}
