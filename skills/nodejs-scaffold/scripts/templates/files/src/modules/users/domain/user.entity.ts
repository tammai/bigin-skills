// Domain model — PURE. The boundary lint forbids this file from importing
// anything local (domain → disallow *); it may reference only language/runtime
// types. Keep business invariants here, not framework or DB concerns.

export interface User {
  id: string
  email: string
  name: string
  passwordHash: string
  roles: string[]
  createdAt: Date
  updatedAt: Date
  version: number
  deletedAt: Date | null
}

// What the users API returns for its own resource.
export interface UserView {
  id: string
  email: string
  name: string
  createdAt: Date
}

// The narrow shape other modules are allowed to see (via users' index.ts).
// Never the Drizzle row, never the full domain entity.
export interface UserPublicView {
  id: string
  name: string
}

export function toUserView(user: Pick<User, 'id' | 'email' | 'name' | 'createdAt'>): UserView {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
}

export function toPublicView(user: Pick<User, 'id' | 'name'>): UserPublicView {
  return { id: user.id, name: user.name }
}
