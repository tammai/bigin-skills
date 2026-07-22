import type { ErrorCode } from './codes.js'

// Domain/application code throws AppError; the error-handler maps it to the
// fixed nested error envelope. statusCode is carried explicitly so the handler
// never has to infer it from the code string.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const badRequest = (code: ErrorCode, message: string, details?: unknown): AppError =>
  new AppError(400, code, message, details)
export const unauthenticated = (code: ErrorCode, message: string): AppError =>
  new AppError(401, code, message)
export const unauthorized = (code: ErrorCode, message: string): AppError =>
  new AppError(403, code, message)
export const notFound = (code: ErrorCode, message: string): AppError =>
  new AppError(404, code, message)
export const conflict = (code: ErrorCode, message: string): AppError =>
  new AppError(409, code, message)
export const unprocessable = (code: ErrorCode, message: string, details?: unknown): AppError =>
  new AppError(422, code, message, details)
