// Static role→permission map. Deliberately NOT a DB table for a two-module
// scaffold — a documented extension point, not a gap. To move it to the DB,
// replace ROLE_PERMISSIONS with a lookup and keep the `can()` signature.
//
// `can()` is called INSIDE application/ use-cases, never in api/ handlers:
// app.authenticate only proves identity; authorization is a separate, explicit
// per-use-case check.
export type Role = 'admin' | 'user'
export type Permission = 'users:read' | 'users:write' | 'users:erase' | 'posts:read' | 'posts:write'

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ['users:read', 'users:write', 'users:erase', 'posts:read', 'posts:write'],
  user: ['users:read', 'posts:read', 'posts:write']
}

function isRole(value: string): value is Role {
  return value === 'admin' || value === 'user'
}

export function can(roles: string[], permission: Permission): boolean {
  return roles.some((r) => isRole(r) && ROLE_PERMISSIONS[r].includes(permission))
}
