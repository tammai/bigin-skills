import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof ZodError) {
    reply.code(400).send({ code: 'invalid_request', message: 'validation failed', details: error.flatten() })
    return
  }

  // Fastify's own body-parser errors (malformed JSON) arrive here too, as a
  // FastifyError with a statusCode — the same path as handler-thrown errors,
  // so neither leaks raw parser/driver text to the client.
  const fastifyErr = error as FastifyError
  if (typeof fastifyErr.statusCode === 'number' && fastifyErr.statusCode < 500) {
    request.log.warn({ err: error }, 'request error')
    reply.code(fastifyErr.statusCode).send({ code: 'bad_request', message: 'invalid request' })
    return
  }

  request.log.error({ err: error }, 'unhandled error')
  reply.code(500).send({ code: 'internal_error', message: 'internal server error' })
}
