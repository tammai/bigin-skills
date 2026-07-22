import { Type } from '@sinclair/typebox'
import { Nullable } from '../../../shared/schema/nullable.js'

// TypeBox is BOTH the runtime validator and the OpenAPI spec source — one
// declaration, no drift. Nullable fields MUST use the Nullable() helper
// (3.0.3-valid `nullable: true`), never Type.Union([T, Type.Null()]).

export const UserResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  name: Type.String(),
  created_at: Type.String({ format: 'date-time' })
})

export const CreateUserBody = Type.Object({
  email: Type.String({ format: 'email' }),
  name: Type.String({ minLength: 1 }),
  password: Type.String({ minLength: 8 })
})

export const IdParam = Type.Object({
  id: Type.String({ format: 'uuid' })
})

export const ListQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String())
})

export const UserListResponse = Type.Object({
  data: Type.Array(UserResponse),
  next_cursor: Nullable(Type.String())
})

// ── auth ──────────────────────────────────────────────────────────────────
export const LoginBody = Type.Object({
  email: Type.String({ format: 'email' }),
  password: Type.String({ minLength: 1 })
})

export const RefreshBody = Type.Object({
  refresh_token: Type.String({ minLength: 1 })
})

export const LogoutBody = Type.Object({
  refresh_token: Type.String({ minLength: 1 })
})

export const TokenPairResponse = Type.Object({
  access_token: Type.String(),
  refresh_token: Type.String(),
  // plain string, not Type.Literal — OpenAPI 3.0.3 has no `const` keyword.
  token_type: Type.String(),
  expires_in: Type.Integer()
})
