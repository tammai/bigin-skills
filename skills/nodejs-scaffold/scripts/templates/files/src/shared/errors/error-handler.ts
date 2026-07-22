import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { AppError } from './app-error.js'
import { ErrorCode } from './codes.js'

// Fixed error contract: `{ error: { code, message, request_id, details? } }`.
// request.id is already populated by the app's genReqId (see src/api/app.ts) —
// this handler just reads it, no extra plumbing.
//
// Status mapping: 400 validation/bad-request, 401 unauthenticated,
// 403 unauthorized, 404 not found, 409 conflict, 422 business-rule, 429
// rate-limited, 500 unexpected.
export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  const requestId = request.id

  if (error instanceof AppError) {
    if (error.statusCode >= 500) request.log.error({ err: error }, 'app error')
    else request.log.warn({ err: error }, 'app error')
    reply.code(error.statusCode).send({
      error: { code: error.code, message: error.message, request_id: requestId, details: error.details }
    })
    return
  }

  const fastifyErr = error as FastifyError

  // Fastify schema (TypeBox/ajv) validation failures.
  if (fastifyErr.validation) {
    request.log.warn({ err: error }, 'validation error')
    reply.code(400).send({
      error: {
        code: ErrorCode.ValidationFailed,
        message: 'request validation failed',
        request_id: requestId,
        details: fastifyErr.validation
      }
    })
    return
  }

  // Fastify's own body-parser errors (malformed JSON) and other <500 framework
  // errors arrive here too — the same path as handler-thrown errors, so none of
  // them leak raw parser/driver text to the client.
  if (typeof fastifyErr.statusCode === 'number' && fastifyErr.statusCode < 500) {
    request.log.warn({ err: error }, 'request error')
    reply.code(fastifyErr.statusCode).send({
      error: { code: mapStatusToCode(fastifyErr.statusCode), message: 'invalid request', request_id: requestId }
    })
    return
  }

  request.log.error({ err: error }, 'unhandled error')
  reply.code(500).send({
    error: { code: ErrorCode.Internal, message: 'internal server error', request_id: requestId }
  })
}

function mapStatusToCode(status: number): ErrorCode {
  switch (status) {
    case 401:
      return ErrorCode.Unauthenticated
    case 403:
      return ErrorCode.Unauthorized
    case 404:
      return ErrorCode.NotFound
    case 409:
      return ErrorCode.Conflict
    case 422:
      return ErrorCode.UnprocessableEntity
    case 429:
      return ErrorCode.RateLimited
    default:
      return ErrorCode.BadRequest
  }
}
