import { usersRepository } from '../infrastructure/users.repository.js'
import { toPublicView, type UserPublicView } from '../domain/user.entity.js'

// The batch-get behind users' public read-composition surface. Dedupes ids and
// issues ONE query, returning a Map keyed by id. A caller (e.g. posts'
// list-posts) uses this once per page — never once per row (that would be an
// N+1 the boundary is specifically meant to prevent).
export async function getManyUsersByIds(ids: string[]): Promise<Map<string, UserPublicView>> {
  const unique = [...new Set(ids)].filter((id) => id.length > 0)
  const result = new Map<string, UserPublicView>()
  if (unique.length === 0) return result

  const users = await usersRepository.findManyByIds(unique)
  for (const user of users) {
    result.set(user.id, toPublicView(user))
  }
  return result
}
