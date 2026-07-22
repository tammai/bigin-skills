import { usersRepository } from '../infrastructure/users.repository.js'
import { toUserView, type UserView } from '../domain/user.entity.js'

// Pure fetch, no RBAC — reused both by the users API (GET /v1/users/:id) and,
// wrapped down to UserPublicView, by index.ts for cross-module reads.
export async function getUserById(id: string): Promise<UserView | null> {
  const user = await usersRepository.findById(id)
  return user ? toUserView(user) : null
}
