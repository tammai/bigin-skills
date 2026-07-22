import { Type, type TSchema, type Static } from '@sinclair/typebox'

// SPIKE-VERIFIED against swagger-parser@10 + @fastify/swagger@9 + a live
// app.inject(): a raw `Type.Union([T, Type.Null()])` emits
// `{"anyOf":[...,{"type":"null"}]}`, which is an INVALID OpenAPI 3.0.3 document
// (`type: "null"` isn't a legal 3.0 value). This helper emits the 3.0-legal
// `{"type":"string","nullable":true}` instead.
//
// EVERY nullable TypeBox field in every module's *.schemas.ts MUST use this —
// never a raw Type.Union([T, Type.Null()]).
//
//   usage: bio: Type.Optional(Nullable(Type.String()))
export function Nullable<T extends TSchema>(schema: T) {
  return Type.Unsafe<Static<T> | null>({ ...schema, nullable: true })
}
