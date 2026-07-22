import { Type } from '@sinclair/typebox'
import { Nullable } from '../../../shared/schema/nullable.js'

export const PostResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  // nullable via the 3.0.3-valid helper — never Type.Union([T, Type.Null()]).
  author_id: Type.Optional(Nullable(Type.String({ format: 'uuid' }))),
  author_name: Type.Optional(Nullable(Type.String())),
  title: Type.String(),
  body: Type.String(),
  created_at: Type.String({ format: 'date-time' }),
  // Row-version for optimistic concurrency (ADR §9.4) — the client sends this
  // back in PATCH's UpdatePostBody.version.
  version: Type.Integer()
})

export const CreatePostBody = Type.Object({
  title: Type.String({ minLength: 1 }),
  body: Type.String({ minLength: 1 })
})

// Optimistic concurrency (ADR §9.4): the caller must send the version it last
// read; a mismatch means someone else edited the post first and gets a 409,
// not a silent overwrite. Fields are optional (a client may only want to
// change one), but `version` itself is required.
export const UpdatePostBody = Type.Object({
  title: Type.Optional(Type.String({ minLength: 1 })),
  body: Type.Optional(Type.String({ minLength: 1 })),
  version: Type.Integer({ minimum: 1 })
})

export const IdParam = Type.Object({
  id: Type.String({ format: 'uuid' })
})

export const ListQuery = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.String())
})

export const PostListResponse = Type.Object({
  data: Type.Array(PostResponse),
  next_cursor: Nullable(Type.String())
})
