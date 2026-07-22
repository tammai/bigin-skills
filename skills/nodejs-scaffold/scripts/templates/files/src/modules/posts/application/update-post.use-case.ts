import { conflict, notFound, unauthorized } from '../../../shared/errors/app-error.js'
import { ErrorCode } from '../../../shared/errors/codes.js'
import { postsRepository } from '../infrastructure/posts.repository.js'
import type { Post } from '../domain/post.entity.js'
import type { Actor } from './create-post.use-case.js'

export interface UpdatePostInput {
  title?: string
  body?: string
  version: number
}

// Optimistic concurrency (ADR §9.4): the caller's `version` must match the
// row's current version, or this throws 409 instead of silently overwriting
// someone else's edit. Paired with the route's `idempotent: true` (ADR §9.3's
// own cross-reference to 9.4) so a network-level retry of a SUCCESSFUL update
// replays the stored response instead of hitting a bogus 409 on retry.
export async function updatePost(id: string, input: UpdatePostInput, actor: Actor): Promise<Post> {
  const current = await postsRepository.findById(id)
  if (!current) throw notFound(ErrorCode.PostNotFound, 'post not found')

  // Ownership: only the author may edit their own post. posts:write is
  // granted to every 'user' role (see rbac.ts), so it can't be the
  // differentiator here the way it is for create.
  if (current.authorId !== actor.sub) {
    throw unauthorized(ErrorCode.Unauthorized, 'not allowed to edit this post')
  }
  if (current.version !== input.version) {
    throw conflict(ErrorCode.PostVersionConflict, 'post was modified since you last read it')
  }

  const updated = await postsRepository.updateWithVersion(id, input.version, {
    title: input.title,
    body: input.body,
    updatedBy: actor.sub
  })
  if (!updated) {
    // Lost the race between the check above and the conditional UPDATE.
    throw conflict(ErrorCode.PostVersionConflict, 'post was modified since you last read it')
  }
  return updated
}
