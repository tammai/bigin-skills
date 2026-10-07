// A non-2xx answer from the API, reduced to what callers branch on. The API's error body
// is status-only for our purposes (it carries no machine-readable code), so the status is
// the whole contract — never surface the raw body to the user.
export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`API request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status)
}
