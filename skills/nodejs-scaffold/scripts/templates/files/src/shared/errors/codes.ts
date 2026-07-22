import { Type } from '@sinclair/typebox'

// One registry of error codes. The same declaration below is used at runtime
// (AppError, error-handler) AND fed into the OpenAPI error-response schema, so
// there is no spec copy and code copy to drift apart. Codes are module-prefixed
// where they belong to a module (`users.*`, `posts.*`, `pagination.*`).
export const ErrorCode = {
  // generic / cross-cutting
  BadRequest: 'bad_request',
  Unauthenticated: 'unauthenticated',
  Unauthorized: 'unauthorized',
  NotFound: 'not_found',
  Conflict: 'conflict',
  UnprocessableEntity: 'unprocessable_entity',
  RateLimited: 'rate_limited',
  Internal: 'internal_error',
  ValidationFailed: 'validation_failed',
  // idempotency
  IdempotencyKeyRequired: 'idempotency_key_required',
  RequestInProgress: 'request_in_progress',
  IdempotencyKeyReused: 'idempotency_key_reused',
  // pagination
  CursorMismatch: 'pagination.cursor_mismatch',
  // users
  UserNotFound: 'users.not_found',
  UserEmailTaken: 'users.email_taken',
  InvalidCredentials: 'users.invalid_credentials',
  InvalidRefreshToken: 'users.invalid_refresh_token',
  // posts
  PostNotFound: 'posts.not_found',
  PostVersionConflict: 'posts.version_conflict'
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export const ErrorCodeValues = Object.values(ErrorCode)

// `Type.Unsafe` with an explicit `{ type, enum }` rather than `Type.Enum` on
// purpose: OpenAPI 3.0.3 has no `const` keyword, and TypeBox's `Type.Enum`
// emits `anyOf: [{ const: ... }]` — same 3.0-invalidity family as the nullable
// spike. `{ type: 'string', enum: [...] }` is valid 3.0.
export const ErrorCodeSchema = Type.Unsafe<ErrorCode>({ type: 'string', enum: [...ErrorCodeValues] })

// The fixed error envelope: nested `{ error: { ... } }` with a request_id.
// Inlined into each route's error responses (no $id / $ref — keeps the emitted
// document unambiguously OpenAPI-3.0-valid).
export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: ErrorCodeSchema,
    message: Type.String(),
    request_id: Type.String(),
    details: Type.Optional(Type.Unknown())
  })
})
