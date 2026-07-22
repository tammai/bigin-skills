// THE ONLY file other modules may import from `users`. Everything reachable
// here is deliberately narrow — never the Drizzle row, never the domain entity,
// never a repository. Enforced by eslint-plugin-boundaries.
//
// These are in-process function calls (this is a modular monolith), NOT network
// RPCs — "public surface" is a compile-time boundary, not a transport.
import { getUserById } from './application/get-user.use-case.js'
import { toPublicView, type UserPublicView } from './domain/user.entity.js'

export { createUser as create } from './application/create-user.use-case.js'
export { getManyUsersByIds as getManyByIds } from './application/get-many-users-by-ids.use-case.js'
export type { UserPublicView } from './domain/user.entity.js'

// getById wrapped down to the public view (id + name only).
export async function getById(id: string): Promise<UserPublicView | null> {
  const user = await getUserById(id)
  return user ? toPublicView(user) : null
}
